'use client';

import { useMemo, useState } from 'react';

import { ContentEditor } from '@/components/os/content-editor';
import { Icon } from '@/components/os/icons';
import { Avatar, ChannelTags, Empty, ErrorBox, FilterSelect, ListSkeleton, MissingOpen, PageHeader, Segmented, StagePill, STAGE_TONE, cx } from '@/components/os/ui';
import { usePersisted } from '@/lib/os/client';
import { useAllContent, useCampaigns, useFieldOptions, usePeople } from '@/lib/os/data';
import {
  CONTENT_CHANNELS,
  CONTENT_STAGES,
  addDays,
  dueLabel,
  endOfMonth,
  longDate,
  monthTitle,
  parseDay,
  shortDate,
  startOfMonth,
  startOfWeek,
  today,
  weekdayShort,
  type Content,
} from '@/lib/os/model';
import { useDrawerRecord } from '@/lib/os/url';

type View = 'month' | 'week' | 'list';
type Filters = { channel: string; status: string; campaign: string; owner: string; pillar: string };

const NO_FILTERS: Filters = { channel: '', status: '', campaign: '', owner: '', pillar: '' };
const DOT: Record<string, string> = {
  gray: 'bg-brand-medium-gray',
  amber: 'bg-amber-500',
  blue: 'bg-sky-500',
  wine: 'bg-brand-burgundy',
  green: 'bg-emerald-500',
};

function dayOf(item: Content): string | null {
  return item.publish_date || item.due_date;
}

function matches(item: Content, filters: Filters): boolean {
  if (filters.channel && !item.channels.includes(filters.channel as Content['channels'][number])) return false;
  if (filters.status && item.status !== filters.status) return false;
  if (filters.campaign === 'none' ? item.campaign_id : filters.campaign && item.campaign_id !== filters.campaign) return false;
  if (filters.owner === 'none' ? item.owner : filters.owner && item.owner !== filters.owner) return false;
  if (filters.pillar && item.pillar !== filters.pillar) return false;
  return true;
}

function ItemChip({ item, onOpen, dense }: { item: Content; onOpen: () => void; dense?: boolean }) {
  const tone = STAGE_TONE[item.status] ?? 'gray';
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className={cx('flex w-full items-center gap-1.5 rounded-md bg-white text-left ring-1 ring-black/[0.06] transition hover:ring-brand-burgundy/30', dense ? 'px-1.5 py-0.5' : 'px-2 py-1.5')}
      title={`${item.title || 'Untitled'} · ${item.status}`}
    >
      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', DOT[tone])} />
      <span className={cx('min-w-0 flex-1 truncate', dense ? 'text-[11px]' : 'text-[13px]')}>{item.title || 'Untitled'}</span>
      {!dense && item.channels.length ? <ChannelTags channels={item.channels} max={2} /> : null}
    </button>
  );
}

