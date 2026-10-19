'use client';

import { useMemo } from 'react';

import { Icon } from '@/components/os/icons';
import { InitiativeEditor } from '@/components/os/initiative-editor';
import { Avatar, Bar, Empty, ErrorBox, ListSkeleton, MissingOpen, PageHeader, Pill, PriorityDot, Segmented, StagePill } from '@/components/os/ui';
import { usePersisted } from '@/lib/os/client';
import { useInitiatives } from '@/lib/os/data';
import { dueLabel, money, type Initiative } from '@/lib/os/model';
import { useDrawerRecord } from '@/lib/os/url';

type Tab = 'open' | 'blocked' | 'done' | 'all';
const RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function Card({ item, onOpen }: { item: Initiative; onOpen: () => void }) {
  const due = dueLabel(item.deadline);
  const late = item.status !== 'Done' && due.late;
  const used = item.budget_aed && item.spent_aed != null ? item.spent_aed / item.budget_aed : null;
  return (
    <button type="button" onClick={onOpen} className="os-panel flex h-full flex-col p-4 text-left transition hover:border-black/15">
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <PriorityDot value={item.priority} />
          <span className="truncate font-semibold">{item.name}</span>
        </span>
        <StagePill value={item.status} />
      </div>
      {item.blockers ? (
        <p className="mt-2 line-clamp-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
          <span className="font-semibold">Blocked:</span> {item.blockers}
        </p>
      ) : item.notes ? (
        <p dir="auto" className="mt-2 line-clamp-2 text-[13px] text-brand-dark-gray">{item.notes}</p>
      ) : null}
      <div className="mt-auto space-y-2 pt-4">
        {item.budget_aed != null ? (
          <div>
            <div className="flex justify-between text-xs">
              <span className="text-brand-dark-gray">Budget</span>
              <span className="tabular-nums">
                {item.spent_aed != null ? `${money(item.spent_aed)} / ` : ''}
                {money(item.budget_aed)}
              </span>
            </div>
            {used != null ? (
              <div className="mt-1">
                <Bar value={item.spent_aed} max={item.budget_aed} tone={used > 1 ? 'red' : 'wine'} />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center justify-between text-xs text-brand-dark-gray">
          <span className="flex items-center gap-2">
            {item.deadline ? <span className={late ? 'font-semibold text-red-700' : ''}>{late ? due.text : `Due ${due.text}`}</span> : <span>No deadline</span>}
            {item.files.length ? <span>· {item.files.length} files</span> : null}
          </span>
          <span className="flex items-center gap-2">
            {item.open_tasks ? <span>{item.open_tasks} tasks</span> : null}
            <Avatar name={item.owner} />
          </span>
        </div>
      </div>
    </button>
  );
}

export function InitiativesView() {
  const initiatives = useInitiatives();
  const [tab, setTab] = usePersisted<Tab>('initiatives.tab', 'open');
  const all = useMemo(() => initiatives.data?.items ?? [], [initiatives.data]);
  const drawer = useDrawerRecord(initiatives.data?.items);

  const groups = useMemo(() => {
    const sort = (list: Initiative[]) => [...list].sort((a, b) => (RANK[a.priority] ?? 1) - (RANK[b.priority] ?? 1) || (a.deadline || '9').localeCompare(b.deadline || '9'));
    const open = sort(all.filter((item) => item.status !== 'Done'));
    return {
      open,
      blocked: open.filter((item) => item.status === 'Blocked' || item.blockers),
      done: all.filter((item) => item.status === 'Done'),
      all: sort(all),
    };
  }, [all]);

  const shown = groups[tab];
  const unowned = groups.open.filter((item) => !item.owner).length;

  return (
    <>
      <PageHeader
        title="Projects & initiatives"
        subtitle={unowned ? <span>Work outside the calendar. <Pill tone="amber">{unowned} without an owner</Pill></span> : 'Work outside the calendar.'}
        actions={
          <button type="button" className="btn-primary gap-1.5 px-3 py-1.5 text-[13px]" onClick={() => drawer.update({ new: '1', open: null })}>
            <Icon.plus className="h-4 w-4" /> New initiative
          </button>
        }
      >
        <Segmented
          label="Initiatives"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: `Open ${groups.open.length}` },
            { value: 'blocked', label: `Blocked ${groups.blocked.length}` },
            { value: 'done', label: `Done ${groups.done.length}` },
            { value: 'all', label: 'All' },
          ]}
        />
      </PageHeader>

      {initiatives.error && !initiatives.data ? <ErrorBox message={initiatives.error.message} onRetry={() => void initiatives.reload()} /> : null}
      {!initiatives.data && !initiatives.error ? (
        <ListSkeleton rows={4} />
      ) : shown.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => (
            <Card key={item.id} item={item} onOpen={() => drawer.update({ open: item.id, new: null })} />
          ))}
        </div>
      ) : initiatives.data ? (
        <Empty title={tab === 'blocked' ? 'Nothing is blocked' : tab === 'done' ? 'Nothing finished yet' : 'No initiatives'} />
      ) : null}

      <InitiativeEditor open={drawer.drawerOpen} item={drawer.creating ? null : drawer.item} onClose={() => drawer.close()} />
      {drawer.missing ? <MissingOpen kind="Initiative" onClose={() => drawer.close()} /> : null}
    </>
  );
}
