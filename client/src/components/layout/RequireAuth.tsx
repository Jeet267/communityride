'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ButtonLink, Card, Page, Spinner } from '../ui';

const ROLE_HELP: Record<string, { title: string; body: string; href: string; cta: string }> = {
  DRIVER: { title: 'This page is for drivers', body: 'Submit your driving licence to start publishing rides.', href: '/driver/onboarding', cta: 'Become a driver' },
  RENTAL_OWNER: { title: 'This page is for rental owners', body: 'Add the rental-owner role, then list a car, bike or scooter.', href: '/vehicles', cta: 'Set up rental owner' },
  FLEET_OPERATOR: { title: 'This page is for fleet operators', body: 'Add the fleet-operator role and your buses to quote group trips.', href: '/vehicles', cta: 'Set up fleet operator' },
  ADMIN: { title: 'Admins only', body: 'Sign in with the admin demo account to verify drivers and vehicles.', href: '/login', cta: 'Switch account' },
};

/** UI convenience only — the server enforces every role and ownership rule. */
export function RequireAuth({ role, children }: { role?: string; children: React.ReactNode }) {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [loading, user, path, router]);
  if (loading || !user) return <Page><Spinner /></Page>;
  if (role && !hasRole(role)) {
    const h = ROLE_HELP[role];
    return (
      <Page className="max-w-xl">
        <Card className="py-10">
          <h1 className="text-2xl font-bold tracking-tight">{h.title}</h1>
          <p className="mt-2 text-muted">{h.body}</p>
          <ButtonLink href={h.href} className="mt-6">{h.cta}</ButtonLink>
        </Card>
      </Page>
    );
  }
  return <>{children}</>;
}
