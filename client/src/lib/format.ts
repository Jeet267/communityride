const tz = { timeZone: 'Asia/Kolkata' } as const;

export const rupees = (paise?: number | null) =>
  paise == null ? '—' : '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const toPaise = (r: string | number) => Math.round(Number(r) * 100);
export const fmtDate = (iso: string | Date) => new Date(iso).toLocaleDateString('en-IN', { ...tz, weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (iso: string | Date) => new Date(iso).toLocaleTimeString('en-IN', { ...tz, hour: 'numeric', minute: '2-digit' });
export const fmtDateTime = (iso: string | Date) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export const fmtDuration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

/** Today/tomorrow in IST as yyyy-mm-dd for <input type="date">. */
export const istDate = (offsetDays = 0) => new Date(Date.now() + offsetDays * 864e5 + 5.5 * 3600e3).toISOString().slice(0, 10);
/** Value for <input type="datetime-local"> at a given day offset and local hour. */
export const localInput = (offsetDays: number, hour: number) => {
  const d = new Date(Date.now() + offsetDays * 864e5);
  d.setHours(hour, 0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
export const localToIso = (v: string) => new Date(v).toISOString();

export const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
export const tone = (s: string): 'ok' | 'warn' | 'neutral' | 'blue' =>
  ['CONFIRMED', 'COMPLETED', 'APPROVED', 'RETURNED', 'PAID', 'ACCEPTED'].includes(s) ? 'ok'
    : ['REJECTED', 'CANCELLED'].includes(s) ? 'warn'
      : ['ACTIVE', 'STARTED', 'ALLOCATED', 'QUOTE_ACCEPTED'].includes(s) ? 'blue' : 'neutral';

export const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
