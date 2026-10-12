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

function blankDraft(today: string): Draft {
  return { title: '', kind: 'task', repeat: 'once', owner: '', stage: 'Queued', started_on: today, note: '' };
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
      if (draft.id) await send(`/api/os/work/${draft.id}`, 'PUT', payload);
      else await send('/api/os/work', 'POST', payload);
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
          <p className="mt-1 text-xs text-brand-medium-gray">Projects, tasks and campaigns. Who owns it, which stage, and how long it has been open.</p>
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
          <input className="rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm" type="date" required value={draft.started_on} onChange={(event) => setDraft({ ...draft, started_on: event.target.value })} />
          <input className="rounded-xl border border-brand-medium-gray/40 px-3 py-2 text-sm md:col-span-3" placeholder="Note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
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
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {STAGES.map((stage) => {
            const group = open.filter((item) => item.stage === stage);
            return (
              <div key={stage} className="rounded-2xl bg-brand-light-gray/30 p-3">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-brand-medium-gray">
                  <span>{stage}</span>
                  <span>{items ? group.length : '—'}</span>
                </div>
                <div className="mt-3 space-y-3">
                  {group.map((item) => {
                    const age = today ? dayCount(item.started_on, today) : null;
                    const inStage = today ? dayCount(item.stage_on || item.started_on, today) : null;
                    return (
                      <article key={item.id} className="rounded-xl border border-brand-medium-gray/30 bg-brand-white p-3">
                        <div className="font-semibold text-brand-black">{item.title}</div>
                        <p className="mt-1 text-[11px] text-brand-dark-gray">
                          {item.kind} · {item.repeat} · {item.owner || 'Unassigned'}
                        </p>
                        <p className="mt-1 text-[11px] text-brand-medium-gray">
                          {age == null ? '—' : `Open ${spanLabel(age)}`}
                          {inStage != null && item.stage_on && item.stage_on !== item.started_on ? ` · ${spanLabel(inStage)} in ${item.stage}` : ''}
                          {item.started_on ? ` · from ${shortDate(item.started_on)}` : ''}
                        </p>
                        {item.note ? <p className="mt-1 text-[11px] text-brand-dark-gray">{item.note}</p> : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            className="rounded-lg border border-brand-medium-gray/40 px-2 py-1 text-[11px]"
                            value={item.stage}
                            onChange={(event) => void saveStage(item, event.target.value as Stage)}
                          >
                            {STAGES.map((option) => <option key={option}>{option}</option>)}
                          </select>
                          <button type="button" className="text-[11px] font-semibold text-brand-burgundy" onClick={() => setDraft({ ...item })}>Edit</button>
                          {item.repeat === 'once' ? null : (
                            <button type="button" className="text-[11px] font-semibold text-brand-burgundy" onClick={() => void closeItem(item, true)}>
                              {item.repeat === 'daily' ? 'Log today' : 'Log week'}
                            </button>
                          )}
                          <button type="button" className="text-[11px] font-semibold text-brand-dark-gray" onClick={() => void closeItem(item, false)}>
                            {item.repeat === 'once' ? 'Archive' : 'Stop'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
