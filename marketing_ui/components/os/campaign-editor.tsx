'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AssetPicker } from '@/components/os/asset-picker';
import { ChipPicker, NumberInput, OwnerInput, changed } from '@/components/os/fields';
import { Icon } from '@/components/os/icons';
import { LinkedTasks } from '@/components/os/linked-tasks';
import { useSession } from '@/components/os/session';
import { ChannelTags, Disclosure, Drawer, Field, Segmented, StagePill } from '@/components/os/ui';
import { api } from '@/lib/os/client';
import { refreshAfterWrite, useAllContent } from '@/lib/os/data';
import { CAMPAIGN_STATES, CONTENT_CHANNELS, rangeLabel, shortDate, type Campaign } from '@/lib/os/model';

type Draft = Pick<
  Campaign,
  'name' | 'objective' | 'start_date' | 'end_date' | 'color' | 'channels' | 'is_critical' | 'mode' | 'budget_aed' | 'owner' | 'state' | 'landing_url' | 'creatives' | 'kpi_target' | 'results'
>;

const EXTRA_CHANNELS = ['Google Ads', 'Meta Ads', 'Email', 'WhatsApp', 'Billboard', 'Showroom', 'PR'];
const COLORS = ['#500F28', '#8C5A3C', '#B08D57', '#2F4F4F', '#3D5A80', '#6366f1', '#787878'];

function draftOf(item: Campaign | null, defaults: Partial<Draft>): Draft {
  return {
    name: item?.name ?? '',
    objective: item?.objective ?? '',
    start_date: item?.start_date ?? '',
    end_date: item?.end_date ?? null,
    color: item?.color ?? '#500F28',
    channels: item?.channels ?? [],
    is_critical: item?.is_critical ?? false,
    mode: item?.mode ?? null,
    budget_aed: item?.budget_aed ?? null,
    owner: item?.owner ?? '',
    state: item?.state ?? 'Active',
    landing_url: item?.landing_url ?? '',
    creatives: item?.creatives ?? [],
    kpi_target: item?.kpi_target ?? '',
    results: item?.results ?? '',
    ...(item ? {} : defaults),
  };
}

