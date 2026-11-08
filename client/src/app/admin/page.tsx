'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, openPrivateDoc } from '@/lib/api';
import { fmtDate, fmtDateTime, label, tone } from '@/lib/format';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Badge, Button, Card, EmptyState, ErrorBanner, Page, PageHeader, Spinner, Tabs } from '@/components/ui';

type Verifs = {
  drivers: { id: string; name: string; licence: string; licenceExpiresAt: string; docKey: string | null }[];
  vehicles: { id: string; owner: string; make: string; model: string; category: string; seatCapacity: number; registration: string; rcDocKey: string | null; insuranceDocKey: string | null }[];
};

function Verifications() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['verifications'], queryFn: () => api<Verifs>('/admin/verifications') });
  const decide = useMutation({
    mutationFn: ({ kind, id, approve }: { kind: string; id: string; approve: boolean }) => {
      const reason = approve ? undefined : prompt('What should they fix?') ?? undefined;
      if (!approve && !reason) return Promise.resolve();
      return api(`/admin/verifications/${kind}/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST', body: { reason } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verifications'] }),
  });
  const doc = (key: string | null) => key && <button className="text-sm font-semibold text-route" onClick={() => openPrivateDoc(key)}>View document</button>;
  if (isLoading || !data) return <Spinner />;
  return (
    <div className="space-y-8">
      <ErrorBanner error={decide.error} />
      <section>
        <h2 className="text-xl font-semibold">Drivers waiting ({data.drivers.length})</h2>
        <div className="mt-4 space-y-3">
          {!data.drivers.length && <EmptyState title="No drivers waiting" />}
          {data.drivers.map(d => (
            <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-semibold">{d.name}</p><p className="text-sm text-muted">Licence {d.licence} · valid until {fmtDate(d.licenceExpiresAt)}</p>{doc(d.docKey)}</div>
              <div className="flex gap-2"><Button size="sm" onClick={() => decide.mutate({ kind: 'driver', id: d.id, approve: true })}>Approve</Button><Button size="sm" variant="danger" onClick={() => decide.mutate({ kind: 'driver', id: d.id, approve: false })}>Reject</Button></div>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Vehicles waiting ({data.vehicles.length})</h2>
        <div className="mt-4 space-y-3">
          {!data.vehicles.length && <EmptyState title="No vehicles waiting" />}
          {data.vehicles.map(v => (
            <Card key={v.id} className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-semibold">{v.make} {v.model} · {v.owner}</p><p className="text-sm text-muted">{label(v.category)} · {v.seatCapacity} seats · {v.registration}</p>
                <div className="flex gap-4">{doc(v.rcDocKey)}{doc(v.insuranceDocKey)}</div></div>
              <div className="flex gap-2"><Button size="sm" onClick={() => decide.mutate({ kind: 'vehicle', id: v.id, approve: true })}>Approve</Button><Button size="sm" variant="danger" onClick={() => decide.mutate({ kind: 'vehicle', id: v.id, approve: false })}>Reject</Button></div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Groups() {
  const { data } = useQuery({ queryKey: ['admin-groups'], queryFn: () => api<any[]>('/admin/group-requests') });
  if (!data) return <Spinner />;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-muted"><tr><th className="px-5 py-3">Route</th><th>Organizer</th><th>Departure</th><th>Passengers</th><th>Status</th></tr></thead>
        <tbody className="divide-y divide-line">{data.map(g => (
          <tr key={g.id}><td className="px-5 py-3 font-semibold">{g.origin} → {g.destination}</td><td>{g.organizer}</td><td>{fmtDateTime(g.departureAt)}</td><td>{g.passengerCount}</td><td><Badge tone={tone(g.status)}>{label(g.status)}</Badge></td></tr>
        ))}</tbody>
      </table>
    </Card>
  );
}

function Audit() {
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
  const [tab, setTab] = useState<'verify' | 'groups' | 'audit'>('verify');
  return (
    <RequireAuth role="ADMIN">
      <Page>
        <PageHeader eyebrow="Admin" title="Operations" subtitle="Verify drivers and vehicles before they can take bookings. Every decision is audit-logged." />
        <Tabs value={tab} onChange={setTab} items={[{ value: 'verify', label: 'Verifications' }, { value: 'groups', label: 'Group requests' }, { value: 'audit', label: 'Audit log' }]} />
        {tab === 'verify' ? <Verifications /> : tab === 'groups' ? <Groups /> : <Audit />}
      </Page>
    </RequireAuth>
  );
}
