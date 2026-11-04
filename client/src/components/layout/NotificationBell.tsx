'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtDateTime, label } from '@/lib/format';

type Note = { id: string; type: string; payload: any; readAt: string | null; createdAt: string };
const TEXT: Record<string, string> = {
  BOOKING_REQUESTED: 'New seat request on your ride', BOOKING_CONFIRMED: 'Your booking was confirmed', BOOKING_REJECTED: 'Your booking request was declined',
  BOOKING_CANCELLED: 'A passenger cancelled', RIDE_CANCELLED: 'A ride you booked was cancelled', TRIP_COMPLETED: 'Trip completed — leave a review',
  DRIVER_APPROVED: 'Your driver profile is verified', DRIVER_REJECTED: 'Your driver profile needs changes',
  VEHICLE_APPROVED: 'Your vehicle is verified', VEHICLE_REJECTED: 'Your vehicle needs changes',
  RENTAL_REQUESTED: 'New rental request', RENTAL_CONFIRMED: 'Your rental is confirmed', RENTAL_REJECTED: 'Your rental request was declined',
  QUOTE_RECEIVED: 'New quote for your group trip', QUOTE_ACCEPTED: 'Your quote was accepted', GROUP_CONFIRMED: 'A group trip is confirmed',
  GROUP_TRIP_ASSIGNED: 'You are assigned to a group trip', GROUP_CANCELLED: 'A group trip was cancelled',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ items: Note[]; unread: number }>('/notifications'), refetchInterval: 30_000 });
  const readAll = async () => { await api('/notifications/read-all', { method: 'POST' }); qc.invalidateQueries({ queryKey: ['notifications'] }); };
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ''}`}
        className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-black/5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {!!data?.unread && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-route px-1 text-[10px] font-bold text-white">{data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-card border border-line bg-white p-2 shadow-frame">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="font-semibold">Notifications</p>
            {!!data?.unread && <button onClick={readAll} className="text-sm font-semibold text-route">Mark all read</button>}
          </div>
          <ul className="max-h-96 overflow-auto">
            {!data?.items.length && <li className="px-3 py-6 text-sm text-muted">Nothing new yet.</li>}
            {data?.items.map(n => (
              <li key={n.id} className="rounded-xl px-3 py-2.5 hover:bg-canvas">
                <p className={n.readAt ? 'text-sm text-muted' : 'text-sm font-semibold'}>{TEXT[n.type] ?? label(n.type)}</p>
                <p className="text-xs text-muted">{fmtDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
