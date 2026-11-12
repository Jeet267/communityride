'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { STEP_LABEL } from '@/lib/groups';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Arrow, Badge, ButtonLink, EmptyState, Page, PageHeader, Spinner } from '@/components/ui';

type Row = { id: string; origin: string; destination: string; departureAt: string; passengerCount: number; status: string; quotes: number };

function List() {
  const { data, isLoading } = useQuery({ queryKey: ['my-groups'], queryFn: () => api<Row[]>('/group-requests/mine') });
  if (isLoading) return <Spinner />;
  if (!data?.length) return <EmptyState title="No group trips yet" body="Planning a school trip, wedding or office offsite? Get quotes from verified bus operators." action={<ButtonLink href="/groups/new">Request group quotes</ButtonLink>} />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.map(g => (
        <Link key={g.id} href={`/groups/${g.id}`} className="rounded-card border border-line bg-white p-6 transition hover:shadow-frame">
          <div className="flex items-start justify-between gap-3">
            <p className="text-lg font-semibold">{g.origin} → {g.destination}</p>
            <Badge tone={g.status === 'CONFIRMED' ? 'ok' : g.status === 'CANCELLED' ? 'warn' : 'blue'}>{STEP_LABEL[g.status] ?? 'Cancelled'}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">{fmtDateTime(g.departureAt)} · {g.passengerCount} passengers · {g.quotes} quote{g.quotes === 1 ? '' : 's'}</p>
        </Link>
      ))}
    </div>
  );
}

export default function GroupsPage() {
  return (
    <RequireAuth>
      <Page>
        <PageHeader eyebrow="Group trips" title="Your group trips" subtitle="Transport for 40-50+ people, quoted by verified fleet operators."
          action={<ButtonLink href="/groups/new" variant="blue">New group request <Arrow /></ButtonLink>} />
        <List />
      </Page>
    </RequireAuth>
  );
}
