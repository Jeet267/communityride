'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { homeFor } from '@/lib/roles';
import { ButtonLink, Card, Page, Spinner } from '../ui';

const ROLE_HELP: Record<string, { title: string; body: string; href: string; cta: string }> = {
  DRIVER: { title: 'This page is for drivers', body: 'Submit your driving licence to start publishing rides.', href: '/driver/onboarding', cta: 'Become a driver' },
  RENTAL_OWNER: { title: 'This page is for rental owners', body: 'Add the rental-owner role, then list a car, bike or scooter.', href: '/vehicles', cta: 'Set up rental owner' },
  FLEET_OPERATOR: { title: 'This page is for fleet operators', body: 'Add the fleet-operator role and your buses to quote group trips.', href: '/vehicles', cta: 'Set up fleet operator' },
};

/** UI convenience only — the server enforces every role and ownership rule. */
export function RequireAuth({ role, children }: { role?: string; children: React.ReactNode }) {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const adminOnly = role === 'ADMIN';
  const blocked = adminOnly && !!user && !hasRole('ADMIN');
  useEffect(() => {
    if (loading) return;
    // Not signed in → login (admin pages open the login with "Admin" already chosen).
    if (!user) router.replace(`/login?${adminOnly ? 'as=ADMIN&' : ''}next=${encodeURIComponent(path)}`);
    // Signed in but not an admin → back to their own dashboard; the admin area is never shown to them.
    else if (blocked) router.replace(homeFor(user.roles));
  }, [loading, user, blocked, adminOnly, path, router]);
  if (loading || !user || blocked) return <Page><Spinner /></Page>;
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
