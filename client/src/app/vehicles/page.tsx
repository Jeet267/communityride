'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { label, tone } from '@/lib/format';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { uploadDoc } from '@/lib/upload';
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorBanner, Field, Page, PageHeader, Select } from '@/components/ui';

type Vehicle = { id: string; category: string; make: string; model: string; seatCapacity: number; verificationStatus: string; registration: string };
const ROLES = [
  { role: 'DRIVER', title: 'Driver', body: 'Publish rides and drive group trips.' },
  { role: 'RENTAL_OWNER', title: 'Rental owner', body: 'Rent out your car, bike or scooter.' },
  { role: 'FLEET_OPERATOR', title: 'Fleet operator', body: 'Quote buses and tempos for 40-50+ groups.' },
];

function Roles() {
  const { user, hasRole, reload } = useAuth();
  const add = useMutation({ mutationFn: async (role: string) => { await api('/users/me/roles', { method: 'POST', body: { role } }); await reload(); } });
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {ROLES.map(r => (
        <Card key={r.role} className="flex flex-col">
          <p className="text-lg font-semibold">{r.title}</p>
          <p className="mt-1 flex-1 text-sm text-muted">{r.body}</p>
          <div className="mt-4">
            {hasRole(r.role) ? <Badge tone="ok">Active{r.role === 'DRIVER' && user?.driverStatus !== 'APPROVED' ? ' · licence not verified' : ''}</Badge>
              : r.role === 'DRIVER' ? <ButtonLink href="/driver/onboarding" size="sm" variant="outline">Submit licence</ButtonLink>
                : <Button size="sm" variant="outline" loading={add.isPending && add.variables === r.role} onClick={() => add.mutate(r.role)}>Add this role</Button>}
          </div>
        </Card>
      ))}
    </div>
  );
}

function AddVehicle({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ category: 'CAR', make: '', model: '', registration: '', seatCapacity: 5, insuranceExpiresAt: '' });
  const [rc, setRc] = useState<File | null>(null);
  const [ins, setIns] = useState<File | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      const [rcDocKey, insuranceDocKey] = await Promise.all([rc ? uploadDoc(rc) : undefined, ins ? uploadDoc(ins) : undefined]);
      return api('/vehicles', { method: 'POST', body: { ...f, seatCapacity: Number(f.seatCapacity), rcDocKey, insuranceDocKey, insuranceExpiresAt: f.insuranceExpiresAt || undefined } });
    },
    onSuccess: () => { onDone(); setF(p => ({ ...p, make: '', model: '', registration: '' })); },
  });
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }));
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-semibold">Add a vehicle</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Type" value={f.category} onChange={e => { set('category', e.target.value); set('seatCapacity', { CAR: 5, BIKE: 2, SCOOTER: 2, BUS: 45, MINI_BUS: 26, TEMPO_TRAVELLER: 17 }[e.target.value]); }}>
          {['CAR', 'BIKE', 'SCOOTER', 'BUS', 'MINI_BUS', 'TEMPO_TRAVELLER'].map(c => <option key={c} value={c}>{label(c)}</option>)}
        </Select>
        <Field label="Seats (including driver)" type="number" min={1} max={80} value={f.seatCapacity} onChange={e => set('seatCapacity', e.target.value)} />
        <Field label="Make" placeholder="Maruti" value={f.make} onChange={e => set('make', e.target.value)} />
        <Field label="Model" placeholder="Dzire" value={f.model} onChange={e => set('model', e.target.value)} />
        <Field label="Registration number" placeholder="HR 26 AB 1234" value={f.registration} onChange={e => set('registration', e.target.value)} />
        <Field label="Insurance valid until" type="date" value={f.insuranceExpiresAt} onChange={e => set('insuranceExpiresAt', e.target.value)} />
        <Field label="RC document (optional)" type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => setRc(e.target.files?.[0] ?? null)} />
        <Field label="Insurance document (optional)" type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => setIns(e.target.files?.[0] ?? null)} />
      </div>
      <ErrorBanner error={m.error} />
      <Button loading={m.isPending} disabled={!f.make || !f.model || !f.registration} onClick={() => m.mutate()}>Submit for verification</Button>
    </Card>
  );
}

function Vehicles() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const { data } = useQuery({ queryKey: ['my-vehicles'], queryFn: () => api<Vehicle[]>('/vehicles/me') });
  const canAdd = ['DRIVER', 'RENTAL_OWNER', 'FLEET_OPERATOR'].some(hasRole);
  return (
    <>
      <Roles />
      <h2 className="mt-12 text-xl font-semibold">Your vehicles</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {data?.length === 0 && <EmptyState title="No vehicles yet" body={canAdd ? 'Add one below. Our team verifies it before it can be used.' : 'Pick a role above to add vehicles.'} />}
        {data?.map(v => (
          <Card key={v.id} className="flex items-center justify-between gap-3">
            <div><p className="font-semibold">{v.make} {v.model}</p><p className="text-sm text-muted">{label(v.category)} · {v.seatCapacity} seats · {v.registration}</p></div>
            <Badge tone={tone(v.verificationStatus)}>{v.verificationStatus === 'PENDING' ? 'Waiting for review' : label(v.verificationStatus)}</Badge>
          </Card>
        ))}
      </div>
      {canAdd && <div className="mt-8"><AddVehicle onDone={() => qc.invalidateQueries({ queryKey: ['my-vehicles'] })} /></div>}
    </>
  );
}

export default function VehiclesPage() {
  return (
    <RequireAuth>
      <Page>
        <PageHeader eyebrow="Partners" title="Vehicles & roles" subtitle="Choose how you use RideMate, then add vehicles for verification." />
        <Vehicles />
      </Page>
    </RequireAuth>
  );
}
