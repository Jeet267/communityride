import { z } from 'zod';
import { place } from '../rides/rides.schema';

export const createGroupSchema = z.object({
  origin: place,
  destination: place,
  departureAt: z.coerce.date().refine(d => d.getTime() > Date.now() + 864e5, 'Group trips need at least 1 day notice'),
  returnAt: z.coerce.date(),
  passengerCount: z.number().int().min(10).max(500),
  luggageNotes: z.string().max(300).optional(),
  vehiclePreference: z.enum(['BUS', 'MINI_BUS', 'TEMPO_TRAVELLER', 'MULTIPLE_CARS', 'BUS_OR_MULTIPLE_VEHICLES']).default('BUS_OR_MULTIPLE_VEHICLES'),
  budgetTotalPaise: z.number().int().positive().optional(),
}).refine(v => v.returnAt > v.departureAt, { message: 'Return must be after departure', path: ['returnAt'] });
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const quoteSchema = z.object({
  totalPricePaise: z.number().int().positive(),
  vehiclePlan: z.string().min(3).max(200),
  inclusions: z.string().max(500).default(''),
  cancellationTerms: z.string().min(10).max(500),
  validUntil: z.coerce.date().refine(d => d > new Date(), 'Quote must be valid in the future'),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export const allocationSchema = z.object({
  allocations: z.array(z.object({ vehicleId: z.string().uuid(), assignedPassengers: z.number().int().min(1) })).min(1).max(20),
});
export type AllocationInput = z.infer<typeof allocationSchema>;

export const driverAssignSchema = z.object({
  assignments: z.array(z.object({ allocationId: z.string().uuid(), driverUserId: z.string().uuid() })).min(1).max(20),
});
export type DriverAssignInput = z.infer<typeof driverAssignSchema>;

export const participantsSchema = z.object({
  participants: z.array(z.object({
    name: z.string().min(2).max(60),
    phone: z.string().regex(/^\+91[6-9]\d{9}$/).optional(),
    notes: z.string().max(200).optional(),
  })).min(1).max(500),
});
