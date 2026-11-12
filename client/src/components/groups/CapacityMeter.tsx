import clsx from 'clsx';
import { Badge, Card } from '../ui';

/** "47 of 50 seated" — partial availability is always shown, never hidden (PRD 3.5). */
export function CapacityMeter({ required, segments }: { required: number; segments: { label: string; seats: number }[] }) {
  const assigned = segments.reduce((s, x) => s + x.seats, 0);
  const covered = assigned >= required;
  const scale = Math.max(required, assigned, 1);
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-semibold">{assigned} of {required} passengers seated</p>
        <Badge tone={covered ? 'ok' : 'warn'}>{covered ? 'Everyone has a seat' : `${required - assigned} more ${required - assigned === 1 ? 'seat' : 'seats'} needed`}</Badge>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-canvas" role="img" aria-label={`${assigned} of ${required} seats allocated`}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${(s.seats / scale) * 100}%` }} className={clsx('h-full border-r-2 border-white last:border-r-0', covered ? 'bg-ok' : 'bg-route')} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 text-sm text-muted">
        {segments.length ? segments.map((s, i) => <li key={i}>{s.label}: {s.seats}</li>) : <li>No vehicles assigned yet</li>}
      </ul>
    </Card>
  );
}
