import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import * as svc from './bookings.service';

export const bookingsRouter = Router();
const idParam = validate({ params: z.object({ id: z.string().uuid() }) });
const bookSchema = z.object({
  seatsRequested: z.number().int().min(1).max(60),
  participants: z.array(z.object({ name: z.string().min(2).max(60), phone: z.string().regex(/^\+91[6-9]\d{9}$/).optional() })).max(60).optional(),
});

bookingsRouter.post('/rides/:rideId/bookings', authenticate,
  validate({ params: z.object({ rideId: z.string().uuid() }), body: bookSchema }),
  h(async (req, res) => ok(res, await svc.requestSeats(req.user!.id, req.params.rideId, req.body.seatsRequested,
    req.body.participants, req.header('Idempotency-Key') ?? undefined), 201)));
bookingsRouter.get('/users/me/ride-bookings', authenticate, h(async (req, res) => ok(res, await svc.myRideBookings(req.user!.id))));
bookingsRouter.get('/bookings/rides/:id', authenticate, idParam, h(async (req, res) => ok(res, await svc.getBooking(req.params.id, req.user!.id))));
bookingsRouter.post('/bookings/rides/:id/cancel', authenticate, idParam, h(async (req, res) => ok(res, await svc.cancelByPassenger(req.params.id, req.user!.id))));
bookingsRouter.post('/driver/bookings/:id/accept', authenticate, requireRole('DRIVER'), idParam, h(async (req, res) => ok(res, await svc.accept(req.params.id, req.user!.id))));
bookingsRouter.post('/driver/bookings/:id/reject', authenticate, requireRole('DRIVER'), idParam, h(async (req, res) => ok(res, await svc.reject(req.params.id, req.user!.id))));
