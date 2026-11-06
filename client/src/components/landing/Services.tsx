import Link from 'next/link';

const SERVICES = [
  { href: '/rides', title: 'Carpool', body: 'Share a car on your route and split the fuel. Book instantly or request a seat from the driver.',
    preview: <div className="space-y-2"><Row a="7:00 am · Gurugram → Jaipur" b="₹450" /><Row a="9:30 am · Delhi → Agra" b="₹400" /></div> },
  { href: '/rentals', title: 'Car & bike rentals', body: 'Self-drive cars and scooters by the day. Deposit, included kilometres and extra-km fees shown up front.',
    preview: <div className="grid grid-cols-7 gap-1">{Array.from({ length: 14 }, (_, i) => <span key={i} className={`h-6 rounded-md ${[3, 4, 5].includes(i) ? 'bg-route' : [9, 10].includes(i) ? 'bg-line' : 'bg-canvas'}`} />)}</div> },
  { href: '/tours', title: 'Group tours', body: 'Join an open bus trip and book seats for your family or friends. One name per seat on the manifest.',
    preview: <div><div className="flex justify-between text-sm"><span className="font-semibold">Jaipur weekend tour</span><span className="text-muted">31 / 45</span></div><div className="mt-2 h-2 rounded-full bg-canvas"><div className="h-2 w-[69%] rounded-full bg-route" /></div></div> },
];

function Row({ a, b }: { a: string; b: string }) {
  return <div className="flex justify-between rounded-lg border border-line px-3 py-2 text-sm"><span>{a}</span><span className="font-semibold">{b}</span></div>;
}

export function Services() {
  return (
    <section className="mx-auto mt-24 max-w-page px-4 md:px-6">
      <h2 className="max-w-[18ch] text-[32px] font-bold leading-[1.1] tracking-[-0.03em] md:text-5xl">Three ways to travel, one verified network</h2>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {SERVICES.map(s => (
          <Link key={s.title} href={s.href} className="group flex flex-col rounded-card border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-frame">
            <div className="rounded-xl bg-canvas p-4">{s.preview}</div>
            <h3 className="mt-6 text-xl font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-2 flex-1 text-muted">{s.body}</p>
            <span className="mt-5 text-sm font-semibold text-route">Explore {s.title.toLowerCase()} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function DriverSteps() {
  const steps = [
    ['Verify your licence', 'Upload your driving licence. Our team checks it, usually within a day.'],
    ['Add your vehicle', 'Registration, insurance and seats. Verified vehicles get a badge on every ride.'],
    ['Publish and get paid', 'Post your route; we check the distance and lock seats as people book.'],
  ];
  return (
    <section className="mx-auto mt-24 max-w-page px-4 md:px-6">
      <div className="grid gap-10 rounded-[32px] bg-ink p-8 text-white md:grid-cols-[1fr_1.4fr] md:p-14">
        <div>
          <h2 className="text-[32px] font-bold leading-[1.1] tracking-[-0.03em] md:text-5xl">Drive with RideMate</h2>
          <p className="mt-4 text-white/70">Fill your empty seats on trips you are already taking.</p>
          <Link href="/driver/onboarding" className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-route px-5 font-semibold hover:brightness-110">Start verification ↗</Link>
        </div>
        <ol className="space-y-6">
          {steps.map(([t, b], i) => (
            <li key={t} className="flex gap-5 border-t border-white/15 pt-6 first:border-0 first:pt-0">
              <span className="font-display text-3xl font-bold text-white/40">0{i + 1}</span>
              <div><p className="text-lg font-semibold">{t}</p><p className="mt-1 text-white/70">{b}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
