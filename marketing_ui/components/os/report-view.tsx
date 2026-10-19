'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon } from '@/components/os/icons';
import { ChannelTags, Empty, ErrorBox, PageHeader, PageSkeleton, Panel, Segmented, SourceStrip, StagePill, Toast } from '@/components/os/ui';
import { useApi } from '@/lib/os/client';
import { addDays, compact, endOfMonth, longDate, money, rangeLabel, shortDate, startOfMonth, startOfWeek, today, type Campaign, type Content, type Initiative, type Task } from '@/lib/os/model';
import { sourceFlags } from '@/lib/os/sources';
import { useUrlState } from '@/lib/os/url';

type Preset = 'week' | 'last-week' | 'month' | 'last-month' | 'custom';
type Brief = Pick<Content, 'id' | 'title' | 'status' | 'publish_date' | 'due_date' | 'channels' | 'owner' | 'campaign_name' | 'format' | 'kpi'>;

type ReportPayload = {
  from: string;
  to: string;
  generated_on: string;
  paid: {
    spend: number | null;
    impressions: number | null;
    clicks: number | null;
    raw_results: number | null;
    channels: Array<{ channel: string; spend: number | null; impressions: number | null; clicks: number | null; raw_results: number | null }>;
    missing: string[];
  };
  crm: { qualified: number | null; whatsapp: number | null; quotes: number | null; orders_90d: number | null; revenue_90d: number | null; months: string[]; odoo?: { state?: string; detail?: string } };
  content: { delivered: Brief[]; by_channel: Record<string, number>; views: number | null };
  campaigns: Array<Campaign & { content: { total: number; published: number; views: number | null } }>;
  completed: { tasks: Task[]; initiatives: Initiative[] };
  upcoming: { content: Brief[]; tasks: Task[] };
  blockers: { tasks: Task[]; initiatives: Initiative[]; connectors: Array<{ name: string; detail?: string }> };
};

function presetRange(preset: Preset): { from: string; to: string } {
  const now = today();
  if (preset === 'week') return { from: startOfWeek(now), to: now };
  if (preset === 'last-week') {
    const from = addDays(startOfWeek(now), -7);
    return { from, to: addDays(from, 6) };
  }
  if (preset === 'last-month') {
    const end = addDays(startOfMonth(now), -1);
    return { from: startOfMonth(end), to: endOfMonth(end) };
  }
  return { from: startOfMonth(now), to: now };
}

function Step({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-black/[0.07] bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-brand-dark-gray">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {note ? <div className="mt-0.5 text-[11px] text-brand-dark-gray">{note}</div> : null}
    </div>
  );
}

