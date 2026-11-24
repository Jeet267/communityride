'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDateTime, label, rupees, tone } from '@/lib/format';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { useAuth } from '@/lib/auth';
import { Arrow, Badge, Button, ButtonLink, Card, EmptyState, ErrorBanner, Page, PageHeader, Spinner } from '@/components/ui';

type Dash = {
  earningsPaise: number;
  rides: { id: string; type: string; title: string | null; origin: string; destination: string; departureAt: string; status: string; seatsLeft: number;
    totalSeats: number; vehicle: string; checklistDone: boolean; bookings: { id: string; passenger: string; seats: number; status: string; totalPaise: number }[] }[];
  groupTrips: { requestId: string; origin: string; destination: string; departureAt: string; vehicle: string; passengers: number }[];
};

function Checklist({ rideId, onDone }: { rideId: string; onDone: () => void }) {
  const [c, setC] = useState({ tyresOk: false, fuelOk: false, documentsOk: false });
  const m = useMutation({ mutationFn: () => api(`/driver/trips/${rideId}/checklist`, { method: 'POST', body: c }), onSuccess: onDone });
  return (
    <div className="rounded-xl bg-canvas p-4">
      <p className="text-sm font-semibold">Pre-trip checklist</p>
      <div className="mt-2 flex flex-wrap gap-4">
        {([['tyresOk', 'Tyres checked'], ['fuelOk', 'Fuel enough for the trip'], ['documentsOk', 'RC, licence, insurance in car']] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-route" checked={c[k]} onChange={e => setC(p => ({ ...p, [k]: e.target.checked }))} />{l}</label>
        ))}
      </div>
      <ErrorBanner error={m.error} className="mt-3" />
      <Button size="sm" variant="outline" className="mt-3" disabled={!c.tyresOk || !c.fuelOk || !c.documentsOk} loading={m.isPending} onClick={() => m.mutate()}>Save checklist</Button>
    </div>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['driver-dash'], queryFn: () => api<Dash>('/driver/dashboard') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['driver-dash'] });
  const act = useMutation({ mutationFn: ({ path, body }: { path: string; body?: unknown }) => api(path, { method: 'POST', body }), onSuccess: refresh });
  if (isLoading || !data) return <Spinner />;
  const pending = data.rides.reduce((n, r) => n + r.bookings.filter(b => b.status === 'PENDING').length, 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {[['Earnings after fees', rupees(data.earningsPaise)], ['Upcoming trips', String(data.rides.length + data.groupTrips.length)], ['Requests waiting', String(pending)]].map(([k, v]) => (
          <Card key={k}><p className="text-sm text-muted">{k}</p><p className="mt-1 font-display text-3xl font-bold">{v}</p></Card>
        ))}
      </div>
      <ErrorBanner error={act.error} className="mt-6" />

      <h2 className="mt-10 text-xl font-semibold">Ride requests ({pending})</h2>
      <div className="mt-4">
        {!pending ? <EmptyState title="No requests waiting" body="When a passenger asks to join one of your rides, it shows up here." /> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-muted"><tr>{['Passenger', 'From → To', 'Departure', 'Persons', 'Amount', ''].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {data.rides.flatMap(r => r.bookings.filter(b => b.status === 'PENDING').map(b => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-semibold">{b.passenger}</td>
                    <td className="px-4 py-3">{r.origin} → {r.destination}</td>
                    <td className="px-4 py-3">{fmtDateTime(r.departureAt)}</td>
                    <td className="px-4 py-3">{b.seats}</td>
                    <td className="px-4 py-3 font-semibold">{rupees(b.totalPaise)}</td>
                    <td className="px-4 py-3"><span className="flex gap-2">
                      <Button size="sm" onClick={() => act.mutate({ path: `/driver/bookings/${b.id}/accept` })}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ path: `/driver/bookings/${b.id}/reject` })}>Decline</Button>
                    </span></td>
                  </tr>
                )))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Your rides</h2>
      <div className="mt-4 space-y-4">
        {!data.rides.length && <EmptyState title="No upcoming rides" body="Publish your next trip and passengers can start booking." action={<ButtonLink href="/rides/new">Publish a ride</ButtonLink>} />}
        {data.rides.map(r => (
          <Card key={r.id} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {r.title && <p className="text-sm font-semibold text-route">{r.title}</p>}
                <p className="text-lg font-semibold">{r.origin} → {r.destination}</p>
                <p className="text-sm text-muted">{fmtDateTime(r.departureAt)} · {r.vehicle} · {r.seatsLeft} of {r.totalSeats} seats left</p>
              </div>
              <Badge tone={tone(r.status)}>{label(r.status)}</Badge>
            </div>
            {r.bookings.length > 0 && (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {r.bookings.map(b => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span><b>{b.passenger}</b> · {b.seats} seat{b.seats > 1 ? 's' : ''} · {rupees(b.totalPaise)}</span>
                    {b.status === 'PENDING' ? (
                      <span className="flex gap-2">
                        <Button size="sm" onClick={() => act.mutate({ path: `/driver/bookings/${b.id}/accept` })}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => act.mutate({ path: `/driver/bookings/${b.id}/reject` })}>Decline</Button>
                      </span>
                    ) : <Badge tone={tone(b.status)}>{label(b.status)}</Badge>}
                  </li>
                ))}
              </ul>
            )}
            {r.status === 'PUBLISHED' && !r.checklistDone && <Checklist rideId={r.id} onDone={refresh} />}
            <div className="flex flex-wrap gap-2">
              {r.status === 'PUBLISHED' && r.checklistDone && <Button size="sm" onClick={() => act.mutate({ path: `/driver/trips/${r.id}/start` })}>Start trip</Button>}
              {r.status === 'STARTED' && <Button size="sm" onClick={() => act.mutate({ path: `/driver/trips/${r.id}/complete` })}>Complete trip</Button>}
              {r.status === 'PUBLISHED' && (
                <Button size="sm" variant="danger" onClick={() => { const reason = prompt('Why are you cancelling? Passengers will see this.'); if (reason) act.mutate({ path: `/rides/${r.id}/cancel`, body: { reason } }); }}>Cancel ride</Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {data.groupTrips.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-semibold">Assigned group trips</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {data.groupTrips.map(g => (
              <Card key={g.requestId}>
                <p className="text-lg font-semibold">{g.origin} → {g.destination}</p>
                <p className="text-sm text-muted">{fmtDateTime(g.departureAt)} · {g.vehicle} · {g.passengers} passengers</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** First time: upload a licence. Then: wait for the admin. Rejected: see why and upload again. Approved: full dashboard. */
function LicenceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const status = user?.driverStatus ?? null;
  if (status === null) return (
    <Card className="max-w-xl py-10">
      <h2 className="text-2xl font-bold tracking-tight">Upload your driving licence first</h2>
      <p className="mt-2 text-muted">Every driver is verified by a RideMate admin before passengers can book. It takes one minute.</p>
      <ButtonLink href="/driver/onboarding" className="mt-6">Upload licence</ButtonLink>
    </Card>
  );
  return (
    <>
      {status === 'PENDING' && (
        <Card className="mb-6 border-warn/40 bg-warn/5"><p className="font-semibold">Your licence is with the admin for verification</p>
          <p className="text-sm text-muted">You can publish rides as soon as it is approved. We'll notify you.</p></Card>
      )}
      {status === 'REJECTED' && (
        <Card className="mb-6 border-warn/40 bg-warn/5"><p className="font-semibold">Your licence was not approved</p>
          <p className="text-sm text-muted">{user?.driverRejectionReason ?? 'Please upload a clearer photo.'}</p>
          <ButtonLink href="/driver/onboarding" variant="outline" className="mt-3">Upload again</ButtonLink></Card>
      )}
      {children}
    </>
  );
}

export default function DriverPage() {
  return (
    <RequireAuth role="DRIVER">
      <Page>
        <PageHeader eyebrow="Drivers" title="Driver dashboard" subtitle="See who wants to join your rides, accept requests and complete your trips."
          action={<ButtonLink href="/rides/new" variant="blue">Publish a ride <Arrow /></ButtonLink>} />
        <LicenceGate><Dashboard /></LicenceGate>
      </Page>
    </RequireAuth>
  );
}
