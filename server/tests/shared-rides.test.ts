import { expect, it } from 'vitest';
import { api, bearer, makeRide, makeUser, makeVerifiedDriver } from './helpers';

it('cab sharing: after one passenger books, the ride still lists for others with seats booked, car and luggage', async () => {
  const driver = await makeVerifiedDriver(5);
  const ride = await makeRide(driver, 4, 'INSTANT');
  const first = await makeUser();
  await api().post(`/api/v1/rides/${ride.id}/bookings`).set(bearer(first)).send({ seatsRequested: 1 }).expect(201);

  const list = await api().get('/api/v1/rides/shared?from=guru&to=JAIPUR').expect(200); // loose, case-insensitive city match
  expect(list.body.data[0]).toMatchObject({
    id: ride.id, origin: 'Gurugram', destination: 'Jaipur', totalSeats: 4, seatsLeft: 3, seatsBooked: 1,
    luggage: 'MEDIUM', vehicleCategory: 'CAR', vehicleSeats: 5, pricePerSeatPaise: 45000,
  });

  // A second passenger joins the same car (that is the "shared" part).
  const second = await makeUser();
  await api().post(`/api/v1/rides/${ride.id}/bookings`).set(bearer(second)).send({ seatsRequested: 2 }).expect(201);
  const after = await api().get(`/api/v1/rides/${ride.id}`).expect(200);
  expect(after.body.data).toMatchObject({ seatsLeft: 1, seatsBooked: 3 });

  // Asking for more seats than are left hides the ride.
  expect((await api().get('/api/v1/rides/shared?seats=2').expect(200)).body.data).toHaveLength(0);
});

it('a driver can set the luggage allowed per seat when publishing', async () => {
  const driver = await makeVerifiedDriver(5);
  const res = await api().post('/api/v1/rides').set(bearer(driver)).send({
    vehicleId: driver.vehicle.id, origin: { name: 'Delhi', lat: 28.61, lng: 77.21 }, destination: { name: 'Agra', lat: 27.18, lng: 78.01 },
    departureAt: new Date(Date.now() + 864e5).toISOString(), availableSeats: 3, pricePerSeatPaise: 40000, luggage: 'LARGE',
  });
  expect(res.status).toBe(201);
  expect(res.body.data.luggage).toBe('LARGE');
});
