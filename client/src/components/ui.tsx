'use client';
import Link from 'next/link';
import clsx from 'clsx';

type Variant = 'primary' | 'blue' | 'outline' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-neutral-800 rounded-full',
  blue: 'bg-route text-white hover:brightness-110 rounded-lg',
  outline: 'border border-line bg-white text-ink hover:bg-canvas rounded-full',
  ghost: 'text-ink hover:bg-black/5 rounded-full',
  danger: 'border border-warn/30 bg-white text-warn hover:bg-warn/5 rounded-full',
};
const sizes = { sm: 'h-9 px-4 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-14 px-7 text-base' };

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...p }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes; loading?: boolean }) {
  return (
    <button {...p} disabled={loading || p.disabled}
      className={clsx('inline-flex items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', variants[variant], sizes[size], className)}>
      {loading ? 'Please wait…' : children}
    </button>
  );
}

export function ButtonLink({ href, variant = 'primary', size = 'md', className, children }:
  { href: string; variant?: Variant; size?: keyof typeof sizes; className?: string; children: React.ReactNode }) {
  return <Link href={href} className={clsx('inline-flex items-center justify-center gap-2 font-semibold transition', variants[variant], sizes[size], className)}>{children}</Link>;
}

export const Arrow = () => <span aria-hidden className="text-[1.1em] leading-none">↗</span>;

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) =>
  <div {...p} className={clsx('rounded-card border border-line bg-surface p-6', className)} />;

const fieldCls = 'mt-1.5 h-11 w-full rounded-field border border-line bg-white px-3.5 text-[15px] outline-none transition placeholder:text-muted/60 focus:border-route';

export function Field({ label, hint, error, className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="text-sm font-semibold">{label}</span>
      <input {...p} className={clsx(fieldCls, p.type === 'file' && 'h-auto py-2')} />
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-warn">{error}</span>}
    </label>
  );
}

export function Select({ label, children, className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="text-sm font-semibold">{label}</span>
      <select {...p} className={fieldCls}>{children}</select>
    </label>
  );
}

export function TextArea({ label, className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="text-sm font-semibold">{label}</span>
      <textarea {...p} className={clsx(fieldCls, 'h-auto min-h-[96px] py-2.5')} />
    </label>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'neutral' | 'blue'; children: React.ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
      tone === 'ok' && 'bg-ok/10 text-ok', tone === 'warn' && 'bg-warn/10 text-warn',
      tone === 'blue' && 'bg-route/10 text-route', tone === 'neutral' && 'bg-black/5 text-muted')}>{children}</span>
  );
}

export function ErrorBanner({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  return (
    <div role="alert" className={clsx('rounded-field border border-warn/25 bg-warn/5 px-4 py-3 text-sm font-medium text-warn', className)}>
      {(error as Error).message ?? String(error)}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-start gap-2 py-10">
      <p className="text-lg font-semibold">{title}</p>
      {body && <p className="max-w-[60ch] text-muted">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-2 text-sm font-semibold text-route">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-[-0.03em] md:text-[40px] md:leading-[1.1]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-[62ch] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const Page = ({ children, className }: { children: React.ReactNode; className?: string }) =>
  <main className={clsx('mx-auto w-full max-w-page px-4 py-10 md:px-6 md:py-14', className)}>{children}</main>;

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div className="mb-6 inline-flex rounded-full border border-line bg-white p-1" role="tablist">
      {items.map(i => (
        <button key={i.value} role="tab" aria-selected={value === i.value} onClick={() => onChange(i.value)}
          className={clsx('h-9 rounded-full px-4 text-sm font-semibold transition', value === i.value ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

export const Spinner = () => <p className="py-10 text-center text-muted">Loading…</p>;
