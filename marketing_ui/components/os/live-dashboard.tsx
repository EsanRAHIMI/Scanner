'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useLiveDashboard } from '@/hooks/use-live-dashboard';
import { WorkBoard } from '@/components/os/work-board';
import { AUDIENCE_CHANNELS, DASHBOARD_SECTIONS, readSiteSource } from '@/lib/os/catalog';
import { aed, monthLabel, num, pct, type AudienceRow, type ChannelRow, type DashboardPayload, type TargetRow } from '@/lib/os/types';

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

function rate(clicks: number | null, impressions: number | null, ctr: number | null): number | null {
  if (ctr != null) return ctr;
  if (clicks == null || impressions == null || impressions <= 0) return null;
  return clicks / impressions;
}

function houseFigure(state: string | undefined, figure: string): string {
  if (state === 'error') {
    if (figure.includes('403') || figure.includes('disabled')) return 'Access is blocked';
    if (figure.includes('Fault') || figure.includes('not allowed')) return 'No permission';
    if (figure.includes('401')) return 'Sign-in rejected';
    return 'Needs a fix';
  }
  return figure.length > 48 ? `${figure.slice(0, 46)}…` : figure;
}

function plainDetail(detail?: string): string {
  if (!detail) return '';
  const raw = detail.includes('{') ? detail.slice(0, detail.indexOf('{')).replace(/:\s*$/, '').trim() : detail;
  if (raw.includes('401')) return 'Sign-in was rejected. Create the token from the account that owns this profile.';
  return raw;
}

function growthLabel(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (value > 0) return `+${num(value)}`;
  if (value < 0) return `−${num(Math.abs(value))}`;
  return '0';
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
              Exceptions first, then the channel you select. A blank figure is unknown, not zero.
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
              <button type="button" className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40" disabled={months[0] === month} onClick={() => setMonth(months[Math.max(0, months.indexOf(month) - 1)])}>Earlier</button>
              <select className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-burgundy" value={month} onChange={(event) => setMonth(event.target.value)}>
                {months.map((item) => (
                  <option key={item} value={item}>{item === today ? `This month · ${monthLabel(item)}` : monthLabel(item)}</option>
                ))}
              </select>
              <button type="button" className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40" disabled={months[months.length - 1] === month} onClick={() => setMonth(months[Math.min(months.length - 1, months.indexOf(month) + 1)])}>Later</button>
              <button type="button" onClick={() => void refresh()} disabled={syncing} className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-brand-burgundy disabled:opacity-60">
                {syncing ? 'Refreshing…' : 'Refresh now'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {!data ? <div className="dash-panel h-40 animate-pulse" /> : <Board data={data} work={work} month={month} onMonth={setMonth} connectorByName={connectorByName} />}
    </div>
  );
}

