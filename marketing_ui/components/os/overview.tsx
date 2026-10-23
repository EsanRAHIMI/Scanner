'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon } from '@/components/os/icons';
import { useSession } from '@/components/os/session';
import { PaidMedia } from '@/components/os/live-dashboard';
import { TimelineBoard } from '@/components/os/timeline-board';
import { Avatar, ChannelTags, Empty, ErrorBox, PageHeader, PageSkeleton, Panel, Pill, PriorityDot, SourceStrip, Stat, StagePill, Trend, cx } from '@/components/os/ui';
import { invalidate, syncSources, useApi } from '@/lib/os/client';
import { decisionItems, monthPace, updatedLabel, type Decision } from '@/lib/os/decisions';
import { compact, delta, dueLabel, longDate, meLabel, money, rangeLabel, shortDate, type Campaign, type Content, type Initiative, type Task } from '@/lib/os/model';
import { sourceFlags } from '@/lib/os/sources';
import type { ChannelRow, DashboardPayload, TargetRow } from '@/lib/os/types';

type Range = { from: string; to: string };
type PaidRange = Range & {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  raw_results: number | null;
  channels: Array<{ channel: string; spend: number | null; impressions: number | null; clicks: number | null; raw_results: number | null }>;
  missing: string[];
};
type Brief = Pick<Content, 'id' | 'title' | 'status' | 'publish_date' | 'due_date' | 'channels' | 'owner' | 'campaign_name' | 'format' | 'kpi'>;
type TaskBrief = Pick<Task, 'id' | 'title' | 'owner' | 'stage' | 'deadline' | 'priority' | 'blocker' | 'link_type' | 'link_id'>;

export type OverviewPayload = {
  today: string;
  range: Range;
  prior: Range;
  synced_at?: string | null;
  paid: {
    current: PaidRange;
    prior: PaidRange;
    month: { month: string; spend: number | null; budget: number | null; qualified: number | null; quotes: number | null; orders_90d: number | null; revenue_90d: number | null; cpl: number | null };
    channels: ChannelRow[];
    connectors: DashboardPayload['connectors'];
    targets: TargetRow[];
    alerts: DashboardPayload['alerts'];
    odoo?: DashboardPayload['site']['odoo'];
  };
  content: { published: number; published_prior: number; upcoming: Brief[]; upcoming_count: number; late: Brief[]; late_count: number; review: Brief[] };
  tasks: { open: number; overdue: TaskBrief[]; overdue_count: number; due_soon: TaskBrief[]; blocked: TaskBrief[]; blocked_count: number; approvals: TaskBrief[] };
  campaigns: { live: Campaign[]; upcoming: Campaign[] };
  initiatives: { focus: Initiative[]; blocked: number; overdue: number; total: number };
};

type Attention = { key: string; level: 'high' | 'medium'; text: string; meta: string; href: string };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function attention(data: OverviewPayload): Attention[] {
  const out: Attention[] = [];
  for (const task of data.tasks.overdue) {
    out.push({ key: `t-${task.id}`, level: 'high', text: task.title, meta: `Task · ${dueLabel(task.deadline, data.today).text} · ${task.owner || 'Unassigned'}`, href: `/tasks?open=${task.id}` });
  }
  for (const task of data.tasks.blocked) {
    if (out.some((item) => item.key === `t-${task.id}`)) continue;
    out.push({ key: `t-${task.id}`, level: 'high', text: task.title, meta: `Blocked${task.blocker ? ` · ${task.blocker}` : ''}`, href: `/tasks?open=${task.id}` });
  }
  for (const item of data.content.late) {
    out.push({ key: `c-${item.id}`, level: 'high', text: item.title || 'Untitled', meta: `Content · ${item.status} · was due ${shortDate(item.due_date || item.publish_date)}`, href: `/content?open=${item.id}` });
  }
  for (const item of data.content.review) {
    out.push({ key: `r-${item.id}`, level: 'medium', text: item.title || 'Untitled', meta: 'Content waiting for approval', href: `/content?open=${item.id}` });
  }
  for (const task of data.tasks.approvals) {
    out.push({ key: `a-${task.id}`, level: 'medium', text: task.title, meta: `Task in review · ${task.owner || 'Unassigned'}`, href: `/tasks?open=${task.id}` });
  }
  const decisions: Decision[] = decisionItems(data.paid.alerts, data.paid.channels, data.paid.targets, monthPace(data.paid.month.month));
  for (const item of decisions) {
    out.push({ key: `d-${item.text}`, level: item.level, text: item.text, meta: `Paid media · ${item.where}`, href: item.href });
  }
  const rank = (level: string) => (level === 'high' ? 0 : 1);
  return out.sort((a, b) => rank(a.level) - rank(b.level));
}

