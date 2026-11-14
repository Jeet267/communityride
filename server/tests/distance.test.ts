import { expect, it } from 'vitest';
import { setMockDistance } from '../src/modules/routing/routing';
import { api, bearer, makeVerifiedDriver, ridePayload } from './helpers';

it.each([[500_000, 201], [500_001, 422]])('route of %i metres returns %i', async (meters, status) => {
  setMockDistance(meters);
  const d = await makeVerifiedDriver();
  const res = await api().post('/api/v1/rides').set(bearer(d)).send(ridePayload(d.vehicle.id));
  expect(res.status).toBe(status);
  if (status === 422) expect(res.body.error.code).toBe('DISTANCE_LIMIT_EXCEEDED');
  setMockDistance(270_000);
});