function CampaignContent({ id }: { id: string }) {
  const content = useAllContent();
  const items = (content.data?.items ?? []).filter((item) => item.campaign_id === id);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-brand-dark-gray">Content · {items.length}</span>
        <Link href={`/content?new=1&campaign=${id}`} className="os-link">
          Add content
        </Link>
      </div>
      {items.length ? (
        <ul className="divide-y divide-black/5 rounded-xl border border-black/[0.07]">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/content?open=${item.id}`} className="flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.02]">
                <span className="w-12 shrink-0 text-[11px] tabular-nums text-brand-dark-gray">{shortDate(item.publish_date)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{item.title || 'Untitled'}</span>
                <ChannelTags channels={item.channels} max={3} />
                <StagePill value={item.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : content.loading ? (
        <p className="text-xs text-brand-dark-gray">Loading…</p>
      ) : (
        <p className="text-xs text-brand-dark-gray">No content is linked yet.</p>
      )}
    </div>
  );
}

export function CampaignEditor({
  item,
  defaults = {},
  open,
  onClose,
}: {
  item: Campaign | null;
  defaults?: Partial<Draft>;
  open: boolean;
  onClose: () => void;
}) {
  const { isAdmin } = useSession();
  const [base, setBase] = useState<Draft>(() => draftOf(item, defaults));
  const [draft, setDraft] = useState<Draft>(base);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = draftOf(item, defaults);
    setBase(next);
    setDraft(next);
    setError(null);
    // defaults only seed a new campaign when the drawer opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const dirty = Object.keys(changed(base, draft)).length > 0;
  const channelOptions = [...new Set([...CONTENT_CHANNELS, ...EXTRA_CHANNELS, ...draft.channels])];

  async function save() {
    if (!draft.name.trim()) return setError('Add a name.');
    if (!draft.start_date) return setError('Add a start date.');
    setBusy(true);
    setError(null);
    try {
      if (item) await api(`campaigns/${item.id}`, { method: 'PATCH', json: changed(base, draft) });
      else await api('campaigns', { method: 'POST', json: draft });
      refreshAfterWrite('campaign');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item || !window.confirm(`Delete “${item.name}”? Content and tasks stay, without the link.`)) return;
    setBusy(true);
    try {
      await api(`campaigns/${item.id}`, { method: 'DELETE' });
      refreshAfterWrite('campaign');
      refreshAfterWrite('task');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        wide
        title={item ? item.name : 'New campaign'}
        subtitle={item ? `${item.status} · ${rangeLabel(item.start_date, item.end_date || item.start_date)}` : 'Organic or paid. Content and tasks link to it.'}
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
            placeholder="Campaign name"
            value={draft.name}
            maxLength={160}
            autoFocus={!item}
            onChange={(e) => set('name', e.target.value)}
          />
          <Field label="Objective">
            <textarea dir="auto" className="os-input min-h-[4rem] resize-y" value={draft.objective} maxLength={4000} placeholder="What should this campaign achieve?" onChange={(e) => set('objective', e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts">
              <input type="date" className="os-input" value={draft.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </Field>
            <Field label="Ends">
              <input type="date" className="os-input" value={draft.end_date ?? ''} min={draft.start_date || undefined} onChange={(e) => set('end_date', e.target.value || null)} />
            </Field>
            <Field label="Owner">
              <OwnerInput value={draft.owner} onChange={(value) => set('owner', value)} />
            </Field>
            <Field label="Budget" hint="Blank means no budget set.">
              <NumberInput prefix="AED" value={draft.budget_aed} placeholder="Not set" onChange={(value) => set('budget_aed', value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <Field label="Organic or paid">
              <Segmented size="sm" label="Organic or paid" value={draft.mode ?? ''} options={[{ value: '', label: 'Not set' }, 'Organic', 'Paid', 'Both']} onChange={(value) => set('mode', (value || null) as Draft['mode'])} />
            </Field>
            <Field label="State">
              <Segmented size="sm" label="State" value={draft.state} options={CAMPAIGN_STATES} onChange={(value) => set('state', value)} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-1 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[#500F28]" checked={draft.is_critical} onChange={(e) => set('is_critical', e.target.checked)} />
              Key date
            </label>
          </div>
          <Field label="Channels">
            <ChipPicker label="Channels" options={channelOptions} value={draft.channels} onChange={(value) => set('channels', value)} />
          </Field>
          <Field label="Landing page">
            <input className="os-input" type="url" placeholder="https://" value={draft.landing_url} onChange={(e) => set('landing_url', e.target.value)} />
          </Field>
          <Disclosure title={`KPIs and results${draft.kpi_target || draft.results ? '' : ' · empty'}`} defaultOpen={Boolean(draft.kpi_target || draft.results)}>
            <Field label="Target">
              <input className="os-input" value={draft.kpi_target} maxLength={500} placeholder="e.g. 40 qualified leads, CPL under AED 120" onChange={(e) => set('kpi_target', e.target.value)} />
            </Field>
            <Field label="Results">
              <textarea dir="auto" className="os-input min-h-[4rem] resize-y" value={draft.results} maxLength={4000} placeholder="What happened, with numbers where known" onChange={(e) => set('results', e.target.value)} />
            </Field>
          </Disclosure>
          <Disclosure title={`Creatives${draft.creatives.length ? ` · ${draft.creatives.length}` : ''}`} defaultOpen={draft.creatives.length > 0}>
            {draft.creatives.length ? (
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {draft.creatives.map((url) => (
                  <li key={url} className="relative aspect-square overflow-hidden rounded-lg border border-black/[0.07] bg-[#f6f5f3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                    <button type="button" aria-label="Remove" className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 text-xs font-semibold shadow" onClick={() => set('creatives', draft.creatives.filter((value) => value !== url))}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <button type="button" className="btn-outline px-3 py-1.5 text-[13px]" onClick={() => setPicker(true)}>
              Pick from DAM
            </button>
          </Disclosure>
          <Field label="Colour on the calendar">
            <div className="flex gap-2">
              {[...new Set([...COLORS, draft.color])].map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={draft.color === color}
                  onClick={() => set('color', color)}
                  className={`h-7 w-7 rounded-full ring-offset-2 ${draft.color === color ? 'ring-2 ring-brand-black' : ''}`}
                  style={{ background: color }}
                />
              ))}
            </div>
          </Field>
          {item ? (
            <>
              <CampaignContent id={item.id} />
              <LinkedTasks type="campaign" id={item.id} />
            </>
          ) : null}
        </div>
      </Drawer>
      <AssetPicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(assets) => {
          const urls = assets.map((asset) => asset.image).filter((url): url is string => Boolean(url));
          setDraft((current) => ({ ...current, creatives: [...new Set([...current.creatives, ...urls])].slice(0, 30) }));
        }}
      />
    </>
  );
}