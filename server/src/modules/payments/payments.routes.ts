import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { AppError } from '../../utils/AppError';

const orderSchema = z.object({
  bookingType: z.enum(['RIDE', 'RENTAL', 'GROUP']),
  bookingId: z.string().uuid(),
  purpose: z.enum(['FULL', 'ADVANCE', 'BALANCE']).default('FULL'),
});
type OrderInput = z.infer<typeof orderSchema>;

/** The amount always comes from the database, never from the client. */
async function resolveAmount(userId: string, o: OrderInput): Promise<bigint> {
  if (o.bookingType === 'RIDE') {
    const b = await prisma.rideBooking.findUnique({ where: { id: o.bookingId } });
    if (!b || b.passengerUserId !== userId) throw new AppError('NOT_FOUND', 404, 'Booking not found');
    if (b.status !== 'CONFIRMED') throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Pay after the driver confirms your booking');
    if (b.paymentStatus === 'PAID') throw new AppError('BOOKING_STATE_CONFLICT', 409, 'This booking is already paid');
    return b.totalPaise;
  }
  if (o.bookingType === 'RENTAL') {
    const b = await prisma.rentalBooking.findUnique({ where: { id: o.bookingId } });
    if (!b || b.renterUserId !== userId) throw new AppError('NOT_FOUND', 404, 'Booking not found');
    if (b.status !== 'CONFIRMED') throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Pay after the owner confirms your booking');
    if (b.paymentStatus === 'PAID') throw new AppError('BOOKING_STATE_CONFLICT', 409, 'This booking is already paid');
    return b.totalPaise + b.depositSnapshot;
  }
  const r = await prisma.groupRequest.findUnique({ where: { id: o.bookingId }, include: { quotes: { where: { status: 'ACCEPTED' } } } });
  if (!r || r.organizerUserId !== userId) throw new AppError('NOT_FOUND', 404, 'Group request not found');
  if (r.status !== 'CONFIRMED' || !r.quotes[0]) throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Pay after the group booking is confirmed');
  const total = r.quotes[0].totalPricePaise;
  const paid = (await prisma.payment.aggregate({ _sum: { amountPaise: true },
    where: { bookingType: 'GROUP', bookingId: r.id, status: 'CAPTURED' } }))._sum.amountPaise ?? 0n;
  if (o.purpose === 'ADVANCE') {
    if (paid > 0n) throw new AppError('BOOKING_STATE_CONFLICT', 409, 'The advance is already paid');
    return (total * 30n) / 100n;
  }
  if (o.purpose === 'BALANCE') {
    if (paid === 0n) throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Pay the advance first');
    if (total - paid <= 0n) throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Nothing left to pay');
    return total - paid;
  }
  throw new AppError('VALIDATION_ERROR', 400, 'Group payments are ADVANCE or BALANCE');
}

export const paymentsRouter = Router();

// Mock gateway: captures immediately. Razorpay replaces the create + adds a verified webhook.
paymentsRouter.post('/payments/orders', authenticate, validate({ body: orderSchema }), h(async (req, res) => {
  const key = req.header('Idempotency-Key');
  if (!key) throw new AppError('VALIDATION_ERROR', 400, 'Idempotency-Key header is required');
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey: key } });
  if (existing) return ok(res, existing);
  const { bookingType, bookingId, purpose } = req.body as OrderInput;
  const amountPaise = await resolveAmount(req.user!.id, req.body);
  const payment = await prisma.$transaction(async tx => {
    const p = await tx.payment.create({ data: { userId: req.user!.id, bookingType, bookingId, purpose, amountPaise, status: 'CAPTURED', idempotencyKey: key } });
    if (bookingType === 'RIDE') await tx.rideBooking.update({ where: { id: bookingId }, data: { paymentStatus: 'PAID' } });
    if (bookingType === 'RENTAL') await tx.rentalBooking.update({ where: { id: bookingId }, data: { paymentStatus: 'PAID' } });
    return p;
  });
  ok(res, payment, 201);
}));

paymentsRouter.get('/payments/:id', authenticate, h(async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!p || p.userId !== req.user!.id) throw new AppError('NOT_FOUND', 404);
  ok(res, p);
}));
