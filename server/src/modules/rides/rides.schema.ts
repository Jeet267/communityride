import { z } from 'zod';

export const place = z.object({ name: z.string().min(2).max(120), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const future30 = (d: Date) => d.getTime() > Date.now() + 30 * 60_000;

export const publishRideSchema = z.object({
  vehicleId: z.string().uuid(),
  origin: place,
  destination: place,
  departureAt: z.coerce.date().refine(future30, 'Departure must be at least 30 minutes from now'),
  availableSeats: z.number().int().min(1).max(60),
  pricePerSeatPaise: z.number().int().min(0).max(1_000_000),
  bookingMode: z.enum(['INSTANT', 'APPROVAL']).default('APPROVAL'),
  luggage: z.enum(['SMALL', 'MEDIUM', 'LARGE']).default('MEDIUM'),
  type: z.enum(['CARPOOL', 'GROUP_TOUR']).default('CARPOOL'),
  title: z.string().min(5).max(120).optional(),
});
export type PublishRideInput = z.infer<typeof publishRideSchema>;

export const editRideSchema = z.object({
  departureAt: z.coerce.date().refine(future30, 'Departure must be at least 30 minutes from now').optional(),
  pricePerSeatPaise: z.number().int().min(0).max(1_000_000).optional(),
  origin: place.optional(),
  destination: place.optional(),
}).refine(v => Object.keys(v).length > 0, 'Change at least one field');
export type EditRideInput = z.infer<typeof editRideSchema>;

export const searchRidesSchema = z.object({
  originLat: z.coerce.number(), originLng: z.coerce.number(),
  destLat: z.coerce.number(), destLng: z.coerce.number(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  seats: z.coerce.number().int().min(1).max(60).default(1),
});
export type SearchRidesInput = z.infer<typeof searchRidesSchema>;

/** Browse every upcoming shared ride (cab sharing), optionally filtered by city names. */
export const sharedRidesSchema = z.object({
  from: z.string().trim().max(60).optional(),
  to: z.string().trim().max(60).optional(),
  seats: z.coerce.number().int().min(1).max(60).default(1),
});
export type SharedRidesInput = z.infer<typeof sharedRidesSchema>;
