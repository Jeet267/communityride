'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { GroupDetail } from '@/lib/groups';
import { label } from '@/lib/format';
import { Button, Card, ErrorBanner } from '../ui';
import { CapacityMeter } from './CapacityMeter';

type Vehicle = { id: string; category: string; make: string; model: string; seatCapacity: number; registration: string };
type Row = { vehicleId: string; assignedPassengers: number; driverUserId?: string };

/** Operator picks vehicles, splits passengers and assigns a verified driver to each. The meter updates live. */
export function AllocationBoard({ group, vehicles, drivers, saved, onSaved }: {
  group: GroupDetail; vehicles: Vehicle[]; drivers: { id: string; name: string }[]; saved?: boolean; onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() => group.allocations.map(a => ({ vehicleId: a.vehicleId, assignedPassengers: a.assignedPassengers, driverUserId: a.driver?.id })));
  const byId = (id: string) => vehicles.find(v => v.id === id);
  const assigned = rows.reduce((s, r) => s + r.assignedPassengers, 0);

  const toggle = (v: Vehicle) => setRows(rs => rs.some(r => r.vehicleId === v.id)
    ? rs.filter(r => r.vehicleId !== v.id)
    : [...rs, { vehicleId: v.id, assignedPassengers: Math.min(v.seatCapacity, Math.max(1, group.passengerCount - rs.reduce((s, r) => s + r.assignedPassengers, 0))) }]);
  // Re-split all passengers across the ticked vehicles, biggest first, so unticking/ticking never leaves gaps.
  const autoSplit = () => setRows(rs => {
    let left = group.passengerCount;
    const sorted = [...rs].sort((a, b) => (byId(b.vehicleId)?.seatCapacity ?? 0) - (byId(a.vehicleId)?.seatCapacity ?? 0));
    const seats = new Map(sorted.map(r => { const n = Math.max(1, Math.min(byId(r.vehicleId)?.seatCapacity ?? 1, left)); left -= n; return [r.vehicleId, n]; }));
    return rs.map(r => ({ ...r, assignedPassengers: seats.get(r.vehicleId) ?? r.assignedPassengers }));
  });
  const update = (id: string, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.vehicleId === id ? { ...r, ...patch } : r)));

  const save = useMutation({
    mutationFn: async () => {
      const res = await api<{ allocations: { id: string; vehicleId: string }[] }>(`/fleet/group-requests/${group.id}/allocations`, {
        method: 'POST', body: { allocations: rows.map(({ vehicleId, assignedPassengers }) => ({ vehicleId, assignedPassengers })) },
      });
      const assignments = rows.filter(r => r.driverUserId)
        .map(r => ({ allocationId: res.allocations.find(a => a.vehicleId === r.vehicleId)!.id, driverUserId: r.driverUserId! }));
      if (assignments.length) await api(`/fleet/group-requests/${group.id}/driver-assignments`, { method: 'POST', body: { assignments } });
    },
    onSuccess: () => { onSaved?.(); return qc.invalidateQueries({ queryKey: ['group', group.id] }); },
  });

  const usedDrivers = new Set(rows.map(r => r.driverUserId).filter(Boolean));
  const locked = group.status === 'CONFIRMED';

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit">
        <p className="font-semibold">Your verified fleet</p>
        <ul className="mt-4 space-y-2">
          {vehicles.map(v => (
            <li key={v.id}>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 hover:border-route/50">
                <span><span className="block font-medium">{v.make} {v.model}</span><span className="text-sm text-muted">{label(v.category)} · {v.seatCapacity} seats</span></span>
                <input type="checkbox" className="h-4 w-4 accent-route" disabled={locked} checked={rows.some(r => r.vehicleId === v.id)} onChange={() => toggle(v)} />
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        <CapacityMeter required={group.passengerCount} segments={rows.map(r => ({ label: byId(r.vehicleId)?.model ?? 'Vehicle', seats: r.assignedPassengers }))} />
        {rows.map(r => {
          const v = byId(r.vehicleId);
          if (!v) return null;
          return (
            <Card key={r.vehicleId} className="grid gap-4 md:grid-cols-[1fr_170px_220px] md:items-end">
              <div><p className="font-semibold">{v.make} {v.model}</p><p className="text-sm text-muted">{v.registration} · {v.seatCapacity} seats</p></div>
              <label className="block"><span className="text-sm font-semibold">Passengers</span>
                <input type="number" min={1} max={v.seatCapacity} disabled={locked} value={r.assignedPassengers}
                  onChange={e => update(r.vehicleId, { assignedPassengers: Math.max(1, Math.min(v.seatCapacity, +e.target.value)) })}
                  className="mt-1.5 h-11 w-full rounded-field border border-line px-3.5 outline-none focus:border-route" />
              </label>
              <label className="block"><span className="text-sm font-semibold">Driver</span>
                <select value={r.driverUserId ?? ''} disabled={locked} onChange={e => update(r.vehicleId, { driverUserId: e.target.value || undefined })}
                  className="mt-1.5 h-11 w-full rounded-field border border-line bg-white px-3 outline-none focus:border-route">
                  <option value="">Choose a driver</option>
                  {drivers.map(d => <option key={d.id} value={d.id} disabled={usedDrivers.has(d.id) && r.driverUserId !== d.id}>{d.name}</option>)}
                </select>
              </label>
            </Card>
          );
        })}
        <ErrorBanner error={save.error} />
        {!locked && (
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" loading={save.isPending} disabled={!rows.length} onClick={() => save.mutate()}>Save vehicles and drivers</Button>
            <Button variant="outline" disabled={!rows.length} onClick={autoSplit}>Auto-split passengers</Button>
            <span className="text-sm text-muted">{assigned < group.passengerCount ? `${group.passengerCount - assigned} ${group.passengerCount - assigned === 1 ? 'passenger still needs' : 'passengers still need'} a seat` : 'The organizer can confirm once every vehicle has a driver.'}</span>
          </div>
        )}
        {(saved || save.isSuccess) && !save.isPending && <p className="text-sm font-semibold text-ok">Saved. The organizer has been notified.</p>}
      </div>
    </div>
  );
}
