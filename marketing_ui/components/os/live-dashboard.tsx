'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useLiveDashboard } from '@/hooks/use-live-dashboard';
import { aed, monthLabel, num, pct, type ChannelRow, type DashboardPayload } from '@/lib/os/types';

type Move = { label: string; href: string; quiet?: boolean };

type Work = {
  brief: number | null;
  making: number | null;
  ready: number | null;
  out: number | null;
  collections: Array<{ name: string; count: number }>;
  campaigns: Array<{ id: string; name: string; channels: string; when: string }>;
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sourceState(state?: string) {
  if (state === 'ok') return { label: 'Live', dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-800' };
  if (state === 'error') return { label: 'Error', dot: 'bg-red-600', chip: 'bg-red-500/10 text-red-800' };
  if (state === 'unconfigured') return { label: 'Not connected', dot: 'bg-brand-medium-gray', chip: 'bg-brand-light-gray text-brand-dark-gray' };
  return { label: 'Waiting', dot: 'bg-amber-500', chip: 'bg-amber-500/10 text-amber-900' };
}

function updatedLabel(iso?: string) {
  if (!iso) return 'Waiting for the first snapshot';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'Updated';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Updated ${hours}h ago`;
  return `Updated ${Math.round(hours / 24)}d ago`;
}

function sumKnown(values: Array<number | null | undefined>): number | null {
  const known = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (!known.length) return null;
  return known.reduce((total, value) => total + value, 0);
}

function moveFor(row: ChannelRow, state?: string): Move {
  if (state === 'error') return { label: 'Fix', href: '/connections' };
  if (state !== 'ok') return { label: 'Connect', href: '/connections' };
  if (row.utilization != null && row.utilization > 1) return { label: 'Cut', href: '/budgets' };
  if (row.status === 'Draft') return { label: 'Set budget', href: '/budgets' };
  if (row.qualified == null) return { label: 'Hold', href: '/budgets' };
  return { label: 'Keep', href: '/budgets', quiet: true };
}

function monthEnd(month: string): string {
  const [year, part] = month.split('-').map(Number);
  const last = new Date(year, part, 0).getDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

function overlapsMonth(start: string, end: string | null, month: string): boolean {
  const from = `${month}-01`;
  const to = monthEnd(month);
  const stop = (end || start).slice(0, 10);
  return start.slice(0, 10) <= to && stop >= from;
}

function Pill({ state }: { state?: string }) {
  const tone = sourceState(state);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}

function PathStep({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-[8.25rem] flex-1 rounded-2xl border border-brand-medium-gray/30 bg-brand-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-brand-black">{value}</div>
      <p className="mt-1 text-xs text-brand-dark-gray">{hint}</p>
    </div>
  );
}

export function LiveDashboard() {
  const [month, setMonth] = useState(currentMonth);
  const { data, authRequired, error, syncing, refresh, signIn } = useLiveDashboard(month);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [work, setWork] = useState<Work | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ready = Boolean(data);
  useEffect(() => {
    if (!ready) return;
    let cancel = false;
    void (async () => {
      const [postsRes, campaignsRes] = await Promise.all([
        fetch('/api/content-calendar', { cache: 'no-store' }),
        fetch('/api/marketing-campaigns', { cache: 'no-store' }),
      ]);
      if (cancel) return;
      if (!postsRes.ok || !campaignsRes.ok) {
        setWork(null);
        return;
      }
      const postsBody = await postsRes.json();
      const campaignsBody = await campaignsRes.json();
      if (cancel) return;
      const items = Array.isArray(postsBody.items) ? postsBody.items : [];
      const inMonth = items.filter((item: { publish_date?: string | null }) =>
        String(item.publish_date || '').slice(0, 7) === month,
      );
      const count = (names: string[]) =>
        inMonth.filter((item: { fields?: Record<string, string> }) =>
          names.includes(String(item.fields?.Status ?? '').trim()),
        ).length;
      const byProduct = new Map<string, number>();
      for (const item of inMonth) {
        const name = String(item.fields?.Product ?? '').trim();
        if (!name) continue;
        byProduct.set(name, (byProduct.get(name) ?? 0) + 1);
      }
      const campaigns = (Array.isArray(campaignsBody.items) ? campaignsBody.items : [])
        .filter((item: { start_date?: string; effective_end_date?: string | null; end_date?: string | null }) =>
          overlapsMonth(String(item.start_date || ''), item.effective_end_date || item.end_date || null, month),
        )
        .map((item: { id: string; name: string; channels?: string; start_date?: string; end_date?: string | null }) => ({
          id: item.id,
          name: item.name,
          channels: item.channels || '—',
          when: item.end_date ? `${item.start_date} → ${item.end_date}` : String(item.start_date || ''),
        }));
      setWork({
        brief: count(['Drafts', 'Needs plan', '']),
        making: count(['In Progress']),
        ready: count(['Scheduled']),
        out: count(['Published']),
        collections: [...byProduct.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, count]) => ({ name, count })),
        campaigns,
      });
    })();
    return () => {
      cancel = true;
    };
  }, [ready, month]);

  if (authRequired) {
    return (
      <form
        className="dash-panel mx-auto max-w-md space-y-4 p-8"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn(email, password);
        }}
      >
        <p className="dash-eyebrow">Marketing</p>
        <h1 className="text-2xl font-semibold">Sign in to the live dashboard</h1>
        <input className="w-full rounded-xl border border-brand-medium-gray/40 px-4 py-3 text-sm" type="email" autoComplete="username" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded-xl border border-brand-medium-gray/40 px-4 py-3 text-sm" type="password" autoComplete="current-password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="btn-primary w-full py-3" type="submit">Sign in</button>
      </form>
    );
  }

  const today = currentMonth();
  const viewingToday = month === today;
  const months = [...new Set([...(data?.months ?? []), today])].sort();
  const connectorByName = new Map((data?.connectors ?? []).map((item) => [item.name.toLowerCase(), item]));

  return (
    <div className="space-y-8">
      <section className="dash-hero">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="dash-eyebrow">Marketing OS</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              {mounted && viewingToday ? todayLabel() : monthLabel(month)}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-brand-light-gray/90">
              Seen, click, WhatsApp, quote, showroom, order. A blank figure is unknown, not zero.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="flex items-center gap-2 text-xs text-brand-light-gray">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              {updatedLabel(data?.generated_at)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {months.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMonth(item)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    month === item ? 'bg-white text-brand-burgundy' : 'bg-white/10 text-white'
                  }`}
                >
                  {item === today ? 'Today' : monthLabel(item)}
                </button>
              ))}
              <button type="button" onClick={() => void refresh()} disabled={syncing} className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-brand-burgundy disabled:opacity-60">
                {syncing ? 'Refreshing…' : 'Refresh sources'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {!data ? <div className="dash-panel h-40 animate-pulse" /> : <Board data={data} work={work} connectorByName={connectorByName} />}
    </div>
  );
}

