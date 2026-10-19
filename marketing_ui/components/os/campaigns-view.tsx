'use client';

import { useMemo } from 'react';

import { CampaignEditor } from '@/components/os/campaign-editor';
import { Icon } from '@/components/os/icons';
import { Avatar, Bar, ChannelTags, Empty, ErrorBox, ListSkeleton, MissingOpen, PageHeader, Pill, Segmented, StagePill } from '@/components/os/ui';
import { usePersisted } from '@/lib/os/client';
import { useCampaigns } from '@/lib/os/data';
import { compact, daysBetween, money, rangeLabel, today, type Campaign } from '@/lib/os/model';
import { useDrawerRecord } from '@/lib/os/url';

type Tab = 'live' | 'upcoming' | 'past' | 'all';

function timing(item: Campaign, now: string): string {
  if (item.status === 'Planned') {
    const days = daysBetween(now, item.start_date);
    return days <= 0 ? 'Starts today' : `Starts in ${days}d`;
  }
  if (item.status === 'Live') {
    if (!item.end_date) return 'Live';
    const days = daysBetween(now, item.end_date);
    return days <= 0 ? 'Ends today' : `${days}d left`;
  }
  return item.status;
}

function CampaignCard({ item, now, onOpen }: { item: Campaign; now: string; onOpen: () => void }) {
  const total = item.content?.total ?? 0;
  const published = item.content?.published ?? 0;
  return (
    <button type="button" onClick={onOpen} className="os-panel flex h-full flex-col overflow-hidden text-left transition hover:border-black/15">
      <span className="h-1 w-full" style={{ background: item.color }} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate font-semibold">{item.name}</span>
            <span className="block text-xs text-brand-dark-gray">{rangeLabel(item.start_date, item.end_date || item.start_date)}</span>
          </span>
          <StagePill value={item.status} />
        </div>
        {item.objective ? <p dir="auto" className="mt-2 line-clamp-2 text-[13px] text-brand-dark-gray">{item.objective}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {item.mode ? <Pill tone="wine">{item.mode}</Pill> : null}
          {item.is_critical ? <Pill tone="amber">Key date</Pill> : null}
          <ChannelTags channels={item.channels} max={5} />
        </div>
        <div className="mt-auto pt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-brand-dark-gray">
              Content {published}/{total} out{item.content?.views ? ` · ${compact(item.content.views)} views` : ''}
            </span>
            <span className="font-medium">{timing(item, now)}</span>
          </div>
          <div className="mt-1.5">
            <Bar value={published} max={Math.max(total, 1)} tone={total ? 'wine' : 'gray'} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-brand-dark-gray">
            <span>{item.budget_aed != null ? money(item.budget_aed) : 'No budget'}</span>
            <span className="flex items-center gap-2">
              {item.open_tasks ? <span>{item.open_tasks} open tasks</span> : null}
              <Avatar name={item.owner} />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function CampaignsView() {
  const campaigns = useCampaigns();
  const [tab, setTab] = usePersisted<Tab>('campaigns.tab', 'live');
  const now = today();
  const all = useMemo(() => campaigns.data?.items ?? [], [campaigns.data]);
  const drawer = useDrawerRecord(campaigns.data?.items);

  const groups = useMemo(() => {
    const live = all.filter((item) => item.status === 'Live' || item.status === 'Paused').sort((a, b) => (a.end_date || '9').localeCompare(b.end_date || '9'));
    const upcoming = all.filter((item) => item.status === 'Planned').sort((a, b) => a.start_date.localeCompare(b.start_date));
    const past = all.filter((item) => item.status === 'Done' || item.status === 'Cancelled').sort((a, b) => (b.end_date || b.start_date).localeCompare(a.end_date || a.start_date));
    return { live, upcoming, past, all: [...live, ...upcoming, ...past] };
  }, [all]);

  const shown = groups[tab];

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Organic and paid pushes. Content and tasks link here."
        actions={
          <button type="button" className="btn-primary gap-1.5 px-3 py-1.5 text-[13px]" onClick={() => drawer.update({ new: '1', open: null })}>
            <Icon.plus className="h-4 w-4" /> New campaign
          </button>
        }
      >
        <Segmented
          label="Campaigns"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'live', label: `Live ${groups.live.length}` },
            { value: 'upcoming', label: `Upcoming ${groups.upcoming.length}` },
            { value: 'past', label: `Past ${groups.past.length}` },
            { value: 'all', label: 'All' },
          ]}
        />
      </PageHeader>

      {campaigns.error && !campaigns.data ? <ErrorBox message={campaigns.error.message} onRetry={() => void campaigns.reload()} /> : null}
      {!campaigns.data && !campaigns.error ? (
        <ListSkeleton rows={4} />
      ) : shown.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => (
            <CampaignCard key={item.id} item={item} now={now} onOpen={() => drawer.update({ open: item.id, new: null })} />
          ))}
        </div>
      ) : campaigns.data ? (
        <Empty
          title={tab === 'live' ? 'No campaign is live today' : tab === 'upcoming' ? 'Nothing planned yet' : 'No campaigns here'}
          action={
            <button type="button" className="btn-primary px-3 py-1.5 text-[13px]" onClick={() => drawer.update({ new: '1' })}>
              New campaign
            </button>
          }
        />
      ) : null}

      <CampaignEditor open={drawer.drawerOpen} item={drawer.creating ? null : drawer.item} onClose={() => drawer.close()} />
      {drawer.missing ? <MissingOpen kind="Campaign" onClose={() => drawer.close()} /> : null}
    </>
  );
}
