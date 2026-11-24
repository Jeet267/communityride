import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { notify } from '../../utils/notify';
import { getValidatedRoute } from '../routing/routing';
import { assertVerifiedDriver } from '../drivers/drivers.service';
import { assertUsableVehicle } from '../vehicles/vehicles.service';
import { EditRideInput, PublishRideInput, SearchRidesInput, SharedRidesInput } from './rides.schema';

export const rideInclude = {
  driver: { select: { id: true, fullName: true, driverProfile: { select: { ratingAverage: true, ratingCount: true } } } },
  vehicle: { select: { make: true, model: true, category: true, seatCapacity: true } },
} satisfies Prisma.RideInclude;
type RideWith = Prisma.RideGetPayload<{ include: typeof rideInclude }>;

export const toRideDto = (r: RideWith) => ({
  id: r.id, type: r.type, title: r.title, origin: r.originName, destination: r.destName, departureAt: r.departureAt,
  distanceKm: Math.round(r.distanceMeters / 1000), durationMin: Math.round(r.durationSeconds / 60),
  totalSeats: r.totalSeats, seatsLeft: r.availableSeats, pricePerSeatPaise: r.pricePerSeatPaise,
  bookingMode: r.bookingMode, status: r.status, luggage: r.luggage,
  seatsBooked: r.totalSeats - r.availableSeats, // seats other passengers already hold: this is a shared ride
  driver: { id: r.driver.id, name: r.driver.fullName, rating: r.driver.driverProfile?.ratingAverage ?? 0, ratingCount: r.driver.driverProfile?.ratingCount ?? 0 },
  vehicle: `${r.vehicle.make} ${r.vehicle.model}`, vehicleCategory: r.vehicle.category, vehicleSeats: r.vehicle.seatCapacity,
});

const TOUR_VEHICLES = ['BUS', 'MINI_BUS', 'TEMPO_TRAVELLER'];

export async function publishRide(driverId: string, input: PublishRideInput) {
  await assertVerifiedDriver(driverId);
  const v = await assertUsableVehicle(input.vehicleId, driverId);
  if (input.type === 'GROUP_TOUR') {
    if (!TOUR_VEHICLES.includes(v.category)) throw new AppError('VALIDATION_ERROR', 400, 'Group tours need a bus, mini-bus or tempo traveller');
    if (!input.title) throw new AppError('VALIDATION_ERROR', 400, 'Give your tour a title, like "Jaipur weekend tour"');
  }
  const maxSeats = input.type === 'CARPOOL' ? v.seatCapacity - 1 : v.seatCapacity; // the driver takes one seat in a carpool
  if (input.availableSeats > maxSeats) throw new AppError('VALIDATION_ERROR', 400, `This vehicle can take ${maxSeats} passengers.`);
  const route = await getValidatedRoute(input.origin, input.destination);
  const ride = await prisma.ride.create({
    data: {
      type: input.type, title: input.title, driverUserId: driverId, vehicleId: v.id, luggage: input.luggage,
      originName: input.origin.name, originLat: input.origin.lat, originLng: input.origin.lng,
      destName: input.destination.name, destLat: input.destination.lat, destLng: input.destination.lng,
      departureAt: input.departureAt, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds,
      routeProvider: route.provider, totalSeats: input.availableSeats, availableSeats: input.availableSeats,
      pricePerSeatPaise: BigInt(input.pricePerSeatPaise), bookingMode: input.bookingMode,
    },
    include: rideInclude,
  });
  return toRideDto(ride);
}

