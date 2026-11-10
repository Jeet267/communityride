'use client';
import { useEffect, useState } from 'react';
import { CITIES, Place } from '@/lib/cities';

/** Local city list first (works offline), plus Photon / OpenStreetMap search for anything else. */
export function PlaceInput({ label, value, onChange }: { label: string; value: Place | null; onChange: (p: Place) => void }) {
  const [q, setQ] = useState(value?.name ?? '');
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<Place[]>([]);

  useEffect(() => { setQ(value?.name ?? ''); }, [value?.name]);
  useEffect(() => {
    if (q.length < 3 || q === value?.name) { setRemote([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lat=28.6&lon=77.2`, { signal: ctrl.signal });
        const j = await r.json();
        setRemote(j.features.filter((f: any) => f.properties.countrycode === 'IN').map((f: any) => ({
          name: [f.properties.name, f.properties.city !== f.properties.name ? f.properties.city : null, f.properties.state].filter(Boolean).join(', '),
          lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
        })));
      } catch { /* offline: local list still works */ }
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, value?.name]);

  const local = CITIES.filter(c => c.name.toLowerCase().startsWith(q.toLowerCase()) && c.name !== value?.name);
  const items = [...local, ...remote.filter(r => !local.some(l => r.name.startsWith(l.name)))].slice(0, 7);

  return (
    <div className="relative">
      <label className="block">
        <span className="text-sm font-semibold">{label}</span>
        <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="City or area" autoComplete="off"
          className="mt-1.5 h-11 w-full rounded-field border border-line bg-white px-3.5 text-[15px] outline-none focus:border-route" />
      </label>
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-field border border-line bg-white py-1 shadow-frame">
          {items.map(p => (
            <li key={`${p.name}${p.lat}`}>
              <button type="button" onMouseDown={() => { onChange(p); setQ(p.name); setOpen(false); }} className="w-full px-3.5 py-2 text-left text-[15px] hover:bg-canvas">{p.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
