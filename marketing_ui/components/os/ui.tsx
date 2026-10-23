'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { CHANNEL_SHORT, initials } from '@/lib/os/model';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-brand-black sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-brand-dark-gray">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  pad = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={cx('os-panel', className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3 border-b border-black/5 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-brand-black">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={pad ? 'p-4' : undefined}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  trend,
  href,
  tone,
  trendNeutral,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: number | null;
  href?: string;
  tone?: 'bad' | 'good';
  trendNeutral?: boolean;
}) {
  const body = (
    <>
      <div className="text-[11px] font-medium uppercase tracking-wider text-brand-dark-gray">{label}</div>
      <div className={cx('mt-1.5 text-2xl font-semibold tabular-nums tracking-tight', tone === 'bad' ? 'text-red-700' : 'text-brand-black')}>{value}</div>
      <div className="mt-1 min-h-[1rem] text-xs leading-snug text-brand-dark-gray">
        {trend != null ? (
          <span className="mr-1.5">
            <Trend value={trend} neutral={trendNeutral} />
          </span>
        ) : null}
        {hint ? <span className="line-clamp-2">{hint}</span> : null}
      </div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="os-panel block p-4 transition hover:border-brand-burgundy/30">
        {body}
      </Link>
    );
  }
  return <div className="os-panel p-4">{body}</div>;
}

