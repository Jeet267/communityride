'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Ride, RideCard } from '@/components/rides/RideCard';
import { ButtonLink, EmptyState, Page, PageHeader, Spinner } from '@/components/ui';

export default function ToursPage() {
  const { data, isLoading } = useQuery({ queryKey: ['tours'], queryFn: () => api<Ride[]>('/rides/tours') });
  return (
    <Page>
      <PageHeader eyebrow="Group tours" title="Join a group tour" subtitle="Bus trips you can join seat by seat. Add a name for each traveller when you book."
        action={<ButtonLink href="/groups/new" variant="outline">Need a whole bus? Get quotes</ButtonLink>} />
      <div className="space-y-4">
        {isLoading && <Spinner />}
        {data?.length === 0 && <EmptyState title="No open tours right now" body="Operators publish new tours every week." />}
        {data?.map(r => <RideCard key={r.id} ride={r} />)}
      </div>
    </Page>
  );
}
