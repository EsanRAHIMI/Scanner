'use client';

import { useEffect, useState } from 'react';

import { AssetPicker } from '@/components/os/asset-picker';
import { ChipPicker, NumberInput, OwnerInput, Stepper, changed } from '@/components/os/fields';
import { Icon } from '@/components/os/icons';
import { LinkedTasks } from '@/components/os/linked-tasks';
import { useSession } from '@/components/os/session';
import { Disclosure, Drawer, Field, Segmented } from '@/components/os/ui';
import { api } from '@/lib/os/client';
import { refreshAfterWrite, useCampaigns, useFieldOptions } from '@/lib/os/data';
import { CONTENT_CHANNELS, CONTENT_STAGES, longDate, type Content, type Kpi } from '@/lib/os/model';

type Draft = Omit<Content, 'id' | 'campaign_name' | 'updated_at'>;

const EMPTY_KPI: Kpi = { views: null, likes: null, comments: null, clicks: null, leads: null };

export function blankContent(patch: Partial<Draft> = {}): Draft {
  return {
    title: '',
    status: 'Idea',
    publish_date: null,
    due_date: null,
    channels: [],
    format: '',
    pillar: '',
    hero_product: '',
    owner: '',
    campaign_id: null,
    mode: null,
    caption: '',
    brief: '',
    assets: [],
    content_link: '',
    kpi: EMPTY_KPI,
    ...patch,
  };
}

function draftOf(item: Content): Draft {
  return blankContent({
    title: item.title,
    status: item.status,
    publish_date: item.publish_date,
    due_date: item.due_date,
    channels: item.channels,
    format: item.format,
    pillar: item.pillar,
    hero_product: item.hero_product,
    owner: item.owner,
    campaign_id: item.campaign_id,
    mode: item.mode,
    caption: item.caption,
    brief: item.brief,
    assets: item.assets,
    content_link: item.content_link,
    kpi: { ...EMPTY_KPI, ...item.kpi },
  });
}

function withCurrent(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}

