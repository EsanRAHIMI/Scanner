'use client';

import { useEffect, useState } from 'react';

type Kind = 'task' | 'project' | 'campaign';
type Repeat = 'once' | 'daily' | 'weekly';
type Stage = 'Queued' | 'Doing' | 'Review' | 'Done';

type WorkItem = {
  id: string;
  title: string;
  kind: Kind;
  repeat: Repeat;
  owner: string;
  stage: Stage;
  started_on: string;
  stage_on: string;
  deadline?: string | null;
  hours?: number | null;
  cost_aed?: number | null;
  note: string;
};

type ArchiveItem = WorkItem & {
  work_id: string;
  closed_on: string;
  reason: string;
};

type Draft = {
  id?: string;
  title: string;
  kind: Kind;
  repeat: Repeat;
  owner: string;
  stage: Stage;
  started_on: string;
  deadline: string;
  hours: string;
  cost_aed: string;
  note: string;
};

const STAGES: Stage[] = ['Queued', 'Doing', 'Review', 'Done'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function localDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  const index = Number(month) - 1;
  if (!year || !day || index < 0 || index > 11) return iso;
  return `${Number(day)} ${MONTHS[index]}`;
}

function dayCount(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00`);
  const end = Date.parse(`${to}T00:00:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86400000));
}

function spanLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function money(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `AED ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function hoursLabel(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} h`;
}

function blankDraft(today: string): Draft {
  return { title: '', kind: 'task', repeat: 'once', owner: '', stage: 'Queued', started_on: today, deadline: '', hours: '', cost_aed: '', note: '' };
}

function asDraft(item: WorkItem): Draft {
  return {
    ...item,
    deadline: item.deadline || '',
    hours: item.hours == null ? '' : String(item.hours),
    cost_aed: item.cost_aed == null ? '' : String(item.cost_aed),
  };
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error('save');
  return res.json();
}

