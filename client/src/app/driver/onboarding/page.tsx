'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { uploadDoc } from '@/lib/upload';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Badge, Button, ButtonLink, Card, ErrorBanner, Field, Page, PageHeader } from '@/components/ui';


function Onboarding() {
  const { user, reload } = useAuth();
  const [licenceNumber, setNumber] = useState('');
  const [expires, setExpires] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const submit = useMutation({
    mutationFn: async () => {
      const licenceDocKey = await uploadDoc(file!);
      await api('/drivers/onboarding', { method: 'POST', body: { licenceNumber, licenceExpiresAt: expires, licenceDocKey } });
      await reload(); // DRIVER role is now in a fresh token
    },
  });
  const status = user?.driverStatus;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_340px]">
      <Card className="space-y-5">
        <h2 className="text-xl font-semibold">{status ? 'Update your licence' : 'Your driving licence'}</h2>
        <Field label="Licence number" placeholder="DL0420190001234" value={licenceNumber} onChange={e => setNumber(e.target.value)} />
        <Field label="Valid until" type="date" value={expires} onChange={e => setExpires(e.target.value)} />
        <Field label="Licence photo or PDF" type="file" accept="image/jpeg,image/png,application/pdf" hint="JPG, PNG or PDF, up to 5 MB. Only our verification team can see it."
          onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <ErrorBanner error={submit.error} />
        <Button size="lg" loading={submit.isPending} disabled={!licenceNumber || !expires || !file} onClick={() => submit.mutate()}>Submit for verification</Button>
      </Card>
      <Card className="h-fit bg-canvas">
        <p className="text-sm text-muted">Verification status</p>
        <div className="mt-2">
          {!status && <Badge>Not submitted</Badge>}
          {status === 'PENDING' && <Badge tone="blue">Waiting for review</Badge>}
          {status === 'APPROVED' && <Badge tone="ok">Verified</Badge>}
          {status === 'REJECTED' && <Badge tone="warn">Needs changes</Badge>}
        </div>
        {user?.driverRejectionReason && status === 'REJECTED' && <p className="mt-3 text-sm text-warn">{user.driverRejectionReason}</p>}
        {status === 'APPROVED' && <ButtonLink href="/vehicles" className="mt-5">Add your vehicle</ButtonLink>}
        {status === 'PENDING' && <p className="mt-3 text-sm text-muted">Meanwhile, add your vehicle so it can be verified too.</p>}
      </Card>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <Page>
        <PageHeader eyebrow="Drivers" title="Become a verified driver" subtitle="We check every licence before a driver can publish rides or be assigned to a group trip." />
        <Onboarding />
      </Page>
    </RequireAuth>
  );
}
