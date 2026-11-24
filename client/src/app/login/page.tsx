'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { afterLogin, LOGIN_ROLES, ROLE_LABEL, type Role } from '@/lib/roles';
import { Button, Card, ErrorBanner, Field } from '@/components/ui';

type Sent = { sent: true; sentTo: string[]; demo: boolean };
type Verified = { isNewUser: boolean; loginAs: Role; roles: string[]; accessToken: string; refreshToken: string; user: { id: string; fullName: string } };

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next');
  const [role, setRole] = useState<Role>((LOGIN_ROLES.some(r => r.role === params.get('as')) ? params.get('as') : 'PASSENGER') as Role);
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const emailOk = EMAIL_RE.test(email.trim());
  const phoneOk = phone.length === 10;
  // Phone and email are both optional, but at least one must be valid and neither half-typed.
  const canSend = (emailOk || phoneOk) && (email === '' || emailOk) && (phone === '' || phoneOk);
  const contact = () => ({ ...(phoneOk ? { phone: `+91${phone}` } : {}), ...(emailOk ? { email: email.trim().toLowerCase() } : {}) });

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (err) { setError(err); } finally { setBusy(false); }
  }

  const sendCode = () => run(async () => {
    const r = await api<Sent>('/auth/otp/request', { method: 'POST', body: contact() });
    setSentTo(r.sentTo); setOtp(''); setStep('otp');
  });

  const verify = () => run(async () => {
    const r = await api<Verified>('/auth/otp/verify', { method: 'POST', body: { ...contact(), otp, loginAs: role, fullName: name.trim() || undefined } });
    await signIn(r);
    // New account without a name → ask for it; otherwise straight to the dashboard of the chosen role.
    if (r.isNewUser && !name.trim()) router.replace(`/welcome?as=${r.loginAs}${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    else router.replace(afterLogin(r.loginAs, next, r.isNewUser));
  });

  const adminLogin = () => run(async () => {
    const r = await api<Verified>('/auth/password/login', { method: 'POST', body: { email: email.trim().toLowerCase(), password } });
    await signIn(r);
    router.replace(afterLogin('ADMIN', next));
  });

  return (
    <main className="mx-auto max-w-page px-4 py-12 md:px-6">
      <Card className="grid gap-10 p-6 md:grid-cols-[1fr_1fr] md:p-10">
        {/* Left: who you are */}
        <section>
          <h1 className="text-3xl font-bold tracking-[-0.03em]">Sign in or create an account</h1>
          <p className="mt-2 text-muted">One step for both. New here? Your account is created as soon as you enter the code.</p>
          <p className="mt-8 text-sm font-semibold">Sign in as</p>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sign in as">
            {LOGIN_ROLES.map(r => (
              <button key={r.role} type="button" role="radio" aria-checked={role === r.role} disabled={step === 'otp'}
                onClick={() => { setRole(r.role); setError(null); }}
                className={`rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-60 ${role === r.role ? 'border-route bg-route/10 ring-2 ring-route/40' : 'border-line bg-white hover:border-ink/30'}`}>
                <span className="block text-sm font-semibold">{r.label}</span>
                <span className="block text-xs text-muted">{r.hint}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Right: your details */}
        <section className="md:border-l md:border-line md:pl-10">
          {role === 'ADMIN' ? (
            <form onSubmit={e => { e.preventDefault(); adminLogin(); }} className="space-y-5">
              <h2 className="text-xl font-semibold">Admin sign-in</h2>
              <Field label="Admin email" type="email" autoComplete="username" placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
              <ErrorBanner error={error} />
              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!emailOk || !password}>Sign in as admin</Button>
              <p className="text-xs text-muted">Only existing admin accounts can sign in here.</p>
            </form>
          ) : step === 'details' ? (
            <form onSubmit={e => { e.preventDefault(); sendCode(); }} className="space-y-5">
              <h2 className="text-xl font-semibold">Your details</h2>
              <Field label="Full name" autoComplete="name" placeholder="Priya Verma" value={name} onChange={e => setName(e.target.value)}
                hint="Needed only when creating an account" />
              <Field label="Email" type="email" autoComplete="email" placeholder="you@gmail.com" value={email} onChange={e => setEmail(e.target.value)}
                error={email && !emailOk ? 'Enter a valid email' : undefined} />
              <Field label="Mobile number" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="98765 43210" value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} hint="India (+91)" error={phone && !phoneOk ? 'Enter 10 digits' : undefined} />
              <p className="text-sm text-muted">Fill email, mobile or both. We send the same 6-digit code to each one.</p>
              <ErrorBanner error={error} />
              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!canSend}>Send code</Button>
            </form>
          ) : (
            <form onSubmit={e => { e.preventDefault(); verify(); }} className="space-y-5">
              <h2 className="text-xl font-semibold">Enter the code</h2>
              <p className="text-muted">Signing in as <b className="text-ink">{ROLE_LABEL[role]}</b>. We sent a 6-digit code to{' '}
                <b className="text-ink">{sentTo.join(' and ')}</b>.{' '}
                <button type="button" className="font-semibold text-route" onClick={() => setStep('details')}>Change</button></p>
              <Field label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} autoFocus />
              <ErrorBanner error={error} />
              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={otp.length !== 6}>Continue</Button>
              <p className="text-center text-sm text-muted">Didn’t get it? Check spam, or{' '}
                <button type="button" className="font-semibold text-route disabled:opacity-50" disabled={busy} onClick={sendCode}>resend the code</button></p>
            </form>
          )}
        </section>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
