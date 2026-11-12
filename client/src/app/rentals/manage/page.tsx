'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDateTime, label, rupees, tone } from '@/lib/format';
import { Listing } from '@/lib/rentals';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Arrow, Badge, Button, ButtonLink, Card, EmptyState, ErrorBanner, Page, PageHeader, Spinner } from '@/components/ui';

type OwnerBooking = { id: string; status: string; paymentStatus: string; startAt: string; endAt: string; totalPaise: number; vehicle: string; renter: string;
  pickupChecklist: any; returnChecklist: any };

function ChecklistForm({ onSubmit, cta }: { onSubmit: (c: { odometerKm: number; fuelPercent: number; damageNotes: string }) => void; cta: string }) {
  const [c, setC] = useState({ odometerKm: '', fuelPercent: '100', damageNotes: '' });
  return (
    <div className="mt-3 grid gap-3 rounded-xl bg-canvas p-4 sm:grid-cols-[140px_120px_1fr_auto] sm:items-end">
      <label className="text-sm font-semibold">Odometer (km)<input type="number" className="mt-1 h-10 w-full rounded-field border border-line px-3" value={c.odometerKm} onChange={e => setC({ ...c, odometerKm: e.target.value })} /></label>
      <label className="text-sm font-semibold">Fuel %<input type="number" min={0} max={100} className="mt-1 h-10 w-full rounded-field border border-line px-3" value={c.fuelPercent} onChange={e => setC({ ...c, fuelPercent: e.target.value })} /></label>
      <label className="text-sm font-semibold">Damage notes<input className="mt-1 h-10 w-full rounded-field border border-line px-3" placeholder="Small scratch on rear bumper" value={c.damageNotes} onChange={e => setC({ ...c, damageNotes: e.target.value })} /></label>
      <Button size="sm" disabled={!c.odometerKm} onClick={() => onSubmit({ odometerKm: +c.odometerKm, fuelPercent: +c.fuelPercent, damageNotes: c.damageNotes })}>{cta}</Button>
    </div>
  );
}

function Manage() {
  const qc = useQueryClient();
  const listings = useQuery({ queryKey: ['my-listings'], queryFn: () => api<Listing[]>('/rentals/mine') });
  const bookings = useQuery({ queryKey: ['owner-bookings'], queryFn: () => api<OwnerBooking[]>('/rental-bookings/owner') });
  const act = useMutation({ mutationFn: ({ path, body }: { path: string; body?: unknown }) => api(path, { method: 'POST', body }), onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-bookings'] }) });
  const toggle = useMutation({ mutationFn: (l: Listing) => api(`/rentals/${l.id}`, { method: 'PATCH', body: { active: !l.active } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['my-listings'] }) });
  if (listings.isLoading || bookings.isLoading) return <Spinner />;
  return (
    <>
      <h2 className="text-xl font-semibold">Your listings</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {!listings.data?.length && <EmptyState title="No listings yet" action={<ButtonLink href="/rentals/new">List a vehicle</ButtonLink>} />}
        {listings.data?.map(l => (
          <Card key={l.id} className="flex items-center justify-between gap-3">
            <div><p className="font-semibold">{l.vehicle}</p><p className="text-sm text-muted">{l.city} · {rupees(l.pricePerDayPaise)}/day</p></div>
            <Button size="sm" variant="outline" onClick={() => toggle.mutate(l)}>{l.active ? 'Pause listing' : 'Resume listing'}</Button>
          </Card>
        ))}
      </div>
      <h2 className="mt-10 text-xl font-semibold">Bookings</h2>
      <ErrorBanner error={act.error} className="mt-4" />
      <div className="mt-4 space-y-4">
        {!bookings.data?.length && <EmptyState title="No bookings yet" />}
        {bookings.data?.map(b => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{b.vehicle} · {b.renter}</p>
                <p className="text-sm text-muted">{fmtDateTime(b.startAt)} → {fmtDateTime(b.endAt)} · {rupees(b.totalPaise)}</p>
                {b.returnChecklist && <p className="mt-1 text-sm">Driven {b.returnChecklist.actualKm} km · {b.returnChecklist.extraKm} extra km billed</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={tone(b.status)}>{label(b.status)}</Badge><Badge tone={b.paymentStatus === 'PAID' ? 'ok' : 'neutral'}>{label(b.paymentStatus)}</Badge>
                {b.status === 'PENDING' && <>
                  <Button size="sm" onClick={() => act.mutate({ path: `/rental-bookings/${b.id}/accept` })}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => act.mutate({ path: `/rental-bookings/${b.id}/reject` })}>Decline</Button>
                </>}
              </div>
            </div>
            {b.status === 'CONFIRMED' && <ChecklistForm cta="Record pickup" onSubmit={c => act.mutate({ path: `/rental-bookings/${b.id}/pickup`, body: c })} />}
            {b.status === 'ACTIVE' && <ChecklistForm cta="Record return" onSubmit={c => act.mutate({ path: `/rental-bookings/${b.id}/return`, body: c })} />}
          </Card>
        ))}
      </div>
    </>
  );
}

export default function ManageRentalsPage() {
  return (
    <RequireAuth role="RENTAL_OWNER">
      <Page>
        <PageHeader eyebrow="Rental owners" title="Your rentals" subtitle="Accept requests and record odometer and fuel at pickup and return."
          action={<ButtonLink href="/rentals/new" variant="blue">New listing <Arrow /></ButtonLink>} />
        <Manage />
      </Page>
    </RequireAuth>
  );
}
