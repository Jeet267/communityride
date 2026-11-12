'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toPaise } from '@/lib/format';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Button, ButtonLink, Card, EmptyState, ErrorBanner, Field, Page, PageHeader, Select, TextArea } from '@/components/ui';

function Form() {
  const router = useRouter();
  const { data: vehicles } = useQuery({ queryKey: ['my-vehicles'], queryFn: () => api<any[]>('/vehicles/me') });
  const usable = (vehicles ?? []).filter(v => v.verificationStatus === 'APPROVED' && ['CAR', 'BIKE', 'SCOOTER'].includes(v.category));
  const [f, setF] = useState({ vehicleId: '', city: 'Gurugram', address: '', mode: 'SELF_DRIVE', price: '2500', deposit: '5000', km: '250', extra: '10', helmet: false,
    policy: 'Full refund up to 24 hours before pickup.' });
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }));
  const m = useMutation({
    mutationFn: () => api('/rentals', { method: 'POST', body: {
      vehicleId: f.vehicleId || usable[0]?.id, city: f.city, pickupAddress: f.address, rentalMode: f.mode, pricePerDayPaise: toPaise(f.price),
      securityDepositPaise: toPaise(f.deposit), includedKmPerDay: Number(f.km), extraKmChargePaise: toPaise(f.extra), helmetIncluded: f.helmet, cancellationPolicy: f.policy,
    } }),
    onSuccess: () => router.push('/rentals/manage'),
  });
  if (vehicles && !usable.length) return <EmptyState title="Add a verified car, bike or scooter first" body="Listings use a vehicle our team has verified." action={<ButtonLink href="/vehicles">Add a vehicle</ButtonLink>} />;
  return (
    <Card className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <Select label="Vehicle" value={f.vehicleId || usable[0]?.id || ''} onChange={e => set('vehicleId', e.target.value)}>
        {usable.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.registration}</option>)}
      </Select>
      <Select label="Mode" value={f.mode} onChange={e => set('mode', e.target.value)}><option value="SELF_DRIVE">Self-drive</option><option value="WITH_DRIVER">With driver</option></Select>
      <Field label="City" value={f.city} onChange={e => set('city', e.target.value)} />
      <Field label="Pickup address" placeholder="Sector 29, Gurugram" value={f.address} onChange={e => set('address', e.target.value)} />
      <Field label="Price per day (₹)" type="number" value={f.price} onChange={e => set('price', e.target.value)} />
      <Field label="Refundable deposit (₹)" type="number" value={f.deposit} onChange={e => set('deposit', e.target.value)} />
      <Field label="Included km per day" type="number" value={f.km} onChange={e => set('km', e.target.value)} />
      <Field label="Extra km charge (₹/km)" type="number" value={f.extra} onChange={e => set('extra', e.target.value)} />
      <TextArea className="sm:col-span-2" label="Cancellation policy" value={f.policy} onChange={e => set('policy', e.target.value)} />
      <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" className="h-4 w-4 accent-route" checked={f.helmet} onChange={e => set('helmet', e.target.checked)} />Helmet included (bikes and scooters)</label>
      <ErrorBanner error={m.error} className="sm:col-span-2" />
      <Button className="w-fit" loading={m.isPending} disabled={f.address.length < 5} onClick={() => m.mutate()}>Publish listing</Button>
    </Card>
  );
}

export default function NewRentalPage() {
  return <RequireAuth role="RENTAL_OWNER"><Page><PageHeader eyebrow="Rental owners" title="List your vehicle" subtitle="Set your daily rate, deposit and included kilometres." /><Form /></Page></RequireAuth>;
}
