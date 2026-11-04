import Link from 'next/link';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-white">
      <div className="mx-auto grid max-w-page gap-10 px-4 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-6">
        <div>
          <Logo />
          <p className="mt-4 max-w-[36ch] text-sm text-muted">Carpools, rentals and group trips within 500 km. Every driver and vehicle is verified before the first trip.</p>
        </div>
        {[
          ['Travel', [['/rides', 'Find a ride'], ['/tours', 'Group tours'], ['/rentals', 'Rent a vehicle'], ['/groups/new', 'Group quotes']]],
          ['Partners', [['/rides/new', 'Publish a ride'], ['/vehicles', 'Add a vehicle'], ['/fleet', 'Fleet operators']]],
          ['Account', [['/login', 'Sign in'], ['/bookings', 'My bookings'], ['/driver', 'Driver dashboard']]],
        ].map(([title, links]) => (
          <div key={title as string}>
            <p className="text-sm font-semibold">{title as string}</p>
            <ul className="mt-3 space-y-2">
              {(links as string[][]).map(([href, l]) => <li key={href}><Link href={href} className="text-sm text-muted hover:text-ink">{l}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-line py-6 text-center text-xs text-muted">© {new Date().getFullYear()} RideMate · Demo project</p>
    </footer>
  );
}
