'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, openPrivateDoc } from '@/lib/api';
import { fmtDate, fmtDateTime, label, rupees, tone } from '@/lib/format';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Badge, Button, Card, EmptyState, ErrorBanner, Page, PageHeader, Spinner, Tabs } from '@/components/ui';

type Overview = {
  users: number; ridesOpen: number; rideBookings: number; pendingRideRequests: number; rentalBookings: number; groupRequests: number;
  driversPending: number; driversApproved: number; driversRejected: number; vehiclesPending: number; bookedValuePaise: number;
};
type Driver = {
  id: string; userId: string; name: string; contact: string; joinedAt: string; suspended: boolean; licence: string; licenceExpiresAt: string;
  docKey: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED'; rejectionReason: string | null; rides: number; rating: number | null;
};
type RideReq = {
  id: string; requestedAt: string; status: string; paymentStatus: string; passenger: string; passengerContact: string; driver: string;
  driverContact: string; origin: string; destination: string; departureAt: string; distanceKm: number; seats: number; pricePerSeatPaise: number; totalPaise: number;
};
type Rental = {
  id: string; requestedAt: string; status: string; paymentStatus: string; renter: string; renterContact: string; owner: string;
  vehicle: string; city: string; startAt: string; endAt: string; totalPaise: number;
};
type Vehicles = { vehicles: { id: string; owner: string; make: string; model: string; category: string; seatCapacity: number; registration: string; rcDocKey: string | null; insuranceDocKey: string | null }[] };
type Tab = 'overview' | 'drivers' | 'rides' | 'rentals' | 'vehicles' | 'groups' | 'audit';

const Th = ({ children }: { children: React.ReactNode }) => <th className="whitespace-nowrap px-4 py-3 font-medium">{children}</th>;
const Td = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
const Table = ({ head, children }: { head: string[]; children: React.ReactNode }) => (
  <Card className="overflow-x-auto p-0">
    <table className="w-full min-w-[760px] text-left text-sm">
      <thead className="border-b border-line text-muted"><tr>{head.map(h => <Th key={h}>{h}</Th>)}</tr></thead>
      <tbody className="divide-y divide-line">{children}</tbody>
    </table>
  </Card>
);
const doc = (key: string | null, text = 'View licence') =>
  key ? <button className="text-sm font-semibold text-route" onClick={() => openPrivateDoc(key)}>{text}</button> : <span className="text-muted">No file</span>;

