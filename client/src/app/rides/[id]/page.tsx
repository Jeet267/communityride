'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, fmtDuration, newKey, rupees } from '@/lib/format';
import { LUGGAGE, Ride } from '@/components/rides/RideCard';
import { Badge, Button, Card, ErrorBanner, Field, Page, Spinner } from '@/components/ui';

export default function RideDetail({ params }: { params: { id: string } }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const router = useRouter();
  const { data: ride, error: loadError } = useQuery({ queryKey: ['ride', params.id], queryFn: () => api<Ride>(`/rides/${params.id}`) });
  const [seats, setSeats] = useState(1);
  const [names, setNames] = useState<string[]>(['']);
  // One key per page visit: double clicks and retries cannot create two bookings.
  const [idemKey] = useState(newKey);

  const book = useMutation({
    mutationFn: () => api(`/rides/${params.id}/bookings`, {
      method: 'POST', idempotencyKey: idemKey,
      body: { seatsRequested: seats, ...(ride?.type === 'GROUP_TOUR' ? { participants: names.slice(0, seats).map(name => ({ name })) } : {}) },
    }),
    onSuccess: () => router.push('/bookings'),
    onError: (e: ApiError) => { if (e.code === 'SEATS_UNAVAILABLE') qc.invalidateQueries({ queryKey: ['ride', params.id] }); },
  });

  if (loadError) return <Page><ErrorBanner error={loadError} /></Page>;
  if (!ride) return <Page><Spinner /></Page>;
  const tour = ride.type === 'GROUP_TOUR';
  const own = user?.id === ride.driver.id;
  const verb = ride.bookingMode === 'INSTANT' ? 'Book' : 'Request';
  const setSeatCount = (n: number) => {
    const v = Math.min(Math.max(1, n), Math.max(1, ride.seatsLeft));
    setSeats(v);
    setNames(prev => Array.from({ length: v }, (_, i) => prev[i] ?? ''));
  };
  const namesOk = !tour || names.slice(0, seats).every(n => n.trim().length >= 2);
  const bookError = book.error as ApiError | null;

  return (
    <Page className="grid gap-6 md:grid-cols-[1fr_380px]">
      <Card className="p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{tour ? 'Group tour' : 'Carpool'}</Badge>
          <Badge>{ride.bookingMode === 'INSTANT' ? 'Instant booking' : 'Driver approves each request'}</Badge>
          {ride.status !== 'PUBLISHED' && <Badge tone="warn">{ride.status.toLowerCase()}</Badge>}
        </div>
        {ride.title && <p className="mt-6 font-semibold text-route">{ride.title}</p>}
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] md:text-4xl">{ride.origin} → {ride.destination}</h1>
        <p className="mt-2 text-lg text-muted">{fmtDateTime(ride.departureAt)}</p>
        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          {[['Distance by road', `${ride.distanceKm} km`], ['Driving time', fmtDuration(ride.durationMin)], ['Seats left', `${ride.seatsLeft} of ${ride.totalSeats}`], ['Already joined', ride.seatsBooked ? `${ride.seatsBooked} ${ride.seatsBooked === 1 ? 'person' : 'people'}` : 'Be the first'], ['Luggage', LUGGAGE[ride.luggage]], ['Vehicle', `${ride.vehicle} · ${ride.vehicleSeats} seats`]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-canvas p-4"><dt className="text-sm text-muted">{k}</dt><dd className="mt-1 text-lg font-semibold">{v}</dd></div>
          ))}
        </dl>
        <div className="mt-8 flex items-center gap-4 border-t border-line pt-6">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-ink font-semibold text-white">{ride.driver.name.split(' ').map(s => s[0]).join('')}</span>
          <div>
            <p className="font-semibold">{ride.driver.name} <span className="ml-1 text-sm font-medium text-ok">✓ Verified driver</span></p>
            <p className="text-sm text-muted">{ride.driver.ratingCount ? `★ ${ride.driver.rating.toFixed(1)} · ${ride.driver.ratingCount} reviews` : 'New on RideMate'} · {ride.vehicle}</p>
          </div>
        </div>
      </Card>

      <Card className="h-fit space-y-5 md:sticky md:top-24">
        <p className="font-display text-3xl font-bold">{rupees(ride.pricePerSeatPaise)} <span className="text-base font-medium text-muted">per seat</span></p>
        <Field label="Seats" type="number" min={1} max={ride.seatsLeft} value={seats} onChange={e => setSeatCount(+e.target.value)} />
        {tour && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Traveller names <span className="font-normal text-muted">(for the tour manifest)</span></p>
            {names.slice(0, seats).map((n, i) => (
              <input key={i} value={n} onChange={e => setNames(p => p.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Traveller ${i + 1}`}
                className="h-11 w-full rounded-field border border-line px-3.5 outline-none focus:border-route" />
            ))}
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-4"><span className="text-muted">Total</span><span className="text-lg font-semibold">{rupees(ride.pricePerSeatPaise * seats)}</span></div>
        {bookError && <ErrorBanner error={bookError.code === 'SEATS_UNAVAILABLE' ? new Error('Someone just booked these seats. Pick fewer seats or another ride.') : bookError} />}
        {own ? <p className="text-sm text-muted">This is your ride. Manage it from the driver dashboard.</p>
          : user ? (
            <Button size="lg" className="w-full" loading={book.isPending} disabled={ride.seatsLeft < seats || ride.status !== 'PUBLISHED' || !namesOk} onClick={() => book.mutate()}>
              {verb} {seats} seat{seats > 1 ? 's' : ''}
            </Button>
          ) : <Button size="lg" className="w-full" onClick={() => router.push(`/login?next=/rides/${params.id}`)}>Sign in to book</Button>}
        {ride.bookingMode === 'APPROVAL' && <p className="text-xs text-muted">Your seats are held while the driver reviews your request.</p>}
      </Card>
    </Page>
  );
}