export function ContentEditor({
  item,
  defaults,
  open,
  onClose,
  onSaved,
}: {
  item: Content | null;
  defaults?: Partial<Draft>;
  open: boolean;
  onClose: () => void;
  onSaved?: (item: Content | null) => void;
}) {
  const { isAdmin } = useSession();
  const campaigns = useCampaigns();
  const { formats, pillars } = useFieldOptions();
  const [base, setBase] = useState<Draft>(() => (item ? draftOf(item) : blankContent(defaults)));
  const [draft, setDraft] = useState<Draft>(base);
  const [picker, setPicker] = useState(false);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = item ? draftOf(item) : blankContent(defaults);
    setBase(next);
    setDraft(next);
    setError(null);
    setLink('');
    // defaults only seed a new item when the drawer opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const dirty = Object.keys(changed(base, draft)).length > 0;

  async function save() {
    if (!draft.title.trim()) {
      setError('Add a title.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = item ? changed(base, draft) : draft;
      const saved = item ? await api<Content>(`content/${item.id}`, { method: 'PATCH', json: body }) : await api<Content>('content', { method: 'POST', json: body });
      refreshAfterWrite('content');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item || !window.confirm(`Delete “${item.title}”? Linked tasks stay, without the link.`)) return;
    setBusy(true);
    try {
      await api(`content/${item.id}`, { method: 'DELETE' });
      refreshAfterWrite('content');
      refreshAfterWrite('task');
      onSaved?.(null);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const campaignOptions = (campaigns.data?.items ?? []).slice().sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
  const published = draft.status === 'Published';

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        wide
        title={item ? item.title || 'Untitled' : 'New content'}
        subtitle={item ? `${item.status} · ${item.publish_date ? longDate(item.publish_date) : 'No publish date'}` : 'One item can go to several channels.'}
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
            className="w-full border-0 bg-transparent p-0 text-lg font-semibold text-brand-black outline-none placeholder:text-brand-medium-gray"
            placeholder="Title"
            value={draft.title}
            maxLength={200}
            autoFocus={!item}
            onChange={(e) => set('title', e.target.value)}
          />

          <Field label="Status">
            <Stepper stages={CONTENT_STAGES} value={draft.status} onChange={(value) => set('status', value as Draft['status'])} />
          </Field>

          <Field label="Channels">
            <ChipPicker label="Channels" options={CONTENT_CHANNELS} value={draft.channels} onChange={(value) => set('channels', value as Draft['channels'])} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Publish date">
              <input type="date" className="os-input" value={draft.publish_date ?? ''} onChange={(e) => set('publish_date', e.target.value || null)} />
            </Field>
            <Field label="Due date" hint="When the work must be ready">
              <input type="date" className="os-input" value={draft.due_date ?? ''} onChange={(e) => set('due_date', e.target.value || null)} />
            </Field>
            <Field label="Campaign">
              <select className="os-input" value={draft.campaign_id ?? ''} onChange={(e) => set('campaign_id', e.target.value || null)}>
                <option value="">No campaign</option>
                {campaignOptions.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} · {campaign.status}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Owner">
              <OwnerInput value={draft.owner} onChange={(value) => set('owner', value)} />
            </Field>
            <Field label="Format">
              <select className="os-input" value={draft.format} onChange={(e) => set('format', e.target.value)}>
                <option value="">Not set</option>
                {withCurrent(formats, draft.format).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pillar">
              <select className="os-input" value={draft.pillar} onChange={(e) => set('pillar', e.target.value)}>
                <option value="">Not set</option>
                {withCurrent(pillars, draft.pillar).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <Field label="Organic or paid">
              <Segmented
                label="Organic or paid"
                size="sm"
                value={draft.mode ?? ''}
                options={[{ value: '', label: 'Not set' }, 'Organic', 'Paid', 'Both']}
                onChange={(value) => set('mode', (value || null) as Draft['mode'])}
              />
            </Field>
            <Field label="Hero product" className="min-w-[12rem] flex-1">
              <input className="os-input" value={draft.hero_product} maxLength={120} placeholder="Collection name" onChange={(e) => set('hero_product', e.target.value)} />
            </Field>
          </div>

          <Field label="Caption">
            <textarea dir="auto" className="os-input min-h-[5.5rem] resize-y" value={draft.caption} maxLength={5000} placeholder="Caption or idea" onChange={(e) => set('caption', e.target.value)} />
          </Field>

          <Disclosure title="Brief" defaultOpen={Boolean(draft.brief)}>
            <textarea dir="auto" className="os-input min-h-[6rem] resize-y" value={draft.brief} maxLength={5000} placeholder="Goal, audience, tone, must-haves" onChange={(e) => set('brief', e.target.value)} />
          </Disclosure>

          <Field label={`Assets${draft.assets.length ? ` · ${draft.assets.length}` : ''}`}>
            <div className="space-y-2">
              {draft.assets.length ? (
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {draft.assets.map((url) => (
                    <li key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-black/[0.07] bg-[#f6f5f3]">
                      <a href={url} target="_blank" rel="noreferrer" title={url}>
                        {/\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                        ) : (
                          <span className="flex h-full items-center justify-center p-1 text-center text-[10px] text-brand-dark-gray">
                            <Icon.link className="h-4 w-4" />
                          </span>
                        )}
                      </a>
                      <button
                        type="button"
                        aria-label="Remove asset"
                        className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 text-xs font-semibold text-brand-black shadow sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={() => set('assets', draft.assets.filter((value) => value !== url))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-outline px-3 py-1.5 text-[13px]" onClick={() => setPicker(true)}>
                  Pick from DAM
                </button>
                <form
                  className="flex min-w-[12rem] flex-1 gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const url = link.trim();
                    if (!/^https?:\/\//i.test(url) || draft.assets.includes(url)) return;
                    set('assets', [...draft.assets, url].slice(0, 30));
                    setLink('');
                  }}
                >
                  <input className="os-input min-w-0 flex-1" placeholder="Or paste a file link" value={link} onChange={(e) => setLink(e.target.value)} />
                </form>
              </div>
            </div>
          </Field>

          <Field label="Published link">
            <input className="os-input" type="url" value={draft.content_link} placeholder="https://instagram.com/p/…" onChange={(e) => set('content_link', e.target.value)} />
          </Field>

          {published ? (
            <Field label="Results after publishing" hint="Leave blank when unknown.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(['views', 'likes', 'comments', 'clicks', 'leads'] as const).map((key) => (
                  <label key={key} className="block">
                    <span className="mb-0.5 block text-[11px] capitalize text-brand-dark-gray">{key}</span>
                    <NumberInput value={draft.kpi[key]} onChange={(value) => set('kpi', { ...draft.kpi, [key]: value })} />
                  </label>
                ))}
              </div>
            </Field>
          ) : null}

          {item ? <LinkedTasks type="content" id={item.id} /> : null}
        </div>
      </Drawer>
      <AssetPicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(assets) => {
          const urls = assets.map((asset) => asset.image).filter((url): url is string => Boolean(url));
          setDraft((current) => ({
            ...current,
            assets: [...new Set([...current.assets, ...urls])].slice(0, 30),
            hero_product: current.hero_product || assets[0]?.name || '',
          }));
        }}
      />
    </>
  );
}
