import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { sha256, randomToken } from '../../utils/crypto';
import { signAccess } from '../../utils/jwt';
import { logger } from '../../utils/logger';
import { sendOtpSms } from './sms';
import { sendOtpEmail } from './mailer';
import type { Role } from '@prisma/client';
import { verifyPassword } from '../../utils/password';

type Identifier = { phone?: string; email?: string };
type OtpRecord = { hash: string; expires: number; tries: number; sentAt: number };
export type LoginRole = Role;

// In-memory store: fine for one server instance (local, or one Render instance). Multi-instance → Redis (Day 5 plan).
const otpStore = new Map<string, OtpRecord>();
const DEMO_PHONE_PREFIX = '+91900000';      // seeded demo phones
const DEMO_EMAIL_DOMAIN = '@ridemate.demo'; // seeded demo emails
const OTP_TTL_MS = 5 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;
// Roles a person may switch on for themselves at login. ADMIN is only ever granted by an existing admin / the seed.
const SELF_SERVICE: Role[] = ['PASSENGER', 'DRIVER', 'RENTAL_OWNER', 'FLEET_OPERATOR'];

// The code is stored under the phone when one is given, else under the email (request and verify send the same fields).
const keyOf = (id: Identifier) => (id.phone ? `phone:${id.phone}` : `email:${id.email}`);
const isDemo = (id: Identifier) =>
  !!env.DEMO_OTP && (id.phone ? id.phone.startsWith(DEMO_PHONE_PREFIX) : !!id.email?.endsWith(DEMO_EMAIL_DOMAIN));

/** The account(s) that already use this phone or email. Two different accounts = the person mixed up their details. */
async function findAccount(id: Identifier) {
  const or = [...(id.phone ? [{ phone: id.phone }] : []), ...(id.email ? [{ email: id.email }] : [])];
  const users = await prisma.user.findMany({ where: { OR: or }, include: { roles: true } });
  if (users.length > 1)
    throw new AppError('CONTACT_TAKEN', 409, 'This phone number and email belong to two different accounts. Use one of them.');
  return users[0] ?? null;
}
const mask = (v: string) => (v.includes('@') ? v.replace(/^(.).*(@.*)$/, '$1***$2') : `******${v.slice(-4)}`);

/**
 * Creates ONE code, stores only its hash, and sends it to every contact the account has:
 * SMS to the phone AND email to the address. Succeeds if at least one channel delivered it.
 */
async function issueOtp(id: Identifier, sendTo: Identifier) {
  const key = keyOf(id);
  const prev = otpStore.get(key);
  if (prev && Date.now() - prev.sentAt < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - prev.sentAt)) / 1000);
    throw new AppError('OTP_COOLDOWN', 429, `Please wait ${wait}s before requesting another code.`);
  }
  const demo = isDemo(id);
  const otp = demo ? env.DEMO_OTP! : crypto.randomInt(100000, 1000000).toString();
  otpStore.set(key, { hash: sha256(otp), expires: Date.now() + OTP_TTL_MS, tries: 0, sentAt: Date.now() });
  if (demo) return { sentTo: [mask(id.email ?? id.phone!)], demo: true }; // demo accounts: fixed code, nothing is sent

  const jobs: [string, Promise<void>][] = [];
  if (sendTo.phone) jobs.push([sendTo.phone, sendOtpSms(sendTo.phone, otp)]);
  if (sendTo.email) jobs.push([sendTo.email, sendOtpEmail(sendTo.email, otp)]);
  const results = await Promise.allSettled(jobs.map(([, job]) => job));
  const sentTo = jobs.filter((_, i) => results[i].status === 'fulfilled').map(([to]) => mask(to));
  results.forEach((r, i) => r.status === 'rejected' && logger.error({ err: r.reason, to: mask(jobs[i][0]) }, 'OTP delivery failed'));
  if (!sentTo.length) {
    otpStore.delete(key);
    throw new AppError('OTP_SEND_FAILED', 503, 'We could not send the code right now. Try again in a minute.');
  }
  return { sentTo, demo: false };
}

/**
 * One flow for sign-in AND sign-up (like Ola / Uber): send a code to the email or phone.
 * An existing account gets the code on BOTH its phone and email; a new one on what was typed.
 */
