import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { encrypt } from '../../utils/crypto';
import { Db } from '../../utils/notify';
import { OnboardingInput } from './drivers.schema';

export async function submitOnboarding(userId: string, input: OnboardingInput) {
  return prisma.$transaction(async tx => {
    await tx.userRoleRow.upsert({ where: { userId_role: { userId, role: 'DRIVER' } }, create: { userId, role: 'DRIVER' }, update: {} });
    const data = {
      licenceNumberEnc: encrypt(input.licenceNumber), licenceDocKey: input.licenceDocKey,
      licenceExpiresAt: input.licenceExpiresAt, verificationStatus: 'PENDING' as const, rejectionReason: null,
    };
    const p = await tx.driverProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return { verificationStatus: p.verificationStatus };
  });
}

/** Reused by ride publishing and group driver assignment. */
export async function assertVerifiedDriver(userId: string, db: Db = prisma) {
  const p = await db.driverProfile.findUnique({ where: { userId } });
  if (!p || p.verificationStatus !== 'APPROVED') throw new AppError('DRIVER_NOT_VERIFIED', 403, 'Your driver profile is not verified yet.');
  if (p.licenceExpiresAt < new Date()) throw new AppError('DRIVER_NOT_VERIFIED', 403, 'Your driving licence has expired.');
}
