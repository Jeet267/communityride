'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatars } from './Avatars';

export function StickyCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 760);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <div className={`fixed inset-x-0 bottom-6 z-30 flex justify-center transition-all duration-300 ${show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}>
      <Link href="/rides" className="inline-flex h-16 items-center gap-4 rounded-2xl bg-ink pl-3 pr-7 text-lg font-semibold text-white shadow-frame">
        <Avatars /> Find a ride <span aria-hidden>↗</span>
      </Link>
    </div>
  );
}