export async function requestOtp(id: Identifier) {
  const existing = await findAccount(id);
  // Send to what was typed plus whatever the account already has: one code, SMS + email.
  const sendTo = { phone: id.phone ?? existing?.phone ?? undefined, email: id.email ?? existing?.email ?? undefined };
  return issueOtp(id, sendTo);
}

export async function issueTokens(userId: string) {
  const roles = (await prisma.userRoleRow.findMany({ where: { userId } })).map(r => r.role);
  const refreshToken = randomToken();
  await prisma.refreshToken.create({ data: { userId, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + 7 * 864e5) } });
  return { accessToken: signAccess({ sub: userId, roles }), refreshToken, roles };
}

/**
 * Checks the code, then applies the role the person chose on the login screen ("Sign in as …"):
 *  - ADMIN: allowed only if the account already is an admin (never created or granted here).
 *  - DRIVER / RENTAL_OWNER / FLEET_OPERATOR: switched on for the account if missing (they still need
 *    admin verification before they can publish rides or list vehicles).
 *  - PASSENGER: every account has it.
 */
export async function verifyOtp(id: Identifier, otp: string, fullName?: string, loginAs: Role = 'PASSENGER') {
  const key = keyOf(id);
  const rec = otpStore.get(key);
  if (!rec || rec.expires < Date.now()) throw new AppError('OTP_INVALID', 401, 'That code has expired. Request a new one.');
  rec.tries += 1;
  if (rec.tries > 5) {
    otpStore.delete(key);
    throw new AppError('OTP_LOCKED', 429, 'Too many attempts. Request a new code.');
  }
  if (rec.hash !== sha256(otp)) throw new AppError('OTP_INVALID', 401, 'That code is wrong.');
  otpStore.delete(key);

  const existing = await findAccount(id);
  if (existing?.suspended) throw new AppError('FORBIDDEN', 403, 'This account is suspended');

  if (loginAs === 'ADMIN' && !existing?.roles.some(r => r.role === 'ADMIN'))
    throw new AppError('NOT_ADMIN', 403, 'This account is not an admin. Choose another role to sign in.');

  // Existing account: fill in a phone/email it doesn't have yet. New account: create it with everything given.
  const isNewUser = !existing;
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: {
        ...(id.phone && !existing.phone ? { phone: id.phone } : {}),
        ...(id.email && !existing.email ? { email: id.email } : {}),
        ...(fullName?.trim() && existing.fullName === 'New user' ? { fullName: fullName.trim() } : {}),
      } })
    : await prisma.user.create({ data: {
        phone: id.phone, email: id.email, fullName: fullName?.trim() || 'New user', roles: { create: [{ role: 'PASSENGER' }] },
      } });
  if (SELF_SERVICE.includes(loginAs) && loginAs !== 'PASSENGER') {
    await prisma.userRoleRow.upsert({
      where: { userId_role: { userId: user.id, role: loginAs } }, create: { userId: user.id, role: loginAs }, update: {},
    });
  }
  return { user: { id: user.id, fullName: user.fullName }, isNewUser, loginAs, ...(await issueTokens(user.id)) };
}

/** Admin sign-in with email + password. Same error for "no such email" and "wrong password", so emails can't be probed. */
export async function passwordLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email }, include: { roles: true } });
  if (!user || !verifyPassword(password, user.passwordHash))
    throw new AppError('INVALID_CREDENTIALS', 401, 'Email or password is wrong.');
  if (!user.roles.some(r => r.role === 'ADMIN')) throw new AppError('NOT_ADMIN', 403, 'Password sign-in is only for admins. Use OTP.');
  if (user.suspended) throw new AppError('FORBIDDEN', 403, 'This account is suspended');
  return { user: { id: user.id, fullName: user.fullName }, isNewUser: false, loginAs: 'ADMIN' as Role, ...(await issueTokens(user.id)) };
}

/** Refresh-token rotation with reuse detection. */
export async function refresh(token: string) {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row || row.expiresAt < new Date() || row.user.suspended) throw new AppError('UNAUTHENTICATED', 401, 'Please sign in again');
  if (row.revokedAt) {
    // An already-used token came back: treat as stolen and end every session for this user.
    await prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw new AppError('UNAUTHENTICATED', 401, 'Please sign in again');
  }
  const used = await prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!used.count) throw new AppError('UNAUTHENTICATED', 401, 'Please sign in again');
  return issueTokens(row.userId);
}

export async function logout(token: string) {
  await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
}
