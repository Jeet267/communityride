import crypto from 'crypto';

/** Password hashing with Node's built-in scrypt. Stored as "scrypt$<salt>$<hash>"; the plain password is never stored. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  const [algo, salt, hash] = (stored ?? '').split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const given = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected); // constant-time compare
}
