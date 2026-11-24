/* Creates or updates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD in server/.env.  Run: npm run admin:create */
import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';
import { hashPassword } from '../src/utils/password';

export async function createAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set in server/.env — skipping admin account.');
    return;
  }
  const passwordHash = hashPassword(env.ADMIN_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: { passwordHash, suspended: false },
    create: { email: env.ADMIN_EMAIL, fullName: 'RideMate Admin', passwordHash },
  });
  for (const role of ['PASSENGER', 'ADMIN'] as const) {
    await prisma.userRoleRow.upsert({ where: { userId_role: { userId: user.id, role } }, create: { userId: user.id, role }, update: {} });
  }
  console.log(`Admin ready: ${env.ADMIN_EMAIL} (sign in at /login → Admin → email + password)`);
}

if (require.main === module) {
  createAdmin().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
}
