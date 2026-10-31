import { Prisma, RentalListing, RentalStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { notify } from '../../utils/notify';
import { assertUsableVehicle } from '../vehicles/vehicles.service';
import { ChecklistInput, CreateListingInput, RentalBookingInput, RentalSearchInput } from './rentals.schema';

const listingInclude = {
  vehicle: { select: { make: true, model: true, category: true, seatCapacity: true } },
  owner: { select: { fullName: true } },
} satisfies Prisma.RentalListingInclude;
type ListingWith = Prisma.RentalListingGetPayload<{ include: typeof listingInclude }>;
const ACTIVE: RentalStatus[] = ['PENDING', 'CONFIRMED', 'ACTIVE'];

export const toListingDto = (l: ListingWith) => ({
  id: l.id, city: l.city, pickupAddress: l.pickupAddress, rentalMode: l.rentalMode, active: l.active,
  pricePerDayPaise: l.pricePerDayPaise, securityDepositPaise: l.securityDepositPaise, includedKmPerDay: l.includedKmPerDay,
  extraKmChargePaise: l.extraKmChargePaise, helmetIncluded: l.helmetIncluded, cancellationPolicy: l.cancellationPolicy,
  vehicle: `${l.vehicle.make} ${l.vehicle.model}`, category: l.vehicle.category, seats: l.vehicle.seatCapacity, owner: l.owner.fullName,
});

export function priceFor(l: RentalListing, startAt: Date, endAt: Date, meters: number) {
  const days = Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / 864e5));
  const includedKm = days * l.includedKmPerDay;
  const extraKm = Math.max(0, Math.ceil(meters / 1000) - includedKm);
  return {
    days, includedKm, extraKm,
    rentPaise: l.pricePerDayPaise * BigInt(days) + l.extraKmChargePaise * BigInt(extraKm),
    depositPaise: l.securityDepositPaise,
  };
}

export async function createListing(ownerId: string, input: CreateListingInput) {
  const v = await assertUsableVehicle(input.vehicleId, ownerId);
  if (!['CAR', 'BIKE', 'SCOOTER'].includes(v.category)) throw new AppError('VALIDATION_ERROR', 400, 'Only cars, bikes and scooters can be rented');
  if (await prisma.rentalListing.findUnique({ where: { vehicleId: v.id } })) throw new AppError('CONFLICT', 409, 'This vehicle is already listed');
  const l = await prisma.rentalListing.create({
    include: listingInclude,
    data: { ...input, ownerUserId: ownerId, pricePerDayPaise: BigInt(input.pricePerDayPaise),
      securityDepositPaise: BigInt(input.securityDepositPaise), extraKmChargePaise: BigInt(input.extraKmChargePaise) },
  });
  return toListingDto(l);
}

export async function updateListing(ownerId: string, id: string, input: Record<string, any>) {
  const l = await prisma.rentalListing.findUnique({ where: { id } });
  if (!l || l.ownerUserId !== ownerId) throw new AppError('FORBIDDEN', 403);
  const data: Record<string, any> = { ...input };
  for (const k of ['pricePerDayPaise', 'securityDepositPaise', 'extraKmChargePaise']) if (input[k] !== undefined) data[k] = BigInt(input[k]);
  return toListingDto(await prisma.rentalListing.update({ where: { id }, data, include: listingInclude }));
}

export async function myListings(ownerId: string) {
  return (await prisma.rentalListing.findMany({ where: { ownerUserId: ownerId }, include: listingInclude })).map(toListingDto);
}

export async function searchListings(q: RentalSearchInput) {
  const rows = await prisma.rentalListing.findMany({
    where: {
      active: true, city: { equals: q.city, mode: 'insensitive' }, rentalMode: q.rentalMode,
      vehicle: { verificationStatus: 'APPROVED', ...(q.category ? { category: q.category } : {}) },
      // overlap rule: A.start < B.end AND A.end > B.start
      bookings: { none: { status: { in: ACTIVE }, startAt: { lt: q.endAt }, endAt: { gt: q.startAt } } },
    },
    include: listingInclude, take: 50,
  });
  return rows.map(toListingDto);
}

export async function getListing(id: string) {
  const l = await prisma.rentalListing.findUnique({ where: { id }, include: listingInclude });
  if (!l) throw new AppError('NOT_FOUND', 404, 'Listing not found');
  return toListingDto(l);
}

export async function availability(id: string) {
  return prisma.rentalBooking.findMany({
    where: { listingId: id, status: { in: ACTIVE }, endAt: { gt: new Date() } },
    select: { startAt: true, endAt: true }, orderBy: { startAt: 'asc' }, take: 100,
  });
}

