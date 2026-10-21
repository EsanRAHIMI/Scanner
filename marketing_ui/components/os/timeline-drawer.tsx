'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { OwnerInput } from '@/components/os/fields';
import { LinkedTasks } from '@/components/os/linked-tasks';
import { PeoplePicker } from '@/components/os/people-picker';
import { useSession } from '@/components/os/session';
import { Avatar, Disclosure, Drawer, Field, Pill, Segmented } from '@/components/os/ui';
import { api } from '@/lib/os/client';
import { refreshAfterWrite } from '@/lib/os/data';
import { compact, meLabel, money, type LinkType } from '@/lib/os/model';
import { ACTIVITY_STATUSES, hoursLabel, type TimelineActivity, type TimeLog } from '@/lib/os/timeline';

function refreshAll() {
  refreshAfterWrite('campaign');
  refreshAfterWrite('content');
  refreshAfterWrite('initiative');
  refreshAfterWrite('task');
}

export function TimelineDrawer({
  activity,
  open,
  onClose,
  onChange,
}: {
  activity: TimelineActivity | null;
  open: boolean;
  onClose: () => void;
  onChange: (item: TimelineActivity) => void;
}) {
  const { me } = useSession();
  const mine = meLabel(me);
  const [item, setItem] = useState<TimelineActivity | null>(activity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [minutes, setMinutes] = useState('');
  const [confirmMove, setConfirmMove] = useState<{ start: string | null; end: string | null } | null>(null);

  useEffect(() => {
    setItem(activity);
    setError(null);
    if (!activity?.id) return;
    let live = true;
    void api<TimelineActivity>(`timeline/activities/${encodeURIComponent(activity.id)}`)
      .then((row) => live && setItem(row))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [activity]);

  if (!open) return null;

  async function patch(body: Record<string, unknown>) {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api<TimelineActivity>(`timeline/activities/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        json: { ...body, expected_updated_at: item.updated_at },
      });
      setItem(next);
      onChange(next);
      refreshAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDates() {
    if (!item) return;
    await patch({ start: item.start, end: item.end, deadline: item.deadline });
    setConfirmMove(null);
  }

  async function toggleTimer() {
    if (!item || !mine) return;
    setBusy(true);
    setError(null);
    try {
      await api(`timeline/activities/${encodeURIComponent(item.id)}/timer`, {
        method: 'POST',
        json: { person: mine, action: item.running?.person === mine ? 'stop' : 'start' },
      });
      const next = await api<TimelineActivity>(`timeline/activities/${encodeURIComponent(item.id)}`);
      setItem(next);
      onChange(next);
      refreshAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addLog() {
    if (!item || !mine) return;
    const value = Number(minutes);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter minutes actually worked.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ended = new Date();
      const started = new Date(ended.getTime() - value * 60_000);
      await api(`timeline/activities/${encodeURIComponent(item.id)}/logs`, {
        method: 'POST',
        json: { person: mine, started_at: started.toISOString(), ended_at: ended.toISOString(), minutes: value, note },
      });
      setMinutes('');
      setNote('');
      const next = await api<TimelineActivity>(`timeline/activities/${encodeURIComponent(item.id)}`);
      setItem(next);
      onChange(next);
      refreshAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const current = item ?? activity;
  if (!current) return null;
  const paid = current.paid;
  const linkType = current.link_type && current.link_type !== 'paid' ? (current.link_type as LinkType) : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={current.title || 'Activity'}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <Pill tone={current.overdue || current.status === 'Blocked' ? 'red' : current.status === 'Live' ? 'wine' : current.status === 'Done' ? 'green' : 'gray'}>{current.status}</Pill>
          {current.confirmed ? <Pill tone="blue">API confirmed</Pill> : current.source === 'record' ? <Pill>Planned</Pill> : <Pill>Manual</Pill>}
          {current.overdue ? <Pill tone="red">Overdue</Pill> : null}
        </span>
      }
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-brand-dark-gray">Logged {hoursLabel(current.hours)} · planned dates stay separate</span>
          <div className="flex gap-2">
            {mine ? (
              <button type="button" className="btn-outline px-3 py-1.5 text-[13px]" onClick={() => void toggleTimer()} disabled={busy}>
                {current.running?.person === mine ? 'Stop timer' : 'Start timer'}
              </button>
            ) : null}
            {current.href ? (
              <Link href={current.href} className="btn-primary px-3 py-1.5 text-[13px]">
                Open record
              </Link>
            ) : null}
          </div>
        </div>
      }
    >
      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      <div className="space-y-4">
        <Field label="Title">
          <input className="os-input" value={current.title} maxLength={160} onChange={(event) => setItem({ ...current, title: event.target.value })} onBlur={() => void patch({ title: current.title })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <input
              type="date"
              className="os-input"
              value={current.start ?? ''}
              onChange={(event) => {
                const start = event.target.value || null;
                setItem({ ...current, start });
                setConfirmMove({ start, end: current.end });
              }}
            />
          </Field>
          <Field label="End">
            <input
              type="date"
              className="os-input"
              value={current.end ?? ''}
              onChange={(event) => {
                const end = event.target.value || null;
                setItem({ ...current, end });
                setConfirmMove({ start: current.start, end });
              }}
            />
          </Field>
        </div>
        {confirmMove ? (
          <div className="rounded-xl border border-amber-600/20 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p>Move this activity to {confirmMove.start || 'unscheduled'}{confirmMove.end ? ` → ${confirmMove.end}` : ''}? Linked records update immediately.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={() => void saveDates()} disabled={busy}>
                Confirm
              </button>
              <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => { setConfirmMove(null); setItem(activity); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <Segmented value={current.status} options={ACTIVITY_STATUSES} onChange={(status) => void patch({ status })} size="sm" label="Status" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select className="os-input" value={current.priority} onChange={(event) => void patch({ priority: event.target.value })}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </Field>
          <Field label="Progress">
            <input
              type="number"
              min={0}
              max={100}
              className="os-input"
              value={current.progress ?? ''}
              placeholder="Unknown"
              onChange={(event) => setItem({ ...current, progress: event.target.value === '' ? null : Number(event.target.value) })}
              onBlur={() => void patch({ progress: current.progress })}
            />
          </Field>
        </div>
        <Field label="Owner">
          <OwnerInput value={current.owner} onChange={(owner) => { setItem({ ...current, owner }); void patch({ owner }); }} />
        </Field>
        <Field label="Reviewer">
          <OwnerInput value={current.reviewer} onChange={(reviewer) => { setItem({ ...current, reviewer }); void patch({ reviewer }); }} placeholder="Approver" />
        </Field>
        <Field label="Contributors">
          <PeoplePicker
            multiple
            value={current.contributors.filter((row) => row.active !== false && !row.end).map((row) => row.person)}
            onChange={(names) => {
              const selected = names as string[];
              const next = [
                ...current.contributors.filter((row) => !selected.includes(row.person) && (row.end || row.active === false)),
                ...selected.map((person) => current.contributors.find((row) => row.person === person && row.active !== false) ?? { person, start: current.start, end: null, active: true }),
              ];
              setItem({ ...current, contributors: next });
              void patch({ contributors: next });
            }}
          />
        </Field>
        {current.contributors.length ? (
          <ul className="space-y-1.5 text-xs text-brand-dark-gray">
            {current.contributors.map((row) => (
              <li key={`${row.person}-${row.start}`} className="flex items-center gap-2">
                <Avatar name={row.person} />
                <span className="font-medium text-brand-black">{row.person}</span>
                <span>
                  {row.start || '—'} → {row.end || 'now'} {row.active === false || row.end ? '(past)' : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <Disclosure title="Time worked" defaultOpen>
          <p className="text-xs text-brand-dark-gray">Actual hours are only the logs below. Calendar length is not used.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input className="os-input max-w-[7rem]" inputMode="decimal" placeholder="Minutes" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
            <input className="os-input min-w-0 flex-1" placeholder="Note" value={note} onChange={(event) => setNote(event.target.value)} />
            <button type="button" className="btn-outline px-3 py-1.5 text-[13px]" onClick={() => void addLog()} disabled={busy}>
              Add log
            </button>
          </div>
          <LogList logs={current.logs ?? []} />
        </Disclosure>

        {paid ? (
          <Disclosure title={`${paid.platform} results`} defaultOpen>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-brand-dark-gray">Spend</dt>
                <dd className="font-semibold">{money(paid.spend)}</dd>
              </div>
              <div>
                <dt className="text-xs text-brand-dark-gray">Budget</dt>
                <dd className="font-semibold">{money(paid.budget)}</dd>
              </div>
              <div>
                <dt className="text-xs text-brand-dark-gray">Leads</dt>
                <dd className="font-semibold">{compact(paid.leads)}</dd>
              </div>
              <div>
                <dt className="text-xs text-brand-dark-gray">Clicks</dt>
                <dd className="font-semibold">{compact(paid.clicks)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-brand-dark-gray">{paid.confirmed ? 'Campaign-level figures from the platform API.' : 'Not confirmed by the platform API. Missing values stay Unknown.'}</p>
          </Disclosure>
        ) : null}

        {linkType && current.link_id ? <LinkedTasks type={linkType} id={current.link_id} /> : null}
      </div>
    </Drawer>
  );
}

function LogList({ logs }: { logs: TimeLog[] }) {
  const done = logs.filter((row) => !row.running);
  if (!done.length) return <p className="mt-2 text-xs text-brand-medium-gray">No time logged yet.</p>;
  return (
    <ul className="mt-2 divide-y divide-black/5 rounded-xl border border-black/[0.07]">
      {done.map((row) => (
        <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2 text-[13px]">
          <span>
            <span className="font-medium text-brand-black">{row.person}</span>
            <span className="block text-xs text-brand-dark-gray">{row.note || row.source}</span>
          </span>
          <span className="tabular-nums text-brand-dark-gray">{row.minutes == null ? '—' : `${Math.round(row.minutes)}m`}</span>
        </li>
      ))}
    </ul>
  );
}
