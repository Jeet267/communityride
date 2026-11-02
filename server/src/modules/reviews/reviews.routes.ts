import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export const reviewsRouter = Router();

reviewsRouter.post('/reviews', authenticate,
  validate({ body: z.object({ rideBookingId: z.string().uuid(), rating: z.number().int().min(1).max(5), comment: z.string().max(500).optional() }) }),
  h(async (req, res) => {
    const b = await prisma.rideBooking.findUnique({ where: { id: req.body.rideBookingId }, include: { ride: true } });
    if (!b || b.passengerUserId !== req.user!.id) throw new AppError('NOT_FOUND', 404, 'Booking not found');
    if (b.status !== 'COMPLETED') throw new AppError('BOOKING_STATE_CONFLICT', 409, 'You can review after the trip is completed');
    const driverId = b.ride.driverUserId;
    const review = await prisma.$transaction(async tx => {
      const r = await tx.review.create({ data: { rideBookingId: b.id, reviewerId: req.user!.id, revieweeId: driverId, rating: req.body.rating, comment: req.body.comment } });
      const agg = await tx.review.aggregate({ where: { revieweeId: driverId }, _avg: { rating: true }, _count: true });
      await tx.driverProfile.update({ where: { userId: driverId }, data: { ratingAverage: Number((agg._avg.rating ?? 0).toFixed(2)), ratingCount: agg._count } });
      return r;
    });
    ok(res, review, 201);
  }));

reviewsRouter.get('/users/:userId/reviews', h(async (req, res) =>
  ok(res, await prisma.review.findMany({ where: { revieweeId: req.params.userId }, orderBy: { createdAt: 'desc' }, take: 20,
    select: { rating: true, comment: true, createdAt: true } }))));
