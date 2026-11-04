'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function AnnouncementBar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(localStorage.getItem('rm_bar_closed') !== '1'); } catch { setOpen(true); }
  }, []);
  if (!open) return null;
  const close = () => { setOpen(false); try { localStorage.setItem('rm_bar_closed', '1'); } catch { /* ignore */ } };
  return (
    <div className="bg-ink text-white">
      <div className="relative mx-auto flex min-h-12 max-w-page items-center justify-center gap-3 px-12 py-2 text-sm md:text-[15px]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" />
        </svg>
        <span><span className="hidden sm:inline">Travelling with 40+ people? </span>Get quotes from verified bus operators</span>
        <span className="hidden h-5 w-px bg-white/30 sm:block" />
        <Link href="/groups/new" className="whitespace-nowrap font-semibold">Get quotes →</Link>
        <button onClick={close} aria-label="Close announcement" className="absolute right-3 grid h-8 w-8 place-items-center rounded-full hover:bg-white/10">✕</button>
      </div>
    </div>
  );
}
