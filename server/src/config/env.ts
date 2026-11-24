import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64),
  CLIENT_ORIGIN: z.string().min(1), // comma-separated list of allowed origins
  ROUTING_PROVIDER: z.enum(['osrm', 'mock']).default('osrm'),
  MAX_JOURNEY_METERS: z.coerce.number().default(500_000),
  DEMO_OTP: z.string().length(6).optional(),
  TRIP_START_WINDOW_MINUTES: z.coerce.number().default(60),
  UPLOAD_DIR: z.string().default('uploads-private'),

  // OTP delivery
  SMS_PROVIDER: z.enum(['console', 'fast2sms', 'twilio', 'msg91']).default('console'),
  FAST2SMS_API_KEY: z.string().optional(), // fast2sms.com → Dev API → API key (Quick SMS route, no DLT)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(), // your Twilio number, e.g. +1415xxxxxxx
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),

  // Email OTP delivery
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'resend']).default('console'),
  MAIL_FROM: z.string().default('RideMate <no-reply@ridemate.dev>'),
  SMTP_HOST: z.string().optional(),            // e.g. smtp.gmail.com
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),            // your Gmail address
  SMTP_PASS: z.string().optional(),            // Gmail App Password (16 chars), not your normal password
  RESEND_API_KEY: z.string().optional(),

  // Admin account created by `npm run admin:create` (and by the seed). Admins sign in with email + password.
  ADMIN_EMAIL: z.string().trim().toLowerCase().email().optional(),
  ADMIN_PASSWORD: z.string().min(8, 'Use at least 8 characters').optional(),
}).superRefine((e, ctx) => {
  const need = (keys: (keyof typeof e)[]) => keys.forEach(k => !e[k] && ctx.addIssue({ code: 'custom', path: [k], message: `Required when SMS_PROVIDER=${e.SMS_PROVIDER}` }));
  if (e.SMS_PROVIDER === 'fast2sms') need(['FAST2SMS_API_KEY']);
  if (e.SMS_PROVIDER === 'twilio') need(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM']);
  if (e.SMS_PROVIDER === 'msg91') need(['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID']);
  const needMail = (keys: (keyof typeof e)[]) => keys.forEach(k => !e[k] && ctx.addIssue({ code: 'custom', path: [k], message: `Required when EMAIL_PROVIDER=${e.EMAIL_PROVIDER}` }));
  if (e.EMAIL_PROVIDER === 'smtp') needMail(['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']);
  if (e.EMAIL_PROVIDER === 'resend') needMail(['RESEND_API_KEY']);
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Readable message instead of a raw ZodError stack — the usual cause is a missing server/.env file.
  console.error('\n❌ Invalid or missing environment variables:');
  for (const i of parsed.error.issues) console.error(`   • ${i.path.join('.')}: ${i.message}`);
  console.error('\n   Fix: cd server && cp .env.example .env  (then fill in the values)\n');
  process.exit(1);
}
export const env = parsed.data;
