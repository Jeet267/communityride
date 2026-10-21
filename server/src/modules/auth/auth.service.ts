import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { sha256, randomToken } from '../../utils/crypto';
import { signAccess } from '../../utils/jwt';
import { logger } from '../../utils/logger';

type OtpRecord = { hash: string; expires: number; tries: number };
// In-memory for the demo (single instance). After the demo this moves to Redis — see README "After the demo".
const otpStore = new Map<string, OtpRecord>();
const DEMO_PREFIX = '+91900000'; // DEMO_OTP only works for seeded demo phones

export function requestOtp(phone: string) {
  const otp = env.DEMO_OTP && phone.startsWith(DEMO_PREFIX) ? env.DEMO_OTP : crypto.randomInt(100000, 1000000).toString();
  otpStore.set(phone, { hash: sha256(otp), expires: Date.now() + 5 * 60_000, tries: 0 });
  if (env.NODE_ENV !== 'production') logger.info(`OTP for ****${phone.slice(-4)}: ${otp}`);
  // Production: call an SMS provider (MSG91 / Twilio) here.
}

export async function issueTokens(userId: string) {
  const roles = (await prisma.userRoleRow.findMany({ where: { userId } })).map(r => r.role);
  const refreshToken = randomToken();
  await prisma.refreshToken.create({ data: { userId, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + 7 * 864e5) } });
  return { accessToken: signAccess({ sub: userId, roles }), refreshToken, roles };
}

export async function verifyOtp(phone: string, otp: string, fullName?: string) {
  const rec = otpStore.get(phone);
  if (!rec || rec.expires < Date.now()) throw new AppError('OTP_INVALID', 401, 'That code has expired. Request a new one.');
  rec.tries += 1;
  if (rec.tries > 5) {
    otpStore.delete(phone);
    throw new AppError('OTP_LOCKED', 429, 'Too many attempts. Request a new code.');
  }
  if (rec.hash !== sha256(otp)) throw new AppError('OTP_INVALID', 401, 'That code is wrong.');
  otpStore.delete(phone);

  const user = await prisma.user.upsert({
    where: { phone },
    create: { phone, fullName: fullName?.trim() || 'New user', roles: { create: [{ role: 'PASSENGER' }] } },
    update: {},
  });
  if (user.suspended) throw new AppError('FORBIDDEN', 403, 'This account is suspended');
  return { user: { id: user.id, fullName: user.fullName }, ...(await issueTokens(user.id)) };
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