const BOX = 0.25; // ~25 km around each point
export async function searchRides(q: SearchRidesInput) {
  const dayStart = new Date(`${q.date}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + 864e5);
  const rides = await prisma.ride.findMany({
    where: {
      type: 'CARPOOL', status: 'PUBLISHED', availableSeats: { gte: q.seats },
      departureAt: { gte: new Date(Math.max(dayStart.getTime(), Date.now())), lt: dayEnd },
      originLat: { gte: q.originLat - BOX, lte: q.originLat + BOX }, originLng: { gte: q.originLng - BOX, lte: q.originLng + BOX },
      destLat: { gte: q.destLat - BOX, lte: q.destLat + BOX }, destLng: { gte: q.destLng - BOX, lte: q.destLng + BOX },
    },
    include: rideInclude, orderBy: { departureAt: 'asc' }, take: 50,
  });
  return rides.map(toRideDto);
}

/** Cab sharing: every upcoming carpool that still has seats, soonest first. Filters match city names loosely. */
export async function listSharedRides(q: SharedRidesInput) {
  const rides = await prisma.ride.findMany({
    where: {
      type: 'CARPOOL', status: 'PUBLISHED', availableSeats: { gte: q.seats }, departureAt: { gt: new Date() },
      ...(q.from ? { originName: { contains: q.from, mode: 'insensitive' as const } } : {}),
      ...(q.to ? { destName: { contains: q.to, mode: 'insensitive' as const } } : {}),
    },
    include: rideInclude, orderBy: { departureAt: 'asc' }, take: 60,
  });
  return rides.map(toRideDto);
}

export async function listTours() {
  const rides = await prisma.ride.findMany({
    where: { type: 'GROUP_TOUR', status: 'PUBLISHED', availableSeats: { gt: 0 }, departureAt: { gt: new Date() } },
    include: rideInclude, orderBy: { departureAt: 'asc' }, take: 50,
  });
  return rides.map(toRideDto);
}

export async function getRide(id: string) {
  const r = await prisma.ride.findUnique({ where: { id }, include: rideInclude });
  if (!r) throw new AppError('NOT_FOUND', 404, 'Ride not found');
  return toRideDto(r);
}

export async function editRide(driverId: string, id: string, input: EditRideInput) {
  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride || ride.driverUserId !== driverId) throw new AppError('FORBIDDEN', 403);
  if (ride.status !== 'PUBLISHED') throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Only upcoming rides can be edited');
  const active = await prisma.rideBooking.count({ where: { rideId: id, status: { in: ['PENDING', 'CONFIRMED'] } } });
  if (active) throw new AppError('BOOKING_STATE_CONFLICT', 409, 'This ride already has bookings. Cancel it and publish a new one instead.');
  const data: Prisma.RideUpdateInput = {};
  if (input.departureAt) data.departureAt = input.departureAt;
  if (input.pricePerSeatPaise !== undefined) data.pricePerSeatPaise = BigInt(input.pricePerSeatPaise);
  if (input.origin || input.destination) {
    const o = input.origin ?? { name: ride.originName, lat: ride.originLat, lng: ride.originLng };
    const d = input.destination ?? { name: ride.destName, lat: ride.destLat, lng: ride.destLng };
    const route = await getValidatedRoute(o, d); // endpoints changed: recalculate distance (PRD)
    Object.assign(data, {
      originName: o.name, originLat: o.lat, originLng: o.lng, destName: d.name, destLat: d.lat, destLng: d.lng,
      distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, routeProvider: route.provider,
    });
  }
  return toRideDto(await prisma.ride.update({ where: { id }, data, include: rideInclude }));
}

export async function cancelRide(driverId: string, id: string, reason: string) {
  return prisma.$transaction(async tx => {
    const ride = await tx.ride.findUnique({ where: { id } });
    if (!ride || ride.driverUserId !== driverId) throw new AppError('FORBIDDEN', 403);
    const c = await tx.ride.updateMany({ where: { id, status: 'PUBLISHED' }, data: { status: 'CANCELLED', cancelReason: reason } });
    if (!c.count) throw new AppError('BOOKING_STATE_CONFLICT', 409, 'This ride has already started or been cancelled');
    const affected = await tx.rideBooking.findMany({ where: { rideId: id, status: { in: ['PENDING', 'CONFIRMED'] } } });
    await tx.rideBooking.updateMany({ where: { rideId: id, status: { in: ['PENDING', 'CONFIRMED'] } }, data: { status: 'CANCELLED' } });
    for (const b of affected) await notify(b.passengerUserId, 'RIDE_CANCELLED', { rideId: id, reason }, tx);
  });
}