export function Trend({ value, inverse = false, neutral = false }: { value: number; inverse?: boolean; neutral?: boolean }) {
  const up = value > 0.0005;
  const down = value < -0.0005;
  const good = !neutral && (inverse ? down : up);
  const bad = !neutral && (inverse ? up : down);
  return (
    <span className={cx('inline-flex items-center gap-0.5 font-semibold tabular-nums', good && 'text-emerald-700', bad && 'text-red-700')}>
      {up ? '▲' : down ? '▼' : '•'} {Math.abs(value * 100).toFixed(0)}%
    </span>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-900 ring-amber-600/20',
  red: 'bg-red-50 text-red-800 ring-red-600/15',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/15',
  wine: 'bg-brand-burgundy/[0.07] text-brand-burgundy ring-brand-burgundy/15',
  gray: 'bg-black/[0.04] text-brand-dark-gray ring-black/10',
};

export function Pill({ tone = 'gray', children, className }: { tone?: keyof typeof TONES | string; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', TONES[tone] ?? TONES.gray, className)}>
      {children}
    </span>
  );
}

export const STAGE_TONE: Record<string, string> = {
  Idea: 'gray',
  Brief: 'gray',
  Production: 'amber',
  Review: 'blue',
  Approved: 'wine',
  Scheduled: 'wine',
  Published: 'green',
  Queued: 'gray',
  Doing: 'amber',
  Blocked: 'red',
  Done: 'green',
  'Not started': 'gray',
  Active: 'amber',
  'On hold': 'gray',
  Planned: 'blue',
  Live: 'green',
  Paused: 'amber',
  Cancelled: 'gray',
  High: 'red',
  Medium: 'amber',
  Low: 'gray',
  ok: 'green',
  error: 'red',
  unconfigured: 'gray',
};

export function StagePill({ value }: { value: string }) {
  return <Pill tone={STAGE_TONE[value] ?? 'gray'}>{value}</Pill>;
}

export function PriorityDot({ value }: { value: string }) {
  const color = value === 'High' ? 'bg-red-600' : value === 'Low' ? 'bg-brand-medium-gray' : 'bg-amber-500';
  return <span className={cx('inline-block h-2 w-2 shrink-0 rounded-full', color)} title={`${value} priority`} />;
}

export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  if (!name) return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-brand-medium-gray/60 text-[10px] text-brand-medium-gray', size === 'sm' ? 'h-6 w-6' : 'h-8 w-8')} title="Unassigned">?</span>;
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-brand-burgundy/10 font-semibold text-brand-burgundy', size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs')}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function ChannelTags({ channels, max = 4 }: { channels: string[]; max?: number }) {
  if (!channels.length) return <span className="text-[11px] text-brand-medium-gray">No channel</span>;
  const shown = channels.slice(0, max);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((name) => (
        <span key={name} className="rounded bg-black/[0.05] px-1.5 py-px text-[10px] font-semibold tracking-wide text-brand-dark-gray" title={name}>
          {CHANNEL_SHORT[name] ?? name}
        </span>
      ))}
      {channels.length > max ? <span className="text-[10px] text-brand-dark-gray">+{channels.length - max}</span> : null}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-black/[0.06]', className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }, (_, n) => (
        <Skeleton key={n} className="h-12" />
      ))}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/10 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-brand-black">{title}</p>
      {children ? <p className="mt-1 max-w-sm text-sm text-brand-dark-gray">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function MissingOpen({ kind, onClose }: { kind: string; onClose: () => void }) {
  return (
    <Drawer open onClose={onClose} title={`${kind} not found`}>
      <p className="text-sm text-brand-dark-gray">This {kind.toLowerCase()} is gone, or the link is stale. Closing it clears the address so the page can be shared again.</p>
    </Drawer>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-600/15 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  label,
}: {
  value: T;
  options: ReadonlyArray<T | { value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full shrink-0 overflow-x-auto rounded-lg bg-black/[0.05] p-0.5">
      {options.map((option) => {
        const item = typeof option === 'string' ? { value: option, label: option } : option;
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.value)}
            className={cx(
              'whitespace-nowrap rounded-md font-medium transition',
              size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
              active ? 'bg-white text-brand-black shadow-sm' : 'text-brand-dark-gray hover:text-brand-black',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className={cx('os-filter max-w-[12rem]', value && 'os-filter-on')}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full min-w-0 truncate bg-transparent pr-1 outline-none">
        <option value="">{label}</option>
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

const drawerStack: string[] = [];

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    drawerStack.push(titleId);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drawerStack[drawerStack.length - 1] === titleId) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      drawerStack.splice(drawerStack.indexOf(titleId), 1);
      previous?.focus?.();
    };
  }, [open, titleId]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[400] flex justify-end" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={cx(
          'relative flex h-full w-full flex-col bg-white shadow-2xl outline-none animate-in slide-in-from-right-8 duration-200',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-black/5 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-semibold text-brand-black">
              {title}
            </h2>
            {subtitle ? <div className="mt-0.5 text-xs text-brand-dark-gray">{subtitle}</div> : null}
          </div>
          <button type="button" onClick={onClose} className="-mr-1 rounded-md p-1.5 text-brand-dark-gray hover:bg-black/5 hover:text-brand-black" aria-label="Close">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/5 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-brand-dark-gray">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-brand-medium-gray">{hint}</span> : null}
    </label>
  );
}

export function Disclosure({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-xl border border-black/[0.07]" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[13px] font-medium text-brand-black">
        {title}
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-brand-dark-gray transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="space-y-3 border-t border-black/5 px-3 py-3">{children}</div>
    </details>
  );
}

export function Bar({ value, max, tone = 'wine' }: { value: number | null; max: number; tone?: 'wine' | 'red' | 'gray' }) {
  const width = value == null || max <= 0 ? 0 : Math.max(2, Math.min(100, (value / max) * 100));
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
      <span
        className={cx('block h-full rounded-full', tone === 'red' ? 'bg-red-600' : tone === 'gray' ? 'bg-brand-medium-gray' : 'bg-brand-burgundy')}
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

export function Toast({ message, tone = 'ok', onDone }: { message: string | null; tone?: 'ok' | 'error'; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDone, tone === 'error' ? 5000 : 2200);
    return () => window.clearTimeout(timer);
  }, [message, tone, onDone]);
  if (!message) return null;
  return (
    <div
      role="status"
      className={cx(
        'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[600] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg',
        tone === 'error' ? 'bg-red-700' : 'bg-brand-black',
      )}
    >
      {message}
    </div>
  );
}