export function ReportView() {
  const { params, update } = useUrlState();
  const preset = (params.get('range') as Preset) || 'week';
  const fallback = presetRange(preset === 'custom' ? 'week' : preset);
  const from = preset === 'custom' ? params.get('from') || fallback.from : fallback.from;
  const to = preset === 'custom' ? params.get('to') || fallback.to : fallback.to;
  const valid = from <= to;
  const report = useApi<ReportPayload>(valid ? `report?start=${from}&end=${to}` : null);
  const [toast, setToast] = useState<string | null>(null);
  const data = report.data;

  async function share() {
    const url = new URL(window.location.href);
    url.searchParams.set('range', 'custom');
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    try {
      await navigator.clipboard.writeText(url.toString());
      setToast('Link copied. It opens this exact range.');
    } catch {
      setToast('Copy is blocked in this browser.');
    }
  }

  const crmDisconnected = data ? data.crm.odoo?.state === 'error' || data.crm.odoo?.state === 'unconfigured' : false;
  const crmNote = crmDisconnected
    ? 'Odoo CRM disconnected'
    : data?.crm.months.length
      ? `Odoo, ${data.crm.months.length} whole month${data.crm.months.length > 1 ? 's' : ''}`
      : 'Odoo reports whole months only';
  const channelCounts = data ? Object.entries(data.content.by_channel).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div id="report">
      <PageHeader
        title="Marketing report"
        subtitle={`${rangeLabel(from, to)} · prepared ${longDate(today())}`}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <button type="button" className="btn-outline gap-1.5 px-3 py-1.5 text-[13px]" onClick={() => void share()}>
              <Icon.link className="h-4 w-4" /> Copy link
            </button>
            <button type="button" className="btn-primary gap-1.5 px-3 py-1.5 text-[13px]" onClick={() => window.print()} disabled={!data}>
              <Icon.print className="h-4 w-4" /> Print or PDF
            </button>
          </div>
        }
      >
        <div className="no-print flex flex-wrap items-center gap-2">
          <Segmented
            label="Range"
            value={preset}
            onChange={(value) => update(value === 'custom' ? { range: 'custom', from, to } : { range: value, from: null, to: null })}
            options={[
              { value: 'week', label: 'This week' },
              { value: 'last-week', label: 'Last week' },
              { value: 'month', label: 'This month' },
              { value: 'last-month', label: 'Last month' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          {preset === 'custom' ? (
            <span className="flex items-center gap-1.5">
              <input type="date" className="os-input h-8 w-auto py-1" value={from} max={to} onChange={(e) => e.target.value && update({ from: e.target.value })} />
              <span className="text-brand-dark-gray">–</span>
              <input type="date" className="os-input h-8 w-auto py-1" value={to} min={from} onChange={(e) => e.target.value && update({ to: e.target.value })} />
            </span>
          ) : null}
        </div>
      </PageHeader>

      {!valid ? <ErrorBox message="The start date is after the end date." /> : null}
      {report.error && !data ? <ErrorBox message={report.error.message} onRetry={() => void report.reload()} /> : null}
      {valid && !data && !report.error ? <PageSkeleton /> : null}

      {data ? (
        <div className="space-y-4">
          <SourceStrip
            items={sourceFlags({
              connectors: data.blockers.connectors,
              missing: data.paid.missing,
              odoo: data.crm.odoo,
              qualified: data.crm.qualified,
            })}
          />
          <Panel title="Spend to sale">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Step label="Spend" value={money(data.paid.spend)} note={data.paid.missing.length ? `${data.paid.missing.join(', ')} unknown` : 'All paid channels'} />
              <Step label="Platform results" value={compact(data.paid.raw_results)} note={`${compact(data.paid.clicks)} clicks · ${compact(data.paid.impressions)} seen`} />
              <Step label="Qualified leads" value={compact(data.crm.qualified)} note={crmNote} />
              <Step label="Quotes" value={compact(data.crm.quotes)} note={crmNote} />
              <Step label="Revenue" value={money(data.crm.revenue_90d)} note={data.crm.revenue_90d == null ? 'Not reported' : 'Paid orders'} />
            </div>
            {data.paid.channels.length ? (
              <div className="-mx-1 mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[10px] uppercase tracking-wider text-brand-medium-gray">
                    <tr>
                      <th className="px-1 py-1.5 font-medium">Channel</th>
                      <th className="px-1 py-1.5 text-right font-medium">Spend</th>
                      <th className="px-1 py-1.5 text-right font-medium">Seen</th>
                      <th className="px-1 py-1.5 text-right font-medium">Clicks</th>
                      <th className="px-1 py-1.5 text-right font-medium">Results</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.paid.channels.map((row) => (
                      <tr key={row.channel} className="border-t border-black/5">
                        <td className="px-1 py-1.5 font-medium">{row.channel}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums">{money(row.spend)}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums">{compact(row.impressions)}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums">{compact(row.clicks)}</td>
                        <td className="px-1 py-1.5 text-right tabular-nums">{compact(row.raw_results)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={`Content delivered · ${data.content.delivered.length}`} action={data.content.views != null ? <span className="text-xs text-brand-dark-gray">{compact(data.content.views)} views</span> : null}>
              {channelCounts.length ? (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {channelCounts.map(([name, count]) => (
                    <span key={name} className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs">
                      {name} <span className="font-semibold">{count}</span>
                    </span>
                  ))}
                </div>
              ) : null}
              {data.content.delivered.length ? (
                <ul className="divide-y divide-black/5">
                  {data.content.delivered.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-12 shrink-0 text-xs tabular-nums text-brand-dark-gray">{shortDate(item.publish_date)}</span>
                      <Link href={`/content?open=${item.id}`} className="min-w-0 flex-1 truncate hover:text-brand-burgundy">
                        {item.title || 'Untitled'}
                      </Link>
                      <ChannelTags channels={item.channels} max={3} />
                      <span className="w-14 text-right text-xs tabular-nums text-brand-dark-gray">{item.kpi.views != null ? compact(item.kpi.views) : '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="Nothing was published in this range" />
              )}
            </Panel>

            <Panel title={`Campaigns · ${data.campaigns.length}`}>
              {data.campaigns.length ? (
                <ul className="space-y-3">
                  {data.campaigns.map((item) => (
                    <li key={item.id} className="border-b border-black/5 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/campaigns?open=${item.id}`} className="flex min-w-0 items-center gap-2 font-medium hover:text-brand-burgundy">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                          <span className="truncate">{item.name}</span>
                        </Link>
                        <StagePill value={item.status} />
                      </div>
                      <div className="mt-1 text-xs text-brand-dark-gray">
                        {rangeLabel(item.start_date, item.end_date || item.start_date)} · {item.content.published}/{item.content.total} content out
                        {item.content.views != null ? ` · ${compact(item.content.views)} views` : ''}
                        {item.budget_aed != null ? ` · ${money(item.budget_aed)} budget` : ''}
                      </div>
                      {item.kpi_target ? <div className="mt-1 text-xs"><span className="text-brand-dark-gray">Target:</span> {item.kpi_target}</div> : null}
                      {item.results ? <div className="mt-0.5 text-xs"><span className="text-brand-dark-gray">Result:</span> {item.results}</div> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="No campaign ran in this range" />
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Completed">
              {data.completed.initiatives.length || data.completed.tasks.length ? (
                <ul className="space-y-1.5 text-sm">
                  {data.completed.initiatives.map((item) => (
                    <li key={item.id} className="flex gap-2">
                      <span className="text-emerald-700">✓</span>
                      <span className="font-medium">{item.name}</span>
                    </li>
                  ))}
                  {data.completed.tasks.map((task) => (
                    <li key={task.id} className="flex gap-2">
                      <span className="text-emerald-700">✓</span>
                      <span className="min-w-0 flex-1">{task.title}</span>
                      {task.owner ? <span className="text-xs text-brand-dark-gray">{task.owner}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-brand-dark-gray">No task or initiative was closed in this range.</p>
              )}
            </Panel>
            <Panel title="Coming up · 14 days">
              {data.upcoming.content.length || data.upcoming.tasks.length ? (
                <ul className="space-y-1.5 text-sm">
                  {data.upcoming.content.map((item) => (
                    <li key={item.id} className="flex gap-2">
                      <span className="w-12 shrink-0 text-xs tabular-nums text-brand-dark-gray">{shortDate(item.publish_date)}</span>
                      <span className="min-w-0 flex-1 truncate">{item.title || 'Untitled'}</span>
                    </li>
                  ))}
                  {data.upcoming.tasks.map((task) => (
                    <li key={task.id} className="flex gap-2">
                      <span className="w-12 shrink-0 text-xs tabular-nums text-brand-dark-gray">{shortDate(task.deadline)}</span>
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-brand-dark-gray">Nothing is scheduled yet.</p>
              )}
            </Panel>
            <Panel title="Blockers">
              {data.blockers.tasks.length || data.blockers.initiatives.length || data.blockers.connectors.length ? (
                <ul className="space-y-1.5 text-sm">
                  {data.blockers.initiatives.map((item) => (
                    <li key={item.id}>
                      <span className="font-medium">{item.name}</span>
                      {item.blockers ? <span className="text-brand-dark-gray"> — {item.blockers}</span> : null}
                    </li>
                  ))}
                  {data.blockers.tasks.map((task) => (
                    <li key={task.id}>
                      {task.title}
                      {task.blocker ? <span className="text-brand-dark-gray"> — {task.blocker}</span> : null}
                    </li>
                  ))}
                  {data.blockers.connectors.map((item) => (
                    <li key={item.name}>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-brand-dark-gray"> — data feed needs a fix</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-brand-dark-gray">No blockers.</p>
              )}
            </Panel>
          </div>
          <p className="text-[11px] text-brand-dark-gray">A dash means the source did not report the figure. It is unknown, not zero.</p>
        </div>
      ) : null}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
