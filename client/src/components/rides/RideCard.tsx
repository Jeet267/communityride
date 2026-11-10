import Link from 'next/link';
import { fmtDate, fmtDuration, fmtTime, rupees } from '@/lib/format';
import { Badge } from '../ui';

export type Ride = {
  id: string; type: 'CARPOOL' | 'GROUP_TOUR'; title: string | null; origin: string; destination: string; departureAt: string;
  distanceKm: number; durationMin: number; totalSeats: number; seatsLeft: number; pricePerSeatPaise: number;
  bookingMode: 'INSTANT' | 'APPROVAL'; status: string; vehicle: string; vehicleCategory: string;
  driver: { id: string; name: string; rating: number; ratingCount: number };
};

export function RideCard({ ride }: { ride: Ride }) {
  return (
    <Link href={`/rides/${ride.id}`} className="grid gap-4 rounded-card border border-line bg-white p-5 transition hover:border-route/40 hover:shadow-frame md:grid-cols-[140px_1fr_auto] md:items-center">
      <div>
        <p className="font-display text-2xl font-bold tracking-tight">{fmtTime(ride.departureAt)}</p>
        <p className="text-sm text-muted">{fmtDate(ride.departureAt)} · {fmtDuration(ride.durationMin)}</p>
      </div>
      <div>
        {ride.title && <p className="text-sm font-semibold text-route">{ride.title}</p>}
        <p className="text-lg font-semibold">{ride.origin} → {ride.destination}</p>
        <p className="text-sm text-muted">{ride.distanceKm} km · {ride.driver.name}{ride.driver.ratingCount ? ` · ★ ${ride.driver.rating.toFixed(1)}` : ''} · {ride.vehicle}</p>
      </div>
      <div className="flex items-center justify-between gap-4 md:flex-col md:items-end">
        <p className="font-display text-2xl font-bold">{rupees(ride.pricePerSeatPaise)}<span className="text-sm font-medium text-muted"> / seat</span></p>
        <Badge tone={ride.seatsLeft <= 1 ? 'warn' : 'ok'}>{ride.seatsLeft} {ride.seatsLeft === 1 ? 'seat' : 'seats'} left</Badge>
      </div>
    </Link>
  );
}
