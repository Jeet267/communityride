import { expect, it } from 'vitest';
import { api, bearer, makeRide, makeUser, makeVehicle, makeVerifiedDriver, ridePayload } from './helpers';

it('blocks an unverified driver from publishing', async () => {
  const d = await makeUser(['PASSENGER', 'DRIVER']);
  const v = await makeVehicle(d.user.id, 'CAR', 5);
  const res = await api().post('/api/v1/rides').set(bearer(d)).send(ridePayload(v.id));
  expect(res.status).toBe(403);
  expect(res.body.error.code).toBe('DRIVER_NOT_VERIFIED');
});

it("stops a driver from accepting another driver's booking", async () => {
  const owner = await makeVerifiedDriver();
  const other = await makeVerifiedDriver();
  const ride = await makeRide(owner, 3, 'APPROVAL');
  const p = await makeUser();
  const booking = await api().post(`/api/v1/rides/${ride.id}/bookings`).set(bearer(p)).send({ seatsRequested: 1 });
  const res = await api().post(`/api/v1/driver/bookings/${booking.body.data.id}/accept`).set(bearer(other));
  expect(res.status).toBe(403);
});

it('locks OTP after 5 wrong attempts', async () => {
  const phone = '+919812345678';
  await api().post('/api/v1/auth/otp/request').send({ phone }).expect(200);
  for (let i = 0; i < 5; i++) expect((await api().post('/api/v1/auth/otp/verify').send({ phone, otp: '000000' })).status).toBe(401);
  expect((await api().post('/api/v1/auth/otp/verify').send({ phone, otp: '000000' })).status).toBe(429);
});

it('rejects a refresh token that was already used', async () => {
  const phone = '+919000000099'; // demo prefix → DEMO_OTP
  await api().post('/api/v1/auth/otp/request').send({ phone });
  const login = await api().post('/api/v1/auth/otp/verify').send({ phone, otp: '123456', fullName: 'Rotation Test' });
  expect(login.status).toBe(200);
  const first = login.body.data.refreshToken;
  expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: first })).status).toBe(200);
  expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: first })).status).toBe(401);
});
