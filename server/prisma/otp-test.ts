/*
 * Sends a real test code with the providers set in server/.env, so you can check SMS and email before using the app.
 *   npm run otp:test -- you@gmail.com 9876543210
 */
import crypto from 'crypto';
import { env } from '../src/config/env';
import { sendOtpEmail } from '../src/modules/auth/mailer';
import { sendOtpSms } from '../src/modules/auth/sms';

async function main() {
  const args = process.argv.slice(2);
  const email = args.find(a => a.includes('@'));
  const digits = args.find(a => /^\+?\d{10,13}$/.test(a));
  const phone = digits ? `+91${digits.replace(/^\+?91/, '').slice(-10)}` : undefined;
  if (!email && !phone) { console.log('Usage: npm run otp:test -- you@gmail.com 9876543210'); process.exit(1); }
  console.log(`Providers → SMS: ${env.SMS_PROVIDER}, email: ${env.EMAIL_PROVIDER}`);
  if (env.SMS_PROVIDER === 'console' || env.EMAIL_PROVIDER === 'console')
    console.log('⚠️  "console" only prints the code here — set SMS_PROVIDER / EMAIL_PROVIDER in server/.env to send for real.');
  const otp = crypto.randomInt(100000, 1000000).toString();
  for (const [label, to, send] of [['Email', email, sendOtpEmail], ['SMS', phone, sendOtpSms]] as const) {
    if (!to) continue;
    try { await send(to, otp); console.log(`✅ ${label} sent to ${to} (code ${otp})`); }
    catch (e) { console.log(`❌ ${label} to ${to} failed: ${(e as Error).message}`); }
  }
}
main();
