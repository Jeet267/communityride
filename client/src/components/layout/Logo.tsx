import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="RideMate home">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#2F6BF0" />
        <path d="M9 23c3-9 11-5 14-14" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cx="9" cy="23" r="2.6" fill="#fff" />
        <circle cx="23" cy="9" r="2.6" fill="#fff" />
      </svg>
      <span className="font-display text-[22px] font-semibold tracking-[-0.03em]">ridemate</span>
    </Link>
  );
}
