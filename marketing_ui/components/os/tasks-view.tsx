'use client';

import { useState } from 'react';

import { Icon } from '@/components/os/icons';
import { useSession } from '@/components/os/session';
import { TaskEditor, useLinkOptions } from '@/components/os/task-editor';
import { Avatar, Empty, ErrorBox, ListSkeleton, MissingOpen, PageHeader, Pill, PriorityDot, Segmented, Toast, cx } from '@/components/os/ui';
import { usePersisted } from '@/lib/os/client';
import { refreshAfterWrite, useTasks } from '@/lib/os/data';
import { TASK_STAGES, dueLabel, isMine, meLabel, shortDate, today, type LinkType, type Task, type TaskStage } from '@/lib/os/model';
import { blankTask, closeTask, draftOf, restoreTask, saveTask } from '@/lib/os/tasks';
import { useDrawerRecord } from '@/lib/os/url';

type Tab = 'mine' | 'team' | 'overdue' | 'blocked' | 'done';
const RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const LINK_LABEL: Record<LinkType, string> = { campaign: 'Campaign', content: 'Content', initiative: 'Initiative' };

function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || (RANK[a.priority] ?? 1) - (RANK[b.priority] ?? 1));
}

export function TasksView() {
  const { me } = useSession();
  const tasks = useTasks();
  const links = useLinkOptions();
  const records = tasks.data ? [...tasks.data.items, ...tasks.data.archive] : undefined;
  const drawer = useDrawerRecord(records);
  const [tab, setTab] = usePersisted<Tab>('tasks.tab', 'mine');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const now = today();
  const link = drawer.params.get('link');
  const [linkType, linkId] = link ? (link.split(':') as [LinkType, string]) : [null, null];

  const linked = (task: Task) => !linkType || (task.link_type === linkType && task.link_id === linkId);
  const open = (tasks.data?.items ?? []).filter(linked);
  const archive = (tasks.data?.archive ?? []).filter(linked);

  const active = open.filter((task) => task.stage !== 'Done');
  const openIds = new Set((tasks.data?.items ?? []).map((task) => task.id));
  const views: Record<Tab, Task[]> = {
    mine: sortTasks(active.filter((task) => isMine(task.owner, me))),
    team: sortTasks(active),
    overdue: sortTasks(active.filter((task) => task.deadline && task.deadline < now)),
    blocked: sortTasks(active.filter((task) => task.stage === 'Blocked' || task.blocker)),
    done: [
      ...open.filter((task) => task.stage === 'Done'),
      ...archive.filter((task) => !(task.reason !== 'round' && openIds.has(task.work_id ?? ''))),
    ],
  };
  const shown = views[tab];

  const linkLabel = link ? links.get(link)?.label : null;

  async function run(work: () => Promise<unknown>, done?: string) {
    try {
      await work();
      refreshAfterWrite('task');
      if (done) setToast({ text: done, tone: 'ok' });
    } catch (err) {
      setToast({ text: (err as Error).message, tone: 'error' });
    }
  }

  async function quickAdd() {
    const clean = title.trim();
    if (!clean) return;
    setBusy(true);
    await run(() => saveTask(null, blankTask({ title: clean, owner: meLabel(me), link_type: linkType, link_id: linkId })), 'Task added.');
    setTitle('');
    setBusy(false);
  }

  const setStage = (task: Task, stage: TaskStage) => run(() => saveTask(task.id, { ...draftOf(task), stage }));

  const grouped = tab === 'team' ? groupByOwner(shown) : null;

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={`${active.length} open · ${views.overdue.length} overdue · ${views.blocked.length} blocked`}
        actions={
          <button type="button" className="btn-primary gap-1.5 px-3 py-1.5 text-[13px]" onClick={() => drawer.update({ new: '1', open: null })}>
            <Icon.plus className="h-4 w-4" /> New task
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Tasks"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'mine', label: `My ${views.mine.length}` },
              { value: 'team', label: `Team ${views.team.length}` },
              { value: 'overdue', label: `Overdue ${views.overdue.length}` },
              { value: 'blocked', label: `Blocked ${views.blocked.length}` },
              { value: 'done', label: 'Completed' },
            ]}
          />
          {link ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-burgundy/[0.07] px-3 py-1 text-xs text-brand-burgundy">
              {LINK_LABEL[linkType as LinkType] ?? 'Linked'}: {linkLabel ?? '…'}
              <button type="button" aria-label="Clear link filter" className="font-semibold" onClick={() => drawer.update({ link: null })}>
                ×
              </button>
            </span>
          ) : null}
        </div>
      </PageHeader>

      <form
        className="os-panel mb-4 flex items-center gap-2 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          void quickAdd();
        }}
      >
        <Icon.plus className="ml-2 h-4 w-4 shrink-0 text-brand-dark-gray" />
        <input
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-brand-medium-gray"
          placeholder={linkLabel ? `Add a task for ${linkLabel}` : 'Add a task for yourself and press Enter'}
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="submit" className="btn-outline px-3 py-1 text-[13px]" disabled={busy || !title.trim()}>
          Add
        </button>
      </form>

      {tasks.error && !tasks.data ? <ErrorBox message={tasks.error.message} onRetry={() => void tasks.reload()} /> : null}
      {!tasks.data && !tasks.error ? (
        <ListSkeleton rows={6} />
      ) : !shown.length ? (
        <Empty title={tab === 'mine' ? 'Nothing on your plate' : tab === 'overdue' ? 'Nothing is overdue' : tab === 'blocked' ? 'Nothing is blocked' : tab === 'done' ? 'Nothing completed yet' : 'No open tasks'}>
          {tab === 'mine' ? 'Tasks you own show here. Add one above.' : null}
        </Empty>
      ) : tab === 'done' ? (
        <DoneList items={shown} onArchive={(task) => void run(() => closeTask(task.id, 'archive'), 'Archived.')} onRestore={(task) => void run(() => restoreTask(task.work_id || task.id), 'Restored.')} onOpen={(task) => drawer.update({ open: task.id, new: null })} links={links} />
      ) : grouped ? (
        <div className="space-y-4">
          {grouped.map(([owner, list]) => (
            <section key={owner || 'none'}>
              <h3 className="mb-1.5 flex items-center gap-2 px-1 text-xs font-semibold text-brand-dark-gray">
                <Avatar name={owner} /> {owner || 'Unassigned'} <span className="font-normal">{list.length}</span>
              </h3>
              <TaskList items={list} now={now} links={links} onOpen={(task) => drawer.update({ open: task.id, new: null })} onStage={setStage} />
            </section>
          ))}
        </div>
      ) : (
        <TaskList items={shown} now={now} links={links} onOpen={(task) => drawer.update({ open: task.id, new: null })} onStage={setStage} />
      )}

      <TaskEditor
        open={drawer.drawerOpen}
        item={drawer.creating ? null : drawer.item}
        defaults={drawer.creating && linkType ? { link_type: linkType, link_id: linkId } : undefined}
        onClose={() => drawer.close()}
      />
      {drawer.missing ? <MissingOpen kind="Task" onClose={() => drawer.close()} /> : null}
      <Toast message={toast?.text ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}