export function WorkBoard() {
  const [today, setToday] = useState('');
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/os/work', { cache: 'no-store' });
    if (!res.ok) throw new Error('load');
    const body = await res.json();
    setItems(Array.isArray(body.items) ? body.items : []);
    setArchive(Array.isArray(body.archive) ? body.archive : []);
  }

  useEffect(() => {
    setToday(localDay());
    void load().catch(() => setMessage('Work could not be loaded.'));
  }, []);

  async function saveDraft() {
    if (!draft || !today) return;
    const payload = { ...draft, today };
    try {
      const body = {
        ...payload,
        deadline: draft.deadline || null,
        hours: draft.hours === '' ? null : Number(draft.hours),
        cost_aed: draft.cost_aed === '' ? null : Number(draft.cost_aed),
      };
      if (draft.id) await send(`/api/os/work/${draft.id}`, 'PUT', body);
      else await send('/api/os/work', 'POST', body);
      setDraft(null);
      setMessage(null);
      await load();
    } catch {
      setMessage('Save failed.');
    }
  }

  async function saveStage(item: WorkItem, stage: Stage) {
    try {
      await send(`/api/os/work/${item.id}`, 'PUT', { ...item, stage, today });
      await load();
    } catch {
      setMessage('Save failed.');
    }
  }

  async function closeItem(item: WorkItem, restart: boolean) {
    try {
      await send(`/api/os/work/${item.id}/${restart ? 'round' : 'archive'}`, 'POST', { today });
      setMessage(null);
      await load();
    } catch {
      setMessage('Save failed.');
    }
  }

  async function restore(workId: string) {
    try {
      await send(`/api/os/work/${workId}/restore`, 'POST');
      setShowArchive(false);
      await load();
    } catch {
      setMessage('Save failed.');
    }
  }

  const open = items ?? [];
  const openIds = new Set(open.map((item) => item.id));

  return (
    <section className="dash-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Work</h2>
          <p className="mt-1 text-xs text-brand-medium-gray">Tasks, projects, and campaigns. Owner, deadline, person-hours, and cost. A blank figure is not entered yet.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-outline px-4 py-1.5 text-xs" onClick={() => { setShowArchive((value) => !value); setDraft(null); }}>
            {showArchive ? 'Board' : `Archive${archive.length ? ` ${archive.length}` : ''}`}
          </button>
          <button type="button" className="btn-primary px-4 py-1.5 text-xs" onClick={() => { setShowArchive(false); setDraft(blankDraft(today || localDay())); }}>
            Add
          </button>
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}

      {draft ? (
        <form
          className="mt-4 grid gap-3 rounded-2xl border border-brand-light-gray p-4 md:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            void saveDraft();
          }}
        >
          <input className="rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm md:col-span-2" required placeholder="Title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <select className="rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as Kind })}>
            <option value="task">Task</option>
            <option value="project">Project</option>
            <option value="campaign">Campaign</option>
          </select>
          <select className="rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm" value={draft.repeat} onChange={(event) => setDraft({ ...draft, repeat: event.target.value as Repeat })}>
            <option value="once">Once</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <input className="rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm" placeholder="Owner" value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} />
          <select className="rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm" value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value as Stage })}>
            {STAGES.map((stage) => <option key={stage}>{stage}</option>)}
          </select>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">
            Started
            <input className="mt-1 w-full rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm font-normal normal-case tracking-normal text-brand-black" type="date" required value={draft.started_on} onChange={(event) => setDraft({ ...draft, started_on: event.target.value })} />
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">
            Deadline
            <input className="mt-1 w-full rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm font-normal normal-case tracking-normal text-brand-black" type="date" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} />
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">
            Hours
            <input className="mt-1 w-full rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm font-normal normal-case tracking-normal text-brand-black" inputMode="decimal" placeholder="—" value={draft.hours} onChange={(event) => setDraft({ ...draft, hours: event.target.value })} />
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">
            Cost AED
            <input className="mt-1 w-full rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm font-normal normal-case tracking-normal text-brand-black" inputMode="decimal" placeholder="—" value={draft.cost_aed} onChange={(event) => setDraft({ ...draft, cost_aed: event.target.value })} />
          </label>
          <input className="rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm md:col-span-4" placeholder="Note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
          <div className="flex gap-2 md:col-span-2">
            <button className="btn-primary px-4 py-2 text-xs" type="submit">Save</button>
            <button className="btn-outline px-4 py-2 text-xs" type="button" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      ) : null}

      {showArchive ? (
        <ul className="mt-4 space-y-3">
          {archive.length === 0 ? <li className="text-sm text-brand-dark-gray">Nothing in the archive yet.</li> : null}
          {archive.map((item) => {
            const days = dayCount(item.started_on, item.closed_on);
            return (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-brand-light-gray pt-3">
                <div>
                  <div className="font-semibold text-brand-black">{item.title}</div>
                  <p className="mt-1 text-xs text-brand-dark-gray">
                    {item.kind} · {item.repeat} · {item.owner || 'Unassigned'} · {item.stage}
                  </p>
                  <p className="mt-1 text-xs text-brand-medium-gray">
                    {shortDate(item.started_on)} → {shortDate(item.closed_on)} · {spanLabel(days)} · {item.reason === 'round' ? 'Round logged' : 'Archived'}
                  </p>
                </div>
                {openIds.has(item.work_id) ? null : (
                  <button type="button" className="btn-outline px-3 py-1 text-xs" onClick={() => void restore(item.work_id)}>Restore</button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <WorkTable today={today} items={items} open={open} onStage={saveStage} onEdit={(item) => setDraft(asDraft(item))} onClose={closeItem} />
      )}
    </section>
  );
}

function WorkTable({
  today,
  items,
  open,
  onStage,
  onEdit,
  onClose,
}: {
  today: string;
  items: WorkItem[] | null;
  open: WorkItem[];
  onStage: (item: WorkItem, stage: Stage) => Promise<void>;
  onEdit: (item: WorkItem) => void;
  onClose: (item: WorkItem, restart: boolean) => Promise<void>;
}) {
  const knownHours = open.map((item) => item.hours).filter((value): value is number => value != null);
  const knownCost = open.map((item) => item.cost_aed).filter((value): value is number => value != null);
  const hours = knownHours.length ? knownHours.reduce((sum, value) => sum + value, 0) : null;
  const cost = knownCost.length ? knownCost.reduce((sum, value) => sum + value, 0) : null;
  const late = open.filter((item) => item.deadline && today && item.deadline < today && item.stage !== 'Done').length;
  const ordered = [...open].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-brand-dark-gray">
        <span>{items ? `${open.length} open` : '—'}</span>
        <span>{late ? `${late} past deadline` : 'No missed deadline'}</span>
        <span>Hours {hoursLabel(hours)}</span>
        <span>Cost {money(cost)}</span>
      </div>
      {items && ordered.length === 0 ? <p className="mb-3 text-sm text-brand-dark-gray">Nothing open. Add a task, project, or campaign.</p> : null}
      {items ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wider text-brand-medium-gray">
              <tr>
                {['Work', 'Owner', 'Stage', 'Open', 'Deadline', 'Hours', 'Cost', ''].map((heading) => (
                  <th key={heading || 'actions'} className="px-2 py-2 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordered.map((item) => {
                const age = today ? dayCount(item.started_on, today) : null;
                const overdue = Boolean(item.deadline && today && item.deadline < today && item.stage !== 'Done');
                return (
                  <tr key={item.id} className="border-t border-brand-light-gray align-top">
                    <td className="px-2 py-3">
                      <div className="font-semibold text-brand-black">{item.title}</div>
                      <p className="mt-1 text-[11px] capitalize text-brand-medium-gray">{item.kind} · {item.repeat}</p>
                      {item.note ? <p className="mt-1 max-w-xs text-[11px] text-brand-dark-gray">{item.note}</p> : null}
                    </td>
                    <td className="px-2 py-3">{item.owner || '—'}</td>
                    <td className="px-2 py-3">
                      <select className="rounded-lg border border-brand-medium-gray/40 px-2 py-1 text-xs" value={item.stage} onChange={(event) => void onStage(item, event.target.value as Stage)}>
                        {STAGES.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-3 tabular-nums">{age == null ? '—' : spanLabel(age)}</td>
                    <td className={`px-2 py-3 tabular-nums ${overdue ? 'font-semibold text-red-700' : ''}`}>{item.deadline ? shortDate(item.deadline) : '—'}</td>
                    <td className="px-2 py-3 tabular-nums">{hoursLabel(item.hours)}</td>
                    <td className="px-2 py-3 tabular-nums">{money(item.cost_aed)}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <button type="button" className="text-[11px] font-semibold text-brand-burgundy" onClick={() => onEdit(item)}>Edit</button>
                        {item.repeat === 'once' ? null : (
                          <button type="button" className="text-[11px] font-semibold text-brand-burgundy" onClick={() => void onClose(item, true)}>
                            {item.repeat === 'daily' ? 'Log today' : 'Log week'}
                          </button>
                        )}
                        <button type="button" className="text-[11px] font-semibold text-brand-dark-gray" onClick={() => void onClose(item, false)}>
                          {item.repeat === 'once' ? 'Archive' : 'Stop'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
