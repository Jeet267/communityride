import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { onboardingSchema } from './drivers.schema';
import { submitOnboarding } from './drivers.service';

export const driversRouter = Router();

driversRouter.post('/drivers/onboarding', authenticate, validate({ body: onboardingSchema }),
  h(async (req, res) => ok(res, await submitOnboarding(req.user!.id, req.body), 201)));

driversRouter.get('/drivers/me/status', authenticate, h(async (req, res) => {
  const p = await prisma.driverProfile.findUnique({ where: { userId: req.user!.id } });
  ok(res, p ? { verificationStatus: p.verificationStatus, rejectionReason: p.rejectionReason, licenceExpiresAt: p.licenceExpiresAt } : null);
}));
