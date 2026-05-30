import type { ReactNode } from 'react';

export type HealthStatus = 'loading' | 'online' | 'offline' | 'degraded';
export type BadgeSurface = 'light' | 'dark';

export function shortenHealthReason(error?: string, detail?: string): string {
  const raw = (error || detail || '').trim();
  if (!raw) return 'No response from service';

  const lower = raw.toLowerCase();
  if (lower.includes('timeout') || lower.includes('aborted')) return 'Connection timed out';
  if (lower.includes('failed to fetch') || lower.includes('network')) return 'Network unreachable';
  if (lower.includes('econnrefused') || lower.includes('connection refused')) return 'Service refused connection';
  if (raw.startsWith('HTTP ')) return raw;
  if (raw.startsWith('status=')) return `Health returned ${raw.replace('status=', '')}`;
  if (raw.length > 52) return `${raw.slice(0, 49)}…`;
  return raw;
}

export function formatStatusPresentation(
  status: HealthStatus,
  serviceName: string,
  error?: string,
  detail?: string,
): { label: string; hint?: string } {
  if (status === 'loading') {
    return { label: 'Connecting', hint: 'Checking reachability…' };
  }

  if (status === 'online') {
    return {
      label: serviceName === 'MongoDB' ? 'Connected' : 'Online',
    };
  }

  if (status === 'degraded') {
    return {
      label: 'Degraded',
      hint: shortenHealthReason(undefined, detail || 'Service responded with warnings'),
    };
  }

  return {
    label: serviceName === 'MongoDB' ? 'Disconnected' : 'Offline',
    hint: shortenHealthReason(error, detail),
  };
}

export function formatAggregatePresentation(
  status: HealthStatus,
  scope: 'frontend' | 'backend',
  sampleError?: string,
): { label: string; hint?: string } {
  if (status === 'loading') {
    return {
      label: 'Connecting',
      hint: scope === 'frontend' ? 'Checking frontend apps…' : 'Checking backend APIs…',
    };
  }

  if (status === 'online') {
    return {
      label: scope === 'frontend' ? 'Apps online' : 'Backend online',
    };
  }

  if (status === 'degraded') {
    return {
      label: 'Degraded',
      hint: 'Some services are responding slowly',
    };
  }

  return {
    label: scope === 'frontend' ? 'Apps offline' : 'Backend offline',
    hint: shortenHealthReason(sampleError),
  };
}

export function StatusBadge({
  status,
  label,
  hint,
  size = 'sm',
  surface = 'light',
}: {
  status: HealthStatus;
  label?: string;
  hint?: string;
  size?: 'sm' | 'md';
  surface?: BadgeSurface;
}) {
  const sizeClass = size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-[11px]';
  const hintClass = size === 'md' ? 'text-[11px]' : 'text-[10px]';

  const lightTone =
    status === 'online'
      ? 'border-green-600/30 bg-green-50 text-green-700'
      : status === 'loading' || status === 'degraded'
        ? 'border-amber-500/40 bg-amber-50 text-amber-800'
        : 'border-red-600/30 bg-red-50 text-red-700';

  const darkTone =
    status === 'online'
      ? 'border-green-400/50 bg-green-500/20 text-green-300'
      : status === 'loading' || status === 'degraded'
        ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
        : 'border-red-400/50 bg-red-500/25 text-red-200';

  const dotClass =
    status === 'online'
      ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'
      : status === 'loading' || status === 'degraded'
        ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.85)]'
        : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]';

  const displayLabel = label ?? status;
  const shapeClass = hint ? 'rounded-xl' : 'rounded-full';

  const pulseClass = status === 'loading' ? 'animate-pulse' : '';

  return (
    <span
      className={`inline-flex max-w-xs items-start gap-2 border font-semibold uppercase tracking-wide ${shapeClass} ${sizeClass} ${pulseClass} ${surface === 'dark' ? darkTone : lightTone}`}
    >
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      <span className="min-w-0 leading-tight">
        <span className="block">{displayLabel}</span>
        {hint ? (
          <span className={`block font-normal normal-case tracking-normal opacity-90 ${hintClass}`}>
            {hint}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function DashboardSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="dash-eyebrow">{eyebrow}</p>
          <h2 className="dash-title">{title}</h2>
          {description ? <p className="dash-desc mt-3">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function ExternalArrow({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 text-brand-burgundy transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-black ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17" />
    </svg>
  );
}

export function AppLaunchCard({
  href,
  title,
  serviceName,
  description,
  icon,
  status,
  responseTime,
  error,
  detail,
  className = '',
}: {
  href: string;
  title: string;
  serviceName: string;
  description: string;
  icon: ReactNode;
  status: HealthStatus;
  responseTime?: number;
  error?: string;
  detail?: string;
  className?: string;
}) {
  const disabled = !href || href === '#';
  const Wrapper = disabled ? 'div' : 'a';
  const linkProps = disabled
    ? {}
    : { href, target: '_blank' as const, rel: 'noopener noreferrer' as const };
  const presentation = formatStatusPresentation(status, serviceName, error, detail);

  return (
    <Wrapper
      {...linkProps}
      className={`dash-card group relative flex h-full flex-col p-6 pt-7 ${disabled ? 'opacity-60' : 'cursor-pointer'} ${className}`}
    >
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-burgundy text-brand-white shadow-[0_10px_24px_-10px_rgba(80,15,40,0.45)]">
          {icon}
        </div>
        <StatusBadge
          status={status}
          label={presentation.label}
          hint={presentation.hint}
          surface="light"
        />
      </div>

      <div className="flex flex-1 flex-col">
        <h3 className="text-lg font-semibold tracking-tight text-brand-black">{title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-dark-gray">{description}</p>
        <div className="mt-5 flex items-center justify-between border-t border-brand-light-gray pt-4">
          <span className="text-xs font-medium text-brand-medium-gray">
            {responseTime ? `${responseTime}ms` : 'Open app'}
          </span>
          {!disabled ? <ExternalArrow /> : null}
        </div>
      </div>
    </Wrapper>
  );
}

export function ServiceHealthRow({
  href,
  name,
  url,
  status,
  responseTime,
  error,
  detail,
  className = '',
}: {
  href: string;
  name: string;
  url: string;
  status: HealthStatus;
  responseTime?: number;
  error?: string;
  detail?: string;
  className?: string;
}) {
  const disabled = !href || href === '#';
  const Wrapper = disabled ? 'div' : 'a';
  const linkProps = disabled
    ? {}
    : { href, target: '_blank' as const, rel: 'noopener noreferrer' as const };
  const presentation = formatStatusPresentation(status, name, error, detail);

  return (
    <Wrapper
      {...linkProps}
      className={`group flex flex-col gap-3 border-b border-brand-light-gray px-5 py-4 transition-colors last:border-b-0 hover:bg-brand-light-gray/60 md:flex-row md:items-center md:justify-between ${disabled ? '' : 'cursor-pointer'} ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h4 className="text-base font-semibold text-brand-black">{name}</h4>
          <StatusBadge
            status={status}
            label={presentation.label}
            hint={presentation.hint}
            surface="light"
          />
        </div>
        <p className="mt-1 truncate font-mono text-xs text-brand-medium-gray">{url}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {responseTime ? (
          <span className="text-sm tabular-nums text-brand-black">{responseTime}ms</span>
        ) : null}
        {!disabled ? <ExternalArrow /> : null}
      </div>
    </Wrapper>
  );
}