/** Approve / reject a driver or vehicle. Reject asks for a reason the user will see. */
function useDecide(keys: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id, approve }: { kind: 'driver' | 'vehicle'; id: string; approve: boolean }) => {
      const reason = approve ? undefined : prompt('What should they fix? They will see this.') ?? undefined;
      if (!approve && !reason) return Promise.resolve();
      return api(`/admin/verifications/${kind}/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST', body: { reason } });
    },
    onSuccess: () => keys.forEach(k => qc.invalidateQueries({ queryKey: [k] })),
  });
}

function OverviewTab({ go }: { go: (t: Tab) => void }) {
  const { data } = useQuery({ queryKey: ['admin-overview'], queryFn: () => api<Overview>('/admin/overview') });
  if (!data) return <Spinner />;
  const cards: [string, string, Tab?][] = [
    ['Drivers waiting for verification', String(data.driversPending), 'drivers'],
    ['Vehicles waiting for verification', String(data.vehiclesPending), 'vehicles'],
    ['Ride requests waiting for drivers', String(data.pendingRideRequests), 'rides'],
    ['Booked value (rides + rentals)', rupees(data.bookedValuePaise)],
    ['Users', String(data.users)],
    ['Approved drivers', String(data.driversApproved), 'drivers'],
    ['Open rides', String(data.ridesOpen)],
    ['Ride bookings', String(data.rideBookings), 'rides'],
    ['Rental bookings', String(data.rentalBookings), 'rentals'],
    ['Group trip requests', String(data.groupRequests), 'groups'],
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([k, v, t]) => (
        <button key={k} disabled={!t} onClick={() => t && go(t)} className="text-left disabled:cursor-default">
          <Card className={t ? 'h-full transition hover:border-route' : 'h-full'}><p className="text-sm text-muted">{k}</p><p className="mt-1 font-display text-3xl font-bold">{v}</p></Card>
        </button>
      ))}
    </div>
  );
}

function DriversTab() {
  const { data } = useQuery({ queryKey: ['admin-drivers'], queryFn: () => api<Driver[]>('/admin/drivers') });
  const decide = useDecide(['admin-drivers', 'admin-overview']);
  if (!data) return <Spinner />;
  if (!data.length) return <EmptyState title="No drivers yet" body="A driver appears here after uploading a licence." />;
  return (
    <>
      <ErrorBanner error={decide.error} className="mb-4" />
      <Table head={['Driver', 'Licence', 'Status', 'Rides', 'Joined', 'Action']}>
        {data.map(d => (
          <tr key={d.id}>
            <Td><p className="font-semibold">{d.name}</p><p className="text-muted">{d.contact}</p></Td>
            <Td><p>{d.licence}</p><p className="text-muted">valid until {fmtDate(d.licenceExpiresAt)}</p>{doc(d.docKey)}</Td>
            <Td><Badge tone={tone(d.status)}>{label(d.status)}</Badge>{d.rejectionReason && <p className="mt-1 max-w-[200px] text-xs text-muted">{d.rejectionReason}</p>}</Td>
            <Td>{d.rides}{d.rating ? ` · ★ ${d.rating}` : ''}</Td>
            <Td>{fmtDate(d.joinedAt)}</Td>
            <Td>
              {d.status !== 'APPROVED' && <Button size="sm" onClick={() => decide.mutate({ kind: 'driver', id: d.id, approve: true })}>Approve</Button>}{' '}
              {d.status !== 'REJECTED' && <Button size="sm" variant="danger" onClick={() => decide.mutate({ kind: 'driver', id: d.id, approve: false })}>Reject</Button>}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}

const STATUSES = ['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const;
function RidesTab() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('ALL');
  const { data } = useQuery({
    queryKey: ['admin-ride-bookings', status],
    queryFn: () => api<RideReq[]>(`/admin/ride-bookings${status === 'ALL' ? '' : `?status=${status}`}`),
  });
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1 text-sm ${status === s ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>{label(s)}</button>
        ))}
      </div>
      {!data ? <Spinner /> : !data.length ? <EmptyState title="No ride requests" /> : (
        <Table head={['Requested', 'Passenger', 'Route', 'Departure', 'Persons', 'Amount', 'Driver', 'Status']}>
          {data.map(b => (
            <tr key={b.id}>
              <Td>{fmtDateTime(b.requestedAt)}</Td>
              <Td><p className="font-semibold">{b.passenger}</p><p className="text-muted">{b.passengerContact}</p></Td>
              <Td><p className="font-semibold">{b.origin} → {b.destination}</p><p className="text-muted">{b.distanceKm} km</p></Td>
              <Td>{fmtDateTime(b.departureAt)}</Td>
              <Td>{b.seats}</Td>
              <Td><p className="font-semibold">{rupees(b.totalPaise)}</p><p className="text-muted">{rupees(b.pricePerSeatPaise)} / seat</p></Td>
              <Td><p>{b.driver}</p><p className="text-muted">{b.driverContact}</p></Td>
              <Td><Badge tone={tone(b.status)}>{label(b.status)}</Badge><p className="mt-1"><Badge tone={tone(b.paymentStatus)}>{label(b.paymentStatus)}</Badge></p></Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function RentalsTab() {
  const { data } = useQuery({ queryKey: ['admin-rentals'], queryFn: () => api<Rental[]>('/admin/rental-bookings') });
  if (!data) return <Spinner />;
  if (!data.length) return <EmptyState title="No rental bookings yet" />;
  return (
    <Table head={['Requested', 'Renter', 'Vehicle', 'Dates', 'Amount', 'Owner', 'Status']}>
      {data.map(b => (
        <tr key={b.id}>
          <Td>{fmtDateTime(b.requestedAt)}</Td>
          <Td><p className="font-semibold">{b.renter}</p><p className="text-muted">{b.renterContact}</p></Td>
          <Td><p className="font-semibold">{b.vehicle}</p><p className="text-muted">{b.city}</p></Td>
          <Td>{fmtDateTime(b.startAt)} → {fmtDateTime(b.endAt)}</Td>
          <Td className="font-semibold">{rupees(b.totalPaise)}</Td>
          <Td>{b.owner}</Td>
          <Td><Badge tone={tone(b.status)}>{label(b.status)}</Badge><p className="mt-1"><Badge tone={tone(b.paymentStatus)}>{label(b.paymentStatus)}</Badge></p></Td>
        </tr>
      ))}
    </Table>
  );
}

function VehiclesTab() {
  const { data } = useQuery({ queryKey: ['verifications'], queryFn: () => api<Vehicles>('/admin/verifications') });
  const decide = useDecide(['verifications', 'admin-overview']);
  if (!data) return <Spinner />;
  if (!data.vehicles.length) return <EmptyState title="No vehicles waiting" body="New cars, bikes and buses appear here for verification." />;
  return (
    <div className="space-y-3">
      <ErrorBanner error={decide.error} />
      {data.vehicles.map(v => (
        <Card key={v.id} className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-semibold">{v.make} {v.model} · {v.owner}</p><p className="text-sm text-muted">{label(v.category)} · {v.seatCapacity} seats · {v.registration}</p>
            <div className="flex gap-4">{doc(v.rcDocKey, 'View RC')}{doc(v.insuranceDocKey, 'View insurance')}</div></div>
          <div className="flex gap-2"><Button size="sm" onClick={() => decide.mutate({ kind: 'vehicle', id: v.id, approve: true })}>Approve</Button><Button size="sm" variant="danger" onClick={() => decide.mutate({ kind: 'vehicle', id: v.id, approve: false })}>Reject</Button></div>
        </Card>
      ))}
    </div>
  );
}

function GroupsTab() {
  const { data } = useQuery({ queryKey: ['admin-groups'], queryFn: () => api<any[]>('/admin/group-requests') });
  if (!data) return <Spinner />;
  if (!data.length) return <EmptyState title="No group requests yet" />;
  return (
    <Table head={['Route', 'Organizer', 'Departure', 'Persons', 'Status']}>
      {data.map(g => (
        <tr key={g.id}><Td className="font-semibold">{g.origin} → {g.destination}</Td><Td>{g.organizer}</Td><Td>{fmtDateTime(g.departureAt)}</Td><Td>{g.passengerCount}</Td><Td><Badge tone={tone(g.status)}>{label(g.status)}</Badge></Td></tr>
      ))}
    </Table>
  );
}

function AuditTab() {
  const { data } = useQuery({ queryKey: ['audit'], queryFn: () => api<any[]>('/admin/audit-logs') });
  if (!data) return <Spinner />;
  if (!data.length) return <EmptyState title="No admin actions yet" />;
  return (
    <Card className="p-0">
      <ul className="divide-y divide-line">{data.map(a => (
        <li key={a.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm"><span className="font-semibold">{a.action}</span><span className="text-muted">{a.entityType} {a.entityId.slice(0, 8)} · {fmtDateTime(a.createdAt)}</span></li>
      ))}</ul>
    </Card>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <RequireAuth role="ADMIN">
      <Page>
        <PageHeader eyebrow="Admin" title="Admin dashboard" subtitle="Verify drivers and vehicles, and see every ride request, rental and group trip. Every decision is audit-logged." />
        <div className="overflow-x-auto">
          <Tabs<Tab> value={tab} onChange={setTab} items={[
            { value: 'overview', label: 'Overview' }, { value: 'drivers', label: 'Drivers' }, { value: 'rides', label: 'Ride requests' },
            { value: 'rentals', label: 'Rentals' }, { value: 'vehicles', label: 'Vehicles' }, { value: 'groups', label: 'Group trips' }, { value: 'audit', label: 'Audit log' },
          ]} />
        </div>
        {{ overview: <OverviewTab go={setTab} />, drivers: <DriversTab />, rides: <RidesTab />, rentals: <RentalsTab />,
          vehicles: <VehiclesTab />, groups: <GroupsTab />, audit: <AuditTab /> }[tab]}
      </Page>
    </RequireAuth>
  );
}
