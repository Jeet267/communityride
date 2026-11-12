export type GroupDetail = {
  id: string; origin: string; destination: string; departureAt: string; returnAt: string; distanceKm: number; passengerCount: number;
  luggageNotes: string | null; vehiclePreference: string; budgetTotalPaise: number | null; status: string; isOrganizer: boolean;
  participantsCount: number; paidPaise: number;
  quotes: { id: string; operator: string; totalPricePaise: number; vehiclePlan: string; inclusions: string; cancellationTerms: string; validUntil: string; status: string }[];
  acceptedQuote: { id: string; operator: string; totalPricePaise: number; byMe: boolean } | null;
  allocations: { id: string; vehicleId: string; vehicle: string; seatCapacity: number; assignedPassengers: number; driver: { id: string; name: string } | null }[];
  summary: { required: number; assigned: number; capacity: number; driversMissing: number };
};
export const STEPS = ['OPEN_FOR_QUOTES', 'QUOTE_ACCEPTED', 'ALLOCATED', 'CONFIRMED'] as const;
export const STEP_LABEL: Record<string, string> = { OPEN_FOR_QUOTES: 'Collecting quotes', QUOTE_ACCEPTED: 'Quote accepted', ALLOCATED: 'Vehicles assigned', CONFIRMED: 'Confirmed' };
