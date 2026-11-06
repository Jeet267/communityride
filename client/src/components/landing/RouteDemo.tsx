'use client';
import { useEffect, useState } from 'react';

const QUERY = 'Gurugram → Jaipur · Tomorrow · 2 seats';
const RESULTS = [
  { time: '7:00 am', driver: 'Ravi S.', car: 'Maruti Dzire', price: '₹450', seats: '2 seats left', rating: '4.9' },
  { time: '9:30 am', driver: 'Ananya K.', car: 'Honda City', price: '₹520', seats: '3 seats left', rating: '4.8' },
];

/** Product preview in the Gushwork style: white frame, grey stage, floating chips. Plays once. */
export function RouteDemo() {
  const [typed, setTyped] = useState(0);
  const [stage, setStage] = useState(0); // 0 typing, 1 results, 2 chips + km
  const [km, setKm] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTyped(QUERY.length); setStage(2); setKm(268); return; }
    let i = 0;
    const t = setInterval(() => {
      i += 1; setTyped(i);
      if (i >= QUERY.length) { clearInterval(t); setTimeout(() => setStage(1), 300); setTimeout(() => setStage(2), 1100); }
    }, 38);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (stage < 2 || km >= 268) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1200);
      setKm(Math.round(268 * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative mx-auto mt-16 max-w-[1080px] rounded-frame border border-white bg-white p-3 shadow-frame">
      <div className="relative overflow-hidden rounded-[20px] bg-[#E7E9ED] px-4 pb-10 pt-8 md:px-10 md:pb-24 md:pt-24">
        <div className="section-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />

        {stage >= 2 && <>
          <Chip className="bottom-6 left-6 md:left-10" icon="✓">500 km route check passed</Chip>
          <Chip className="right-6 top-6 md:right-10" icon="●" blue>Seat locked the moment you book</Chip>
        </>}

        <div className="relative mx-auto max-w-[640px] rounded-2xl border border-line bg-white p-4 text-left shadow-sm md:p-6">
          <div className="flex items-center gap-3 rounded-full border border-line bg-canvas px-4 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6170" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <span className="text-[15px] font-medium">{QUERY.slice(0, typed)}<span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-ink" /></span>
          </div>

          <ul className="mt-4 space-y-3">
            {RESULTS.map((r, i) => (
              <li key={r.time} className={`flex items-center justify-between gap-4 rounded-xl border border-line p-4 transition-all duration-500 ${stage >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
                style={{ transitionDelay: `${i * 140}ms` }}>
                <div>
                  <p className="font-semibold">{r.time} · Gurugram → Jaipur</p>
                  <p className="text-sm text-muted">{r.driver} · ★ {r.rating} · {r.car}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold">{r.price}</p>
                  <p className={`text-xs font-semibold ${i === 0 ? 'text-warn' : 'text-ok'}`}>{r.seats}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className={`mt-5 transition-opacity duration-500 ${stage >= 2 ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex justify-between text-sm"><span className="font-semibold">{km} km by road</span><span className="text-muted">500 km limit</span></div>
            <div className="mt-2 h-2 rounded-full bg-canvas"><div className="h-2 rounded-full bg-route transition-[width]" style={{ width: `${(km / 500) * 100}%` }} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, className, icon, blue }: { children: React.ReactNode; className: string; icon: string; blue?: boolean }) {
  return (
    <div className={`rise absolute z-20 hidden items-center gap-2 rounded-xl border px-4 py-3 text-[15px] font-medium shadow-sm sm:flex ${blue ? 'border-route bg-route text-white' : 'border-line bg-white text-ink'} ${className}`}>
      <span className={blue ? 'text-white' : 'text-route'} aria-hidden>{icon}</span>{children}
    </div>
  );
}
