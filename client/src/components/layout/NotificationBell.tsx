'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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

// Where a click on each notification takes you.
const LINK: Record<string, string> = {
  BOOKING_REQUESTED: '/driver', BOOKING_CANCELLED: '/driver', BOOKING_CONFIRMED: '/bookings', BOOKING_REJECTED: '/bookings',
  RIDE_CANCELLED: '/bookings', TRIP_COMPLETED: '/bookings', DRIVER_APPROVED: '/driver', DRIVER_REJECTED: '/driver/onboarding',
  VEHICLE_APPROVED: '/vehicles', VEHICLE_REJECTED: '/vehicles', RENTAL_REQUESTED: '/rentals/manage', RENTAL_CONFIRMED: '/bookings',
  RENTAL_REJECTED: '/bookings', QUOTE_RECEIVED: '/groups', QUOTE_ACCEPTED: '/fleet', GROUP_CONFIRMED: '/groups',
  GROUP_TRIP_ASSIGNED: '/driver', GROUP_CANCELLED: '/groups',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const path = usePathname();
  const qc = useQueryClient();

  // Close when clicking outside, pressing Esc, or moving to another page.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  useEffect(() => setOpen(false), [path]);

  const openNote = async (n: Note) => {
    setOpen(false);
    if (!n.readAt) { await api(`/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {}); qc.invalidateQueries({ queryKey: ['notifications'] }); }
    router.push(LINK[n.type] ?? '/');
  };
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ items: Note[]; unread: number }>('/notifications'), refetchInterval: 30_000 });
  const readAll = async () => { await api('/notifications/read-all', { method: 'POST' }); qc.invalidateQueries({ queryKey: ['notifications'] }); };
  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ''}`}
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
              <li key={n.id}>
                <button onClick={() => openNote(n)} className="flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-canvas">
                  {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-route" aria-label="Unread" />}
                  <span>
                    <span className={`block text-sm ${n.readAt ? 'text-muted' : 'font-semibold'}`}>{TEXT[n.type] ?? label(n.type)}</span>
                    <span className="block text-xs text-muted">{fmtDateTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
