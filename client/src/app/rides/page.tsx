'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { city, Place } from '@/lib/cities';
import { istDate } from '@/lib/format';
import { PlaceInput } from '@/components/rides/PlaceInput';
import { Ride, RideCard } from '@/components/rides/RideCard';
import { ButtonLink, EmptyState, ErrorBanner, Field, Page, PageHeader, Spinner } from '@/components/ui';

const toQuery = (f: Place, t: Place, date: string, seats: number) =>
  new URLSearchParams({ originLat: `${f.lat}`, originLng: `${f.lng}`, destLat: `${t.lat}`, destLng: `${t.lng}`, date, seats: `${seats}` }).toString();

/** Cab sharing: every upcoming shared ride is listed first; the search narrows it to a route and day. */
export default function RidesPage() {
  const [from, setFrom] = useState<Place | null>(city('Gurugram'));
  const [to, setTo] = useState<Place | null>(city('Jaipur'));
  const [date, setDate] = useState(istDate(1));
  const [seats, setSeats] = useState(1);
  const [search, setSearch] = useState<string | null>(null); // null = show all shared rides

  const all = useQuery({ queryKey: ['rides-shared', seats], queryFn: () => api<Ride[]>(`/rides/shared?seats=${seats}`), enabled: search === null });
  const found = useQuery({ queryKey: ['rides', search], queryFn: () => api<Ride[]>(`/rides?${search}`), enabled: search !== null });
  const q = search === null ? all : found;

  return (
    <Page>
      <PageHeader eyebrow="Cab sharing" title="Find a shared ride"
        subtitle="Join a car that is already going your way. See the route, car, luggage, price per seat and how many people already joined." />
      <form onSubmit={e => { e.preventDefault(); if (from && to) setSearch(toQuery(from, to, date, seats)); }}
        className="grid gap-4 rounded-card border border-line bg-white p-5 md:grid-cols-[1fr_1fr_170px_110px_auto] md:items-end">
        <PlaceInput label="From" value={from} onChange={setFrom} />
        <PlaceInput label="To" value={to} onChange={setTo} />
        <Field label="Date" type="date" min={istDate(0)} value={date} onChange={e => setDate(e.target.value)} />
        <Field label="Seats" type="number" min={1} max={8} value={seats} onChange={e => setSeats(Math.max(1, +e.target.value))} />
        <button type="submit" disabled={!from || !to} className="h-11 rounded-full bg-ink px-6 font-semibold text-white disabled:opacity-50">Search</button>
      </form>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{search === null ? 'All upcoming shared rides' : 'Rides on your route that day'}{q.data ? ` (${q.data.length})` : ''}</h2>
        {search !== null && <button className="text-sm font-semibold text-route" onClick={() => setSearch(null)}>Show all shared rides</button>}
      </div>
      <section className="mt-4 space-y-4">
        {q.isLoading && <Spinner />}
        <ErrorBanner error={q.error} />
        {q.data?.length === 0 && (
          <EmptyState title={search === null ? 'No shared rides yet' : 'No rides on this route that day'}
            body="Try another day, or publish your own ride and share the cost."
            action={<ButtonLink href="/rides/new" variant="outline">Publish a ride</ButtonLink>} />
        )}
        {q.data?.map(r => <RideCard key={r.id} ride={r} />)}
      </section>
    </Page>
  );
}
