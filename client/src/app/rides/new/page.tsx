'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { Place } from '@/lib/cities';
import { localInput, localToIso, toPaise } from '@/lib/format';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { PlaceInput } from '@/components/rides/PlaceInput';
import { Button, Card, ErrorBanner, Field, Page, PageHeader, Select } from '@/components/ui';
import { LUGGAGE } from '@/components/rides/RideCard';

type Vehicle = { id: string; category: string; make: string; model: string; seatCapacity: number; verificationStatus: string; registration: string };
const TOUR = ['BUS', 'MINI_BUS', 'TEMPO_TRAVELLER'];

function PublishForm() {
  const router = useRouter();
  const { data: vehicles } = useQuery({ queryKey: ['my-vehicles'], queryFn: () => api<Vehicle[]>('/vehicles/me') });
  const approved = (vehicles ?? []).filter(v => v.verificationStatus === 'APPROVED');
  const [type, setType] = useState<'CARPOOL' | 'GROUP_TOUR'>('CARPOOL');
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [f, setF] = useState({ vehicleId: '', departure: localInput(1, 7), seats: 3, price: '450', approval: true, title: '', luggage: 'MEDIUM' });
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }));
  const options = approved.filter(v => (type === 'GROUP_TOUR' ? TOUR.includes(v.category) : !TOUR.includes(v.category)));

  const publish = useMutation({
    mutationFn: () => api('/rides', { method: 'POST', body: {
      type, vehicleId: f.vehicleId || options[0]?.id, origin: from, destination: to, departureAt: localToIso(f.departure),
      availableSeats: Number(f.seats), pricePerSeatPaise: toPaise(f.price), bookingMode: f.approval ? 'APPROVAL' : 'INSTANT', luggage: f.luggage,
      ...(type === 'GROUP_TOUR' ? { title: f.title } : {}),
    } }),
    onSuccess: () => router.push('/driver'),
  });
  const err = publish.error as ApiError | null;

  if (vehicles && !approved.length) return (
    <Card className="py-10">
      <h2 className="text-xl font-semibold">Add a verified vehicle first</h2>
      <p className="mt-2 text-muted">Rides can only be published with a vehicle our team has verified.</p>
      <Link href="/vehicles" className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 font-semibold text-white">Add a vehicle</Link>
    </Card>
  );

  return (
    <form onSubmit={e => { e.preventDefault(); publish.mutate(); }} className="grid gap-6 md:grid-cols-[1fr_320px]">
      <Card className="space-y-5">
        {err && (
          <div role="alert" className="rounded-field border border-warn/25 bg-warn/5 p-4 text-warn">
            <p className="font-semibold">{err.message}</p>
            {err.code === 'DISTANCE_UNAVAILABLE' && <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => publish.mutate()}>Try again</Button>}
            {err.code === 'DRIVER_NOT_VERIFIED' && <Link href="/driver/onboarding" className="mt-2 inline-block text-sm font-semibold underline">Check verification status</Link>}
          </div>
        )}
        <div className="inline-flex rounded-full border border-line bg-canvas p-1">
          {(['CARPOOL', 'GROUP_TOUR'] as const).map(t => (
            <button type="button" key={t} onClick={() => { setType(t); set('vehicleId', ''); }}
              className={`h-9 rounded-full px-4 text-sm font-semibold ${type === t ? 'bg-ink text-white' : 'text-muted'}`}>{t === 'CARPOOL' ? 'Carpool' : 'Group tour (bus)'}</button>
          ))}
        </div>
        {type === 'GROUP_TOUR' && <Field label="Tour title" placeholder="Jaipur weekend heritage tour" value={f.title} onChange={e => set('title', e.target.value)} required minLength={5} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <PlaceInput label="From" value={from} onChange={setFrom} />
          <PlaceInput label="To" value={to} onChange={setTo} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Departure" type="datetime-local" value={f.departure} onChange={e => set('departure', e.target.value)} required />
          <Select label="Vehicle" value={f.vehicleId || options[0]?.id || ''} onChange={e => set('vehicleId', e.target.value)}>
            {options.length === 0 && <option value="">No verified {type === 'GROUP_TOUR' ? 'bus or tempo' : 'car'} yet</option>}
            {options.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.registration} · {v.seatCapacity} seats</option>)}
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Seats offered" type="number" min={1} max={60} value={f.seats} onChange={e => set('seats', e.target.value)} />
          <Field label="Price per seat (₹)" type="number" min={0} step="10" value={f.price} onChange={e => set('price', e.target.value)} />
        </div>
        <Select label="Luggage allowed per seat" value={f.luggage} onChange={e => set('luggage', e.target.value)}>
          {Object.entries(LUGGAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <label className="flex items-center gap-3 text-[15px]">
          <input type="checkbox" checked={f.approval} onChange={e => set('approval', e.target.checked)} className="h-4 w-4 accent-route" />
          I want to approve each booking request
        </label>
      </Card>
      <Card className="h-fit space-y-4 bg-canvas">
        <p className="font-semibold">Before you publish</p>
        <ul className="space-y-2 text-sm text-muted">
          <li>We calculate the road distance on our server. Journeys over 500 km cannot be published.</li>
          <li>Seats are locked the moment a passenger books, so you will never be overbooked.</li>
          <li>Once someone books, edit by cancelling and publishing again.</li>
        </ul>
        <Button type="submit" size="lg" className="w-full" loading={publish.isPending} disabled={!from || !to || !options.length}>Publish ride</Button>
      </Card>
    </form>
  );
}

export default function NewRidePage() {
  return (
    <RequireAuth role="DRIVER">
      <Page>
        <PageHeader eyebrow="Drivers" title="Publish a ride" subtitle="Offer empty seats on a trip you are already taking, or run a group tour on your bus." />
        <PublishForm />
      </Page>
    </RequireAuth>
  );
}
