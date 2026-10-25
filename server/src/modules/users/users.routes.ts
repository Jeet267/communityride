import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';

export const usersRouter = Router();

async function meDto(id: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id },
    include: { roles: true, driverProfile: { select: { verificationStatus: true, rejectionReason: true } } },
  });
  return {
    id: u.id, fullName: u.fullName, phone: u.phone, email: u.email, roles: u.roles.map(r => r.role),
    driverStatus: u.driverProfile?.verificationStatus ?? null, driverRejectionReason: u.driverProfile?.rejectionReason ?? null,
  };
}

usersRouter.get('/users/me', authenticate, h(async (req, res) => ok(res, await meDto(req.user!.id))));

usersRouter.patch('/users/me', authenticate,
  validate({ body: z.object({ fullName: z.string().min(2).max(60).optional(), email: z.string().email().optional() }) }),
  h(async (req, res) => {
    await prisma.user.update({ where: { id: req.user!.id }, data: req.body });
    ok(res, await meDto(req.user!.id));
  }));

// ADMIN cannot be self-assigned; admins only come from the seed.
usersRouter.post('/users/me/roles', authenticate,
  validate({ body: z.object({ role: z.enum(['DRIVER', 'RENTAL_OWNER', 'FLEET_OPERATOR']) }) }),
  h(async (req, res) => {
    await prisma.userRoleRow.upsert({
      where: { userId_role: { userId: req.user!.id, role: req.body.role } },
      create: { userId: req.user!.id, role: req.body.role }, update: {},
    });
    ok(res, await meDto(req.user!.id)); // client then calls /auth/refresh so the new role is in the token
  }));
