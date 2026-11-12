'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, label, localInput, localToIso, rupees } from '@/lib/format';
import { estimate, Listing } from '@/lib/rentals';
import { Badge, Button, Card, ErrorBanner, Field, Page, Spinner } from '@/components/ui';

function Detail({ id }: { id: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [start, setStart] = useState(sp.get('start') ?? localInput(1, 9));
  const [end, setEnd] = useState(sp.get('end') ?? localInput(2, 9));
  const [km, setKm] = useState(150);
  const { data: l } = useQuery({ queryKey: ['rental', id], queryFn: () => api<Listing>(`/rentals/${id}`) });
  const { data: busy } = useQuery({ queryKey: ['rental-avail', id], queryFn: () => api<{ startAt: string; endAt: string }[]>(`/rentals/${id}/availability`) });
  const book = useMutation({
    mutationFn: () => api(`/rentals/${id}/bookings`, { method: 'POST', body: { startAt: localToIso(start), endAt: localToIso(end), plannedDistanceMeters: km * 1000 } }),
    onSuccess: () => router.push('/bookings'),
    onError: () => qc.invalidateQueries({ queryKey: ['rental-avail', id] }),
  });
  if (!l) return <Spinner />;
  const e = estimate(l, start, end, km);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_380px]">
      <Card className="p-8">
        <div className="flex gap-2"><Badge tone="blue">{label(l.category)}</Badge><Badge>{label(l.rentalMode)}</Badge>{l.helmetIncluded && <Badge>Helmet included</Badge>}</div>
        <h1 className="mt-5 text-3xl font-bold tracking-[-0.03em] md:text-4xl">{l.vehicle}</h1>
        <p className="mt-1 text-muted">{l.pickupAddress} · owner {l.owner}</p>
        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          {[['Per day', rupees(l.pricePerDayPaise)], ['Refundable deposit', rupees(l.securityDepositPaise)], ['Included', `${l.includedKmPerDay} km per day`], ['Extra km', `${rupees(l.extraKmChargePaise)} per km`]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-canvas p-4"><dt className="text-sm text-muted">{k}</dt><dd className="mt-1 text-lg font-semibold">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-muted"><b className="text-ink">Cancellation:</b> {l.cancellationPolicy}</p>
        <div className="mt-6">
          <p className="text-sm font-semibold">Already booked</p>
          {busy?.length ? <ul className="mt-2 space-y-1 text-sm text-muted">{busy.map((b, i) => <li key={i}>{fmtDateTime(b.startAt)} → {fmtDateTime(b.endAt)}</li>)}</ul>
            : <p className="mt-1 text-sm text-muted">Free for the next few weeks.</p>}
        </div>
      </Card>
      <Card className="h-fit space-y-4 md:sticky md:top-24">
        <Field label="Pickup" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
        <Field label="Return" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} />
        <Field label="Planned distance (km)" type="number" min={0} max={500} value={km} onChange={e => setKm(+e.target.value)} hint="Your final bill uses the real odometer reading" />
        <div className="space-y-1 border-t border-line pt-4 text-sm">
          <p className="flex justify-between"><span className="text-muted">{e.days} day{e.days > 1 ? 's' : ''} × {rupees(l.pricePerDayPaise)}</span><span>{rupees(l.pricePerDayPaise * e.days)}</span></p>
          {e.extraKm > 0 && <p className="flex justify-between"><span className="text-muted">{e.extraKm} extra km</span><span>{rupees(e.extraKm * l.extraKmChargePaise)}</span></p>}
          <p className="flex justify-between"><span className="text-muted">Deposit (refundable)</span><span>{rupees(l.securityDepositPaise)}</span></p>
          <p className="flex justify-between pt-2 text-base font-semibold"><span>Estimated total</span><span>{rupees(e.rent + l.securityDepositPaise)}</span></p>
        </div>
        <ErrorBanner error={book.error} />
        {user ? <Button size="lg" className="w-full" loading={book.isPending} onClick={() => book.mutate()}>Request booking</Button>
          : <Button size="lg" className="w-full" onClick={() => router.push(`/login?next=/rentals/${id}`)}>Sign in to book</Button>}
      </Card>
    </div>
  );
}

export default function RentalDetailPage({ params }: { params: { id: string } }) {
  return <Page><Suspense><Detail id={params.id} /></Suspense></Page>;
}