export async function bookRental(renterId: string, listingId: string, input: RentalBookingInput) {
  const l = await prisma.rentalListing.findUnique({ where: { id: listingId } });
  if (!l?.active) throw new AppError('NOT_FOUND', 404, 'Listing not found');
  if (l.ownerUserId === renterId) throw new AppError('VALIDATION_ERROR', 400, 'You cannot rent your own vehicle');
  const p = priceFor(l, input.startAt, input.endAt, input.plannedDistanceMeters);
  try {
    return await prisma.$transaction(async tx => {
      // The rental_no_overlap exclusion constraint rejects overlapping active bookings atomically.
      const b = await tx.rentalBooking.create({
        data: { listingId, vehicleId: l.vehicleId, renterUserId: renterId, startAt: input.startAt, endAt: input.endAt,
          plannedDistanceMeters: input.plannedDistanceMeters, pricePerDaySnapshot: l.pricePerDayPaise,
          depositSnapshot: p.depositPaise, totalPaise: p.rentPaise },
      });
      await notify(l.ownerUserId, 'RENTAL_REQUESTED', { bookingId: b.id }, tx);
      return { ...b, breakdown: p };
    });
  } catch (e: any) {
    if (String(e?.message).includes('rental_no_overlap')) throw new AppError('VEHICLE_UNAVAILABLE', 409, 'This vehicle is already booked for part of that time.');
    throw e;
  }
}

type Actor = 'owner' | 'renter';
async function move(id: string, userId: string, actor: Actor, from: RentalStatus[], to: RentalStatus, extra: Prisma.RentalBookingUpdateManyMutationInput = {}) {
  return prisma.$transaction(async tx => {
    const b = await tx.rentalBooking.findUnique({ where: { id }, include: { listing: true } });
    if (!b) throw new AppError('NOT_FOUND', 404, 'Booking not found');
    if ((actor === 'owner' ? b.listing.ownerUserId : b.renterUserId) !== userId) throw new AppError('FORBIDDEN', 403);
    const c = await tx.rentalBooking.updateMany({ where: { id, status: { in: from } }, data: { status: to, ...extra } });
    if (!c.count) throw new AppError('BOOKING_STATE_CONFLICT', 409, `This booking cannot be moved to ${to.toLowerCase()}`);
    await notify(actor === 'owner' ? b.renterUserId : b.listing.ownerUserId, `RENTAL_${to}`, { bookingId: id }, tx);
    return { id, status: to };
  });
}

export const acceptRental = (id: string, u: string) => move(id, u, 'owner', ['PENDING'], 'CONFIRMED');
export const rejectRental = (id: string, u: string) => move(id, u, 'owner', ['PENDING'], 'REJECTED');
export const cancelRental = (id: string, u: string) => move(id, u, 'renter', ['PENDING', 'CONFIRMED'], 'CANCELLED');
export const pickupRental = (id: string, u: string, c: ChecklistInput) =>
  move(id, u, 'owner', ['CONFIRMED'], 'ACTIVE', { pickupChecklist: { ...c, at: new Date().toISOString() } });

export async function returnRental(id: string, ownerId: string, c: ChecklistInput) {
  const b = await prisma.rentalBooking.findUnique({ where: { id }, include: { listing: true } });
  if (!b) throw new AppError('NOT_FOUND', 404);
  const startKm = (b.pickupChecklist as any)?.odometerKm;
  if (typeof startKm !== 'number') throw new AppError('BOOKING_STATE_CONFLICT', 409, 'Record pickup before return');
  const actualKm = c.odometerKm - startKm;
  if (actualKm < 0) throw new AppError('VALIDATION_ERROR', 400, 'Return odometer is lower than pickup odometer');
  const p = priceFor(b.listing, b.startAt, b.endAt, actualKm * 1000); // final bill uses real kilometres
  return move(id, ownerId, 'owner', ['ACTIVE'], 'RETURNED',
    { returnChecklist: { ...c, actualKm, extraKm: p.extraKm, at: new Date().toISOString() }, totalPaise: p.rentPaise });
}

const bookingDto = (b: any) => ({
  id: b.id, status: b.status, paymentStatus: b.paymentStatus, startAt: b.startAt, endAt: b.endAt,
  totalPaise: b.totalPaise, depositPaise: b.depositSnapshot, pickupChecklist: b.pickupChecklist, returnChecklist: b.returnChecklist,
  vehicle: `${b.listing.vehicle.make} ${b.listing.vehicle.model}`, city: b.listing.city, renter: b.renter?.fullName,
});

export async function ownerBookings(ownerId: string) {
  return (await prisma.rentalBooking.findMany({
    where: { listing: { ownerUserId: ownerId } }, orderBy: { startAt: 'asc' }, take: 100,
    include: { listing: { include: { vehicle: true } }, renter: { select: { fullName: true } } },
  })).map(bookingDto);
}

export async function myRentalBookings(userId: string) {
  return (await prisma.rentalBooking.findMany({
    where: { renterUserId: userId }, orderBy: { createdAt: 'desc' }, take: 50,
    include: { listing: { include: { vehicle: true } } },
  })).map(bookingDto);
}
