import request from 'supertest';
import { randomUUID } from 'crypto';
import { Role, VehicleCategory } from '@prisma/client';
import { buildApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { signAccess } from '../src/utils/jwt';
import { encrypt } from '../src/utils/crypto';

export const app = buildApp();
export const api = () => request(app);
export const bearer = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });
export const inDays = (d: number) => new Date(Date.now() + d * 864e5);

export async function makeUser(roles: Role[] = ['PASSENGER']) {
  const user = await prisma.user.create({ data: { phone: `t-${randomUUID()}`, fullName: 'Test User', roles: { create: roles.map(role => ({ role })) } } });
  return { user, token: signAccess({ sub: user.id, roles }) };
}

export const makeVehicle = (ownerUserId: string, category: VehicleCategory, seatCapacity: number) =>
  prisma.vehicle.create({ data: { ownerUserId, category, make: 'Test', model: `${category} ${seatCapacity}`, seatCapacity,
    registrationEnc: encrypt('HR26AB1234'), verificationStatus: 'APPROVED' } });

export async function makeVerifiedDriver(seats = 5, extra: Role[] = []) {
  const d = await makeUser(['PASSENGER', 'DRIVER', ...extra]);
  await prisma.driverProfile.create({ data: { userId: d.user.id, licenceNumberEnc: encrypt('DL0420190001234'),
    licenceExpiresAt: inDays(1000), verificationStatus: 'APPROVED' } });
  const vehicle = await makeVehicle(d.user.id, seats > 8 ? 'BUS' : 'CAR', seats);
  return { ...d, vehicle };
}

export const ridePayload = (vehicleId: string) => ({
  vehicleId,
  origin: { name: 'Gurugram', lat: 28.45, lng: 77.02 },
  destination: { name: 'Jaipur', lat: 26.91, lng: 75.78 },
  departureAt: inDays(1).toISOString(),
  availableSeats: 3,
  pricePerSeatPaise: 45000,
});

export async function makeRide(driver: { user: { id: string }; vehicle: { id: string } }, seats: number, bookingMode: 'INSTANT' | 'APPROVAL' = 'INSTANT') {
  return prisma.ride.create({ data: {
    driverUserId: driver.user.id, vehicleId: driver.vehicle.id, originName: 'Gurugram', originLat: 28.45, originLng: 77.02,
    destName: 'Jaipur', destLat: 26.91, destLng: 75.78, departureAt: inDays(1), distanceMeters: 270000, durationSeconds: 18000,
    routeProvider: 'mock', totalSeats: seats, availableSeats: seats, pricePerSeatPaise: 45000n, bookingMode,
  } });
}
