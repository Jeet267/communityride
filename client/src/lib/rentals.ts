export type Listing = {
  id: string; city: string; pickupAddress: string; rentalMode: string; active: boolean; pricePerDayPaise: number; securityDepositPaise: number;
  includedKmPerDay: number; extraKmChargePaise: number; helmetIncluded: boolean; cancellationPolicy: string;
  vehicle: string; category: string; seats: number; owner: string;
};

/** Mirrors the server's priceFor() so the user sees the same number before booking. The server's number is final. */
export function estimate(l: Listing, startIso: string, endIso: string, km: number) {
  const days = Math.max(1, Math.ceil((new Date(endIso).getTime() - new Date(startIso).getTime()) / 864e5));
  const includedKm = days * l.includedKmPerDay;
  const extraKm = Math.max(0, km - includedKm);
  return { days, includedKm, extraKm, rent: l.pricePerDayPaise * days + l.extraKmChargePaise * extraKm };
}
