'use client';

import * as React from 'react';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

const SELECTABLE_FIELDS = ['Category', 'Space', 'Color', 'Material'] as const;

type SelectableField = (typeof SELECTABLE_FIELDS)[number];
type FieldOptions = Record<SelectableField, string[]>;

const emptyOptions: FieldOptions = {
  Category: [],
  Space: [],
  Color: [],
  Material: [],
};

const fetcher = async (url: string) => {
  const res = await apiFetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
  return JSON.parse(text) as { options?: Partial<FieldOptions> };
};

function normalizeOptions(options: Partial<FieldOptions> | undefined): FieldOptions {
  const next = { ...emptyOptions };
  for (const field of SELECTABLE_FIELDS) {
    const seen = new Set<string>();
    next[field] = (options?.[field] ?? [])
      .map(value => value.trim())
      .filter(value => {
        const key = value.toLowerCase();
        if (!value || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }
  return next;
}

export function FieldOptionsManager() {
  const { data, error, isLoading, mutate } = useSWR('/admin/products/field-options', fetcher);
  const [draft, setDraft] = React.useState<FieldOptions>(emptyOptions);
  const [newValues, setNewValues] = React.useState<Record<SelectableField, string>>({
    Category: '',
    Space: '',
    Color: '',
    Material: '',
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (data?.options) {
      setDraft(normalizeOptions(data.options));
    }
  }, [data]);

  const addOption = (field: SelectableField) => {
    const value = newValues[field].trim();
    if (!value) return;

    setDraft(prev => {
      const exists = prev[field].some(item => item.toLowerCase() === value.toLowerCase());
      if (exists) return prev;
      return { ...prev, [field]: [...prev[field], value].sort((a, b) => a.localeCompare(b)) };
    });
    setNewValues(prev => ({ ...prev, [field]: '' }));
    setMessage(null);
  };

  const removeOption = (field: SelectableField, value: string) => {
    setDraft(prev => ({
      ...prev,
      [field]: prev[field].filter(item => item !== value),
    }));
    setMessage(null);
  };

  const saveOptions = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch('/admin/products/field-options', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: draft }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Failed to save field options');

      const json = JSON.parse(text) as { options?: Partial<FieldOptions> };
      setDraft(normalizeOptions(json.options));
      await mutate(json, { revalidate: false });
      setMessage('Saved');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-black/25">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-black/60 dark:text-white/60">
            Selectable Field Options
          </h4>
          <p className="mt-1 text-xs font-medium text-black/40 dark:text-white/40">
            Manage values shown in editable product fields.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {message ? (
            <span className={`text-[10px] font-black ${message === 'Saved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {message}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void saveOptions()}
            disabled={isSaving || isLoading}
            className="rounded-full bg-black px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-emerald-600 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-emerald-400"
          >
            {isSaving ? 'Saving...' : 'Save Options'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-bold text-red-500">
          Failed to load field options
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SELECTABLE_FIELDS.map(field => (
          <div key={field} className="rounded-xl border border-black/5 bg-black/[0.015] p-3 dark:border-white/5 dark:bg-white/[0.02]">
            <div className="mb-3 flex items-center justify-between">
              <h5 className="text-xs font-black uppercase tracking-widest text-black/50 dark:text-white/50">
                {field}
              </h5>
              <span className="text-[10px] font-bold text-black/30 dark:text-white/30">
                {draft[field].length}
              </span>
            </div>

            <div className="mb-3 flex gap-2">
              <input
                value={newValues[field]}
                onChange={(e) => setNewValues(prev => ({ ...prev, [field]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addOption(field);
                  }
                }}
                placeholder={`Add ${field}`}
                className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
              <button
                type="button"
                onClick={() => addOption(field)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-emerald-700"
              >
                Add
              </button>
            </div>

            <div className="scrollbar-minimal flex max-h-44 flex-wrap gap-2 overflow-y-auto">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-black/5 dark:bg-white/5" />
                ))
              ) : draft[field].length === 0 ? (
                <div className="py-5 text-xs italic text-black/30 dark:text-white/30">
                  No options
                </div>
              ) : (
                draft[field].map(value => (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-bold text-black/60 shadow-sm dark:border-white/10 dark:bg-black/25 dark:text-white/70"
                  >
                    {value}
                    <button
                      type="button"
                      onClick={() => removeOption(field, value)}
                      className="ml-1 text-red-500/60 hover:text-red-600"
                      title={`Remove ${value}`}
                    >
                      x
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
