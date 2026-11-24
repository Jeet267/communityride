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

// ---------- Admin dashboard data: everything that happens on the platform ----------

const contact = (u: { email: string | null; phone: string | null }) => u.email ?? u.phone ?? '';

/** Headline numbers for the dashboard. Money is in paise. */
adminRouter.get('/admin/overview', ...admin, h(async (_req, res) => {
  const paid = { in: ['CONFIRMED', 'COMPLETED'] as const };
  const [users, drivers, ridesOpen, bookings, pendingBookings, rideRevenue, rentalRevenue, rentals, groups, vehiclesPending] = await Promise.all([
    prisma.user.count(),
    prisma.driverProfile.groupBy({ by: ['verificationStatus'], _count: true }),
    prisma.ride.count({ where: { status: { in: ['PUBLISHED', 'STARTED'] } } }),
    prisma.rideBooking.count(),
    prisma.rideBooking.count({ where: { status: 'PENDING' } }),
    prisma.rideBooking.aggregate({ _sum: { totalPaise: true }, where: { status: { in: [...paid.in] } } }),
    prisma.rentalBooking.aggregate({ _sum: { totalPaise: true }, where: { status: { in: ['CONFIRMED', 'ACTIVE', 'RETURNED'] } } }),
    prisma.rentalBooking.count(),
    prisma.groupRequest.count(),
    prisma.vehicle.count({ where: { verificationStatus: 'PENDING' } }),
  ]);
  const byStatus = Object.fromEntries(drivers.map(d => [d.verificationStatus, d._count]));
  ok(res, {
    users, ridesOpen, rideBookings: bookings, pendingRideRequests: pendingBookings, rentalBookings: rentals, groupRequests: groups,
    driversPending: byStatus.PENDING ?? 0, driversApproved: byStatus.APPROVED ?? 0, driversRejected: byStatus.REJECTED ?? 0, vehiclesPending,
    bookedValuePaise: (rideRevenue._sum.totalPaise ?? 0n) + (rentalRevenue._sum.totalPaise ?? 0n),
  });
}));

/** Every driver (not only pending): who they are, licence status, how many rides they run. */
adminRouter.get('/admin/drivers', ...admin, h(async (_req, res) => {
  const rows = await prisma.driverProfile.findMany({
    orderBy: [{ verificationStatus: 'asc' }], take: 300,
    include: { user: { select: { id: true, fullName: true, email: true, phone: true, suspended: true, createdAt: true, _count: { select: { ridesDriven: true } } } } },
  });
  ok(res, rows.map(d => ({
    id: d.id, userId: d.user.id, name: d.user.fullName, contact: contact(d.user), joinedAt: d.user.createdAt, suspended: d.user.suspended,
    licence: mask(decrypt(d.licenceNumberEnc)), licenceExpiresAt: d.licenceExpiresAt, docKey: d.licenceDocKey,
    status: d.verificationStatus, rejectionReason: d.rejectionReason, rides: d.user._count.ridesDriven,
    rating: d.ratingCount ? Number(d.ratingAverage.toFixed(1)) : null,
  })));
}));

/** Every ride request: who asked, which ride (from → to, when, driver), how many seats, how much, status. */
adminRouter.get('/admin/ride-bookings', ...admin, validate({ query: z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED']).optional() }) }),
  h(async (req, res) => {
    const rows = await prisma.rideBooking.findMany({
      where: req.query.status ? { status: req.query.status as never } : {},
      orderBy: { createdAt: 'desc' }, take: 300,
      include: {
        passenger: { select: { fullName: true, email: true, phone: true } },
        ride: { select: { originName: true, destName: true, departureAt: true, distanceMeters: true, driver: { select: { fullName: true, email: true, phone: true } } } },
      },
    });
    ok(res, rows.map(b => ({
      id: b.id, requestedAt: b.createdAt, status: b.status, paymentStatus: b.paymentStatus,
      passenger: b.passenger.fullName, passengerContact: contact(b.passenger),
      driver: b.ride.driver.fullName, driverContact: contact(b.ride.driver),
      origin: b.ride.originName, destination: b.ride.destName, departureAt: b.ride.departureAt, distanceKm: Math.round(b.ride.distanceMeters / 1000),
      seats: b.seatsRequested, pricePerSeatPaise: b.pricePerSeatSnapshot, totalPaise: b.totalPaise,
    })));
  }));

/** Every rental booking: renter, vehicle, owner, dates, amount, status. */
adminRouter.get('/admin/rental-bookings', ...admin, h(async (_req, res) => {
  const rows = await prisma.rentalBooking.findMany({
    orderBy: { createdAt: 'desc' }, take: 300,
    include: {
      renter: { select: { fullName: true, email: true, phone: true } },
      listing: { select: { city: true, owner: { select: { fullName: true } }, vehicle: { select: { make: true, model: true } } } },
    },
  });
  ok(res, rows.map(b => ({
    id: b.id, requestedAt: b.createdAt, status: b.status, paymentStatus: b.paymentStatus,
    renter: b.renter.fullName, renterContact: contact(b.renter), owner: b.listing.owner.fullName,
    vehicle: `${b.listing.vehicle.make} ${b.listing.vehicle.model}`, city: b.listing.city, startAt: b.startAt, endAt: b.endAt, totalPaise: b.totalPaise,
  })));
}));
