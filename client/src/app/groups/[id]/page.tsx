'use client';
import { useRef, useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, newKey, rupees } from '@/lib/format';
import { GroupDetail, STEPS, STEP_LABEL } from '@/lib/groups';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { CapacityMeter } from '@/components/groups/CapacityMeter';
import { Badge, Button, Card, ErrorBanner, Page, Spinner, TextArea } from '@/components/ui';

function Steps({ status }: { status: string }) {
  const at = STEPS.indexOf(status as any);
  return (
    <ol className="flex flex-wrap gap-2">
      {STEPS.map((s, i) => (
        <li key={s} className={clsx('rounded-full px-3 py-1.5 text-sm font-medium', status === 'CANCELLED' ? 'bg-black/5 text-muted' : i < at ? 'bg-ok/10 text-ok' : i === at ? 'bg-ink text-white' : 'bg-white text-muted')}>
          {i + 1}. {STEP_LABEL[s]}
        </li>
      ))}
    </ol>
  );
}

function Manifest({ g }: { g: GroupDetail }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const { data } = useQuery({ queryKey: ['manifest', g.id], queryFn: () => api<{ count: number; participants: { name: string; phone?: string }[] }>(`/group-requests/${g.id}/manifest`) });
  const add = useMutation({
    mutationFn: () => api(`/group-requests/${g.id}/participants`, { method: 'POST', body: {
      participants: text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const [name, phone] = l.split(',').map(s => s.trim());
        return { name, ...(phone ? { phone: phone.startsWith('+91') ? phone : `+91${phone}` } : {}) };
      }),
    } }),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['manifest', g.id] }); qc.invalidateQueries({ queryKey: ['group', g.id] }); },
  });
  return (
    <Card className="space-y-4">
      <div className="flex items-baseline justify-between"><h2 className="text-xl font-semibold">Passenger manifest</h2><span className="text-sm text-muted">{data?.count ?? 0} of {g.passengerCount} added</span></div>
      {!!data?.participants.length && (
        <ul className="grid max-h-60 gap-1 overflow-auto text-sm sm:grid-cols-2">{data.participants.map((p, i) => <li key={i}>{i + 1}. {p.name} {p.phone && <span className="text-muted">· {p.phone}</span>}</li>)}</ul>
      )}
      <TextArea label="Add travellers — one per line: name, phone (optional)" placeholder={'Aarav Shah, 9876543210\nDiya Patel'} value={text} onChange={e => setText(e.target.value)} />
      <ErrorBanner error={add.error} />
      <Button variant="outline" disabled={!text.trim()} loading={add.isPending} onClick={() => add.mutate()}>Add to manifest</Button>
    </Card>
  );
}

