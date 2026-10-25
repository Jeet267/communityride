import { z } from 'zod';
import { DOC_KEY } from '../uploads/uploads.routes';

export const createVehicleSchema = z.object({
  category: z.enum(['CAR', 'BIKE', 'SCOOTER', 'BUS', 'MINI_BUS', 'TEMPO_TRAVELLER']),
  make: z.string().trim().min(2).max(40),
  model: z.string().trim().min(1).max(40),
  registration: z.string().transform(s => s.replace(/\s|-/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/, 'Enter a registration like HR26AB1234')),
  seatCapacity: z.number().int().min(1).max(80),
  rcDocKey: z.string().regex(DOC_KEY).optional(),
  insuranceDocKey: z.string().regex(DOC_KEY).optional(),
  insuranceExpiresAt: z.coerce.date().optional(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
