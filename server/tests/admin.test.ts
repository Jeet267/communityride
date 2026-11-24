import { expect, it } from 'vitest';
import { api, bearer, makeRide, makeUser, makeVerifiedDriver } from './helpers';
import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/utils/password';
import { encrypt } from '../src/utils/crypto';

const adminLogin = (email: string, password: string) => api().post('/api/v1/auth/password/login').send({ email, password });

it('admin signs in with email + password; wrong password and non-admins are refused', async () => {
  await prisma.user.create({ data: { fullName: 'Jeet', email: 'jeet123@gmail.com', passwordHash: hashPassword('Jeet123@'),
    roles: { create: [{ role: 'PASSENGER' }, { role: 'ADMIN' }] } } });

  const ok = await adminLogin('Jeet123@gmail.com', 'Jeet123@'); // email is case-insensitive
  expect(ok.status).toBe(200);
  expect(ok.body.data).toMatchObject({ loginAs: 'ADMIN' });
  expect(ok.body.data.roles).toContain('ADMIN');

  const wrong = await adminLogin('jeet123@gmail.com', 'nope');
  expect(wrong.status).toBe(401);
  expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  expect((await adminLogin('nobody@gmail.com', 'Jeet123@')).status).toBe(401); // same answer: emails can't be probed

  await prisma.user.create({ data: { fullName: 'Pax', email: 'pax@gmail.com', passwordHash: hashPassword('Secret123'), roles: { create: [{ role: 'PASSENGER' }] } } });
  expect((await adminLogin('pax@gmail.com', 'Secret123')).body.error.code).toBe('NOT_ADMIN');
});

it('admin dashboard shows who requested which ride, how many persons and the amount; other roles are blocked', async () => {
  const admin = await makeUser(['PASSENGER', 'ADMIN']);
  const driver = await makeVerifiedDriver(4);
  const ride = await makeRide(driver, 4, 'APPROVAL');
  const pax = await makeUser();
  await api().post(`/api/v1/rides/${ride.id}/bookings`).set(bearer(pax)).send({ seatsRequested: 2 }).expect(201);

  const list = await api().get('/api/v1/admin/ride-bookings').set(bearer(admin)).expect(200);
  expect(list.body.data[0]).toMatchObject({ origin: 'Gurugram', destination: 'Jaipur', seats: 2, totalPaise: 90000, status: 'PENDING' });

  const pending = await api().get('/api/v1/admin/ride-bookings?status=CONFIRMED').set(bearer(admin)).expect(200);
  expect(pending.body.data).toHaveLength(0);

  const overview = await api().get('/api/v1/admin/overview').set(bearer(admin)).expect(200);
  expect(overview.body.data).toMatchObject({ pendingRideRequests: 1, driversApproved: 1 });

  expect((await api().get('/api/v1/admin/ride-bookings').set(bearer(pax))).status).toBe(403);
  expect((await api().get('/api/v1/admin/drivers').set(bearer(driver))).status).toBe(403);
});

it('a new driver shows in the admin driver list as PENDING, and approval unlocks publishing', async () => {
  const admin = await makeUser(['PASSENGER', 'ADMIN']);
  const d = await makeUser(['PASSENGER', 'DRIVER']);
  const profile = await prisma.driverProfile.create({ data: { userId: d.user.id, licenceNumberEnc: encrypt('DL0420230009999'), licenceExpiresAt: new Date(Date.now() + 9e10) } });

  const drivers = await api().get('/api/v1/admin/drivers').set(bearer(admin)).expect(200);
  expect(drivers.body.data.find((x: { id: string }) => x.id === profile.id)).toMatchObject({ status: 'PENDING', licence: '***********9999' });

  await api().post(`/api/v1/admin/verifications/driver/${profile.id}/approve`).set(bearer(admin)).send({}).expect(200);
  const me = await api().get('/api/v1/users/me').set(bearer(d)).expect(200);
  expect(me.body.data.driverStatus).toBe('APPROVED');
});
