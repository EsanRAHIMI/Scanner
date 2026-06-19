'use client';

import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { Template } from '@/lib/types';
import { useMe } from '../shell';

type UserRow = { user_id: string; username?: string; email?: string; role?: string };

export default function TemplatesPage() {
  const me = useMe();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ templates: Template[] }>('/templates?all=1');
      setTemplates(res.templates);
      if (res.templates.length && !res.templates.some((t) => t.id === selectedId)) {
        setSelectedId(res.templates[0].id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
    api<{ profiles: UserRow[] }>('/user-profiles')
      .then((r) => setUsers(r.profiles))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = templates.find((x) => x.id === selectedId);
    setDraft(t ? structuredClone(t) : null);
  }, [selectedId, templates]);

  if (!me?.is_admin) {
    return <div className="card p-8 text-sm text-gray-600">Template management is admin-only.</div>;
  }

  function setBranding(key: string, value: string) {
    setDraft((d) => (d ? { ...d, branding: { ...d.branding, [key]: value } } : d));
  }
  function setFixed(page: string, key: string, value: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            fixed_pages: {
              ...d.fixed_pages,
              [page]: { ...(d.fixed_pages?.[page] || {}), [key]: value },
            },
          }
        : d
    );
  }
  function setPricingDefaults(patch: Partial<Template['pricing_defaults']>) {
    setDraft((d) => (d ? { ...d, pricing_defaults: { ...d.pricing_defaults, ...patch } } : d));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError('');
    try {
      await api(`/templates/${draft.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name,
          scope: draft.scope,
          assigned_user_ids: draft.assigned_user_ids,
          active: draft.active,
          branding: draft.branding,
          fixed_pages: draft.fixed_pages,
          pricing_defaults: draft.pricing_defaults,
        }),
      });
      setNotice('Template saved.');
      setTimeout(() => setNotice(''), 2500);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function createTemplate() {
    try {
      const t = await api<Template>('/templates', {
        method: 'POST',
        body: JSON.stringify({ name: 'New template' }),
      });
      await load();
      setSelectedId(t.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function duplicateTemplate(id: string) {
    try {
      const t = await api<Template>(`/templates/${id}/duplicate`, { method: 'POST' });
      await load();
      setSelectedId(t.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return;
    try {
      await api(`/templates/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const services = draft?.pricing_defaults?.included_services || [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Templates</h1>
          <button className="btn-secondary text-xs" onClick={() => void createTemplate()}>
            + New
          </button>
        </div>
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  className={`card w-full p-3 text-left transition ${
                    selectedId === t.id ? 'ring-2 ring-brand-burgundy' : 'hover:shadow-brand-card-hover'
                  }`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                        t.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {t.active ? 'active' : 'inactive'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {t.scope === 'global' ? 'Global' : `Assigned (${t.assigned_user_ids?.length || 0})`}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {draft ? (
        <div className="space-y-6">
          {error && <div className="card border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {notice && <div className="card border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}

          <div className="card space-y-4 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="grow">
                <label className="label">Template name</label>
                <input
                  className="input max-w-sm"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  />
                  Active
                </label>
                <button className="btn-secondary text-xs" onClick={() => void duplicateTemplate(draft.id)}>
                  Duplicate
                </button>
                <button
                  className="btn-secondary text-xs text-red-600"
                  onClick={() => void deleteTemplate(draft.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            <div>
              <label className="label">Availability</label>
              <select
                className="input max-w-xs"
                value={draft.scope}
                onChange={(e) => setDraft({ ...draft, scope: e.target.value as Template['scope'] })}
              >
                <option value="global">Global — all sales users</option>
                <option value="assigned">Assigned users only</option>
              </select>
              {draft.scope === 'assigned' && (
                <div className="mt-2 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
                  {users.map((u) => (
                    <label key={u.user_id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.assigned_user_ids?.includes(u.user_id)}
                        onChange={(e) => {
                          const set = new Set(draft.assigned_user_ids || []);
                          if (e.target.checked) set.add(u.user_id);
                          else set.delete(u.user_id);
                          setDraft({ ...draft, assigned_user_ids: Array.from(set) });
                        }}
                      />
                      <span className="truncate">{u.username || u.email}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Branding */}
          <div className="card space-y-4 p-5">
            <h2 className="font-semibold">Branding</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  ['company_name', 'Company name'],
                  ['logo_url', 'Logo URL'],
                  ['pattern_url', 'Pattern image URL'],
                  ['pattern2_url', 'Pattern image URL (variant)'],
                  ['background', 'Page background color'],
                  ['text_color', 'Text color'],
                  ['address', 'Showroom address'],
                  ['phone', 'Phone'],
                  ['website', 'Website'],
                ] as [string, string][]
              ).map(([k, label]) => (
                <div key={k}>
                  <label className="label">{label}</label>
                  <input
                    className="input"
                    value={draft.branding?.[k] || ''}
                    onChange={(e) => setBranding(k, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              Upload new logos/patterns in the Assets section, then paste the URL here.
            </p>
          </div>

          {/* Fixed pages */}
          <div className="card space-y-4 p-5">
            <h2 className="font-semibold">Fixed pages</h2>
            <div>
              <label className="label">Cover / closing corner label</label>
              <input
                className="input max-w-sm"
                value={draft.fixed_pages?.cover?.tag || ''}
                onChange={(e) => {
                  setFixed('cover', 'tag', e.target.value);
                  setFixed('closing', 'tag', e.target.value);
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Intro heading (EN)</label>
                <input
                  className="input"
                  value={draft.fixed_pages?.intro?.heading || ''}
                  onChange={(e) => setFixed('intro', 'heading', e.target.value)}
                />
                <label className="label mt-3">Intro text (EN)</label>
                <textarea
                  className="input"
                  rows={7}
                  value={draft.fixed_pages?.intro?.text_en || ''}
                  onChange={(e) => setFixed('intro', 'text_en', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Intro heading (AR)</label>
                <input
                  className="input"
                  dir="rtl"
                  value={draft.fixed_pages?.intro?.heading_ar || ''}
                  onChange={(e) => setFixed('intro', 'heading_ar', e.target.value)}
                />
                <label className="label mt-3">Intro text (AR)</label>
                <textarea
                  className="input"
                  dir="rtl"
                  rows={7}
                  value={draft.fixed_pages?.intro?.text_ar || ''}
                  onChange={(e) => setFixed('intro', 'text_ar', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Intro image URL</label>
              <input
                className="input"
                value={draft.fixed_pages?.intro?.image_url || ''}
                onChange={(e) => setFixed('intro', 'image_url', e.target.value)}
              />
            </div>
          </div>

          {/* Pricing defaults */}
          <div className="card space-y-4 p-5">
            <h2 className="font-semibold">Pricing & terms defaults</h2>
            <div className="grid max-w-md grid-cols-3 gap-3">
              <div>
                <label className="label">Currency</label>
                <input
                  className="input"
                  value={draft.pricing_defaults?.currency || 'AED'}
                  onChange={(e) => setPricingDefaults({ currency: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Discount %</label>
                <input
                  className="input"
                  type="number"
                  value={draft.pricing_defaults?.discount_pct ?? 0}
                  onChange={(e) => setPricingDefaults({ discount_pct: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">VAT %</label>
                <input
                  className="input"
                  type="number"
                  value={draft.pricing_defaults?.vat_pct ?? 0}
                  onChange={(e) => setPricingDefaults({ vat_pct: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="label">Included services / warranty lines</label>
              <div className="space-y-2">
                {services.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <textarea
                      className="input"
                      rows={2}
                      value={s}
                      onChange={(e) =>
                        setPricingDefaults({
                          included_services: services.map((x, j) => (j === i ? e.target.value : x)),
                        })
                      }
                    />
                    <button
                      className="text-xs text-red-500"
                      onClick={() =>
                        setPricingDefaults({ included_services: services.filter((_, j) => j !== i) })
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  className="btn-secondary w-full text-xs"
                  onClick={() => setPricingDefaults({ included_services: [...services, ''] })}
                >
                  + Add line
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>
      ) : (
        !loading && <div className="card p-8 text-sm text-gray-500">Select a template.</div>
      )}
    </div>
  );
}
