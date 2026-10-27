import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { notify } from '../../utils/notify';

async function ownRide(rideId: string, driverId: string) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride || ride.driverUserId !== driverId) throw new AppError('FORBIDDEN', 403, 'This is not your trip');
  return ride;
}

export async function saveChecklist(rideId: string, driverId: string, list: { tyresOk: boolean; fuelOk: boolean; documentsOk: boolean; notes?: string }) {
  const ride = await ownRide(rideId, driverId);
  if (ride.status !== 'PUBLISHED') throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Checklist is for trips that have not started');
  if (!list.tyresOk || !list.fuelOk || !list.documentsOk) throw new AppError('VALIDATION_ERROR', 400, 'Fix tyres, fuel and documents before you start');
  await prisma.ride.update({ where: { id: rideId }, data: { checklist: { ...list, checkedAt: new Date().toISOString() } } });
  return { checklistDone: true };
}

export async function startTrip(rideId: string, driverId: string) {
  const ride = await ownRide(rideId, driverId);
  if (!ride.checklist) throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Complete the pre-trip checklist first');
  if (ride.departureAt.getTime() - Date.now() > env.TRIP_START_WINDOW_MINUTES * 60_000)
    throw new AppError('BOOKING_STATE_CONFLICT', 409, 'It is too early to start this trip');
  const c = await prisma.ride.updateMany({ where: { id: rideId, status: 'PUBLISHED' }, data: { status: 'STARTED' } });
  if (!c.count) throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Trip already started or cancelled');
  return { status: 'STARTED' };
}

export async function completeTrip(rideId: string, driverId: string) {
  await ownRide(rideId, driverId);
  return prisma.$transaction(async tx => {
    const c = await tx.ride.updateMany({ where: { id: rideId, status: 'STARTED' }, data: { status: 'COMPLETED' } });
    if (!c.count) throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Start the trip before completing it');
    const done = await tx.rideBooking.findMany({ where: { rideId, status: 'CONFIRMED' } });
    await tx.rideBooking.updateMany({ where: { rideId, status: 'CONFIRMED' }, data: { status: 'COMPLETED' } });
    await tx.rideBooking.updateMany({ where: { rideId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    for (const b of done) await notify(b.passengerUserId, 'TRIP_COMPLETED', { bookingId: b.id, askReview: true }, tx);
    return { status: 'COMPLETED' };
  });
}

export async function dashboard(driverId: string) {
  const [rides, earned, assignments] = await Promise.all([
    prisma.ride.findMany({
      where: { driverUserId: driverId, status: { in: ['PUBLISHED', 'STARTED'] } }, orderBy: { departureAt: 'asc' },
      include: {
        vehicle: { select: { make: true, model: true } },
        bookings: { where: { status: { in: ['PENDING', 'CONFIRMED'] } }, include: { passenger: { select: { fullName: true } } } },
      },
    }),
    prisma.rideBooking.aggregate({ _sum: { totalPaise: true }, where: { status: 'COMPLETED', ride: { driverUserId: driverId } } }),
    prisma.driverAssignment.findMany({
      where: { driverUserId: driverId, active: true, allocation: { quote: { request: { status: 'CONFIRMED' } } } },
      include: { allocation: { include: { vehicle: true, quote: { include: { request: true } } } } },
    }),
  ]);
  const gross = earned._sum.totalPaise ?? 0n;
  return {
    earningsPaise: (gross * 9n) / 10n, // 10% platform fee
    rides: rides.map(r => ({
      id: r.id, type: r.type, title: r.title, origin: r.originName, destination: r.destName, departureAt: r.departureAt,
      status: r.status, seatsLeft: r.availableSeats, totalSeats: r.totalSeats, pricePerSeatPaise: r.pricePerSeatPaise,
      vehicle: `${r.vehicle.make} ${r.vehicle.model}`, checklistDone: !!r.checklist,
      bookings: r.bookings.map(b => ({ id: b.id, passenger: b.passenger.fullName, seats: b.seatsRequested, status: b.status, totalPaise: b.totalPaise })),
    })),
    groupTrips: assignments.map(a => ({
      requestId: a.allocation.quote.request.id, origin: a.allocation.quote.request.originName,
      destination: a.allocation.quote.request.destName, departureAt: a.allocation.startAt,
      vehicle: `${a.allocation.vehicle.make} ${a.allocation.vehicle.model}`, passengers: a.allocation.assignedPassengers,
    })),
  };
}