function Detail({ id }: { id: string }) {
  const qc = useQueryClient();
  const payKey = useRef<Record<string, string>>({});
  const { data: g, isLoading, error } = useQuery({ queryKey: ['group', id], queryFn: () => api<GroupDetail>(`/group-requests/${id}`) });
  const act = useMutation({
    mutationFn: ({ path, body, key }: { path: string; body?: unknown; key?: string }) => api(path, { method: 'POST', body, idempotencyKey: key }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group', id] }),
  });
  if (isLoading) return <Spinner />;
  if (!g) return <ErrorBanner error={error} />;
  const pay = (purpose: 'ADVANCE' | 'BALANCE') => {
    payKey.current[purpose] ??= newKey();
    act.mutate({ path: '/payments/orders', body: { bookingType: 'GROUP', bookingId: id, purpose }, key: payKey.current[purpose] });
  };
  const total = g.acceptedQuote?.totalPricePaise ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-route">Group trip · {g.passengerCount} passengers</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] md:text-[40px]">{g.origin} → {g.destination}</h1>
          <p className="mt-1 text-muted">{fmtDateTime(g.departureAt)} — return {fmtDate(g.returnAt)} · {g.distanceKm} km by road{g.budgetTotalPaise ? ` · budget ${rupees(g.budgetTotalPaise)}` : ''}</p>
        </div>
        {g.isOrganizer && !['CONFIRMED', 'CANCELLED'].includes(g.status) && (
          <Button variant="danger" size="sm" onClick={() => confirm('Cancel this group request?') && act.mutate({ path: `/group-requests/${id}/cancel` })}>Cancel request</Button>
        )}
      </div>
      <Steps status={g.status} />
      <ErrorBanner error={act.error} />

      {g.status === 'OPEN_FOR_QUOTES' && (
        <Card>
          <h2 className="text-xl font-semibold">Quotes</h2>
          {!g.quotes.length ? <p className="mt-2 text-muted">Operators are reviewing your request. Quotes usually arrive within a day.</p> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-muted"><tr><th className="py-2">Operator</th><th>Vehicle plan</th><th>Total</th><th>Per person</th><th>Valid until</th><th /></tr></thead>
                <tbody className="divide-y divide-line">
                  {g.quotes.map((q, i) => (
                    <tr key={q.id}>
                      <td className="py-3 font-semibold">{q.operator} {i === 0 && g.quotes.length > 1 && <Badge tone="ok">Lowest</Badge>}</td>
                      <td>{q.vehiclePlan}<p className="text-xs text-muted">{q.inclusions}</p></td>
                      <td className="font-semibold">{rupees(q.totalPricePaise)}</td>
                      <td>{rupees(Math.round(q.totalPricePaise / g.passengerCount))}</td>
                      <td>{fmtDate(q.validUntil)}</td>
                      <td className="text-right">{g.isOrganizer && <Button size="sm" loading={act.isPending} onClick={() => act.mutate({ path: `/group-requests/${id}/quotes/${q.id}/accept` })}>Accept</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted">{g.quotes[0]?.cancellationTerms}</p>
            </div>
          )}
        </Card>
      )}

      {g.acceptedQuote && (
        <Card className="flex flex-wrap items-center justify-between gap-4 bg-canvas">
          <div><p className="text-sm text-muted">Accepted quote</p><p className="text-lg font-semibold">{g.acceptedQuote.operator} · {rupees(total)}</p></div>
          {g.status === 'QUOTE_ACCEPTED' && <p className="text-sm text-muted">{g.acceptedQuote.operator} is assigning vehicles and drivers.</p>}
        </Card>
      )}

      {['ALLOCATED', 'CONFIRMED'].includes(g.status) && (
        <>
          <CapacityMeter required={g.passengerCount} segments={g.allocations.map(a => ({ label: a.vehicle, seats: a.assignedPassengers }))} />
          <Card>
            <h2 className="text-xl font-semibold">Vehicles and drivers</h2>
            <ul className="mt-4 divide-y divide-line">
              {g.allocations.map(a => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span><b>{a.vehicle}</b> · {a.assignedPassengers} of {a.seatCapacity} seats</span>
                  {a.driver ? <Badge tone="ok">Driver: {a.driver.name}</Badge> : <Badge tone="warn">Driver not assigned</Badge>}
                </li>
              ))}
            </ul>
            {g.isOrganizer && g.status === 'ALLOCATED' && (
              <Button size="lg" className="mt-6" loading={act.isPending} onClick={() => act.mutate({ path: `/group-requests/${id}/confirm` })}>Confirm booking</Button>
            )}
            {g.status === 'CONFIRMED' && <p className="mt-6 rounded-xl bg-ok/10 px-4 py-3 font-semibold text-ok">Confirmed for {g.passengerCount} passengers</p>}
          </Card>
        </>
      )}

      {g.isOrganizer && g.status === 'CONFIRMED' && (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Payment</h2>
            <p className="text-sm text-muted">Paid {rupees(g.paidPaise)} of {rupees(total)} · 30% advance now, balance before the trip</p>
          </div>
          <div className="flex gap-2">
            {g.paidPaise === 0 && <Button onClick={() => pay('ADVANCE')}>Pay advance {rupees(Math.floor(total * 0.3))}</Button>}
            {g.paidPaise > 0 && g.paidPaise < total && <Button onClick={() => pay('BALANCE')}>Pay balance {rupees(total - g.paidPaise)}</Button>}
            {g.paidPaise >= total && total > 0 && <Badge tone="ok">Fully paid</Badge>}
          </div>
        </Card>
      )}

      {g.isOrganizer && g.status !== 'CANCELLED' && <Manifest g={g} />}
    </div>
  );
}

export default function GroupDetailPage({ params }: { params: { id: string } }) {
  return <RequireAuth><Page><Detail id={params.id} /></Page></RequireAuth>;
}
