import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="dash-eyebrow">{eyebrow}</p> : null}
        <h1 className={eyebrow ? 'dash-title' : 'text-2xl font-semibold tracking-tight text-brand-black md:text-3xl'}>
          {title}
        </h1>
        {description ? <p className="dash-desc mt-3 text-sm md:text-base">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="dash-metric">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-burgundy">{label}</p>
      <p className="mt-3 text-3xl font-light tabular-nums text-brand-black md:text-4xl">{value}</p>
      {hint ? <p className="mt-3 text-sm leading-relaxed text-brand-dark-gray">{hint}</p> : null}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm font-medium text-red-700">
      {children}
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: string;
}) {
  const normalized = status.trim().toLowerCase();
  const isSuccess =
    normalized === 'labeled' ||
    normalized === 'approved' ||
    normalized === 'done' ||
    normalized === 'online' ||
    normalized === 'finished' ||
    normalized === 'connected';
  const isPending =
    normalized === 'pending' ||
    normalized === 'uploading' ||
    normalized === 'running' ||
    normalized === 'checking';

  const tone = isSuccess
    ? 'border-green-500/25 bg-green-500/10 text-green-800'
    : isPending
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-900'
      : 'border-brand-medium-gray/30 bg-brand-light-gray/80 text-brand-dark-gray';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}
