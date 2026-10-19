'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useSession } from '@/components/os/session';
import { Avatar, PriorityDot, StagePill, cx } from '@/components/os/ui';
import { refreshAfterWrite, useTasks } from '@/lib/os/data';
import { dueLabel, meLabel, type LinkType } from '@/lib/os/model';
import { blankTask, draftOf, saveTask } from '@/lib/os/tasks';

export function LinkedTasks({ type, id }: { type: LinkType; id: string }) {
  const tasks = useTasks();
  const { me } = useSession();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = (tasks.data?.items ?? []).filter((task) => task.link_type === type && task.link_id === id);
  const open = items.filter((task) => task.stage !== 'Done');
  const done = items.length - open.length;

  async function add() {
    const clean = title.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      await saveTask(null, blankTask({ title: clean, owner: meLabel(me), link_type: type, link_id: id }));
      setTitle('');
      refreshAfterWrite('task');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(taskId: string) {
    const task = items.find((item) => item.id === taskId);
    if (!task) return;
    try {
      await saveTask(task.id, { ...draftOf(task), stage: task.stage === 'Done' ? 'Doing' : 'Done' });
      refreshAfterWrite('task');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-brand-dark-gray">
          Tasks {items.length ? `· ${open.length} open${done ? `, ${done} done` : ''}` : ''}
        </span>
        <Link href={`/tasks?link=${type}:${id}`} className="os-link">
          Open in Tasks
        </Link>
      </div>
      {items.length ? (
        <ul className="divide-y divide-black/5 rounded-xl border border-black/[0.07]">
          {items.map((task) => {
            const due = dueLabel(task.deadline);
            return (
              <li key={task.id} className="flex items-center gap-2.5 px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-[#500F28]"
                  checked={task.stage === 'Done'}
                  onChange={() => void toggle(task.id)}
                  aria-label={`Mark ${task.title} ${task.stage === 'Done' ? 'not done' : 'done'}`}
                />
                <PriorityDot value={task.priority} />
                <Link href={`/tasks?open=${task.id}`} className={cx('min-w-0 flex-1 truncate text-sm', task.stage === 'Done' && 'text-brand-medium-gray line-through')}>
                  {task.title}
                </Link>
                {task.stage !== 'Done' && task.stage !== 'Queued' ? <StagePill value={task.stage} /> : null}
                {task.deadline ? <span className={cx('text-[11px] tabular-nums', due.late && task.stage !== 'Done' ? 'font-semibold text-red-700' : 'text-brand-dark-gray')}>{due.text}</span> : null}
                <Avatar name={task.owner} />
              </li>
            );
          })}
        </ul>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <input className="os-input min-w-0 flex-1" placeholder="Add a task and press Enter" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit" className="btn-outline shrink-0 px-3 py-1.5 text-[13px]" disabled={busy || !title.trim()}>
          Add
        </button>
      </form>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
