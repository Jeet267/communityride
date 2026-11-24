import { expect, it, vi } from 'vitest';
import { api, bearer } from './helpers';
import { prisma } from '../src/config/prisma';

// Capture codes instead of sending real email / SMS.
const sent = new Map<string, string>();
vi.mock('../src/modules/auth/mailer', () => ({ sendOtpEmail: async (to: string, otp: string) => { sent.set(to, otp); } }));
vi.mock('../src/modules/auth/sms', () => ({ sendOtpSms: async (to: string, otp: string) => { sent.set(to, otp); } }));

async function login(id: { email?: string; phone?: string }, loginAs?: string) {
  await api().post('/api/v1/auth/otp/request').send(id).expect(200);
  const key = (id.email ?? id.phone)!.toLowerCase();
  return api().post('/api/v1/auth/otp/verify').send({ ...id, otp: sent.get(key), loginAs });
}

it('one flow: a new email gets a code, verify creates a passenger account', async () => {
  const res = await login({ email: 'Kiran@Example.com' }); // email is normalised to lower case
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({ isNewUser: true, loginAs: 'PASSENGER', roles: ['PASSENGER'] });
  const auth = bearer({ token: res.body.data.accessToken });
  await api().patch('/api/v1/users/me').set(auth).send({ fullName: 'Kiran Rao' }).expect(200);
  const me = await api().get('/api/v1/users/me').set(auth);
  expect(me.body.data).toMatchObject({ fullName: 'Kiran Rao', email: 'kiran@example.com' });
});

it('signing in as Driver or Car owner switches that role on; signing in again reuses the account', async () => {
  const a = await login({ phone: '+919812300001' }, 'DRIVER');
  expect(a.body.data.roles.sort()).toEqual(['DRIVER', 'PASSENGER']);
  sent.clear();
  const b = await login({ phone: '+919812300001' }, 'RENTAL_OWNER');
  expect(b.body.data.isNewUser).toBe(false);
  expect(b.body.data.user.id).toBe(a.body.data.user.id);
  expect(b.body.data.roles.sort()).toEqual(['DRIVER', 'PASSENGER', 'RENTAL_OWNER']);
});

it('admin login is refused unless the account already is an admin, and creates no account', async () => {
  const res = await login({ email: 'sneaky@example.com' }, 'ADMIN');
  expect(res.status).toBe(403);
  expect(res.body.error.code).toBe('NOT_ADMIN');
  expect(await prisma.user.count({ where: { email: 'sneaky@example.com' } })).toBe(0);

  const u = await prisma.user.create({ data: { fullName: 'Ops', email: 'ops@example.com', roles: { create: [{ role: 'PASSENGER' }, { role: 'ADMIN' }] } } });
  const ok = await login({ email: 'ops@example.com' }, 'ADMIN');
  expect(ok.status).toBe(200);
  expect(ok.body.data.user.id).toBe(u.id);
  // ADMIN can never be self-assigned through the roles endpoint either.
  const self = await api().post('/api/v1/users/me/roles').set(bearer({ token: (await login({ email: 'x@example.com' })).body.data.accessToken })).send({ role: 'ADMIN' });
  expect(self.status).toBe(400);
});

it('an account with both phone and email gets the same code on both', async () => {
  await prisma.user.create({ data: { fullName: 'Asha', phone: '+919812300002', email: 'asha@example.com', roles: { create: [{ role: 'PASSENGER' }] } } });
  const r = await api().post('/api/v1/auth/otp/request').send({ phone: '+919812300002' }).expect(200);
  expect(r.body.data.sentTo).toEqual(['******0002', 'a***@example.com']);
  expect(sent.get('+919812300002')).toBe(sent.get('asha@example.com'));
});

it('one form with name, email and phone: code goes to both, verify creates the account with all three', async () => {
  const body = { phone: '+919812300003', email: 'rahul@example.com' };
  const r = await api().post('/api/v1/auth/otp/request').send(body).expect(200);
  expect(r.body.data.sentTo).toEqual(['******0003', 'r***@example.com']);
  expect(sent.get('+919812300003')).toBe(sent.get('rahul@example.com'));

  const v = await api().post('/api/v1/auth/otp/verify').send({ ...body, otp: sent.get('rahul@example.com'), fullName: 'Rahul Jain', loginAs: 'DRIVER' }).expect(200);
  expect(v.body.data.isNewUser).toBe(true);
  const u = await prisma.user.findUnique({ where: { email: 'rahul@example.com' } });
  expect(u).toMatchObject({ phone: '+919812300003', fullName: 'Rahul Jain' });
});

it('a phone from one account and an email from another is refused clearly', async () => {
  await prisma.user.create({ data: { fullName: 'A', phone: '+919812300004', roles: { create: [{ role: 'PASSENGER' }] } } });
  await prisma.user.create({ data: { fullName: 'B', email: 'b@example.com', roles: { create: [{ role: 'PASSENGER' }] } } });
  const r = await api().post('/api/v1/auth/otp/request').send({ phone: '+919812300004', email: 'b@example.com' });
  expect(r.status).toBe(409);
  expect(r.body.error.code).toBe('CONTACT_TAKEN');
});
