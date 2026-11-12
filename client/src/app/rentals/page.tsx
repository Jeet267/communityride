'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { label, localInput, localToIso, rupees } from '@/lib/format';
import { Listing } from '@/lib/rentals';
import { Arrow, Badge, ButtonLink, EmptyState, ErrorBanner, Field, Page, PageHeader, Select, Spinner } from '@/components/ui';

export default function RentalsPage() {
  const [f, setF] = useState({ city: 'Gurugram', category: '', start: localInput(1, 9), end: localInput(2, 9) });
  const [q, setQ] = useState(f);
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));
  const params = new URLSearchParams({ city: q.city, startAt: localToIso(q.start), endAt: localToIso(q.end), ...(q.category ? { category: q.category } : {}) });
  const { data, isLoading, error } = useQuery({ queryKey: ['rentals', params.toString()], queryFn: () => api<Listing[]>(`/rentals?${params}`) });

  return (
    <Page>
      <PageHeader eyebrow="Rentals" title="Rent a car, bike or scooter" subtitle="Only vehicles free for your whole time window are shown."
        action={<ButtonLink href="/rentals/new" variant="blue">List your vehicle <Arrow /></ButtonLink>} />
      <form onSubmit={e => { e.preventDefault(); setQ(f); }} className="grid gap-4 rounded-card border border-line bg-white p-5 md:grid-cols-[1fr_160px_1fr_1fr_auto] md:items-end">
        <Field label="City" value={f.city} onChange={e => set('city', e.target.value)} />
        <Select label="Type" value={f.category} onChange={e => set('category', e.target.value)}>
          <option value="">Any</option><option value="CAR">Car</option><option value="BIKE">Bike</option><option value="SCOOTER">Scooter</option>
        </Select>
        <Field label="Pickup" type="datetime-local" value={f.start} onChange={e => set('start', e.target.value)} />
        <Field label="Return" type="datetime-local" value={f.end} onChange={e => set('end', e.target.value)} />
        <button className="h-11 rounded-full bg-ink px-6 font-semibold text-white">Search</button>
      </form>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && <Spinner />}
        <ErrorBanner error={error} />
        {data?.length === 0 && <div className="md:col-span-3"><EmptyState title="Nothing free for those dates" body="Try different dates or another city." /></div>}
        {data?.map(l => (
          <Link key={l.id} href={`/rentals/${l.id}?start=${encodeURIComponent(q.start)}&end=${encodeURIComponent(q.end)}`}
            className="rounded-card border border-line bg-white p-6 transition hover:shadow-frame">
            <div className="flex items-start justify-between gap-2"><Badge tone="blue">{label(l.category)}</Badge>{l.helmetIncluded && <Badge>Helmet included</Badge>}</div>
            <p className="mt-4 text-xl font-semibold">{l.vehicle}</p>
            <p className="text-sm text-muted">{l.city} · {label(l.rentalMode)} · {l.seats} seats</p>
            <p className="mt-4 font-display text-2xl font-bold">{rupees(l.pricePerDayPaise)}<span className="text-sm font-medium text-muted"> / day</span></p>
            <p className="text-sm text-muted">{l.includedKmPerDay} km/day included · deposit {rupees(l.securityDepositPaise)}</p>
          </Link>
        ))}
      </div>
    </Page>
  );
}