function Board({
  data,
  work,
  month,
  onMonth,
  connectorByName,
}: {
  data: DashboardPayload;
  work: Work | null;
  month: string;
  onMonth: (month: string) => void;
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
  const odoo = sourceState(data.site.odoo?.state);

  const steps = [
    { label: 'Seen', value: seen, hint: 'Ads and search' },
    { label: 'Click', value: clicks, hint: 'Ads and search' },
    { label: 'WhatsApp', value: whatsapp, hint: whatsapp == null ? 'Not in the feed' : 'Conversations' },
    { label: 'Qualified', value: data.qualified, hint: 'From Odoo' },
    { label: 'Quote', value: data.quotes, hint: odoo.label },
    { label: 'Showroom', value: null, hint: 'Visits not tracked' },
    { label: 'Order', value: data.orders_90d, hint: data.revenue_90d == null ? 'Paid orders, 90 days' : aed(data.revenue_90d) },
  ];

  const used = data.budget ? (data.spend == null ? null : data.spend / data.budget) : null;
  const pace = monthPace(month);
  const priorMonth = shiftMonth(month, -1);
  const priorSpend = data.trend.find((point) => point.month === priorMonth)?.spend ?? null;
  const spendDelta = data.spend != null && priorSpend != null ? data.spend - priorSpend : null;
  const decisions = decisionItems(data.alerts, data.channels, data.targets ?? [], pace);

  return (
    <>
      {decisions.length ? (
        <section className="dash-panel p-5">
          <h2 className="text-lg font-semibold">Decide now</h2>
          <ul className="mt-3 divide-y divide-brand-light-gray">
            {decisions.map((item) => (
              <li key={item.text}>
                <Link href={item.href} className="flex items-start gap-3 py-2.5 text-sm hover:text-brand-burgundy">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.level === 'high' ? 'bg-red-600' : 'bg-amber-500'}`} />
                  <span className="min-w-0 flex-1 text-brand-black">{item.text}</span>
                  <span className="shrink-0 text-xs font-semibold text-brand-burgundy">{item.where}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="dash-panel p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">{monthLabel(month)}</h2>
            <p className="text-xs text-brand-medium-gray">{pct(used)} of {aed(data.budget)} · {pct(pace)} of the month gone</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <PathStep label="Spend" value={aed(data.spend)} hint={spendDelta == null ? `vs ${monthLabel(priorMonth)} unknown` : `${spendDelta > 0 ? '+' : spendDelta < 0 ? '−' : ''}${aed(Math.abs(spendDelta))} vs ${monthLabel(priorMonth)}`} />
            <PathStep label="Seen" value={num(seen)} hint="Ads and search" />
            <PathStep label="Click" value={num(clicks)} hint={seen && clicks != null ? pct(clicks / seen) + ' of seen' : 'Ads and search'} />
            <PathStep label="Left" value={aed(data.budget != null && data.spend != null ? data.budget - data.spend : null)} hint="Budget remaining" />
          </div>
          <Funnel steps={steps} />
        </div>
        <SpendChart trend={data.trend} month={month} onPick={onMonth} />
      </section>

      <ChannelConsole moves={moves} connectorByName={connectorByName} targets={data.targets ?? []} />

      <AudienceSection rows={data.audience} />

      <WorkBoard />

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

      <section className="dash-panel p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">House systems</h2>
          <Link href="/connections" className="text-xs font-semibold text-brand-burgundy">Connections</Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {DASHBOARD_SECTIONS.flatMap((section) => section.sources).map((source) => {
            const reading = readSiteSource(source.id, data.site);
            return (
              <Link key={source.id} href={source.href} className="inline-flex items-center gap-2 rounded-full border border-brand-light-gray px-3 py-1.5 text-xs hover:border-brand-burgundy/40">
                <span className="font-semibold text-brand-black">{source.title}</span>
                <span className="max-w-[14rem] truncate text-brand-dark-gray">{reading.figure === '—' ? sourceState(reading.state).label : houseFigure(reading.state, reading.figure)}</span>
                <Pill state={reading.state} />
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

function AudienceSection({ rows }: { rows?: AudienceRow[] }) {
  const byName = new Map((rows ?? []).map((row) => [row.channel, row]));
  return (
    <section className="dash-panel overflow-hidden">
      <div className="border-b border-brand-light-gray px-5 py-4">
        <h2 className="text-lg font-semibold">Audience</h2>
        <p className="mt-1 text-xs text-brand-medium-gray">
          Followers, 30-day growth, views, likes, and comments on the connected profiles. A blank figure is unknown. Ad spend stays in Paid channels.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-[10px] uppercase tracking-wider text-brand-medium-gray">
            <tr>
              {['Profile', 'Followers', 'Growth', 'Views', 'Likes', 'Comments', ''].map((heading) => (
                <th key={heading || 'state'} className="px-4 py-3 font-semibold">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AUDIENCE_CHANNELS.map((name) => {
              const row = byName.get(name);
              return (
                <tr key={name} className="border-t border-brand-light-gray">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-brand-black">{name}</div>
                    {row?.state && row.state !== 'ok' && row.detail ? (
                      <p className="mt-1 max-w-sm truncate text-xs text-brand-dark-gray" title={plainDetail(row.detail)}>{plainDetail(row.detail)}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{num(row?.followers)}</td>
                  <td className="px-4 py-3 tabular-nums">{growthLabel(row?.growth)}</td>
                  <td className="px-4 py-3 tabular-nums">{num(row?.views)}</td>
                  <td className="px-4 py-3 tabular-nums">{num(row?.likes)}</td>
                  <td className="px-4 py-3 tabular-nums">{num(row?.comments)}</td>
                  <td className="px-4 py-3"><Pill state={row?.state} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function shiftMonth(month: string, delta: number): string {
  const [year, part] = month.split('-').map(Number);
  const next = new Date(year, part - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function monthPace(month: string): number {
  const now = new Date();
  const [year, part] = month.split('-').map(Number);
  const days = new Date(year, part, 0).getDate();
  const start = new Date(year, part - 1, 1);
  const end = new Date(year, part - 1, days, 23, 59, 59);
  if (now < start) return 0;
  if (now > end) return 1;
  return now.getDate() / days;
}

function actualFor(row: ChannelRow, metric: string): number | null {
  if (metric === 'WhatsApp / 30d') return row.whatsapp;
  if (metric === 'Quotes / 30d') return row.quotes;
  if (metric === 'Paid orders / 90d') return row.orders_90d;
  if (metric === 'Qualified CPL') {
    if (row.spend == null || row.qualified == null || row.qualified <= 0) return null;
    return row.spend / row.qualified;
  }
  if (metric === 'Search CPC') {
    if (row.spend == null || row.clicks == null || row.clicks <= 0) return null;
    return row.spend / row.clicks;
  }
  return null;
}

function scoreTarget(direction: string | undefined, actual: number | null, target: number | null): 'met' | 'miss' | 'unknown' {
  if (actual == null || target == null) return 'unknown';
  if (direction === 'lte') return actual <= target ? 'met' : 'miss';
  return actual >= target ? 'met' : 'miss';
}

function targetFigure(metric: string, value: number | null, unit?: string): string {
  if (value == null) return '—';
  if (unit === 'AED' || metric.includes('CPL') || metric.includes('CPC')) return aed(value);
  if (unit === 'ratio') return pct(value);
  return num(value);
}

function placeFor(text: string): { href: string; where: string } {
  if (text.includes('over budget') || text.includes('draft') || text.includes('of budget') || text.includes('against')) {
    return text.includes('against') ? { href: '/targets', where: 'Targets' } : { href: '/budgets', where: 'Budgets' };
  }
  return { href: '/connections', where: 'Connections' };
}

function decisionItems(
  alerts: DashboardPayload['alerts'],
  channels: ChannelRow[],
  targets: TargetRow[],
  pace: number,
) {
  const qualified = alerts.filter((item) => item.text.includes('no qualified-lead'));
  const rest = alerts.filter((item) => !item.text.includes('no qualified-lead') && !item.text.includes('last checked'));
  const merged = rest.map((item) => ({ ...item, ...placeFor(item.text) }));
  if (qualified.length) {
    merged.push({
      level: 'medium',
      text: `Qualified leads are unknown on ${qualified.length} active channels. Do not raise budget from raw results.`,
      href: '/connections',
      where: 'Connections',
    });
  }
  for (const target of targets) {
    if (target.target == null || target.channel === 'All') continue;
    const row = channels.find((item) => item.channel === target.channel);
    if (!row) continue;
    const actual = actualFor(row, target.metric);
    if (scoreTarget(target.direction, actual, target.target) !== 'miss') continue;
    merged.push({
      level: 'high',
      text: `${target.channel} ${target.metric} is ${targetFigure(target.metric, actual, target.unit)} against ${targetFigure(target.metric, target.target, target.unit)}.`,
      href: '/targets',
      where: 'Targets',
    });
  }
  if (pace > 0 && pace < 1) {
    for (const row of channels) {
      if (row.utilization != null && row.utilization > pace + 0.2 && row.utilization <= 1) {
        merged.push({
          level: 'medium',
          text: `${row.channel} has used ${pct(row.utilization)} of its budget with ${pct(pace)} of the month gone.`,
          href: '/budgets',
          where: 'Budgets',
        });
      }
    }
  }
  const rank = (level: string) => (level === 'high' ? 0 : 1);
  return merged.sort((a, b) => rank(a.level) - rank(b.level)).slice(0, 6);
}

function Funnel({ steps }: { steps: Array<{ label: string; value: number | null; hint: string }> }) {
  let previous: number | null = null;
  return (
    <ol className="mt-5 space-y-2">
      {steps.map((step) => {
        const width = step.value == null ? 8 : previous == null || previous <= 0 ? 100 : Math.max(4, Math.min(100, (step.value / previous) * 100));
        const drop = step.value != null && previous != null && previous > 0 ? pct(step.value / previous) : null;
        if (step.value != null) previous = step.value;
        return (
          <li key={step.label} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">{step.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-brand-light-gray" title={drop ? `${drop} of the previous known step` : step.hint}>
              <span className={`block h-full rounded-full ${step.value == null ? 'bg-brand-medium-gray/50' : 'bg-brand-burgundy/80'}`} style={{ width: `${width}%` }} />
            </span>
            <span className="w-36 text-right">
              <span className="font-semibold tabular-nums">{num(step.value)}</span>
              {drop ? <span className="ml-2 text-[10px] font-medium text-brand-dark-gray">{drop}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ChannelConsole({
  moves,
  connectorByName,
  targets,
}: {
  moves: Array<{ row: ChannelRow; move: Move }>;
  connectorByName: Map<string, { name: string; state: string; detail?: string }>;
  targets: TargetRow[];
}) {
  const [selected, setSelected] = useState(moves[0]?.row.channel ?? '');
  const current = moves.find((item) => item.row.channel === selected) ?? moves[0];
  if (!current) return null;
  const tone = connectorByName.get(current.row.channel.toLowerCase())?.state;
  const detail = connectorByName.get(current.row.channel.toLowerCase())?.detail;
  const goals = targets.filter((item) => item.channel === current.row.channel && item.target != null);
  const width = current.row.utilization == null ? 0 : Math.max(0, Math.min(100, current.row.utilization * 100));
  return (
    <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <div className="dash-panel overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b border-brand-light-gray px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Channels</h2>
            <p className="mt-1 text-xs text-brand-medium-gray">Select a row to inspect it. Primary channels lead.</p>
          </div>
          <Link href="/budgets" className="text-xs font-semibold text-brand-burgundy">Budgets</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wider text-brand-medium-gray">
              <tr>
                {['Channel', 'Spend', 'Seen', 'Click', 'CTR', ''].map((heading) => (
                  <th key={heading || 'do'} className="px-4 py-3 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moves.map(({ row, move }) => {
                const active = row.channel === current.row.channel;
                const state = connectorByName.get(row.channel.toLowerCase())?.state;
                return (
                  <tr key={row.channel} className={`cursor-pointer border-t border-brand-light-gray ${active ? 'bg-brand-burgundy/5' : ''}`} onClick={() => setSelected(row.channel)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.channel}</div>
                      <div className="mt-1"><Pill state={state} /></div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{aed(row.spend)}</td>
                    <td className="px-4 py-3 tabular-nums">{num(row.impressions)}</td>
                    <td className="px-4 py-3 tabular-nums">{num(row.clicks)}</td>
                    <td className="px-4 py-3 tabular-nums">{pct(rate(row.clicks, row.impressions, row.ctr))}</td>
                    <td className="px-4 py-3">
                      <Link href={move.href} className={`font-semibold ${move.quiet ? 'text-brand-dark-gray' : 'text-brand-burgundy'}`} onClick={(event) => event.stopPropagation()}>{move.label}</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="dash-panel p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{current.row.channel}</h2>
          <Pill state={tone} />
        </div>
        <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{aed(current.row.spend)}</p>
        <p className="mt-1 text-xs text-brand-medium-gray">{pct(current.row.utilization)} of {aed(current.row.budget)} · {current.row.remaining != null && current.row.remaining < 0 ? `${aed(Math.abs(current.row.remaining))} over` : `left ${aed(current.row.remaining)}`}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-light-gray">
          <div className={`h-full rounded-full ${current.row.utilization != null && current.row.utilization > 1 ? 'bg-red-700' : 'bg-brand-burgundy'}`} style={{ width: `${width}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {[
            ['WhatsApp', num(current.row.whatsapp)],
            ['Qualified', num(current.row.qualified)],
            ['Quote', num(current.row.quotes)],
            ['Orders', num(current.row.orders_90d)],
            ['Revenue', aed(current.row.revenue_90d)],
            ['Result', num(current.row.raw_results)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">{label}</dt>
              <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {goals.length ? (
          <ul className="mt-4 space-y-2 border-t border-brand-light-gray pt-3">
            {goals.map((goal) => {
              const actual = actualFor(current.row, goal.metric);
              const score = scoreTarget(goal.direction, actual, goal.target);
              return (
                <li key={goal.metric} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-brand-dark-gray">{goal.metric}</span>
                  <span className={`font-semibold tabular-nums ${score === 'miss' ? 'text-red-700' : score === 'met' ? 'text-emerald-800' : 'text-brand-black'}`}>
                    {targetFigure(goal.metric, actual, goal.unit)}
                    <span className="ml-1 text-[10px] font-medium text-brand-medium-gray">/ {targetFigure(goal.metric, goal.target, goal.unit)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {current.row.issue ? <p className="mt-4 text-sm text-red-700">{current.row.issue}</p> : null}
        {current.row.next_action ? <p className="mt-2 text-sm text-brand-dark-gray">{current.row.next_action}</p> : null}
        {detail ? <p className="mt-3 text-xs text-brand-medium-gray">{detail}</p> : null}
        <Link href={current.move.href} className="btn-primary mt-4 inline-flex px-4 py-2 text-xs">{current.move.label}</Link>
      </aside>
    </section>
  );
}

function SpendChart({
  trend,
  month,
  onPick,
}: {
  trend: DashboardPayload['trend'];
  month: string;
  onPick: (month: string) => void;
}) {
  const known = trend.map((point) => point.spend).filter((value): value is number => value != null);
  const max = Math.max(...known, 1);
  return (
    <section className="dash-panel p-5">
      <h2 className="text-lg font-semibold">Spend by month</h2>
      <p className="mt-1 text-xs text-brand-medium-gray">Select a month. A short bar with no figure means spend is unknown.</p>
      <div className="mt-4 flex h-44 items-end gap-1">
        {trend.map((point) => {
          const height = point.spend == null ? 8 : Math.max(8, (point.spend / max) * 100);
          const selected = point.month === month;
          return (
            <button key={point.month} type="button" onClick={() => onPick(point.month)} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[9px] tabular-nums text-brand-dark-gray">{selected && point.spend != null ? num(point.spend) : ''}</span>
              <span className={`w-full rounded-t ${selected ? 'bg-brand-burgundy' : 'bg-brand-burgundy/25'}`} style={{ height: `${height}%` }} />
              <span className={`text-[9px] ${selected ? 'font-semibold text-brand-burgundy' : 'text-brand-medium-gray'}`}>{monthLabel(point.month).slice(0, 3)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

