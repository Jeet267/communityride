import { Arrow, ButtonLink } from '../ui';

/** Mirrors Gushwork's white grid section with floating cards — here it explains 50-person group booking. */
export function GroupSection() {
  return (
    <section className="mx-auto mt-24 max-w-[1280px] px-2 md:px-4">
      <div className="relative overflow-hidden rounded-[32px] border border-line bg-white px-4 py-16 md:px-10 md:py-24">
        <div className="section-grid pointer-events-none absolute inset-0" aria-hidden />

        <FloatCard className="left-1/2 top-10 -translate-x-1/2 md:left-16 md:top-16 md:translate-x-0" title="Tata Starbus · 35 seats" sub="Driver: Mohan Lal" tag="Driver assigned" />
        <FloatCard className="right-6 top-24 hidden md:right-16 md:top-20 md:block" title="Force Traveller · 17 seats" sub="Driver: Suresh Yadav" tag="Driver assigned" green />

        <div className="relative mx-auto max-w-3xl pt-40 text-center md:pt-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-1.5 text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-route" aria-hidden /> How group trips work
          </span>
          <h2 className="mt-6 text-[36px] font-bold leading-[1.05] tracking-[-0.035em] md:text-[64px]">50 tourists.<br />One booking.</h2>
          <p className="mx-auto mt-5 max-w-[58ch] text-lg text-muted">
            Tell us the route, date and headcount. Verified operators send quotes, split the group across buses and tempo travellers,
            and assign a verified driver to every vehicle. We only confirm when every passenger has a seat.
          </p>

          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-line bg-canvas p-5 text-left">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">52 seats for 50 passengers</p>
              <span className="rounded-full bg-ok/10 px-2.5 py-1 text-xs font-semibold text-ok">Everyone has a seat</span>
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-line">
              <div className="h-full w-[67%] border-r-2 border-white bg-ok" />
              <div className="h-full w-[33%] bg-ok" />
            </div>
            <p className="mt-2 text-sm text-muted">Bus 35 · Tempo traveller 17</p>
          </div>

          <ButtonLink href="/groups/new" size="lg" className="mt-10">Get group quotes <Arrow /></ButtonLink>
        </div>
      </div>
    </section>
  );
}

function FloatCard({ className, title, sub, tag, green }: { className: string; title: string; sub: string; tag: string; green?: boolean }) {
  return (
    <div className={`absolute z-10 w-[min(300px,80vw)] rounded-2xl border border-line bg-canvas p-5 text-left ${className}`}>
      <p className="font-semibold">{title}</p>
      <div className="mt-3 h-2.5 w-4/5 rounded-full bg-line" />
      <div className="mt-2 h-2.5 w-3/5 rounded-full bg-line" />
      <p className="mt-3 text-sm text-muted">{sub}</p>
      <span className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${green ? 'bg-ok text-white' : 'border border-line bg-white'}`}>
        <span aria-hidden>✓</span>{tag}
      </span>
    </div>
  );
}