function groupByOwner(list: Task[]): Array<[string, Task[]]> {
  const map = new Map<string, Task[]>();
  for (const task of list) map.set(task.owner, [...(map.get(task.owner) ?? []), task]);
  return [...map.entries()].sort((a, b) => (a[0] ? a[0].localeCompare(b[0] || '~') : 1));
}

function TaskList({
  items,
  now,
  links,
  onOpen,
  onStage,
}: {
  items: Task[];
  now: string;
  links: ReturnType<typeof useLinkOptions>;
  onOpen: (task: Task) => void;
  onStage: (task: Task, stage: TaskStage) => void;
}) {
  return (
    <ul className="os-panel divide-y divide-black/5">
      {items.map((task) => {
        const due = dueLabel(task.deadline, now);
        const linked = task.link_type && task.link_id ? links.get(`${task.link_type}:${task.link_id}`) : null;
        return (
          <li key={task.id} className="flex items-center gap-3 px-3 py-2.5">
            <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#500F28]" checked={false} onChange={() => onStage(task, 'Done')} aria-label={`Mark ${task.title} done`} />
            <PriorityDot value={task.priority} />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(task)}>
              <span className="block truncate text-sm">{task.title}</span>
              <span className="block truncate text-xs text-brand-dark-gray">
                {[linked ? `${LINK_LABEL[linked.type]}: ${linked.label}` : null, task.blocker ? `Waiting on ${task.blocker}` : null, task.repeat !== 'once' ? `Repeats ${task.repeat}` : null].filter(Boolean).join(' · ') || ' '}
              </span>
            </button>
            {task.deadline ? <span className={cx('hidden text-xs tabular-nums sm:inline', due.late ? 'font-semibold text-red-700' : due.soon ? 'text-brand-burgundy' : 'text-brand-dark-gray')}>{due.text}</span> : null}
            <select
              aria-label="Stage"
              value={task.stage}
              onChange={(event) => onStage(task, event.target.value as TaskStage)}
              className={cx('h-7 rounded-md border border-black/10 bg-white px-1.5 text-xs', task.stage === 'Blocked' && 'border-red-600/30 text-red-700')}
            >
              {TASK_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
            <Avatar name={task.owner} />
          </li>
        );
      })}
    </ul>
  );
}

function DoneList({
  items,
  links,
  onArchive,
  onRestore,
  onOpen,
}: {
  items: Task[];
  links: ReturnType<typeof useLinkOptions>;
  onArchive: (task: Task) => void;
  onRestore: (task: Task) => void;
  onOpen: (task: Task) => void;
}) {
  return (
    <ul className="os-panel divide-y divide-black/5">
      {items.map((task) => {
        const archived = Boolean(task.closed_on);
        const linked = task.link_type && task.link_id ? links.get(`${task.link_type}:${task.link_id}`) : null;
        return (
          <li key={task.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-600 text-[10px] text-white">✓</span>
            {archived ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-brand-dark-gray">{task.title}</span>
                <span className="block truncate text-xs text-brand-medium-gray">{linked ? `${LINK_LABEL[linked.type]}: ${linked.label}` : ' '}</span>
              </span>
            ) : (
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(task)}>
                <span className="block truncate text-sm">{task.title}</span>
                <span className="block truncate text-xs text-brand-dark-gray">{linked ? `${LINK_LABEL[linked.type]}: ${linked.label}` : ' '}</span>
              </button>
            )}
            <span className="hidden text-xs text-brand-dark-gray sm:inline">{archived ? `${task.reason === 'round' ? 'Round' : 'Closed'} ${shortDate(task.closed_on)}` : `Done ${shortDate(task.stage_on)}`}</span>
            {archived ? (
              task.reason !== 'round' ? (
                <button type="button" className="btn-ghost px-2 text-xs" onClick={() => onRestore(task)}>
                  Restore
                </button>
              ) : (
                <Pill>Logged</Pill>
              )
            ) : (
              <button type="button" className="btn-ghost px-2 text-xs" onClick={() => onArchive(task)}>
                Archive
              </button>
            )}
            <Avatar name={task.owner} />
          </li>
        );
      })}
    </ul>
  );
}
