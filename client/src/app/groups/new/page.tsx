'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { city, Place } from '@/lib/cities';
import { localInput, localToIso, toPaise } from '@/lib/format';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { PlaceInput } from '@/components/rides/PlaceInput';
import { Button, Card, ErrorBanner, Field, Page, PageHeader, Select, TextArea } from '@/components/ui';

function Form() {
  const router = useRouter();
  const [from, setFrom] = useState<Place | null>(city('Gurugram'));
  const [to, setTo] = useState<Place | null>(city('Jaipur'));
  const [f, setF] = useState({ departure: localInput(7, 6), ret: localInput(9, 20), pax: 50, pref: 'BUS_OR_MULTIPLE_VEHICLES', luggage: '', budget: '' });
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }));
  const m = useMutation({
    mutationFn: () => api<{ id: string }>('/group-requests', { method: 'POST', body: {
      origin: from, destination: to, departureAt: localToIso(f.departure), returnAt: localToIso(f.ret), passengerCount: Number(f.pax),
      vehiclePreference: f.pref, luggageNotes: f.luggage || undefined, budgetTotalPaise: f.budget ? toPaise(f.budget) : undefined,
    } }),
    onSuccess: r => router.push(`/groups/${r.id}`),
  });
  return (
    <form onSubmit={e => { e.preventDefault(); m.mutate(); }} className="grid gap-6 md:grid-cols-[1fr_320px]">
      <Card className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <PlaceInput label="From" value={from} onChange={setFrom} />
          <PlaceInput label="To" value={to} onChange={setTo} />
          <Field label="Departure" type="datetime-local" value={f.departure} onChange={e => set('departure', e.target.value)} />
          <Field label="Return" type="datetime-local" value={f.ret} onChange={e => set('ret', e.target.value)} />
          <Field label="Passengers" type="number" min={10} max={500} value={f.pax} onChange={e => set('pax', e.target.value)} hint="Minimum 10 people" />
          <Select label="Vehicle preference" value={f.pref} onChange={e => set('pref', e.target.value)}>
            <option value="BUS_OR_MULTIPLE_VEHICLES">Bus or a mix of vehicles</option>
            <option value="BUS">Bus</option><option value="MINI_BUS">Mini-bus</option>
            <option value="TEMPO_TRAVELLER">Tempo traveller</option><option value="MULTIPLE_CARS">Multiple cars</option>
          </Select>
        </div>
        <TextArea label="Luggage and pickup notes" placeholder="50 medium bags. Pickup from Sector 29 metro." value={f.luggage} onChange={e => set('luggage', e.target.value)} />
        <Field label="Total budget (₹, optional)" type="number" min={0} value={f.budget} onChange={e => set('budget', e.target.value)} />
      </Card>
      <Card className="h-fit space-y-4 bg-canvas">
        <p className="font-semibold">What happens next</p>
        <ol className="list-decimal space-y-2 pl-4 text-sm text-muted">
          <li>Verified operators send quotes with their vehicle plan.</li>
          <li>You accept one quote.</li>
          <li>The operator assigns vehicles and a verified driver for each.</li>
          <li>You confirm once every passenger has a seat.</li>
        </ol>
        <ErrorBanner error={m.error} />
        <Button type="submit" size="lg" className="w-full" loading={m.isPending} disabled={!from || !to}>Request quotes</Button>
      </Card>
    </form>
  );
}

export default function NewGroupPage() {
  return (
    <RequireAuth>
      <Page>
        <PageHeader eyebrow="Group trips" title="Request transport for your group" subtitle="Journeys up to 500 km. We check the distance before operators see your request." />
        <Form />
      </Page>
    </RequireAuth>
  );
}
