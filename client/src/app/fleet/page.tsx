'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, label, localInput, localToIso, rupees, toPaise, tone } from '@/lib/format';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorBanner, Field, Page, PageHeader, Spinner, TextArea } from '@/components/ui';

type Req = { id: string; origin: string; destination: string; departureAt: string; returnAt: string; distanceKm: number; passengerCount: number;
  budgetTotalPaise: number | null; vehiclePreference: string; status: string; myQuote: { id: string; status: string; totalPricePaise: number } | null };

function QuoteForm({ r, onDone }: { r: Req; onDone: () => void }) {
  const [f, setF] = useState({ total: '', plan: '', inclusions: 'Fuel, tolls, driver allowance', terms: 'Full refund up to 7 days before departure.', valid: localInput(3, 20) });
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));
  const m = useMutation({
    mutationFn: () => api(`/fleet/group-requests/${r.id}/quotes`, { method: 'POST', body: {
      totalPricePaise: toPaise(f.total), vehiclePlan: f.plan, inclusions: f.inclusions, cancellationTerms: f.terms, validUntil: localToIso(f.valid) } }),
    onSuccess: onDone,
  });
  return (
    <div className="mt-4 grid gap-4 rounded-xl bg-canvas p-4 sm:grid-cols-2">
      <Field label="Total price (₹)" type="number" value={f.total} onChange={e => set('total', e.target.value)} hint={f.total ? `${rupees(Math.round(toPaise(f.total) / r.passengerCount))} per person` : undefined} />
      <Field label="Vehicle plan" placeholder="1 bus (35) + 1 tempo traveller (17)" value={f.plan} onChange={e => set('plan', e.target.value)} />
      <Field label="Inclusions" value={f.inclusions} onChange={e => set('inclusions', e.target.value)} />
      <Field label="Quote valid until" type="datetime-local" value={f.valid} onChange={e => set('valid', e.target.value)} />
      <TextArea className="sm:col-span-2" label="Cancellation terms" value={f.terms} onChange={e => set('terms', e.target.value)} />
      <ErrorBanner error={m.error} className="sm:col-span-2" />
      <Button className="w-fit" loading={m.isPending} disabled={!f.total || f.plan.length < 3} onClick={() => m.mutate()}>Send quote</Button>
    </div>
  );
}

function Requests() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['fleet-requests'], queryFn: () => api<Req[]>('/fleet/group-requests') });
  if (isLoading) return <Spinner />;
  if (!data?.length) return <EmptyState title="No open group requests right now" body="New requests within 500 km show up here for every verified operator." />;
  return (
    <div className="space-y-4">
      {data.map(r => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{r.origin} → {r.destination} · {r.passengerCount} passengers</p>
              <p className="text-sm text-muted">{fmtDateTime(r.departureAt)} → {fmtDate(r.returnAt)} · {r.distanceKm} km · {label(r.vehiclePreference)}{r.budgetTotalPaise ? ` · budget ${rupees(r.budgetTotalPaise)}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              {r.myQuote && <Badge tone={tone(r.myQuote.status)}>Your quote: {rupees(r.myQuote.totalPricePaise)} · {label(r.myQuote.status)}</Badge>}
              {!r.myQuote && r.status === 'OPEN_FOR_QUOTES' && <Button size="sm" variant={open === r.id ? 'outline' : 'primary'} onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Close' : 'Send quote'}</Button>}
              {r.myQuote?.status === 'ACCEPTED' && <ButtonLink href={`/fleet/groups/${r.id}`} size="sm">Assign vehicles</ButtonLink>}
            </div>
          </div>
          {open === r.id && <QuoteForm r={r} onDone={() => { setOpen(null); qc.invalidateQueries({ queryKey: ['fleet-requests'] }); }} />}
        </Card>
      ))}
    </div>
  );
}

export default function FleetPage() {
  return (
    <RequireAuth role="FLEET_OPERATOR">
      <Page>
        <PageHeader eyebrow="Fleet operators" title="Group requests" subtitle="Quote 40-50+ passenger trips. Once a quote is accepted, assign vehicles and verified drivers."
          action={<Link href="/vehicles" className="text-sm font-semibold text-route">Manage fleet →</Link>} />
        <Requests />
      </Page>
    </RequireAuth>
  );
}
