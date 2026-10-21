import crypto from 'crypto';
import { env } from '../config/env';

const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');

/** AES-256-GCM: licence, registration and phone numbers are encrypted at rest. */
export function encrypt(plain: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}
export function decrypt(payload: string) {
  const [iv, tag, enc] = payload.split('.').map(s => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
export const mask = (s: string) => '*'.repeat(Math.max(0, s.length - 4)) + s.slice(-4);
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = () => crypto.randomBytes(48).toString('base64url');