export function ContentPlanner() {
  const content = useAllContent();
  const campaigns = useCampaigns();
  const people = usePeople();
  const { pillars } = useFieldOptions();
  const [view, setView] = usePersisted<View>('content.view', 'month');
  const [filters, setFilters] = usePersisted<Filters>('content.filters', NO_FILTERS);
  const [cursor, setCursor] = useState(today);
  const [picked, setPicked] = useState<string | null>(null);

  const now = today();
  const items = useMemo(() => (content.data?.items ?? []).filter((item) => matches(item, filters)), [content.data, filters]);
  const byDay = useMemo(() => {
    const map = new Map<string, Content[]>();
    for (const item of items) {
      const day = dayOf(item);
      if (!day) continue;
      map.set(day, [...(map.get(day) ?? []), item]);
    }
    return map;
  }, [items]);

  const drawer = useDrawerRecord(content.data?.items);
  const defaults = drawer.creating
    ? { campaign_id: drawer.params.get('campaign') || null, publish_date: drawer.params.get('date') || null, status: 'Idea' as const }
    : undefined;

  const range = useMemo(() => {
    if (view === 'week') {
      const from = startOfWeek(cursor);
      return { from, to: addDays(from, 6) };
    }
    return { from: startOfMonth(cursor), to: endOfMonth(cursor) };
  }, [view, cursor]);

  const inRange = items.filter((item) => {
    const day = dayOf(item);
    return day && day >= range.from && day <= range.to;
  });
  const undated = items.filter((item) => !dayOf(item));
  const counts = CONTENT_STAGES.map((stage) => ({ stage, count: inRange.filter((item) => item.status === stage).length }));
  const active = Object.values(filters).filter(Boolean).length;

  function step(direction: number) {
    setCursor((current) => {
      if (view === 'week') return addDays(current, direction * 7);
      const day = parseDay(startOfMonth(current));
      day.setMonth(day.getMonth() + direction);
      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-01`;
    });
    setPicked(null);
  }

  const title = view === 'week' ? `${shortDate(range.from)} – ${shortDate(range.to)}` : monthTitle(cursor);
  const campaignOptions = (campaigns.data?.items ?? []).map((item) => ({ value: item.id, label: item.name }));
  const ownerOptions = [{ value: 'none', label: 'Unassigned' }, ...(people.data?.items ?? []).map((name) => ({ value: name, label: name }))];
  const setFilter = (key: keyof Filters) => (value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const open = (id: string) => drawer.update({ open: id, new: null });

  return (
    <>
      <PageHeader
        title="Content"
        subtitle="One plan for every channel. Placeholders the classic calendar creates for empty campaign days are hidden."
        actions={
          <button type="button" className="btn-primary gap-1.5 px-3 py-1.5 text-[13px]" onClick={() => drawer.update({ new: '1', open: null, date: view === 'list' ? null : picked })}>
            <Icon.plus className="h-4 w-4" /> New content
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="View" value={view} onChange={setView} options={[{ value: 'month', label: 'Calendar' }, { value: 'week', label: 'Week' }, { value: 'list', label: 'List' }]} />
          <div className="flex items-center gap-1">
            <button type="button" className="btn-ghost px-2" aria-label="Previous" onClick={() => step(-1)}>
              <Icon.chevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-semibold">{title}</span>
            <button type="button" className="btn-ghost px-2" aria-label="Next" onClick={() => step(1)}>
              <Icon.chevronRight className="h-4 w-4" />
            </button>
            <button type="button" className="btn-ghost px-2 text-xs" onClick={() => setCursor(today())}>
              Today
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
            <FilterSelect label="Channel" value={filters.channel} options={CONTENT_CHANNELS} onChange={setFilter('channel')} />
            <FilterSelect label="Status" value={filters.status} options={CONTENT_STAGES} onChange={setFilter('status')} />
            <FilterSelect label="Campaign" value={filters.campaign} options={[{ value: 'none', label: 'No campaign' }, ...campaignOptions]} onChange={setFilter('campaign')} />
            <FilterSelect label="Owner" value={filters.owner} options={ownerOptions} onChange={setFilter('owner')} />
            <FilterSelect label="Pillar" value={filters.pillar} options={pillars} onChange={setFilter('pillar')} />
            {active ? (
              <button type="button" className="btn-ghost px-2 text-xs" onClick={() => setFilters(NO_FILTERS)}>
                Clear {active}
              </button>
            ) : null}
          </div>
        </div>
      </PageHeader>

      {content.error && !content.data ? <ErrorBox message={content.error.message} onRetry={() => void content.reload()} /> : null}

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {counts.map(({ stage, count }) => (
          <button
            key={stage}
            type="button"
            onClick={() => setFilter('status')(filters.status === stage ? '' : stage)}
            className={cx('flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', filters.status === stage ? 'border-brand-burgundy bg-brand-burgundy/[0.06] text-brand-burgundy' : 'border-black/[0.07] bg-white text-brand-dark-gray')}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', DOT[STAGE_TONE[stage] ?? 'gray'])} />
            {stage}
            <span className="font-semibold tabular-nums text-brand-black">{count}</span>
          </button>
        ))}
      </div>

      {!content.data && !content.error ? (
        <ListSkeleton rows={6} />
      ) : view === 'month' ? (
        <MonthGrid cursor={cursor} byDay={byDay} now={now} picked={picked} onPick={setPicked} onOpen={open} onNew={(day) => drawer.update({ new: '1', open: null, date: day })} />
      ) : view === 'week' ? (
        <WeekGrid from={range.from} byDay={byDay} now={now} onOpen={open} onNew={(day) => drawer.update({ new: '1', open: null, date: day })} />
      ) : (
        <ListView items={inRange} undated={undated} now={now} onOpen={open} />
      )}

      {view !== 'list' && undated.length ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-brand-dark-gray">{undated.length} item{undated.length > 1 ? 's' : ''} without a date</summary>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {undated.map((item) => (
              <ItemChip key={item.id} item={item} onOpen={() => open(item.id)} />
            ))}
          </div>
        </details>
      ) : null}

      <ContentEditor
        open={drawer.drawerOpen}
        item={drawer.creating ? null : drawer.item}
        defaults={defaults}
        onClose={() => drawer.close({ campaign: null, date: null })}
      />
      {drawer.missing ? <MissingOpen kind="Content" onClose={() => drawer.close({ campaign: null, date: null })} /> : null}
    </>
  );
}

function MonthGrid({
  cursor,
  byDay,
  now,
  picked,
  onPick,
  onOpen,
  onNew,
}: {
  cursor: string;
  byDay: Map<string, Content[]>;
  now: string;
  picked: string | null;
  onPick: (day: string | null) => void;
  onOpen: (id: string) => void;
  onNew: (day: string) => void;
}) {
  const first = startOfWeek(startOfMonth(cursor));
  const month = cursor.slice(0, 7);
  const last = endOfMonth(cursor);
  const weeks = Math.ceil((parseDay(last).getTime() - parseDay(first).getTime()) / (7 * 86_400_000) + 0.01);
  const days = Array.from({ length: Math.max(5, weeks) * 7 }, (_, n) => addDays(first, n));
  const pickedItems = picked ? byDay.get(picked) ?? [] : [];

  return (
    <>
      <div className="os-panel overflow-hidden">
        <div className="grid grid-cols-7 border-b border-black/5 bg-black/[0.015] text-center text-[10px] font-semibold uppercase tracking-wider text-brand-dark-gray">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => (
            <div key={name} className="py-2">
              <span className="sm:hidden">{name[0]}</span>
              <span className="hidden sm:inline">{name}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const list = byDay.get(day) ?? [];
            const outside = day.slice(0, 7) !== month;
            const isToday = day === now;
            return (
              <div
                key={day}
                role="button"
                tabIndex={0}
                onClick={() => onPick(picked === day ? null : day)}
                onDoubleClick={() => onNew(day)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onPick(day);
                }}
                className={cx(
                  'group relative min-h-[4.25rem] cursor-pointer border-b border-r border-black/5 p-1 text-left align-top transition sm:min-h-[7.5rem] sm:p-1.5 [&:nth-child(7n)]:border-r-0',
                  outside && 'bg-black/[0.015]',
                  picked === day && 'bg-brand-burgundy/[0.04]',
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cx(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums',
                      isToday ? 'bg-brand-burgundy font-semibold text-white' : outside ? 'text-brand-medium-gray' : 'text-brand-black',
                    )}
                  >
                    {parseDay(day).getDate()}
                  </span>
                  <button
                    type="button"
                    aria-label={`New content on ${longDate(day)}`}
                    className="hidden rounded p-0.5 text-brand-dark-gray opacity-0 transition hover:bg-black/5 group-hover:opacity-100 sm:block"
                    onClick={(event) => {
                      event.stopPropagation();
                      onNew(day);
                    }}
                  >
                    <Icon.plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1 hidden space-y-1 sm:block">
                  {list.slice(0, 3).map((item) => (
                    <ItemChip key={item.id} item={item} dense onOpen={() => onOpen(item.id)} />
                  ))}
                  {list.length > 3 ? <span className="block px-1 text-[10px] font-medium text-brand-dark-gray">+{list.length - 3} more</span> : null}
                </div>
                {list.length ? (
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((item) => (
                      <span key={item.id} className={cx('h-1.5 w-1.5 rounded-full', DOT[STAGE_TONE[item.status] ?? 'gray'])} />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {picked ? (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{longDate(picked)}</span>
            <button type="button" className="os-link" onClick={() => onNew(picked)}>
              Add here
            </button>
          </div>
          {pickedItems.length ? pickedItems.map((item) => <ItemChip key={item.id} item={item} onOpen={() => onOpen(item.id)} />) : <p className="text-xs text-brand-dark-gray">Nothing planned on this day.</p>}
        </div>
      ) : null}
    </>
  );
}

function WeekGrid({ from, byDay, now, onOpen, onNew }: { from: string; byDay: Map<string, Content[]>; now: string; onOpen: (id: string) => void; onNew: (day: string) => void }) {
  const days = Array.from({ length: 7 }, (_, n) => addDays(from, n));
  return (
    <div className="grid gap-2 lg:grid-cols-7">
      {days.map((day) => {
        const list = byDay.get(day) ?? [];
        return (
          <section key={day} className={cx('os-panel flex min-h-[6rem] flex-col p-2 lg:min-h-[22rem]', day === now && 'ring-2 ring-brand-burgundy/20')}>
            <header className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs">
                <span className="font-semibold uppercase tracking-wider text-brand-dark-gray">{weekdayShort(day)}</span>{' '}
                <span className={cx('tabular-nums', day === now ? 'font-semibold text-brand-burgundy' : 'text-brand-black')}>{parseDay(day).getDate()}</span>
              </span>
              <button type="button" aria-label={`New content on ${longDate(day)}`} className="rounded p-0.5 text-brand-dark-gray hover:bg-black/5" onClick={() => onNew(day)}>
                <Icon.plus className="h-3.5 w-3.5" />
              </button>
            </header>
            <div className="space-y-1.5">
              {list.map((item) => (
                <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="block w-full rounded-lg border border-black/[0.06] bg-white p-2 text-left transition hover:border-brand-burgundy/30">
                  <span className="line-clamp-2 text-[13px] font-medium">{item.title || 'Untitled'}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1">
                    <StagePill value={item.status} />
                    <ChannelTags channels={item.channels} max={3} />
                  </span>
                  {item.campaign_name ? <span className="mt-1 block truncate text-[11px] text-brand-dark-gray">{item.campaign_name}</span> : null}
                </button>
              ))}
              {!list.length ? <p className="px-1 text-[11px] text-brand-medium-gray">—</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ListView({ items, undated, now, onOpen }: { items: Content[]; undated: Content[]; now: string; onOpen: (id: string) => void }) {
  const groups = new Map<string, Content[]>();
  for (const item of [...items].sort((a, b) => (dayOf(a) ?? '').localeCompare(dayOf(b) ?? ''))) {
    const day = dayOf(item) ?? '';
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  if (undated.length) groups.set('', undated);
  if (!groups.size) return <Empty title="No content in this period">Change the month or clear the filters.</Empty>;
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([day, list]) => (
        <section key={day || 'undated'}>
          <h3 className={cx('mb-1.5 px-1 text-xs font-semibold', day === now ? 'text-brand-burgundy' : 'text-brand-dark-gray')}>{day ? longDate(day) : 'No date'}</h3>
          <ul className="os-panel divide-y divide-black/5">
            {list.map((item) => {
              const late = item.status !== 'Published' && dayOf(item) && dueLabel(dayOf(item), now).late;
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => onOpen(item.id)} className="os-row rounded-none first:rounded-t-2xl last:rounded-b-2xl">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title || 'Untitled'}</span>
                      <span className="block truncate text-xs text-brand-dark-gray">
                        {[item.campaign_name, item.format, item.pillar, item.hero_product].filter(Boolean).join(' · ') || 'No campaign'}
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <ChannelTags channels={item.channels} />
                    </span>
                    {late ? <span className="text-[11px] font-semibold text-red-700">Late</span> : null}
                    {item.status === 'Published' && item.kpi.views != null ? <span className="hidden text-xs tabular-nums text-brand-dark-gray md:inline">{item.kpi.views.toLocaleString('en-US')} views</span> : null}
                    <StagePill value={item.status} />
                    <Avatar name={item.owner} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
