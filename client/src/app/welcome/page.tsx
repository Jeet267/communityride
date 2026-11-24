'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Button, Card, ErrorBanner, Field, Page, PageHeader } from '@/components/ui';
import { afterLogin, LOGIN_ROLES, ROLE_LABEL, type Role } from '@/lib/roles';

const NEXT_STEP: Record<Role, string> = {
  PASSENGER: 'Next: search rides, rentals or group trips.',
  DRIVER: 'Next: upload your driving licence. An admin verifies it before you can publish rides.',
  RENTAL_OWNER: 'Next: add your car or bike. An admin verifies it before it can be rented.',
  FLEET_OPERATOR: 'Next: add your buses and tempo travellers. An admin verifies each one.',
  ADMIN: '',
};

/** Last step of sign-up: the role was chosen on the login screen, so only the name is asked here. */
function Welcome() {
  const { user, reload } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const as = (LOGIN_ROLES.some(r => r.role === params.get('as')) ? params.get('as') : 'PASSENGER') as Role;
  const [name, setName] = useState(user && user.fullName !== 'New user' ? user.fullName : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/users/me', { method: 'PATCH', body: { fullName: name.trim() } });
      await reload();
      router.replace(afterLogin(as, params.get('next'), true));
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return (
    <Page className="max-w-xl">
      <PageHeader eyebrow={`New ${ROLE_LABEL[as].toLowerCase()} account`} title="Welcome to RideMate" subtitle="One last thing: what should we call you?" />
      <Card>
        <form onSubmit={go} className="space-y-5">
          <Field label="Your full name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <p className="text-sm text-muted">{NEXT_STEP[as]}</p>
          <ErrorBanner error={error} />
          <Button type="submit" size="lg" loading={busy} disabled={name.trim().length < 2}>Continue</Button>
        </form>
      </Card>
    </Page>
  );
}

export default function WelcomePage() {
  return <RequireAuth><Suspense><Welcome /></Suspense></RequireAuth>;
}
