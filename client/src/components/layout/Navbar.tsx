'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Arrow, ButtonLink } from '../ui';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { homeFor, ROLE_LABEL, type Role } from '@/lib/roles';

type Item = { href: string; label: string; hint?: string };

function Menu({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="group relative">
      <button className="flex items-center gap-1.5 py-2 text-[15px] font-medium text-ink/85 hover:text-ink">
        {title}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition group-hover:rotate-180" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div className="invisible absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="rounded-card border border-line bg-white p-2 shadow-frame">
          {items.map(i => (
            <Link key={i.href} href={i.href} className="block rounded-xl px-3 py-2.5 hover:bg-canvas">
              <span className="block text-[15px] font-semibold">{i.label}</span>
              {i.hint && <span className="block text-sm text-muted">{i.hint}</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Navbar() {
  const { user, hasRole, signOut } = useAuth();
  const router = useRouter();
  const partner: Item[] = [
    { href: '/driver', label: 'Driver dashboard', hint: 'Requests, trips and earnings' },
    { href: '/vehicles', label: 'Vehicles & roles', hint: 'Add a car, bus or scooter' },
    { href: '/rentals/manage', label: 'Rental owner', hint: 'Listings, pickups and returns' },
    { href: '/fleet', label: 'Fleet operators', hint: 'Quote and staff group trips' },
    ...(hasRole('ADMIN') ? [{ href: '/admin', label: 'Admin', hint: 'Verify drivers and vehicles' }] : []),
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-page items-center justify-between gap-4 px-4 md:px-6">
        <Logo />
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          <Menu title="Rides" items={[
            { href: '/rides', label: 'Find a ride', hint: 'Share a car on your route' },
            { href: '/tours', label: 'Group tours', hint: 'Join a bus trip, book your seats' },
            { href: '/rides/new', label: 'Publish a ride', hint: 'Drivers: offer your empty seats' },
          ]} />
          <Menu title="Rentals" items={[
            { href: '/rentals', label: 'Rent a car or bike', hint: 'Self-drive, by the day' },
            { href: '/rentals/new', label: 'List your vehicle', hint: 'Earn from your idle car' },
          ]} />
          <Link href="/groups" className="text-[15px] font-medium text-ink/85 hover:text-ink">Group trips</Link>
          <Menu title="Partners" items={partner} />
          {user && <Link href="/bookings" className="text-[15px] font-medium text-ink/85 hover:text-ink">My bookings</Link>}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <div className="group relative hidden sm:block">
                <button className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-semibold text-white" aria-label="Account">
                  {user.fullName.split(' ').map(s => s[0]).slice(0, 2).join('')}
                </button>
                <div className="invisible absolute right-0 top-full z-50 w-56 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <div className="rounded-card border border-line bg-white p-2 shadow-frame">
                    <p className="px-3 py-2 text-sm"><span className="block font-semibold">{user.fullName}</span><span className="text-muted">{user.email ?? user.phone}</span>
                      <span className="mt-1 block text-xs text-muted">{user.roles.filter(r => r !== 'PASSENGER').map(r => ROLE_LABEL[r as Role]).join(' · ') || 'Passenger'}</span></p>
                    <Link href={homeFor(user.roles)} className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-canvas">My dashboard</Link>
                    <Link href="/bookings" className="block rounded-xl px-3 py-2 text-sm hover:bg-canvas">My bookings</Link>
                    <Link href="/groups" className="block rounded-xl px-3 py-2 text-sm hover:bg-canvas">My group trips</Link>
                    <button onClick={async () => { await signOut(); router.push('/'); }} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-canvas">Sign out</button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <Link href="/login" className="px-3 text-[15px] font-medium">Sign in</Link>
          )}
          <ButtonLink href="/rides/new" variant="blue" className="hidden sm:inline-flex">Publish a ride <Arrow /></ButtonLink>
          <details className="relative lg:hidden">
            <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full hover:bg-black/5" aria-label="Menu">☰</summary>
            <div className="absolute right-0 z-50 mt-2 w-64 rounded-card border border-line bg-white p-2 shadow-frame">
              {[['/rides', 'Find a ride'], ['/tours', 'Group tours'], ['/rentals', 'Rentals'], ['/groups', 'Group trips'], ['/bookings', 'My bookings'], ...partner.map(p => [p.href, p.label])].map(([href, l]) => (
                <Link key={href} href={href} className="block rounded-xl px-3 py-2.5 text-[15px] hover:bg-canvas">{l}</Link>
              ))}
              {user && <button onClick={() => signOut()} className="block w-full rounded-xl px-3 py-2.5 text-left text-[15px] hover:bg-canvas">Sign out</button>}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
