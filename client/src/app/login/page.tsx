'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card, ErrorBanner, Field } from '@/components/ui';

const DEMO = [
  ['Priya · passenger', '9000000003'], ['Ravi · driver', '9000000002'], ['Arjun · rental owner', '9000000004'],
  ['Shree Travels · fleet', '9000000005'], ['Neha · group organizer', '9000000006'], ['Admin', '9000000001'],
];

function LoginForm() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/';

  async function send(p = phone) {
    setBusy(true); setError(null);
    try { await api('/auth/otp/request', { method: 'POST', body: { phone: `+91${p}` } }); setPhone(p); setStep('otp'); }
    catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api('/auth/otp/verify', { method: 'POST', body: { phone: `+91${phone}`, otp, fullName: name || undefined } });
      await signIn(r);
      router.replace(next);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto grid max-w-page gap-8 px-4 py-14 md:grid-cols-[1fr_380px] md:px-6">
      <Card className="p-8">
        <h1 className="text-3xl font-bold tracking-[-0.03em]">Sign in to RideMate</h1>
        {step === 'phone' ? (
          <form onSubmit={e => { e.preventDefault(); send(); }} className="mt-6 max-w-sm space-y-5">
            <p className="text-muted">We will send a 6-digit code to your phone.</p>
            <Field label="Mobile number" inputMode="numeric" maxLength={10} placeholder="98765 43210" value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} hint="India (+91) numbers only" autoFocus />
            <ErrorBanner error={error} />
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={phone.length !== 10}>Send code</Button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 max-w-sm space-y-5">
            <p className="text-muted">Enter the code sent to +91 {phone}. <button type="button" className="font-semibold text-route" onClick={() => setStep('phone')}>Change number</button></p>
            <Field label="6-digit code" inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} autoFocus />
            <Field label="Your name" hint="Only needed the first time you sign in" value={name} onChange={e => setName(e.target.value)} />
            <ErrorBanner error={error} />
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={otp.length !== 6}>Sign in</Button>
          </form>
        )}
      </Card>
      <Card className="h-fit bg-canvas">
        <p className="font-semibold">Demo accounts</p>
        <p className="mt-1 text-sm text-muted">Code is <b className="text-ink">123456</b> for these numbers.</p>
        <ul className="mt-4 space-y-2">
          {DEMO.map(([l, p]) => (
            <li key={p}><button onClick={() => send(p)} className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-3 py-2.5 text-left text-sm hover:border-route">
              <span className="font-medium">{l}</span><span className="text-muted">{p}</span></button></li>
          ))}
        </ul>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
