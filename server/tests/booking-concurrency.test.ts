import { expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { api, bearer, makeRide, makeUser, makeVerifiedDriver } from './helpers';

it('only one of 10 parallel requests gets the last seat', async () => {
  const d = await makeVerifiedDriver();
  const ride = await makeRide(d, 1);
  const passengers = await Promise.all(Array.from({ length: 10 }, () => makeUser()));
  const results = await Promise.all(passengers.map(p =>
    api().post(`/api/v1/rides/${ride.id}/bookings`).set(bearer(p)).send({ seatsRequested: 1 })));
  expect(results.filter(r => r.status === 201)).toHaveLength(1);
  expect(results.filter(r => r.status === 409)).toHaveLength(9);
  expect((await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } })).availableSeats).toBe(0);
});

it('returns the same booking for a repeated Idempotency-Key', async () => {
  const d = await makeVerifiedDriver();
  const ride = await makeRide(d, 3);
  const p = await makeUser();
  const send = () => api().post(`/api/v1/rides/${ride.id}/bookings`).set(bearer(p)).set('Idempotency-Key', 'key-123').send({ seatsRequested: 1 });
  const a = await send();
  const b = await send();
  expect(a.body.data.id).toBe(b.body.data.id);
  expect((await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } })).availableSeats).toBe(2);
});

it('releases seats once when a pending booking is rejected twice', async () => {
  const d = await makeVerifiedDriver();
  const ride = await makeRide(d, 3, 'APPROVAL');
  const p = await makeUser();
  const booking = await api().post(`/api/v1/rides/${ride.id}/bookings`).set(bearer(p)).send({ seatsRequested: 2 });
  const [r1, r2] = await Promise.all([1, 2].map(() => api().post(`/api/v1/driver/bookings/${booking.body.data.id}/reject`).set(bearer(d))));
  expect([r1.status, r2.status].sort()).toEqual([200, 409]);
  expect((await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } })).availableSeats).toBe(3);
});