function Board({
  data,
  work,
  connectorByName,
}: {
  data: DashboardPayload;
  work: Work | null;
  connectorByName: Map<string, { name: string; state: string; detail?: string }>;
}) {
  const seen = sumKnown([
    ...data.channels.map((row) => row.impressions),
    data.site.search?.impressions,
  ]);
  const clicks = sumKnown([
    ...data.channels.map((row) => row.clicks),
    data.site.search?.clicks,
  ]);
  const whatsapp = sumKnown(data.channels.map((row) => row.whatsapp));
  const moves = data.channels.map((row) => ({
    row,
    move: moveFor(row, connectorByName.get(row.channel.toLowerCase())?.state),
  }));
  const todo = moves.filter((item) => !item.move.quiet);
  const odoo = sourceState(data.site.odoo?.state);

  const steps = [
    { label: 'Seen', value: num(seen), hint: 'Ads and search' },
    { label: 'Click', value: num(clicks), hint: 'Ads and search' },
    { label: 'WhatsApp', value: num(whatsapp), hint: whatsapp == null ? 'Not in the feed' : 'Conversations' },
    { label: 'Qualified', value: num(data.qualified), hint: data.qualified == null ? 'From Odoo' : 'From Odoo' },
    { label: 'Quote', value: num(data.quotes), hint: odoo.label },
    { label: 'Showroom', value: '—', hint: 'Visits not tracked' },
    { label: 'Order', value: num(data.orders_90d), hint: data.revenue_90d == null ? 'Paid orders' : aed(data.revenue_90d) },
  ];

  return (
    <>
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">The path</h2>
          <p className="text-xs text-brand-medium-gray">Spend {aed(data.spend)} of {aed(data.budget)}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {steps.map((step, index) => (
            <div key={step.label} className="flex min-w-0 flex-1 items-stretch gap-2">
              <PathStep label={step.label} value={step.value} hint={step.hint} />
              {index < steps.length - 1 ? (
                <span className="self-center text-brand-medium-gray" aria-hidden="true">→</span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {todo.length ? (
        <section className="dash-panel p-5">
          <h2 className="text-lg font-semibold">This week</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {todo.map(({ row, move }) => (
              <Link
                key={row.channel}
                href={move.href}
                className="inline-flex items-center gap-2 rounded-full bg-brand-light-gray/60 px-3 py-1.5 text-sm font-semibold text-brand-black hover:bg-brand-burgundy/10"
              >
                {move.label}
                <span className="font-medium text-brand-dark-gray">{row.channel}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="dash-panel overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b border-brand-light-gray px-5 py-4">
          <h2 className="text-lg font-semibold">Channels</h2>
          <Link href="/budgets" className="text-xs font-semibold text-brand-burgundy">Budgets</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wider text-brand-medium-gray">
              <tr>
                {['Channel', 'Spend', 'Seen', 'Click', 'WhatsApp', 'Qualified', 'Quote', 'Do'].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moves.map(({ row, move }) => {
                const tone = connectorByName.get(row.channel.toLowerCase())?.state;
                return (
                  <tr key={row.channel} className="border-t border-brand-light-gray align-top">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-brand-black">{row.channel}</span>
                        <Pill state={tone} />
                      </div>
                      <div className="mt-2 w-28">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-light-gray">
                          <div
                            className={`h-full rounded-full ${row.utilization != null && row.utilization > 1 ? 'bg-red-700' : 'bg-brand-burgundy'}`}
                            style={{ width: `${row.utilization == null ? 0 : Math.max(0, Math.min(100, row.utilization * 100))}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-1 text-[10px] text-brand-medium-gray">{pct(row.utilization)} of {aed(row.budget)}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{aed(row.spend)}</td>
                    <td className="px-4 py-3 tabular-nums">{num(row.impressions)}</td>
                    <td className="px-4 py-3 tabular-nums">{num(row.clicks)}</td>
                    <td className="px-4 py-3 tabular-nums">{num(row.whatsapp)}</td>
                    <td className="px-4 py-3 tabular-nums">{num(row.qualified)}</td>
                    <td className="px-4 py-3 tabular-nums">{num(row.quotes)}</td>
                    <td className="px-4 py-3">
                      <Link href={move.href} className={`text-sm font-semibold ${move.quiet ? 'text-brand-dark-gray' : 'text-brand-burgundy'}`}>
                        {move.label}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="dash-panel p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Content</h2>
            <Link href="/calendar" className="text-xs font-semibold text-brand-burgundy">Open calendar</Link>
          </div>
          <p className="mt-1 text-xs text-brand-medium-gray">Brief, make, schedule, publish. Counts are posts dated this month.</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              ['Brief', work?.brief],
              ['Making', work?.making],
              ['Ready', work?.ready],
              ['Out', work?.out],
            ].map(([label, value], index, list) => (
              <div key={String(label)} className="relative rounded-xl border border-brand-light-gray px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">{label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{value == null ? '—' : num(value as number)}</div>
                {index < list.length - 1 ? <span className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-brand-medium-gray sm:block" aria-hidden="true">→</span> : null}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">Collections</div>
            {work && work.collections.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {work.collections.map((item) => (
                  <span key={item.name} className="rounded-full bg-brand-light-gray/60 px-3 py-1 text-xs font-semibold text-brand-black">
                    {item.name}
                    <span className="ml-1 font-medium text-brand-dark-gray">{item.count}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-brand-dark-gray">{work ? 'No collection tagged this month.' : '—'}</p>
            )}
          </div>
        </div>

        <div className="dash-panel p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Campaigns</h2>
            <Link href="/calendar" className="text-xs font-semibold text-brand-burgundy">Open calendar</Link>
          </div>
          <p className="mt-1 text-xs text-brand-medium-gray">What is in market this month, and on which channels.</p>
          {work && work.campaigns.length ? (
            <ul className="mt-4 space-y-3">
              {work.campaigns.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 border-t border-brand-light-gray pt-3 first:border-t-0 first:pt-0">
                  <div>
                    <div className="font-semibold text-brand-black">{item.name}</div>
                    <div className="mt-1 text-xs text-brand-dark-gray">{item.when}</div>
                  </div>
                  <div className="max-w-[12rem] text-right text-xs font-medium text-brand-dark-gray">{item.channels}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-brand-dark-gray">{work ? 'No campaign scheduled this month.' : '—'}</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Website', data.site.ga4?.state, data.site.ga4?.sessions != null ? `${num(data.site.ga4.sessions)} sessions` : 'Sessions unknown', '/connections'],
          ['Google search', data.site.search?.state, data.site.search?.impressions != null ? `${num(data.site.search.impressions)} impressions` : 'Impressions unknown', '/connections'],
          ['Reviews', data.site.reviews?.state, data.site.reviews?.rating != null ? `${data.site.reviews.rating} · ${num(data.site.reviews.count)}` : 'Rating unknown', '/connections'],
          ['Instagram', undefined, 'Posts are managed on the calendar', '/calendar'],
          ['Showroom', undefined, 'Appointments, walk-ins and events are not tracked', ''],
          ['Odoo', data.site.odoo?.state, data.site.odoo?.detail || 'Quotes and orders', '/connections'],
          ['Tag Manager', data.site.gtm?.state, data.site.gtm?.detail || 'Tag check only', '/connections'],
        ].map(([title, state, detail, href]) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">{title}</div>
                {state ? <Pill state={String(state)} /> : null}
              </div>
              <p className="mt-2 text-sm text-brand-dark-gray">{detail}</p>
            </>
          );
          return href ? (
            <Link key={String(title)} href={String(href)} className="dash-card p-5">{body}</Link>
          ) : (
            <div key={String(title)} className="dash-card p-5">{body}</div>
          );
        })}
      </section>
    </>
  );
}
