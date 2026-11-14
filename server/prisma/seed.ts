/* Demo data. Run with `npx prisma migrate reset` (re-creates DB + seeds) or `npm run db:seed` on an empty DB. */
import { Role, VehicleCategory } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { encrypt } from '../src/utils/crypto';
const days = (n: number, hourIst = 7) => {
  const d = new Date(Date.now() + n * 864e5);
  d.setUTCHours(hourIst - 6, 30, 0, 0); // hourIst:00 IST = (hourIst - 5:30) UTC
  return d;
};

async function user(phone: string, fullName: string, roles: Role[]) {
  return prisma.user.upsert({ where: { phone }, update: { fullName }, create: { phone, fullName, roles: { create: roles.map(role => ({ role })) } } });
}
async function driver(userId: string) {
  await prisma.driverProfile.upsert({ where: { userId }, update: {}, create: {
    userId, licenceNumberEnc: encrypt('DL0420190001234'), licenceExpiresAt: new Date('2031-01-01'), verificationStatus: 'APPROVED',
  } });
}
const vehicle = (ownerUserId: string, category: VehicleCategory, make: string, model: string, seatCapacity: number, reg: string) =>
  prisma.vehicle.create({ data: { ownerUserId, category, make, model, seatCapacity, registrationEnc: encrypt(reg), verificationStatus: 'APPROVED' } });

async function main() {
  if (await prisma.ride.count()) { console.log('Database already has data. Run `npx prisma migrate reset` to reseed.'); return; }

  await user('+919000000001', 'RideMate Admin', ['PASSENGER', 'ADMIN']);
  const ravi = await user('+919000000002', 'Ravi Sharma', ['PASSENGER', 'DRIVER']);
  await driver(ravi.id);
  const priya = await user('+919000000003', 'Priya Verma', ['PASSENGER']);
  const arjun = await user('+919000000004', 'Arjun Mehta', ['PASSENGER', 'RENTAL_OWNER']);
  const fleet = await user('+919000000005', 'Shree Travels', ['PASSENGER', 'FLEET_OPERATOR']);
  const neha = await user('+919000000006', 'Neha Gupta', ['PASSENGER']);
  const fleetDrivers = [];
  for (const [i, name] of ['Mohan Lal', 'Suresh Yadav', 'Imran Khan'].entries()) {
    const d = await user(`+91900000001${i}`, name, ['PASSENGER', 'DRIVER']);
    await driver(d.id);
    fleetDrivers.push(d);
  }

  const dzire = await vehicle(ravi.id, 'CAR', 'Maruti', 'Dzire', 5, 'HR26AB1234');
  const creta = await vehicle(arjun.id, 'CAR', 'Hyundai', 'Creta', 5, 'HR26CD5678');
  const activa = await vehicle(arjun.id, 'SCOOTER', 'Honda', 'Activa', 2, 'HR26EF9012');
  const bus45 = await vehicle(fleet.id, 'BUS', 'Volvo', '9400 Bus', 45, 'HR55BU0001');
  await vehicle(fleet.id, 'BUS', 'Tata', 'Starbus 35', 35, 'HR55BU0002');
  await vehicle(fleet.id, 'TEMPO_TRAVELLER', 'Force', 'Traveller 17', 17, 'HR55TT0003');
  await vehicle(fleet.id, 'TEMPO_TRAVELLER', 'Force', 'Traveller 12', 12, 'HR55TT0004');

  const carpools = [
    ['Gurugram', 28.4595, 77.0266, 'Jaipur', 26.9124, 75.7873, 268000, 45000],
    ['Delhi', 28.6139, 77.209, 'Agra', 27.1767, 78.0081, 233000, 40000],
    ['Gurugram', 28.4595, 77.0266, 'Chandigarh', 30.7333, 76.7794, 262000, 50000],
  ] as const;
  const rides = [];
  for (const [o, olat, olng, d, dlat, dlng, m, price] of carpools) {
    rides.push(await prisma.ride.create({ data: {
      driverUserId: ravi.id, vehicleId: dzire.id, originName: o, originLat: olat, originLng: olng,
      destName: d, destLat: dlat, destLng: dlng, departureAt: days(1), distanceMeters: m, durationSeconds: Math.round(m / 16),
      routeProvider: 'seed', totalSeats: 4, availableSeats: 4, pricePerSeatPaise: BigInt(price), bookingMode: 'APPROVAL',
    } }));
  }

  // Priya has one confirmed booking on the Agra ride.
  await prisma.$transaction([
    prisma.ride.update({ where: { id: rides[1].id }, data: { availableSeats: { decrement: 1 } } }),
    prisma.rideBooking.create({ data: { rideId: rides[1].id, passengerUserId: priya.id, seatsRequested: 1,
      pricePerSeatSnapshot: 40000n, totalPaise: 40000n, status: 'CONFIRMED' } }),
  ]);

  // Mode B: an open group tour on the 45-seater.
  await prisma.ride.create({ data: {
    type: 'GROUP_TOUR', title: 'Jaipur weekend heritage tour', driverUserId: fleetDrivers[0].id, vehicleId: bus45.id,
    originName: 'Gurugram', originLat: 28.4595, originLng: 77.0266, destName: 'Jaipur', destLat: 26.9124, destLng: 75.7873,
    departureAt: days(6), distanceMeters: 268000, durationSeconds: 19000, routeProvider: 'seed',
    totalSeats: 45, availableSeats: 45, pricePerSeatPaise: 120000n, bookingMode: 'INSTANT',
  } });

  for (const [v, price, km] of [[creta, 250000n, 250], [activa, 50000n, 120]] as const) {
    await prisma.rentalListing.create({ data: {
      ownerUserId: arjun.id, vehicleId: v.id, city: 'Gurugram', pickupAddress: 'Sector 29, Gurugram', rentalMode: 'SELF_DRIVE',
      pricePerDayPaise: price, securityDepositPaise: price * 2n, includedKmPerDay: km, extraKmChargePaise: 1000n,
      helmetIncluded: v.category === 'SCOOTER', cancellationPolicy: 'Full refund up to 24 hours before pickup.',
    } });
  }

  // Mode A: Neha's 50-person request with one quote from Shree Travels.
  const group = await prisma.groupRequest.create({ data: {
    organizerUserId: neha.id, originName: 'Gurugram', destName: 'Jaipur', departureAt: days(10, 6), returnAt: days(12, 20),
    distanceMeters: 268000, passengerCount: 50, luggageNotes: '50 medium bags', vehiclePreference: 'BUS_OR_MULTIPLE_VEHICLES',
    budgetTotalPaise: 25000000n,
  } });
  await prisma.groupQuote.create({ data: {
    groupRequestId: group.id, operatorUserId: fleet.id, totalPricePaise: 21000000n, vehiclePlan: '1 bus (35) + 1 tempo traveller (17)',
    inclusions: 'Fuel, tolls, driver allowance', cancellationTerms: 'Full refund up to 7 days before departure.', validUntil: days(8),
  } });

  console.log('Seeded. Demo OTP 123456 for phones +919000000001 … +919000000012');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
