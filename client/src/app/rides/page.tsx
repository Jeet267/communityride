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

export default function RidesPage() {
  const [from, setFrom] = useState<Place | null>(city('Gurugram'));
  const [to, setTo] = useState<Place | null>(city('Jaipur'));
  const [date, setDate] = useState(istDate(1));
  const [seats, setSeats] = useState(1);
  const [search, setSearch] = useState(() => toQuery(city('Gurugram'), city('Jaipur'), istDate(1), 1));

  const { data, isLoading, error } = useQuery({ queryKey: ['rides', search], queryFn: () => api<Ride[]>(`/rides?${search}`) });

  return (
    <Page>
      <PageHeader eyebrow="Carpool" title="Find a ride" subtitle="Rides leaving within about 25 km of your pickup and drop, on the day you choose." />
      <form onSubmit={e => { e.preventDefault(); if (from && to) setSearch(toQuery(from, to, date, seats)); }}
        className="grid gap-4 rounded-card border border-line bg-white p-5 md:grid-cols-[1fr_1fr_170px_110px_auto] md:items-end">
        <PlaceInput label="From" value={from} onChange={setFrom} />
        <PlaceInput label="To" value={to} onChange={setTo} />
        <Field label="Date" type="date" min={istDate(0)} value={date} onChange={e => setDate(e.target.value)} />
        <Field label="Seats" type="number" min={1} max={8} value={seats} onChange={e => setSeats(Math.max(1, +e.target.value))} />
        <button type="submit" disabled={!from || !to} className="h-11 rounded-full bg-ink px-6 font-semibold text-white disabled:opacity-50">Search</button>
      </form>

      <section className="mt-8 space-y-4">
        {isLoading && <Spinner />}
        <ErrorBanner error={error} />
        {data?.length === 0 && (
          <EmptyState title="No rides on this route that day" body="Try the next day, or publish your own ride and share the cost."
            action={<ButtonLink href="/rides/new" variant="outline">Publish a ride</ButtonLink>} />
        )}
        {data?.map(r => <RideCard key={r.id} ride={r} />)}
      </section>
    </Page>
  );
}
