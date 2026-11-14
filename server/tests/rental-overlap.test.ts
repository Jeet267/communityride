import { expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { api, bearer, inDays, makeUser, makeVerifiedDriver } from './helpers';

it('only one of 5 overlapping rental bookings succeeds; back-to-back is allowed', async () => {
  const owner = await makeVerifiedDriver(5, ['RENTAL_OWNER']);
  const listing = await prisma.rentalListing.create({ data: {
    ownerUserId: owner.user.id, vehicleId: owner.vehicle.id, city: 'Gurugram', pickupAddress: 'Sector 29', rentalMode: 'SELF_DRIVE',
    pricePerDayPaise: 250000n, securityDepositPaise: 500000n, includedKmPerDay: 250, extraKmChargePaise: 1200n,
    cancellationPolicy: 'Full refund up to 24 hours before',
  } });
  const start = inDays(2);
  const end = inDays(3);
  const renters = await Promise.all(Array.from({ length: 5 }, () => makeUser()));
  const res = await Promise.all(renters.map(r => api().post(`/api/v1/rentals/${listing.id}/bookings`).set(bearer(r))
    .send({ startAt: start, endAt: end, plannedDistanceMeters: 100000 })));
  expect(res.filter(r => r.status === 201)).toHaveLength(1);
  expect(res.filter(r => r.status === 409)).toHaveLength(4);

  const next = await api().post(`/api/v1/rentals/${listing.id}/bookings`).set(bearer(renters[0]))
    .send({ startAt: end, endAt: inDays(4), plannedDistanceMeters: 0 });
  expect(next.status).toBe(201);
});

it('bills real kilometres on return', async () => {
  const owner = await makeVerifiedDriver(5, ['RENTAL_OWNER']);
  const listing = await prisma.rentalListing.create({ data: {
    ownerUserId: owner.user.id, vehicleId: owner.vehicle.id, city: 'Gurugram', pickupAddress: 'Sector 29', rentalMode: 'SELF_DRIVE',
    pricePerDayPaise: 200000n, securityDepositPaise: 0n, includedKmPerDay: 100, extraKmChargePaise: 1000n, cancellationPolicy: 'Full refund up to 24 hours before',
  } });
  const renter = await makeUser();
  const b = await api().post(`/api/v1/rentals/${listing.id}/bookings`).set(bearer(renter)).send({ startAt: inDays(1), endAt: inDays(2), plannedDistanceMeters: 50000 });
  const id = b.body.data.id;
  await api().post(`/api/v1/rental-bookings/${id}/accept`).set(bearer(owner)).expect(200);
  await api().post(`/api/v1/rental-bookings/${id}/pickup`).set(bearer(owner)).send({ odometerKm: 1000, fuelPercent: 100 }).expect(200);
  await api().post(`/api/v1/rental-bookings/${id}/return`).set(bearer(owner)).send({ odometerKm: 1150, fuelPercent: 80 }).expect(200);
  const after = await prisma.rentalBooking.findUniqueOrThrow({ where: { id } });
  expect(after.totalPaise).toBe(200000n + 50n * 1000n); // 1 day + 50 extra km
});
