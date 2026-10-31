import { BookingStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { encrypt } from '../../utils/crypto';
import { notify } from '../../utils/notify';

type Participant = { name: string; phone?: string };

export async function requestSeats(passengerId: string, rideId: string, seats: number, participants?: Participant[], idemKey?: string) {
  if (idemKey) {
    const existing = await prisma.rideBooking.findUnique({ where: { idempotencyKey: idemKey } });
    if (existing) {
      if (existing.passengerUserId !== passengerId) throw new AppError('CONFLICT', 409, 'Use a new Idempotency-Key');
      return existing;
    }
  }
  return prisma.$transaction(async tx => {
    const ride = await tx.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.status !== 'PUBLISHED' || ride.departureAt < new Date()) throw new AppError('NOT_FOUND', 404, 'This ride is no longer available');
    if (ride.driverUserId === passengerId) throw new AppError('VALIDATION_ERROR', 400, 'You cannot book your own ride');
    if (ride.type === 'GROUP_TOUR' && participants?.length !== seats) throw new AppError('VALIDATION_ERROR', 400, 'Add a name for every seat');

    // Check and decrement in ONE statement: under a race only one request can win the last seat.
    const updated = await tx.$executeRaw`
      UPDATE "Ride" SET "availableSeats" = "availableSeats" - ${seats}
      WHERE id = ${rideId}::uuid AND status = 'PUBLISHED' AND "availableSeats" >= ${seats}`;
    if (updated === 0) throw new AppError('SEATS_UNAVAILABLE', 409, 'Not enough seats left on this ride.');

    const booking = await tx.rideBooking.create({
      data: {
        rideId, passengerUserId: passengerId, seatsRequested: seats,
        pricePerSeatSnapshot: ride.pricePerSeatPaise, totalPaise: ride.pricePerSeatPaise * BigInt(seats),
        status: ride.bookingMode === 'INSTANT' ? 'CONFIRMED' : 'PENDING', idempotencyKey: idemKey,
        participants: participants?.map(p => ({ name: p.name, phoneEnc: p.phone ? encrypt(p.phone) : null })),
      },
    });
    await notify(ride.driverUserId, 'BOOKING_REQUESTED', { bookingId: booking.id, rideId, seats }, tx);
    return booking;
  });
}

type Move = { from: BookingStatus[]; to: BookingStatus; releaseSeats: boolean; byDriver: boolean; guard?: (departureAt: Date) => void };

async function transition(bookingId: string, actorId: string, m: Move) {
  return prisma.$transaction(async tx => {
    const b = await tx.rideBooking.findUnique({ where: { id: bookingId }, include: { ride: true } });
    if (!b) throw new AppError('NOT_FOUND', 404, 'Booking not found');
    if ((m.byDriver ? b.ride.driverUserId : b.passengerUserId) !== actorId) throw new AppError('FORBIDDEN', 403);
    m.guard?.(b.ride.departureAt);
    // Conditional update: a double click cannot release seats twice.
    const changed = await tx.rideBooking.updateMany({ where: { id: bookingId, status: { in: m.from } }, data: { status: m.to } });
    if (!changed.count) throw new AppError('BOOKING_STATE_CONFLICT', 409, `This booking can no longer be ${m.to.toLowerCase()}.`);
    if (m.releaseSeats) await tx.ride.update({ where: { id: b.rideId }, data: { availableSeats: { increment: b.seatsRequested } } });
    await notify(m.byDriver ? b.passengerUserId : b.ride.driverUserId, `BOOKING_${m.to}`, { bookingId, rideId: b.rideId }, tx);
    return { id: bookingId, status: m.to };
  });
}

export const accept = (id: string, driverId: string) =>
  transition(id, driverId, { from: ['PENDING'], to: 'CONFIRMED', releaseSeats: false, byDriver: true });
export const reject = (id: string, driverId: string) =>
  transition(id, driverId, { from: ['PENDING'], to: 'REJECTED', releaseSeats: true, byDriver: true });
export const cancelByPassenger = (id: string, passengerId: string) => transition(id, passengerId, {
  from: ['PENDING', 'CONFIRMED'], to: 'CANCELLED', releaseSeats: true, byDriver: false,
  guard: dep => {
    if (dep.getTime() - Date.now() < 2 * 3600_000) throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Bookings can be cancelled up to 2 hours before departure');
  },
});

export async function myRideBookings(userId: string) {
  const bookings = await prisma.rideBooking.findMany({
    where: { passengerUserId: userId }, orderBy: { createdAt: 'desc' }, take: 50,
    include: { ride: { select: { id: true, type: true, title: true, originName: true, destName: true, departureAt: true, status: true, driver: { select: { fullName: true } } } } },
  });
  const reviewed = new Set((await prisma.review.findMany({ where: { rideBookingId: { in: bookings.map(b => b.id) } } })).map(r => r.rideBookingId));
  return bookings.map(b => ({
    id: b.id, status: b.status, paymentStatus: b.paymentStatus, seats: b.seatsRequested, totalPaise: b.totalPaise,
    createdAt: b.createdAt, reviewed: reviewed.has(b.id),
    ride: { id: b.ride.id, type: b.ride.type, title: b.ride.title, origin: b.ride.originName, destination: b.ride.destName,
      departureAt: b.ride.departureAt, status: b.ride.status, driver: b.ride.driver.fullName },
  }));
}

export async function getBooking(id: string, userId: string) {
  const b = await prisma.rideBooking.findUnique({ where: { id }, include: { ride: true } });
  if (!b) throw new AppError('NOT_FOUND', 404);
  if (b.passengerUserId !== userId && b.ride.driverUserId !== userId) throw new AppError('FORBIDDEN', 403);
  return { id: b.id, status: b.status, paymentStatus: b.paymentStatus, seats: b.seatsRequested, totalPaise: b.totalPaise,
    rideId: b.rideId, origin: b.ride.originName, destination: b.ride.destName, departureAt: b.ride.departureAt };
}
