'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { GroupDetail, STEP_LABEL } from '@/lib/groups';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { AllocationBoard } from '@/components/groups/AllocationBoard';
import { Badge, ErrorBanner, Page, PageHeader, Spinner } from '@/components/ui';

function Board({ id }: { id: string }) {
  // Lives here, not in the board: the board remounts (new key) after a save, which would drop its own state.
  const [saved, setSaved] = useState(false);
  const group = useQuery({ queryKey: ['group', id], queryFn: () => api<GroupDetail>(`/group-requests/${id}`) });
  const vehicles = useQuery({ queryKey: ['fleet-vehicles'], queryFn: () => api<any[]>('/fleet/vehicles') });
  const drivers = useQuery({ queryKey: ['fleet-drivers'], queryFn: () => api<{ id: string; name: string }[]>('/fleet/drivers') });
  if (group.error) return <ErrorBanner error={group.error} />;
  if (!group.data || !vehicles.data || !drivers.data) return <Spinner />;
  const g = group.data;
  return (
    <>
      <PageHeader eyebrow="Fleet operators" title={`${g.origin} → ${g.destination}`} subtitle={`${g.passengerCount} passengers · ${fmtDateTime(g.departureAt)} · ${g.distanceKm} km`}
        action={<Badge tone={g.status === 'CONFIRMED' ? 'ok' : 'blue'}>{STEP_LABEL[g.status] ?? g.status}</Badge>} />
      {g.acceptedQuote?.byMe
        ? <AllocationBoard key={g.allocations.map(a => a.id).join()} group={g} vehicles={vehicles.data} drivers={drivers.data} saved={saved} onSaved={() => setSaved(true)} />
        : <ErrorBanner error={new Error('Your quote has not been accepted for this trip.')} />}
    </>
  );
}

export default function FleetGroupPage({ params }: { params: { id: string } }) {
  return <RequireAuth role="FLEET_OPERATOR"><Page><Board id={params.id} /></Page></RequireAuth>;
}
