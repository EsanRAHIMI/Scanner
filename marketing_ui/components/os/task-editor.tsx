'use client';

import { useEffect, useMemo, useState } from 'react';

import { NumberInput, OwnerInput, changed } from '@/components/os/fields';
import { useSession } from '@/components/os/session';
import { Disclosure, Drawer, Field, Segmented } from '@/components/os/ui';
import { refreshAfterWrite, useAllContent, useCampaigns, useInitiatives } from '@/lib/os/data';
import { PRIORITIES, TASK_STAGES, meLabel, type LinkType, type Task } from '@/lib/os/model';
import { blankTask, closeTask, draftOf, saveTask, type TaskDraft } from '@/lib/os/tasks';

export function useLinkOptions() {
  const campaigns = useCampaigns();
  const initiatives = useInitiatives();
  const content = useAllContent();
  return useMemo(() => {
    const map = new Map<string, { type: LinkType; id: string; label: string }>();
    for (const item of campaigns.data?.items ?? []) map.set(`campaign:${item.id}`, { type: 'campaign', id: item.id, label: item.name });
    for (const item of initiatives.data?.items ?? []) map.set(`initiative:${item.id}`, { type: 'initiative', id: item.id, label: item.name });
    for (const item of content.data?.items ?? []) map.set(`content:${item.id}`, { type: 'content', id: item.id, label: item.title || 'Untitled' });
    return map;
  }, [campaigns.data, initiatives.data, content.data]);
}

export function TaskEditor({
  item,
  defaults,
  open,
  onClose,
}: {
  item: Task | null;
  defaults?: Partial<TaskDraft>;
  open: boolean;
  onClose: () => void;
}) {
  const { me } = useSession();
  const links = useLinkOptions();
  const [base, setBase] = useState<TaskDraft>(() => (item ? draftOf(item) : blankTask(defaults)));
  const [draft, setDraft] = useState<TaskDraft>(base);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = item ? draftOf(item) : blankTask({ owner: meLabel(me), ...defaults });
    setBase(next);
    setDraft(next);
    setError(null);
    // defaults only seed a new task when the drawer opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const dirty = Object.keys(changed(base, draft)).length > 0;
  const linkKey = draft.link_type && draft.link_id ? `${draft.link_type}:${draft.link_id}` : '';
  const grouped = (type: LinkType) => [...links.values()].filter((entry) => entry.type === type);

  async function save() {
    if (!draft.title.trim()) return setError('Add a title.');
    setBusy(true);
    setError(null);
    try {
      await saveTask(item?.id ?? null, { ...draft, title: draft.title.trim() });
      refreshAfterWrite('task');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function close(how: 'archive' | 'round') {
    if (!item) return;
    setBusy(true);
    try {
      if (dirty) await saveTask(item.id, draft);
      await closeTask(item.id, how);
      refreshAfterWrite('task');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={item ? item.title : 'New task'}
      subtitle={item ? `${item.stage}${item.owner ? ` · ${item.owner}` : ''}` : 'Link it to a campaign, content, or initiative.'}
      footer={
        <>
          {item ? (
            <div className="flex gap-1">
              {item.repeat !== 'once' ? (
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => void close('round')} title="Log this round and start the next one">
                  Log round
                </button>
              ) : null}
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => void close('archive')} title="Move to Completed history">
                Archive
              </button>
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {error ? <span className="max-w-[12rem] truncate text-xs text-red-700" title={error}>{error}</span> : null}
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
          placeholder="What needs doing?"
          value={draft.title}
          maxLength={120}
          autoFocus={!item}
          onChange={(e) => set('title', e.target.value)}
        />
        <Field label="Stage">
          <Segmented size="sm" label="Stage" value={draft.stage} options={TASK_STAGES} onChange={(value) => set('stage', value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Owner">
            <OwnerInput value={draft.owner} onChange={(value) => set('owner', value)} />
          </Field>
          <Field label="Due">
            <input type="date" className="os-input" value={draft.deadline ?? ''} onChange={(e) => set('deadline', e.target.value || null)} />
          </Field>
        </div>
        <Field label="Priority">
          <Segmented size="sm" label="Priority" value={draft.priority} options={PRIORITIES} onChange={(value) => set('priority', value)} />
        </Field>
        <Field label="Linked to">
          <select
            className="os-input"
            value={linkKey}
            onChange={(e) => {
              const entry = links.get(e.target.value);
              setDraft((current) => ({ ...current, link_type: entry?.type ?? null, link_id: entry?.id ?? null }));
            }}
          >
            <option value="">Nothing</option>
            {linkKey && !links.has(linkKey) ? <option value={linkKey}>Linked item</option> : null}
            <optgroup label="Campaigns">
              {grouped('campaign').map((entry) => (
                <option key={entry.id} value={`campaign:${entry.id}`}>
                  {entry.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Initiatives">
              {grouped('initiative').map((entry) => (
                <option key={entry.id} value={`initiative:${entry.id}`}>
                  {entry.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Content">
              {grouped('content').map((entry) => (
                <option key={entry.id} value={`content:${entry.id}`}>
                  {entry.label}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        {draft.stage === 'Blocked' || draft.blocker ? (
          <Field label="Blocker">
            <input className="os-input" value={draft.blocker} maxLength={500} placeholder="What is it waiting on?" onChange={(e) => set('blocker', e.target.value)} />
          </Field>
        ) : null}
        <Field label="Note">
          <textarea dir="auto" className="os-input min-h-[4rem] resize-y" value={draft.note} maxLength={2000} onChange={(e) => set('note', e.target.value)} />
        </Field>
        <Disclosure title="Repeat, time and cost">
          <Field label="Repeats">
            <Segmented size="sm" label="Repeats" value={draft.repeat} options={[{ value: 'once', label: 'Once' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} onChange={(value) => set('repeat', value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hours">
              <NumberInput value={draft.hours} placeholder="—" onChange={(value) => set('hours', value)} />
            </Field>
            <Field label="Cost">
              <NumberInput prefix="AED" value={draft.cost_aed} placeholder="—" onChange={(value) => set('cost_aed', value)} />
            </Field>
          </div>
          <Field label="Started">
            <input type="date" className="os-input" value={draft.started_on} onChange={(e) => set('started_on', e.target.value)} />
          </Field>
        </Disclosure>
      </div>
    </Drawer>
  );
}
