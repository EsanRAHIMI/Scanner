'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { AdjustEditor } from '@/components/adjust-editor';
import { PageHeader } from '@/components/page-header';
import {
  changeOutputBackground,
  deleteOutput,
  getItem,
  listBackgrounds,
  listOutputs,
  resolveMediaUrl,
  type Background,
  type BatchItem,
  type OutputRow,
} from '@/lib/api';

function previewUrl(row: OutputRow): string | null {
  const base = resolveMediaUrl(row.final_url);
  if (!base) return null;
  const stamp = encodeURIComponent(row.updated_at);
  return `${base}${base.includes('?') ? '&' : '?'}v=${stamp}`;
}

export default function OutputsPage() {
  const [rows, setRows] = useState<OutputRow[]>([]);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [total, setTotal] = useState(0);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BatchItem | null>(null);

  async function openAdjust(row: OutputRow) {
    setError(null);
    try {
      const res = await getItem(row.id);
      setEditing(res.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open editor');
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [outputsRes, bgRes] = await Promise.all([
        listOutputs({ file_name: fileName || undefined, limit: 200 }),
        listBackgrounds(),
      ]);
      setRows(outputsRes.items);
      setTotal(outputsRes.total);
      setBackgrounds(bgRes.backgrounds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outputs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(row: OutputRow) {
    const confirmed = window.confirm(`Delete "${row.file_name}"?`);
    if (!confirmed) return;

    setDeletingId(row.id);
    setError(null);
    try {
      await deleteOutput(row.id);
      setRows((prev) => prev.filter((item) => item.id !== row.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete output');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBackgroundChange(row: OutputRow, backgroundId: string) {
    if (!backgroundId || backgroundId === row.background_id) return;
    setApplyingId(row.id);
    setError(null);
    try {
      const res = await changeOutputBackground(row.id, backgroundId);
      setRows((prev) => prev.map((item) => (item.id === row.id ? res.output : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change background');
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Final outputs"
        description="Published images for other services. Change background per card or remove entries."
        actions={
          <>
            <input
              className="field-input h-9 w-44 text-xs"
              placeholder="Filter…"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
            <button type="button" className="btn-outline h-9 px-3 text-xs" onClick={() => void load()}>
              Refresh
            </button>
          </>
        }
      />

      {loading && <p className="text-sm text-brand-medium-gray">Loading…</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!loading && rows.length === 0 && (
        <section className="dash-panel">
          <div className="dash-panel-body text-sm text-brand-medium-gray">No finalized outputs yet.</div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {rows.map((row) => {
          const preview = previewUrl(row);
          const busy = applyingId === row.id || deletingId === row.id;
          return (
            <article key={row.id} className="dash-panel overflow-hidden transition hover:border-brand-burgundy/30">
              <a href={row.final_url} target="_blank" rel="noreferrer" className="relative block aspect-[3/4] bg-brand-light-gray/60">
                {preview ? (
                  <Image src={preview} alt={row.file_name} fill className="object-cover" unoptimized sizes="20vw" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-brand-medium-gray">—</div>
                )}
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-brand-black/35 text-[10px] text-white">
                    {deletingId === row.id ? 'Deleting' : 'Updating'}
                  </div>
                )}
              </a>

              <div className="flex items-center gap-1 border-t border-brand-medium-gray/15 px-2.5 py-1.5">
                <p className="min-w-0 flex-1 truncate text-[11px] font-medium" title={row.file_name}>
                  {row.file_name}
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] text-brand-medium-gray transition hover:bg-brand-burgundy/10 hover:text-brand-burgundy disabled:opacity-40"
                  disabled={busy}
                  title="Adjust / touch up"
                  onClick={() => void openAdjust(row)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] text-brand-medium-gray transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  disabled={busy}
                  title="Delete"
                  onClick={() => void handleDelete(row)}
                >
                  ×
                </button>
              </div>

              <div className="px-2.5 pb-2.5">
                <select
                  className="w-full truncate rounded-lg border-0 bg-brand-light-gray/70 px-2 py-1 text-[10px] text-brand-dark-gray outline-none focus:ring-1 focus:ring-brand-burgundy/30 disabled:opacity-50"
                  value={row.background_id ?? ''}
                  disabled={busy || backgrounds.length === 0}
                  title="Background"
                  onChange={(e) => void handleBackgroundChange(row, e.target.value)}
                >
                  {!row.background_id && <option value="">Background</option>}
                  {backgrounds.map((bg) => (
                    <option key={bg.id} value={bg.id}>
                      {bg.name}
                      {bg.is_default ? ' · default' : ''}
                    </option>
                  ))}
                </select>

                {row.rendition_urls && Object.keys(row.rendition_urls).length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {Object.entries(row.rendition_urls).map(([name, url]) => {
                      const href = resolveMediaUrl(url) ?? url;
                      return (
                        <a
                          key={name}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-brand-medium-gray/25 px-1.5 py-0.5 text-[9px] font-medium text-brand-dark-gray transition hover:border-brand-burgundy/40 hover:text-brand-burgundy"
                          title={`Open ${name}`}
                        >
                          {name.replace('_', ' ')}
                        </a>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {!loading && rows.length > 0 && (
        <p className="text-xs text-brand-medium-gray">{total} published item{total === 1 ? '' : 's'}</p>
      )}

      {editing ? (
        <AdjustEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setEditing(updated);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
