import { z } from 'zod';

export const createListingSchema = z.object({
  vehicleId: z.string().uuid(),
  city: z.string().trim().min(2).max(60),
  pickupAddress: z.string().min(5).max(200),
  rentalMode: z.enum(['SELF_DRIVE', 'WITH_DRIVER']),
  pricePerDayPaise: z.number().int().positive(),
  securityDepositPaise: z.number().int().min(0),
  includedKmPerDay: z.number().int().min(0).max(1000),
  extraKmChargePaise: z.number().int().min(0),
  helmetIncluded: z.boolean().default(false),
  cancellationPolicy: z.string().min(10).max(500),
});
export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingSchema = createListingSchema.omit({ vehicleId: true }).partial().extend({ active: z.boolean().optional() });

export const rentalSearchSchema = z.object({
  city: z.string().min(2),
  category: z.enum(['CAR', 'BIKE', 'SCOOTER']).optional(),
  rentalMode: z.enum(['SELF_DRIVE', 'WITH_DRIVER']).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
}).refine(v => v.endAt > v.startAt, { message: 'Return time must be after pickup time', path: ['endAt'] });
export type RentalSearchInput = z.infer<typeof rentalSearchSchema>;

export const rentalBookingSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  plannedDistanceMeters: z.number().int().min(0).max(500_000),
}).refine(v => v.endAt > v.startAt, { message: 'Return time must be after pickup time', path: ['endAt'] })
  .refine(v => v.startAt.getTime() > Date.now(), { message: 'Pickup time must be in the future', path: ['startAt'] });
export type RentalBookingInput = z.infer<typeof rentalBookingSchema>;

export const checklistSchema = z.object({
  odometerKm: z.number().int().min(0),
  fuelPercent: z.number().int().min(0).max(100),
  damageNotes: z.string().max(500).default(''),
});
export type ChecklistInput = z.infer<typeof checklistSchema>;
