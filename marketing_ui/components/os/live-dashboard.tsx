'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon } from '@/components/os/icons';
import { useSession } from '@/components/os/session';
import { Bar, Disclosure, Empty, ErrorBox, PageHeader, PageSkeleton, Panel, Pill, Segmented, SourceStrip, Stat, cx } from '@/components/os/ui';
import { useLiveDashboard } from '@/hooks/use-live-dashboard';
import { AUDIENCE_CHANNELS, DASHBOARD_SECTIONS, readSiteSource } from '@/lib/os/catalog';
import { actualFor, decisionItems, monthPace, scoreTarget, targetFigure, updatedLabel } from '@/lib/os/decisions';
import { usePersisted } from '@/lib/os/client';
import { compact, delta, money } from '@/lib/os/model';
import { aed, monthLabel, num, pct, type AudienceRow, type ChannelRow, type DashboardPayload, type TargetRow } from '@/lib/os/types';
import { sourceFlags } from '@/lib/os/sources';
import { useUrlState } from '@/lib/os/url';

type Connector = { name: string; state: string; detail?: string };
type Metric = 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'results';

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, step: number): string {
  const [year, part] = month.split('-').map(Number);
  const next = new Date(year, part - 1 + step, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function sumKnown(values: Array<number | null | undefined>): number | null {
  const known = values.filter((value): value is number => value != null && !Number.isNaN(value));
  return known.length ? known.reduce((total, value) => total + value, 0) : null;
}

function rate(clicks: number | null, impressions: number | null, ctr: number | null): number | null {
  if (ctr != null) return ctr;
  if (clicks == null || impressions == null || impressions <= 0) return null;
  return clicks / impressions;
}

function cpc(row: ChannelRow): number | null {
  if (row.spend == null || row.clicks == null || row.clicks <= 0) return null;
  return row.spend / row.clicks;
}

function metricValue(row: ChannelRow, metric: Metric): number | null {
  if (metric === 'spend') return row.spend;
  if (metric === 'impressions') return row.impressions;
  if (metric === 'clicks') return row.clicks;
  if (metric === 'ctr') return rate(row.clicks, row.impressions, row.ctr);
  if (metric === 'cpc') return cpc(row);
  return row.raw_results;
}

function metricText(value: number | null, metric: Metric): string {
  if (metric === 'spend' || metric === 'cpc') return money(value, metric === 'cpc' ? 2 : 0);
  if (metric === 'ctr') return pct(value);
  return compact(value);
}

function stateTone(state?: string): { label: string; tone: string; dot: string } {
  if (state === 'ok') return { label: 'Live', tone: 'green', dot: 'bg-emerald-500' };
  if (state === 'error') return { label: 'Error', tone: 'red', dot: 'bg-red-600' };
  if (state === 'unconfigured') return { label: 'Not connected', tone: 'gray', dot: 'bg-brand-medium-gray' };
  return { label: 'Waiting', tone: 'amber', dot: 'bg-amber-500' };
}

function moveFor(row: ChannelRow, state?: string): { label: string; href: string } {
  if (state === 'error') return { label: 'Fix connection', href: '/connections' };
  if (state !== 'ok') return { label: 'Connect', href: '/connections' };
  if (row.utilization != null && row.utilization > 1) return { label: 'Cut budget', href: '/budgets' };
  if (row.status === 'Draft') return { label: 'Set budget', href: '/budgets' };
  if (row.qualified == null) return { label: 'Hold budget', href: '/budgets' };
  return { label: 'Keep', href: '/budgets' };
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

export function PaidMedia() {
  const { isAdmin } = useSession();
  const [month, setMonth] = useState(currentMonth);
  const { data, authRequired, error, syncing, refresh } = useLiveDashboard(month);
  const today = currentMonth();
  const months = [...new Set([...(data?.months ?? []), today])].sort();

  const header = (
    <PageHeader
      title="Paid media"
      subtitle={data ? `${monthLabel(month)} · ${updatedLabel(data.generated_at)} · a blank figure is unknown, not zero` : 'Loading live channels…'}
      actions={
        <>
          <div className="flex items-center rounded-lg border border-black/10 bg-white">
            <button type="button" className="p-1.5 text-brand-dark-gray hover:text-brand-black disabled:opacity-30" aria-label="Earlier month" disabled={months[0] === month} onClick={() => setMonth(months[Math.max(0, months.indexOf(month) - 1)])}>
              <Icon.chevronLeft className="h-4 w-4" />
            </button>
            <select className="bg-transparent py-1 text-[13px] font-medium outline-none" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Month">
              {months.map((item) => (
                <option key={item} value={item}>
                  {item === today ? `This month · ${monthLabel(item)}` : monthLabel(item)}
                </option>
              ))}
            </select>
            <button type="button" className="p-1.5 text-brand-dark-gray hover:text-brand-black disabled:opacity-30" aria-label="Later month" disabled={months[months.length - 1] === month} onClick={() => setMonth(months[Math.min(months.length - 1, months.indexOf(month) + 1)])}>
              <Icon.chevronRight className="h-4 w-4" />
            </button>
          </div>
          {isAdmin ? (
            <button type="button" onClick={() => void refresh()} disabled={syncing} className="btn-outline gap-1.5 px-3 py-1.5 text-[13px]">
              <Icon.refresh className={cx('h-4 w-4', syncing && 'animate-spin')} />
              {syncing ? 'Refreshing…' : 'Refresh now'}
            </button>
          ) : null}
        </>
      }
    />
  );

  return (
    <>
      {header}
      {authRequired ? <ErrorBox message="Your session ended. Reload the page to sign in again." onRetry={() => window.location.reload()} /> : null}
      {error ? <div className="mb-4"><ErrorBox message={error} /></div> : null}
      {data ? <Board data={data} month={month} onMonth={setMonth} /> : authRequired ? null : <PageSkeleton />}
    </>
  );
}

function Board({ data, month, onMonth }: { data: DashboardPayload; month: string; onMonth: (month: string) => void }) {
  const { params, update } = useUrlState();
  const connectors = new Map<string, Connector>((data.connectors ?? []).map((item) => [item.name.toLowerCase(), item]));
  const pace = monthPace(month);
  const decisions = decisionItems(data.alerts, data.channels, data.targets ?? [], pace).slice(0, 6);
  const impressions = sumKnown(data.channels.map((row) => row.impressions));
  const clicks = sumKnown(data.channels.map((row) => row.clicks));
  const results = sumKnown(data.channels.map((row) => row.raw_results));
  const used = data.budget && data.spend != null ? data.spend / data.budget : null;
  const prior = data.trend.find((point) => point.month === shiftMonth(month, -1))?.spend ?? null;
  const cpl = data.spend != null && data.qualified ? data.spend / data.qualified : null;
  const selected = data.channels.find((row) => row.channel === params.get('channel')) ?? data.channels[0];

  return (
    <div className="space-y-4">
      <SourceStrip items={sourceFlags({ connectors: data.connectors, odoo: data.site?.odoo, qualified: data.qualified })} />
      {decisions.length ? (
        <Panel title="Decide now" pad={false}>
          <ul className="divide-y divide-black/5">
            {decisions.map((item) => (
              <li key={item.text}>
                <Link href={item.href} className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-black/[0.02]">
                  <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.level === 'high' ? 'bg-red-600' : 'bg-amber-500')} />
                  <span className="min-w-0 flex-1">{item.text}</span>
                  <span className="shrink-0 text-xs font-semibold text-brand-burgundy">{item.where}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Spend" value={money(data.spend)} trendNeutral trend={delta(data.spend, prior)} hint={prior == null ? 'Last month unknown' : 'vs last month'} />
        <Stat label="Budget used" value={pct(used)} hint={`${money(data.budget)} · ${Math.round(pace * 100)}% of month`} tone={used != null && used > pace + 0.15 ? 'bad' : undefined} href="/budgets" />
        <Stat label="Impressions" value={compact(impressions)} hint="Ads only" />
        <Stat label="Clicks" value={compact(clicks)} hint={impressions && clicks != null ? `${pct(clicks / impressions)} CTR` : 'CTR unknown'} />
        <Stat label="Platform results" value={compact(results)} hint="As each platform counts them" />
        <Stat label="Qualified · CPL" value={compact(data.qualified)} hint={cpl != null ? `CPL ${money(cpl)}` : data.qualified == null ? 'Odoo not reporting' : 'CPL unknown'} />
      </div>

      <section aria-label="Channels" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.channels.map((row) => (
          <ChannelCard key={row.channel} row={row} state={connectors.get(row.channel.toLowerCase())?.state} active={row.channel === selected?.channel} onSelect={() => update({ channel: row.channel })} />
        ))}
      </section>

      {selected ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <Inspector row={selected} connector={connectors.get(selected.channel.toLowerCase())} targets={data.targets ?? []} />
          <Comparison rows={data.channels} selected={selected.channel} onSelect={(channel) => update({ channel })} />
        </div>
      ) : (
        <Empty title="No paid channel is set up for this month" action={<Link href="/budgets" className="btn-primary px-3 py-1.5 text-[13px]">Set budgets</Link>} />
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <SpendChart trend={data.trend} month={month} onPick={onMonth} />
        <Funnel data={data} impressions={impressions} clicks={clicks} />
      </div>

      <Disclosure title="Social profiles · followers and engagement">
        <AudienceTable rows={data.audience} />
      </Disclosure>

      <Panel title="House systems" action={<Link href="/connections" className="os-link">Connections</Link>}>
        <div className="flex flex-wrap gap-2">
          {DASHBOARD_SECTIONS.flatMap((section) => section.sources).map((source) => {
            const reading = readSiteSource(source.id, data.site);
            const tone = stateTone(reading.state);
            return (
              <Link key={source.id} href={source.href} className="inline-flex max-w-full items-center gap-2 rounded-full border border-black/[0.08] px-3 py-1.5 text-xs hover:border-brand-burgundy/30">
                <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
                <span className="font-semibold">{source.title}</span>
                <span className="truncate text-brand-dark-gray">{reading.figure === '—' ? tone.label : houseFigure(reading.state, reading.figure)}</span>
              </Link>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function ChannelCard({ row, state, active, onSelect }: { row: ChannelRow; state?: string; active: boolean; onSelect: () => void }) {
  const tone = stateTone(state);
  const over = row.utilization != null && row.utilization > 1;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cx('os-panel p-4 text-left transition', active ? 'border-brand-burgundy/40 ring-2 ring-brand-burgundy/10' : 'hover:border-black/15')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{row.channel}</span>
        <Pill tone={tone.tone}>{tone.label}</Pill>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-xl font-semibold tabular-nums">{money(row.spend)}</span>
        <span className={cx('text-xs tabular-nums', over ? 'font-semibold text-red-700' : 'text-brand-dark-gray')}>
          {row.budget == null ? 'No budget' : over ? `${money(Math.abs(row.remaining ?? 0))} over` : `of ${money(row.budget)}`}
        </span>
      </div>
      <div className="mt-2">
        <Bar value={row.spend} max={row.budget ?? row.spend ?? 1} tone={over ? 'red' : 'wine'} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {[
          ['CTR', pct(rate(row.clicks, row.impressions, row.ctr))],
          ['CPC', money(cpc(row), 2)],
          ['Results', compact(row.raw_results)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase tracking-wider text-brand-medium-gray">{label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </button>
  );
}

function Inspector({ row, connector, targets }: { row: ChannelRow; connector?: Connector; targets: TargetRow[] }) {
  const tone = stateTone(connector?.state);
  const move = moveFor(row, connector?.state);
  const goals = targets.filter((item) => item.channel === row.channel && item.target != null);
  return (
    <Panel title={`${row.channel} · detail`} action={<Pill tone={tone.tone}>{tone.label}</Pill>}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        {[
          ['Spend', aed(row.spend)],
          ['Budget', aed(row.budget)],
          ['Left', row.remaining != null && row.remaining < 0 ? `${aed(Math.abs(row.remaining))} over` : aed(row.remaining)],
          ['Impressions', num(row.impressions)],
          ['Clicks', num(row.clicks)],
          ['Platform results', num(row.raw_results)],
          ['WhatsApp', num(row.whatsapp)],
          ['Qualified', num(row.qualified)],
          ['Quotes', num(row.quotes)],
          ['Orders · 90d', num(row.orders_90d)],
          ['Revenue · 90d', aed(row.revenue_90d)],
          ['Checked', row.checked_on ?? '—'],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-brand-medium-gray">{label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {goals.length ? (
        <ul className="mt-4 space-y-1.5 border-t border-black/5 pt-3">
          {goals.map((goal) => {
            const actual = actualFor(row, goal.metric);
            const score = scoreTarget(goal.direction, actual, goal.target);
            return (
              <li key={goal.metric} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-brand-dark-gray">{goal.metric}</span>
                <span className={cx('font-semibold tabular-nums', score === 'miss' && 'text-red-700', score === 'met' && 'text-emerald-700')}>
                  {targetFigure(goal.metric, actual, goal.unit)}
                  <span className="ml-1 text-[11px] font-normal text-brand-medium-gray">/ {targetFigure(goal.metric, goal.target, goal.unit)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {row.issue ? <p className="mt-4 text-sm text-red-700">{row.issue}</p> : null}
      {row.next_action ? <p className="mt-1 text-sm text-brand-dark-gray">{row.next_action}</p> : null}
      {connector?.detail && connector.state !== 'ok' ? <p className="mt-2 text-xs text-brand-dark-gray">{plainDetail(connector.detail)}</p> : null}
      <Link href={move.href} className="btn-primary mt-4 px-3 py-1.5 text-[13px]">
        {move.label}
      </Link>
    </Panel>
  );
}

function Comparison({ rows, selected, onSelect }: { rows: ChannelRow[]; selected: string; onSelect: (channel: string) => void }) {
  const [metric, setMetric] = usePersisted<Metric>('paid.metric', 'spend');
  const values = rows.map((row) => ({ row, value: metricValue(row, metric) })).sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const max = Math.max(0, ...values.map((item) => item.value ?? 0));
  return (
    <Panel
      title="Compare channels"
      action={
        <Segmented
          size="sm"
          label="Metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'spend', label: 'Spend' },
            { value: 'impressions', label: 'Seen' },
            { value: 'clicks', label: 'Clicks' },
            { value: 'ctr', label: 'CTR' },
            { value: 'cpc', label: 'CPC' },
            { value: 'results', label: 'Results' },
          ]}
        />
      }
    >
      <ul className="space-y-2.5">
        {values.map(({ row, value }) => (
          <li key={row.channel}>
            <button type="button" className="block w-full text-left" onClick={() => onSelect(row.channel)}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className={cx(row.channel === selected ? 'font-semibold text-brand-burgundy' : 'font-medium')}>{row.channel}</span>
                <span className="tabular-nums">{metricText(value, metric)}</span>
              </div>
              <div className="mt-1">
                <Bar value={value} max={max} tone={value == null ? 'gray' : 'wine'} />
              </div>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-brand-dark-gray">An empty bar means the platform did not report it.</p>
    </Panel>
  );
}

function SpendChart({ trend, month, onPick }: { trend: DashboardPayload['trend']; month: string; onPick: (month: string) => void }) {
  const known = trend.map((point) => point.spend).filter((value): value is number => value != null);
  const max = Math.max(...known, 1);
  return (
    <Panel title="Spend by month">
      <div className="flex h-44 items-end gap-1">
        {trend.map((point) => {
          const height = point.spend == null ? 6 : Math.max(6, (point.spend / max) * 100);
          const on = point.month === month;
          return (
            <button key={point.month} type="button" onClick={() => onPick(point.month)} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${monthLabel(point.month)} · ${aed(point.spend)}`}>
              <span className="text-[9px] tabular-nums text-brand-dark-gray">{on && point.spend != null ? compact(point.spend) : ''}</span>
              <span className={cx('w-full rounded-t', point.spend == null ? 'bg-black/[0.06]' : on ? 'bg-brand-burgundy' : 'bg-brand-burgundy/25')} style={{ height: `${height}%` }} />
              <span className={cx('text-[9px]', on ? 'font-semibold text-brand-burgundy' : 'text-brand-medium-gray')}>{monthLabel(point.month).slice(0, 3)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-brand-dark-gray">Select a month to load it. A grey stub means spend is unknown.</p>
    </Panel>
  );
}

function Funnel({ data, impressions, clicks }: { data: DashboardPayload; impressions: number | null; clicks: number | null }) {
  const seen = sumKnown([impressions, data.site.search?.impressions]);
  const tapped = sumKnown([clicks, data.site.search?.clicks]);
  const steps = [
    { label: 'Seen', value: seen, hint: 'Ads and search' },
    { label: 'Click', value: tapped, hint: 'Ads and search' },
    { label: 'WhatsApp', value: sumKnown(data.channels.map((row) => row.whatsapp)), hint: 'Conversations' },
    { label: 'Qualified', value: data.qualified, hint: 'Odoo' },
    { label: 'Quote', value: data.quotes, hint: 'Odoo' },
    { label: 'Order', value: data.orders_90d, hint: data.revenue_90d == null ? 'Paid, 90 days' : aed(data.revenue_90d) },
  ];
  let previous: number | null = null;
  return (
    <Panel title="Spend to sale">
      <ol className="space-y-2.5">
        {steps.map((step) => {
          const width = step.value == null ? 0 : previous == null || previous <= 0 ? 100 : Math.max(3, Math.min(100, (step.value / previous) * 100));
          const share = step.value != null && previous != null && previous > 0 ? pct(step.value / previous) : null;
          if (step.value != null) previous = step.value;
          return (
            <li key={step.label} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 text-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-brand-dark-gray">{step.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-black/[0.06]" title={share ? `${share} of the previous known step` : step.hint}>
                <span className="block h-full rounded-full bg-brand-burgundy/80" style={{ width: `${width}%` }} />
              </span>
              <span className="w-28 text-right">
                <span className="font-semibold tabular-nums">{num(step.value)}</span>
                {share ? <span className="ml-1.5 text-[10px] text-brand-dark-gray">{share}</span> : step.value == null ? <span className="ml-1.5 text-[10px] text-brand-medium-gray">unknown</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function AudienceTable({ rows }: { rows?: AudienceRow[] }) {
  const byName = new Map((rows ?? []).map((row) => [row.channel, row]));
  return (
    <div className="-mx-3 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-[10px] uppercase tracking-wider text-brand-medium-gray">
          <tr>
            {['Profile', 'Followers', '30d growth', 'Views', 'Likes', 'Comments', ''].map((heading) => (
              <th key={heading || 'state'} className="px-3 py-2 font-medium">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AUDIENCE_CHANNELS.map((name) => {
            const row = byName.get(name);
            const tone = stateTone(row?.state);
            return (
              <tr key={name} className="border-t border-black/5">
                <td className="px-3 py-2">
                  <div className="font-medium">{name}</div>
                  {row?.state && row.state !== 'ok' && row.detail ? (
                    <p className="max-w-xs truncate text-xs text-brand-dark-gray" title={plainDetail(row.detail)}>
                      {plainDetail(row.detail)}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 tabular-nums">{num(row?.followers)}</td>
                <td className="px-3 py-2 tabular-nums">{growthLabel(row?.growth)}</td>
                <td className="px-3 py-2 tabular-nums">{num(row?.views)}</td>
                <td className="px-3 py-2 tabular-nums">{num(row?.likes)}</td>
                <td className="px-3 py-2 tabular-nums">{num(row?.comments)}</td>
                <td className="px-3 py-2">
                  <Pill tone={tone.tone}>{tone.label}</Pill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