function WeekRow({ label, now, before, format, inverse }: { label: string; now: number | null; before: number | null; format: (n: number | null) => string; inverse?: boolean }) {
  const change = delta(now, before);
  return (
    <tr className="border-t border-black/5 first:border-t-0">
      <td className="py-2 pr-3 text-[13px] text-brand-dark-gray">{label}</td>
      <td className="py-2 pr-3 text-right text-[13px] font-semibold tabular-nums">{format(now)}</td>
      <td className="py-2 pr-3 text-right text-[13px] tabular-nums text-brand-dark-gray">{format(before)}</td>
      <td className="w-14 py-2 text-right text-xs">{change == null ? <span className="text-brand-medium-gray">—</span> : <Trend value={change} inverse={inverse} />}</td>
    </tr>
  );
}

export function Overview() {
  const { me, isAdmin } = useSession();
  const { data, error, reload } = useApi<OverviewPayload>('overview');
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function refresh() {
    setSyncing(true);
    setSyncNote(null);
    try {
      await syncSources();
      invalidate('overview', 'dashboard');
      setSyncNote('Sources refreshed.');
    } catch (err) {
      setSyncNote((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const name = meLabel(me);
  const header = (
    <PageHeader
      title={`${greeting()}${name ? `, ${name.split(/[\s.]/)[0].replace(/^./, (c) => c.toUpperCase())}` : ''}`}
      subtitle={data ? `${longDate(data.today)} · ${updatedLabel(data.synced_at)}${syncNote ? ` · ${syncNote}` : ''}` : 'Loading the latest numbers…'}
      actions={
        isAdmin ? (
          <button type="button" className="btn-outline gap-1.5 px-3 py-1.5 text-[13px]" onClick={() => void refresh()} disabled={syncing}>
            <Icon.refresh className={cx('h-4 w-4', syncing && 'animate-spin')} />
            {syncing ? 'Refreshing…' : 'Refresh sources'}
          </button>
        ) : null
      }
    />
  );

  if (error && !data) {
    return (
      <>
        {header}
        <ErrorBox message={error.message} onRetry={() => void reload()} />
      </>
    );
  }
  if (!data) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }

  const paid = data.paid;
  const week = paid.current;
  const before = paid.prior;
  const used = paid.month.budget && paid.month.spend != null ? paid.month.spend / paid.month.budget : null;
  const pace = monthPace(paid.month.month);
  const items = attention(data);
  const shown = showAll ? items : items.slice(0, 7);

  return (
    <>
      {header}
      <SourceStrip items={sourceFlags({ connectors: paid.connectors, missing: week.missing, odoo: paid.odoo, qualified: paid.month.qualified })} />

      <div className="mb-4">
        <TimelineBoard />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Spend · 7 days"
          value={money(week.spend)}
          trendNeutral
          trend={delta(week.spend, before.spend)}
          hint={week.missing.length ? `${week.missing.join(', ')} unknown` : before.spend == null ? 'Prior week unknown' : 'vs prior 7 days'}
          href="/paid"
        />
        <Stat
          label="Month to date"
          value={money(paid.month.spend)}
          hint={used == null ? 'No budget set' : `${Math.round(used * 100)}% of ${money(paid.month.budget)} · ${Math.round(pace * 100)}% of month`}
          tone={used != null && used > pace + 0.15 ? 'bad' : undefined}
          href="/budgets"
        />
        <Stat
          label="Qualified leads"
          value={compact(paid.month.qualified)}
          hint={paid.month.qualified == null ? `Odoo not reporting · ${compact(week.raw_results)} platform results` : paid.month.cpl != null ? `CPL ${money(paid.month.cpl)}` : 'This month'}
          href="/paid"
        />
        <Stat
          label="Published · 7 days"
          value={data.content.published}
          trend={delta(data.content.published, data.content.published_prior)}
          hint={`${data.content.published_prior} the week before`}
          href="/content"
        />
        <Stat
          label="Open tasks"
          value={data.tasks.open}
          hint={data.tasks.overdue_count ? `${data.tasks.overdue_count} overdue · ${data.tasks.blocked_count} blocked` : data.tasks.blocked_count ? `${data.tasks.blocked_count} blocked` : 'Nothing overdue'}
          tone={data.tasks.overdue_count ? 'bad' : undefined}
          href="/tasks"
        />
        <Stat label="Live campaigns" value={data.campaigns.live.length} hint={`${data.campaigns.upcoming.length} starting in 30 days`} href="/campaigns" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          title={
            <span className="flex items-center gap-2">
              Needs attention {items.length ? <Pill tone={items.some((item) => item.level === 'high') ? 'red' : 'amber'}>{items.length}</Pill> : null}
            </span>
          }
          pad={false}
        >
          {items.length ? (
            <ul className="divide-y divide-black/5">
              {shown.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="flex items-start gap-3 px-4 py-2.5 hover:bg-black/[0.02]">
                    <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.level === 'high' ? 'bg-red-600' : 'bg-amber-500')} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-brand-black">{item.text}</span>
                      <span className="block truncate text-xs text-brand-dark-gray">{item.meta}</span>
                    </span>
                    <Icon.chevronRight className="mt-1 h-4 w-4 shrink-0 text-brand-medium-gray" />
                  </Link>
                </li>
              ))}
              {items.length > 7 ? (
                <li className="px-4 py-2">
                  <button type="button" className="os-link" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Show less' : `Show all ${items.length}`}
                  </button>
                </li>
              ) : null}
            </ul>
          ) : (
            <div className="p-4">
              <Empty title="Nothing needs you right now">No overdue work, blocked tasks, or paid-media exceptions.</Empty>
            </div>
          )}
        </Panel>

        <Panel title="This week vs last week" action={<span className="text-[11px] text-brand-dark-gray">{rangeLabel(week.from, week.to)}</span>}>
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-brand-medium-gray">
                <th className="pb-1 text-left font-medium" />
                <th className="pb-1 pr-3 text-right font-medium">This</th>
                <th className="pb-1 pr-3 text-right font-medium">Last</th>
                <th className="pb-1 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              <WeekRow label="Spend" now={week.spend} before={before.spend} format={(n) => money(n)} inverse />
              <WeekRow label="Impressions" now={week.impressions} before={before.impressions} format={compact} />
              <WeekRow label="Clicks" now={week.clicks} before={before.clicks} format={compact} />
              <WeekRow label="Platform results" now={week.raw_results} before={before.raw_results} format={compact} />
              <WeekRow label="Content published" now={data.content.published} before={data.content.published_prior} format={compact} />
            </tbody>
          </table>
          {week.missing.length || before.missing.length ? (
            <p className="mt-2 text-[11px] text-brand-dark-gray">
              Unknown where a channel has no daily snapshot{before.missing.length ? ` (last week: ${before.missing.join(', ')})` : ''}.
            </p>
          ) : null}
        </Panel>
      </div>

      <PaidMedia embedded />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Coming up · 14 days" action={<Link href="/content" className="os-link">Content</Link>} pad={false}>
          {data.content.upcoming.length ? (
            <ul className="divide-y divide-black/5">
              {data.content.upcoming.map((item) => (
                <li key={item.id}>
                  <Link href={`/content?open=${item.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02]">
                    <span className="w-14 shrink-0 text-xs font-semibold tabular-nums text-brand-burgundy">{dueLabel(item.publish_date, data.today).text}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{item.title || 'Untitled'}</span>
                      <span className="block truncate text-xs text-brand-dark-gray">{[item.campaign_name, item.format].filter(Boolean).join(' · ') || 'No campaign'}</span>
                    </span>
                    <ChannelTags channels={item.channels} max={3} />
                    <StagePill value={item.status} />
                  </Link>
                </li>
              ))}
              {data.content.upcoming_count > data.content.upcoming.length ? (
                <li className="px-4 py-2 text-xs text-brand-dark-gray">+{data.content.upcoming_count - data.content.upcoming.length} more</li>
              ) : null}
            </ul>
          ) : (
            <div className="p-4">
              <Empty title="Nothing scheduled in the next two weeks" action={<Link href="/content?new=1" className="btn-primary px-3 py-1.5 text-[13px]">Plan content</Link>} />
            </div>
          )}
        </Panel>

        <Panel title="Campaigns" action={<Link href="/campaigns" className="os-link">All campaigns</Link>} pad={false}>
          {data.campaigns.live.length || data.campaigns.upcoming.length ? (
            <ul className="divide-y divide-black/5">
              {[...data.campaigns.live, ...data.campaigns.upcoming].map((item) => (
                <li key={item.id}>
                  <Link href={`/campaigns?open=${item.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02]">
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: item.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="block truncate text-xs text-brand-dark-gray">
                        {rangeLabel(item.start_date, item.end_date || item.start_date)} · {item.content?.published ?? 0}/{item.content?.total ?? 0} content out
                      </span>
                    </span>
                    <StagePill value={item.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <Empty title="No campaign is live or starting soon" />
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Initiatives"
          action={
            <span className="flex items-center gap-2">
              {data.initiatives.blocked ? <Pill tone="red">{data.initiatives.blocked} blocked</Pill> : null}
              {data.initiatives.overdue ? <Pill tone="amber">{data.initiatives.overdue} late</Pill> : null}
              <Link href="/initiatives" className="os-link">
                All {data.initiatives.total}
              </Link>
            </span>
          }
          pad={false}
        >
          {data.initiatives.focus.length ? (
            <ul className="divide-y divide-black/5">
              {data.initiatives.focus.map((item) => {
                const due = dueLabel(item.deadline, data.today);
                return (
                  <li key={item.id}>
                    <Link href={`/initiatives?open=${item.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02]">
                      <PriorityDot value={item.priority} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.name}</span>
                        <span className="block truncate text-xs text-brand-dark-gray">{item.blockers ? `Blocked: ${item.blockers}` : item.deadline ? `Due ${shortDate(item.deadline)}` : 'No deadline'}</span>
                      </span>
                      {item.deadline && due.late ? <Pill tone="red">{due.text}</Pill> : null}
                      <StagePill value={item.status} />
                      <Avatar name={item.owner} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-4">
              <Empty title="All initiatives are done" />
            </div>
          )}
        </Panel>

        <Panel title="Tasks due this week" action={<Link href="/tasks" className="os-link">Tasks</Link>} pad={false}>
          {data.tasks.due_soon.length ? (
            <ul className="divide-y divide-black/5">
              {data.tasks.due_soon.map((task) => (
                <li key={task.id}>
                  <Link href={`/tasks?open=${task.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02]">
                    <PriorityDot value={task.priority} />
                    <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                    <span className="text-xs tabular-nums text-brand-dark-gray">{dueLabel(task.deadline, data.today).text}</span>
                    <Avatar name={task.owner} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <Empty title="No task is due this week" />
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
