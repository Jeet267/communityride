import { Router } from 'express';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import { decrypt, mask } from '../../utils/crypto';
import { notify } from '../../utils/notify';
import { toVehicleDto } from '../vehicles/vehicles.service';
import { DOC_KEY } from '../uploads/uploads.routes';

export const adminRouter = Router();
const admin = [authenticate, requireRole('ADMIN')];

adminRouter.get('/admin/verifications', ...admin, h(async (_req, res) => {
  const [drivers, vehicles] = await Promise.all([
    prisma.driverProfile.findMany({ where: { verificationStatus: 'PENDING' }, include: { user: { select: { fullName: true } } } }),
    prisma.vehicle.findMany({ where: { verificationStatus: 'PENDING' }, include: { owner: { select: { fullName: true } } } }),
  ]);
  ok(res, {
    drivers: drivers.map(d => ({ id: d.id, name: d.user.fullName, licence: mask(decrypt(d.licenceNumberEnc)),
      licenceExpiresAt: d.licenceExpiresAt, docKey: d.licenceDocKey })),
    vehicles: vehicles.map(v => ({ ...toVehicleDto(v), owner: v.owner.fullName, rcDocKey: v.rcDocKey, insuranceDocKey: v.insuranceDocKey })),
  });
}));

adminRouter.post('/admin/verifications/:kind/:id/:decision', ...admin,
  validate({
    params: z.object({ kind: z.enum(['driver', 'vehicle']), id: z.string().uuid(), decision: z.enum(['approve', 'reject']) }),
    body: z.object({ reason: z.string().max(200).optional() }),
  }),
  h(async (req, res) => {
    const { kind, id, decision } = req.params as { kind: 'driver' | 'vehicle'; id: string; decision: string };
    const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
    if (status === 'REJECTED' && !req.body.reason) throw new AppError('VALIDATION_ERROR', 400, 'Add a reason so the user knows what to fix');
    await prisma.$transaction(async tx => {
      const ownerId = kind === 'driver'
        ? (await tx.driverProfile.update({ where: { id }, data: { verificationStatus: status, rejectionReason: req.body.reason ?? null } })).userId
        : (await tx.vehicle.update({ where: { id }, data: { verificationStatus: status } })).ownerUserId;
      await tx.auditLog.create({ data: { actorId: req.user!.id, action: `${kind}.${status}`, entityType: kind, entityId: id, metadata: { reason: req.body.reason } } });
      await notify(ownerId, `${kind.toUpperCase()}_${status}`, { id, reason: req.body.reason }, tx);
    });
    ok(res, { status });
  }));

// Private documents are only streamed to admins; the key regex blocks path traversal.
adminRouter.get('/admin/documents/:key', ...admin, h(async (req, res) => {
  if (!DOC_KEY.test(req.params.key)) throw new AppError('NOT_FOUND', 404);
  res.sendFile(path.resolve(env.UPLOAD_DIR, req.params.key));
}));

adminRouter.get('/admin/group-requests', ...admin, h(async (_req, res) => ok(res, (await prisma.groupRequest.findMany({
  orderBy: { createdAt: 'desc' }, take: 100, include: { organizer: { select: { fullName: true } } },
})).map(r => ({ id: r.id, origin: r.originName, destination: r.destName, departureAt: r.departureAt,
  passengerCount: r.passengerCount, status: r.status, organizer: r.organizer.fullName })))));

adminRouter.get('/admin/audit-logs', ...admin, h(async (_req, res) =>
  ok(res, await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }))));

adminRouter.post('/admin/users/:id/suspend', ...admin, validate({ params: z.object({ id: z.string().uuid() }) }),
  h(async (req, res) => {
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.params.id }, data: { suspended: true } }),
      prisma.refreshToken.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.auditLog.create({ data: { actorId: req.user!.id, action: 'user.SUSPENDED', entityType: 'user', entityId: req.params.id } }),
    ]);
    ok(res, { suspended: true });
  }));
