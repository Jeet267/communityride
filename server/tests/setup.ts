import 'dotenv/config';
import { execSync } from 'child_process';
import { beforeAll, beforeEach } from 'vitest';

// Tests run against a separate real Postgres database (race conditions only show up on a real DB).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.ROUTING_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';
process.env.DEMO_OTP = process.env.DEMO_OTP ?? '123456';

const g = globalThis as any;
beforeAll(() => {
  if (!g.__migrated) {
    execSync('npx prisma migrate reset --force --skip-seed', { stdio: 'ignore', env: process.env });
    g.__migrated = true;
  }
});

beforeEach(async () => {
  const { prisma } = await import('../src/config/prisma');
  await prisma.$executeRawUnsafe('TRUNCATE "User", "Payment", "Review", "AuditLog" CASCADE');
});
