import Link from 'next/link';
import { RouteDemo } from '@/components/landing/RouteDemo';
import { GroupSection } from '@/components/landing/GroupSection';
import { DriverSteps, Services } from '@/components/landing/Services';
import { StickyCta } from '@/components/landing/StickyCta';
import { Avatars } from '@/components/landing/Avatars';

const ROUTES = ['Gurugram – Jaipur', 'Delhi – Agra', 'Gurugram – Chandigarh', 'Noida – Dehradun', 'Bengaluru – Mysuru', 'Mumbai – Pune'];

export default function Home() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-page px-4 pb-10 pt-16 text-center md:px-6 md:pt-24">
          <h1 className="mx-auto max-w-[17ch] text-[42px] font-bold leading-[1.04] tracking-[-0.04em] md:text-[84px]">
            Rides, Rentals and Group Trips Within 500 km
          </h1>
          <p className="mx-auto mt-6 max-w-[62ch] text-lg leading-8 text-muted md:text-xl">
            Share a car to Jaipur, rent a scooter for the weekend, or move 50 people on one booking. Every driver and vehicle is verified before the first trip.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link href="/rides" className="inline-flex h-[72px] items-center gap-5 rounded-2xl bg-ink pl-4 pr-8 text-lg font-semibold text-white transition hover:bg-neutral-800">
              <Avatars /> Find a ride <span aria-hidden>↗</span>
            </Link>
            <p className="text-muted">Travelling with 40+ people? <Link href="/groups/new" className="text-ink underline underline-offset-4">Get group quotes</Link></p>
          </div>
          <ul className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-3 text-[17px] text-ink/80">
            {['Verified drivers & vehicles', 'Seats locked when you book', 'Groups of 50+ in one booking'].map(t => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-route text-[11px] text-white" aria-hidden>✓</span>{t}
              </li>
            ))}
          </ul>
          <RouteDemo />
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-page px-4 text-center md:px-6">
        <p className="text-muted">Popular routes people search on RideMate</p>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-10 gap-y-4">
          {ROUTES.map(r => <li key={r} className="font-display text-xl font-semibold tracking-tight text-ink/35">{r}</li>)}
        </ul>
      </section>

      <GroupSection />
      <Services />
      <DriverSteps />
      <StickyCta />
    </main>
  );
}
