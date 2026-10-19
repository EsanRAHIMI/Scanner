'use client';

import { useEffect, useState } from 'react';

import { NumberInput, OwnerInput, changed } from '@/components/os/fields';
import { Icon } from '@/components/os/icons';
import { LinkedTasks } from '@/components/os/linked-tasks';
import { useSession } from '@/components/os/session';
import { Drawer, Field, Segmented } from '@/components/os/ui';
import { api } from '@/lib/os/client';
import { refreshAfterWrite } from '@/lib/os/data';
import { INITIATIVE_STATUSES, PRIORITIES, longDate, type Initiative, type InitiativeFile } from '@/lib/os/model';

type Draft = Omit<Initiative, 'id' | 'open_tasks'>;

function draftOf(item: Initiative | null): Draft {
  return {
    name: item?.name ?? '',
    owner: item?.owner ?? '',
    priority: item?.priority ?? 'Medium',
    deadline: item?.deadline ?? null,
    status: item?.status ?? 'Not started',
    budget_aed: item?.budget_aed ?? null,
    spent_aed: item?.spent_aed ?? null,
    blockers: item?.blockers ?? '',
    files: item?.files ?? [],
    notes: item?.notes ?? '',
  };
}

export function InitiativeEditor({ item, open, onClose }: { item: Initiative | null; open: boolean; onClose: () => void }) {
  const { isAdmin } = useSession();
  const [base, setBase] = useState<Draft>(() => draftOf(item));
  const [draft, setDraft] = useState<Draft>(base);
  const [file, setFile] = useState<InitiativeFile>({ label: '', url: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = draftOf(item);
    setBase(next);
    setDraft(next);
    setFile({ label: '', url: '' });
    setError(null);
    // reset only when a different initiative opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const dirty = Object.keys(changed(base, draft)).length > 0;

  async function save() {
    if (!draft.name.trim()) return setError('Add a name.');
    setBusy(true);
    setError(null);
    try {
      if (item) await api(`initiatives/${item.id}`, { method: 'PATCH', json: changed(base, draft) });
      else await api('initiatives', { method: 'POST', json: draft });
      refreshAfterWrite('initiative');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item || !window.confirm(`Delete “${item.name}”? Its tasks stay, without the link.`)) return;
    setBusy(true);
    try {
      await api(`initiatives/${item.id}`, { method: 'DELETE' });
      refreshAfterWrite('initiative');
      refreshAfterWrite('task');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addFile() {
    const url = file.url.trim();
    if (!/^https?:\/\//i.test(url)) return setError('A file link starts with https://');
    set('files', [...draft.files, { label: file.label.trim() || new URL(url).hostname, url }]);
    setFile({ label: '', url: '' });
    setError(null);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={item ? item.name : 'New initiative'}
      subtitle={item ? `${item.status} · ${item.deadline ? `Due ${longDate(item.deadline)}` : 'No deadline'}` : 'A project outside the content calendar.'}
      footer={
        <>
          {item && isAdmin ? (
            <button type="button" className="btn-danger" onClick={() => void remove()} disabled={busy}>
              <Icon.trash className="h-4 w-4" /> Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {error ? <span className="max-w-[14rem] truncate text-xs text-red-700" title={error}>{error}</span> : null}
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={() => void save()} disabled={busy || (!!item && !dirty)}>
              {busy ? 'Saving…' : item ? 'Save' : 'Create'}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        <input
          className="w-full border-0 bg-transparent p-0 text-lg font-semibold outline-none placeholder:text-brand-medium-gray"
          placeholder="Initiative name"
          value={draft.name}
          maxLength={120}
          autoFocus={!item}
          onChange={(e) => set('name', e.target.value)}
        />
        <Field label="Status">
          <Segmented size="sm" label="Status" value={draft.status} options={INITIATIVE_STATUSES} onChange={(value) => set('status', value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Owner">
            <OwnerInput value={draft.owner} onChange={(value) => set('owner', value)} />
          </Field>
          <Field label="Deadline">
            <input type="date" className="os-input" value={draft.deadline ?? ''} onChange={(e) => set('deadline', e.target.value || null)} />
          </Field>
          <Field label="Budget">
            <NumberInput prefix="AED" value={draft.budget_aed} placeholder="Not set" onChange={(value) => set('budget_aed', value)} />
          </Field>
          <Field label="Spent so far">
            <NumberInput prefix="AED" value={draft.spent_aed} placeholder="Unknown" onChange={(value) => set('spent_aed', value)} />
          </Field>
        </div>
        <Field label="Priority">
          <Segmented size="sm" label="Priority" value={draft.priority} options={PRIORITIES} onChange={(value) => set('priority', value)} />
        </Field>
        <Field label="Blockers" hint="Anything here shows on Overview and in Reports.">
          <textarea dir="auto" className="os-input min-h-[3.5rem] resize-y" value={draft.blockers} maxLength={2000} placeholder="What is stopping progress?" onChange={(e) => set('blockers', e.target.value)} />
        </Field>
        <Field label={`Files${draft.files.length ? ` · ${draft.files.length}` : ''}`}>
          <div className="space-y-2">
            {draft.files.length ? (
              <ul className="divide-y divide-black/5 rounded-xl border border-black/[0.07]">
                {draft.files.map((entry, index) => (
                  <li key={`${entry.url}-${index}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Icon.link className="h-4 w-4 shrink-0 text-brand-dark-gray" />
                    <a href={entry.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-brand-burgundy" title={entry.url}>
                      {entry.label || entry.url}
                    </a>
                    <button type="button" className="text-xs text-brand-dark-gray hover:text-red-700" onClick={() => set('files', draft.files.filter((_, n) => n !== index))}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addFile();
              }}
            >
              <input className="os-input w-36" placeholder="Label" value={file.label} maxLength={120} onChange={(e) => setFile({ ...file, label: e.target.value })} />
              <input className="os-input min-w-[10rem] flex-1" placeholder="https://drive…" value={file.url} onChange={(e) => setFile({ ...file, url: e.target.value })} />
              <button type="submit" className="btn-outline px-3 py-1.5 text-[13px]" disabled={!file.url.trim()}>
                Add
              </button>
            </form>
          </div>
        </Field>
        <Field label="Notes">
          <textarea dir="auto" className="os-input min-h-[5rem] resize-y" value={draft.notes} maxLength={8000} placeholder="Decisions, suppliers, context" onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {item ? <LinkedTasks type="initiative" id={item.id} /> : null}
      </div>
    </Drawer>
  );
}
