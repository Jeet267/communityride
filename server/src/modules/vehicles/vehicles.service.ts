import { Vehicle } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { decrypt, encrypt, mask } from '../../utils/crypto';
import { Db } from '../../utils/notify';
import { CreateVehicleInput } from './vehicles.schema';

export const toVehicleDto = (v: Vehicle) => ({
  id: v.id, category: v.category, make: v.make, model: v.model, seatCapacity: v.seatCapacity,
  verificationStatus: v.verificationStatus, registration: mask(decrypt(v.registrationEnc)),
  insuranceExpiresAt: v.insuranceExpiresAt, hasRc: !!v.rcDocKey, hasInsurance: !!v.insuranceDocKey,
});

export async function createVehicle(ownerId: string, input: CreateVehicleInput) {
  const { registration, ...rest } = input;
  const v = await prisma.vehicle.create({ data: { ...rest, ownerUserId: ownerId, registrationEnc: encrypt(registration) } });
  return toVehicleDto(v);
}

export async function listMine(ownerId: string) {
  return (await prisma.vehicle.findMany({ where: { ownerUserId: ownerId, active: true }, orderBy: { createdAt: 'desc' } })).map(toVehicleDto);
}

export async function assertUsableVehicle(vehicleId: string, ownerId: string, db: Db = prisma) {
  const v = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!v || v.ownerUserId !== ownerId || !v.active) throw new AppError('FORBIDDEN', 403, 'This vehicle is not in your account');
  if (v.verificationStatus !== 'APPROVED') throw new AppError('VEHICLE_UNAVAILABLE', 409, 'This vehicle is not verified yet');
  if (v.insuranceExpiresAt && v.insuranceExpiresAt < new Date()) throw new AppError('VEHICLE_UNAVAILABLE', 409, 'Insurance for this vehicle has expired');
  return v;
}
