'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDateTime, label, newKey, rupees, tone } from '@/lib/format';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorBanner, Page, PageHeader, Spinner, Tabs } from '@/components/ui';

type RideBooking = { id: string; status: string; paymentStatus: string; seats: number; totalPaise: number; reviewed: boolean;
  ride: { id: string; type: string; title: string | null; origin: string; destination: string; departureAt: string; driver: string } };
type RentalBooking = { id: string; status: string; paymentStatus: string; startAt: string; endAt: string; totalPaise: number; depositPaise: number; vehicle: string; city: string };

function usePay() {
  const keys = useRef(new Map<string, string>()); // one Idempotency-Key per booking, reused on retries
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingType, bookingId }: { bookingType: 'RIDE' | 'RENTAL'; bookingId: string }) => {
      if (!keys.current.has(bookingId)) keys.current.set(bookingId, newKey());
      return api('/payments/orders', { method: 'POST', body: { bookingType, bookingId }, idempotencyKey: keys.current.get(bookingId) });
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

function Review({ bookingId }: { bookingId: string }) {
  const [rating, setRating] = useState(0);
  const qc = useQueryClient();
  const m = useMutation({ mutationFn: () => api('/reviews', { method: 'POST', body: { rideBookingId: bookingId, rating } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ride-bookings'] }) });
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">Rate your driver</span>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} aria-label={`${n} stars`} onClick={() => setRating(n)} className={`text-xl ${n <= rating ? 'text-amber-500' : 'text-line'}`}>★</button>
      ))}
      <Button size="sm" variant="outline" disabled={!rating} loading={m.isPending} onClick={() => m.mutate()}>Submit</Button>
    </div>
  );
}

function RideBookings() {
  const qc = useQueryClient();
  const pay = usePay();
  const { data, isLoading } = useQuery({ queryKey: ['ride-bookings'], queryFn: () => api<RideBooking[]>('/users/me/ride-bookings') });
  const cancel = useMutation({ mutationFn: (id: string) => api(`/bookings/rides/${id}/cancel`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ride-bookings'] }) });
  if (isLoading) return <Spinner />;
  if (!data?.length) return <EmptyState title="No ride bookings yet" body="Find a ride on your route and book a seat." action={<ButtonLink href="/rides">Find a ride</ButtonLink>} />;
  return (
    <div className="space-y-4">
      <ErrorBanner error={cancel.error ?? pay.error} />
      {data.map(b => (
        <Card key={b.id} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {b.ride.title && <p className="text-sm font-semibold text-route">{b.ride.title}</p>}
              <Link href={`/rides/${b.ride.id}`} className="text-lg font-semibold hover:underline">{b.ride.origin} → {b.ride.destination}</Link>
              <p className="text-sm text-muted">{fmtDateTime(b.ride.departureAt)} · {b.seats} seat{b.seats > 1 ? 's' : ''} · {b.ride.driver}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={tone(b.status)}>{label(b.status)}</Badge>
              <Badge tone={b.paymentStatus === 'PAID' ? 'ok' : 'neutral'}>{label(b.paymentStatus)}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="font-semibold">{rupees(b.totalPaise)}</p>
            <div className="flex flex-wrap gap-2">
              {b.status === 'CONFIRMED' && b.paymentStatus === 'UNPAID' && <Button size="sm" loading={pay.isPending} onClick={() => pay.mutate({ bookingType: 'RIDE', bookingId: b.id })}>Pay {rupees(b.totalPaise)}</Button>}
              {['PENDING', 'CONFIRMED'].includes(b.status) && <Button size="sm" variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate(b.id)}>Cancel booking</Button>}
              {b.status === 'COMPLETED' && !b.reviewed && <Review bookingId={b.id} />}
              {b.reviewed && <span className="text-sm text-ok">Thanks for your review</span>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function RentalBookings() {
  const qc = useQueryClient();
  const pay = usePay();
  const { data, isLoading } = useQuery({ queryKey: ['rental-bookings'], queryFn: () => api<RentalBooking[]>('/users/me/rental-bookings') });
  const cancel = useMutation({ mutationFn: (id: string) => api(`/rental-bookings/${id}/cancel`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['rental-bookings'] }) });
  if (isLoading) return <Spinner />;
  if (!data?.length) return <EmptyState title="No rentals yet" body="Rent a car or scooter by the day." action={<ButtonLink href="/rentals">Browse rentals</ButtonLink>} />;
  return (
    <div className="space-y-4">
      <ErrorBanner error={cancel.error ?? pay.error} />
      {data.map(b => (
        <Card key={b.id} className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">{b.vehicle} · {b.city}</p>
            <p className="text-sm text-muted">{fmtDateTime(b.startAt)} → {fmtDateTime(b.endAt)}</p>
            <p className="mt-1 text-sm">{rupees(b.totalPaise)} rent + {rupees(b.depositPaise)} refundable deposit</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone(b.status)}>{label(b.status)}</Badge>
            {b.status === 'CONFIRMED' && b.paymentStatus === 'UNPAID' && <Button size="sm" loading={pay.isPending} onClick={() => pay.mutate({ bookingType: 'RENTAL', bookingId: b.id })}>Pay {rupees(b.totalPaise + b.depositPaise)}</Button>}
            {b.paymentStatus === 'PAID' && <Badge tone="ok">Paid</Badge>}
            {['PENDING', 'CONFIRMED'].includes(b.status) && <Button size="sm" variant="danger" onClick={() => cancel.mutate(b.id)}>Cancel</Button>}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function BookingsPage() {
  const [tab, setTab] = useState<'rides' | 'rentals'>('rides');
  return (
    <RequireAuth>
      <Page>
        <PageHeader title="My bookings" subtitle="Ride seats and rentals. Group trips you organise are under Group trips." action={<ButtonLink href="/groups" variant="outline">My group trips</ButtonLink>} />
        <Tabs value={tab} onChange={setTab} items={[{ value: 'rides', label: 'Rides' }, { value: 'rentals', label: 'Rentals' }]} />
        {tab === 'rides' ? <RideBookings /> : <RentalBookings />}
      </Page>
    </RequireAuth>
  );
}
