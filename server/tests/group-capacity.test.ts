import { expect, it } from 'vitest';
import { api, bearer, inDays, makeUser, makeVehicle, makeVerifiedDriver } from './helpers';

async function setup() {
  const organizer = await makeUser();
  const operator = await makeUser(['PASSENGER', 'FLEET_OPERATOR']);
  const bus = await makeVehicle(operator.user.id, 'BUS', 35);
  const t12 = await makeVehicle(operator.user.id, 'TEMPO_TRAVELLER', 12);
  const t17 = await makeVehicle(operator.user.id, 'TEMPO_TRAVELLER', 17);
  const d1 = await makeVerifiedDriver();
  const d2 = await makeVerifiedDriver();
  const created = await api().post('/api/v1/group-requests').set(bearer(organizer)).send({
    origin: { name: 'Gurugram', lat: 28.45, lng: 77.02 }, destination: { name: 'Jaipur', lat: 26.91, lng: 75.78 },
    departureAt: inDays(3), returnAt: inDays(4), passengerCount: 50,
  });
  expect(created.status).toBe(201);
  const id = created.body.data.id;
  const quote = await api().post(`/api/v1/fleet/group-requests/${id}/quotes`).set(bearer(operator)).send({
    totalPricePaise: 9_000_000, vehiclePlan: 'Bus 35 + Tempo 17', cancellationTerms: 'Full refund up to 7 days before', validUntil: inDays(2),
  });
  expect(quote.status).toBe(201);
  await api().post(`/api/v1/group-requests/${id}/quotes/${quote.body.data.id}/accept`).set(bearer(organizer)).expect(200);
  return { organizer, operator, bus, t12, t17, d1, d2, id };
}

it('blocks confirm at 47/50, then confirms at 52 seats with drivers', async () => {
  const s = await setup();
  const allocate = (rows: { vehicleId: string; assignedPassengers: number }[]) =>
    api().post(`/api/v1/fleet/group-requests/${s.id}/allocations`).set(bearer(s.operator)).send({ allocations: rows });
  const confirm = () => api().post(`/api/v1/group-requests/${s.id}/confirm`).set(bearer(s.organizer));

  const a1 = await allocate([{ vehicleId: s.bus.id, assignedPassengers: 35 }, { vehicleId: s.t12.id, assignedPassengers: 12 }]);
  expect(a1.body.data.shortBy).toBe(3);
  const c1 = await confirm();
  expect(c1.status).toBe(422);
  expect(c1.body.error.code).toBe('GROUP_CAPACITY_INSUFFICIENT');
  expect(c1.body.error.details.assigned).toBe(47);

  const a2 = await allocate([{ vehicleId: s.bus.id, assignedPassengers: 35 }, { vehicleId: s.t17.id, assignedPassengers: 15 }]);
  expect(a2.body.data.shortBy).toBe(0);
  const c2 = await confirm();
  expect(c2.status).toBe(422);
  expect(c2.body.error.code).toBe('DRIVER_NOT_ASSIGNED');

  const [x, y] = a2.body.data.allocations;
  await api().post(`/api/v1/fleet/group-requests/${s.id}/driver-assignments`).set(bearer(s.operator))
    .send({ assignments: [{ allocationId: x.id, driverUserId: s.d1.user.id }, { allocationId: y.id, driverUserId: s.d2.user.id }] }).expect(200);
  const c3 = await confirm();
  expect(c3.status).toBe(200);
  expect(c3.body.data.status).toBe('CONFIRMED');
});

it('rejects a vehicle with more passengers than seats', async () => {
  const s = await setup();
  const res = await api().post(`/api/v1/fleet/group-requests/${s.id}/allocations`).set(bearer(s.operator))
    .send({ allocations: [{ vehicleId: s.t12.id, assignedPassengers: 20 }] });
  expect(res.status).toBe(400);
});

it('rejects the same bus on an overlapping second group', async () => {
  const s = await setup();
  await api().post(`/api/v1/fleet/group-requests/${s.id}/allocations`).set(bearer(s.operator))
    .send({ allocations: [{ vehicleId: s.bus.id, assignedPassengers: 35 }] }).expect(200);

  const second = await api().post('/api/v1/group-requests').set(bearer(s.organizer)).send({
    origin: { name: 'Gurugram', lat: 28.45, lng: 77.02 }, destination: { name: 'Agra', lat: 27.17, lng: 78.0 },
    departureAt: inDays(3), returnAt: inDays(4), passengerCount: 20,
  });
  const q = await api().post(`/api/v1/fleet/group-requests/${second.body.data.id}/quotes`).set(bearer(s.operator))
    .send({ totalPricePaise: 3_000_000, vehiclePlan: 'Bus 35', cancellationTerms: 'Full refund up to 7 days before', validUntil: inDays(2) });
  await api().post(`/api/v1/group-requests/${second.body.data.id}/quotes/${q.body.data.id}/accept`).set(bearer(s.organizer)).expect(200);
  const clash = await api().post(`/api/v1/fleet/group-requests/${second.body.data.id}/allocations`).set(bearer(s.operator))
    .send({ allocations: [{ vehicleId: s.bus.id, assignedPassengers: 20 }] });
  expect(clash.status).toBe(409);
  expect(clash.body.error.code).toBe('VEHICLE_UNAVAILABLE');
});
