'use client';

import * as React from 'react';

import { useDamCache } from '../dam-cache-provider';
import type { DamAirtableRecord, DamAssetsResponse } from '@/types/trainer';

function colorToCss(value: string): string | null {
  const v = value.trim().toLowerCase();
  const map: Record<string, string> = {
    bronze: '#CD7F32',
    chrome: '#BFC7CE',
    brass: '#B5A642',
    gold: '#D4AF37',
    silver: '#C0C0C0',
    black: '#111827',
    white: '#FFFFFF',
    nickel: '#A3A3A3',
    copper: '#B87333',
    pink: '#EC4899',
    rose: '#F43F5E',
  };
  if (map[v]) return map[v];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())) return value.trim();
  return null;
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return '';
}

function normalizeImageUrl(raw: string) {
  const s = raw.trim();
  if (!s) return '';

  const m1 = s.match(/^https?:\/\/lh3\.googleusercontent\.com\/d\/([^=/?#]+)(.*)$/i);
  if (m1) return s;

  const m2 = s.match(/^https?:\/\/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m2) return `https://lh3.googleusercontent.com/d/${m2[1]}=w1000`;

  const m3 = s.match(/^https?:\/\/drive\.google\.com\/open\?id=([^&]+)(&.*)?$/i);
  if (m3) return `https://lh3.googleusercontent.com/d/${m3[1]}=w1000`;

  return s;
}

function extractUrls(v: unknown): string[] {
  if (typeof v === 'string') {
    const u = normalizeImageUrl(v);
    return /^https?:\/\//i.test(u) ? [u] : [];
  }
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === 'string') {
        const u = normalizeImageUrl(item);
        if (/^https?:\/\//i.test(u)) out.push(u);
      } else if (item && typeof item === 'object') {
        const maybe = (item as Record<string, unknown>).url;
        if (typeof maybe === 'string') {
          const u = normalizeImageUrl(maybe);
          if (/^https?:\/\//i.test(u)) out.push(u);
        }
      }
    }
    return out;
  }
  if (v && typeof v === 'object') {
    const maybe = (v as Record<string, unknown>).url;
    if (typeof maybe === 'string') {
      const u = normalizeImageUrl(maybe);
      return /^https?:\/\//i.test(u) ? [u] : [];
    }
  }
  return [];
}

function renderCell(column: string, value: unknown) {
  if (value === null || value === undefined) return null;

  const col = column.trim().toLowerCase();

  if (col === 'url') {
    const urls = extractUrls(value);
    if (urls.length) {
      const shown = urls.slice(0, 3);
      const extra = urls.length - shown.length;
      return (
        <div className="flex flex-wrap items-center gap-2">
          {shown.map((u) => (
            <a
              key={u}
              href={u}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 py-0.5"
              title={u}
            >
              <span className="block h-24 w-24 shrink-0 overflow-hidden rounded-md border border-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt="asset"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.style.display = 'none';
                  }}
                  className="block h-full w-full object-cover"
                />
              </span>
              <span className="max-w-[220px] truncate text-[11px] text-black/60 group-hover:text-black">
                {u}
              </span>
            </a>
          ))}
          {extra > 0 ? <span className="text-[11px] text-black/45">+{extra}</span> : null}
        </div>
      );
    }
  }

  if (Array.isArray(value)) {
    const arr = value as unknown[];
    const allStrings = arr.every((x) => typeof x === 'string');
    if (allStrings) {
      const items = arr as string[];
      return (
        <div className="flex flex-wrap gap-1">
          {items.map((label) => {
            const css = column.toLowerCase() === 'color' ? colorToCss(label) : null;
            return (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px]"
                title={label}
              >
                {css ? (
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-black/20"
                    style={{ backgroundColor: css }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="max-w-[240px] truncate">{label}</span>
              </span>
            );
          })}
        </div>
      );
    }

    return <span className="text-xs text-black/60">[{arr.length}]</span>;
  }

  const scalar = formatScalar(value);
  if (scalar) {
    if (column.toLowerCase() === 'color') {
      const css = colorToCss(scalar);
      return (
        <span className="inline-flex items-center gap-2">
          {css ? (
            <span
              className="h-3 w-3 rounded-full border border-black/20"
              style={{ backgroundColor: css }}
              aria-hidden="true"
            />
          ) : null}
          <span>{scalar}</span>
        </span>
      );
    }
    return scalar;
  }

  if (typeof value === 'object') {
    const maybe = value as Record<string, unknown>;
    if (typeof maybe.name === 'string') return maybe.name;
    if (typeof maybe.url === 'string') return maybe.url;
    return <span className="text-xs text-black/60">Object</span>;
  }

  return String(value);
}

export default function DamPage() {
  const { data, loading, error, refresh } = useDamCache();
  const [sortKey, setSortKey] = React.useState<string>('Record ID');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [rowLimit, setRowLimit] = React.useState<20 | 50 | 'all'>(20);
  const [search, setSearch] = React.useState<string>('');

  const hiddenColumns = React.useMemo(
    () =>
      [
        'Content Calendar',
        'DataBase Modified',
        'First URL',
        'URL',
        'Linker',
        'Last Modified 2',
        'Last file name',
        'Needs Drive Update',
        'Product Code',
        'Table Name',
      ] as const,
    []
  );

  const load = refresh;

  const columns: string[] = data?.columns ?? [];
  const records: DamAirtableRecord[] = data?.records ?? [];

  const hiddenSet = React.useMemo(() => new Set<string>(hiddenColumns), [hiddenColumns]);
  const displayedColumns = React.useMemo(() => {
    const available = new Set(columns);
    const desiredOrder = [
      'Collection Code',
      'Collection Name',
      'Variant Number',
      'Lighting',
      'Home & Decor',
      'Space',
      'Customized',
      'Creative Type',
      'Scale',
      'Size',
      'Color',
      'Main Tag (Assets)',
      'Material',
      'New Arrivals',
      'Discount',
      'ID',
      'Record ID',
      'First URL',
    ] as const;

    const out: string[] = [];
    for (const key of desiredOrder) {
      if (key === 'Record ID' || key === 'First URL') {
        if (!hiddenSet.has(key)) out.push(key);
        continue;
      }
      if (hiddenSet.has(key)) continue;
      if (available.has(key)) {
        out.push(key);
        continue;
      }

      // If a desired column exists in Airtable but is empty for all returned records,
      // it may not show up in the inferred `columns` list. Still show it.
      out.push(key);
    }

    const desiredSet = new Set<string>(desiredOrder as readonly string[]);
    const extras = columns
      .filter((c) => !hiddenSet.has(c) && !desiredSet.has(c))
      .sort((a, b) => a.localeCompare(b));
    out.push(...extras);
    return out;
  }, [columns, hiddenSet]);
  const hiddenPresent = React.useMemo(
    () => hiddenColumns.filter((c) => columns.includes(c)),
    [columns, hiddenColumns]
  );

  const getSearchText = React.useCallback(
    (r: DamAirtableRecord) => {
      const parts: string[] = [];
      for (const c of displayedColumns) {
        if (c === 'Record ID') {
          parts.push(r.id);
          continue;
        }
        if (c === 'First URL') {
          const urls = extractUrls(r.fields?.['URL']);
          if (urls[0]) parts.push(urls[0]);
          continue;
        }
        const v = r.fields?.[c];
        if (v === null || v === undefined) continue;
        if (Array.isArray(v)) {
          const arr = v as unknown[];
          const allStrings = arr.every((x) => typeof x === 'string');
          if (allStrings) {
            parts.push((arr as string[]).join(' | '));
          } else {
            parts.push(String(arr.length));
          }
          continue;
        }
        const s = formatScalar(v);
        if (s) {
          parts.push(s);
          continue;
        }
        if (typeof v === 'object') {
          const obj = v as Record<string, unknown>;
          if (typeof obj.name === 'string') parts.push(obj.name);
          else if (typeof obj.url === 'string') parts.push(obj.url);
        }
      }
      return parts.join(' \n ').toLowerCase();
    },
    [displayedColumns]
  );

  const filteredRecords = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => getSearchText(r).includes(q));
  }, [getSearchText, records, search]);

  const getSortValue = React.useCallback((r: DamAirtableRecord, key: string) => {
    if (key === 'Record ID') return r.id;
    if (key === 'First URL') {
      const urls = extractUrls(r.fields?.['URL']);
      return urls[0] ?? '';
    }
    const v = r.fields?.[key];
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') return v.toLowerCase();
    if (Array.isArray(v)) {
      const arr = v as unknown[];
      const allStrings = arr.every((x) => typeof x === 'string');
      if (allStrings) return (arr as string[]).join(' | ').toLowerCase();
      return arr.length;
    }
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      if (typeof obj.name === 'string') return obj.name.toLowerCase();
    }
    return '';
  }, []);

  const sortedRecords = React.useMemo(() => {
    const base = [...filteredRecords];
    base.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);

      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return base;
  }, [filteredRecords, getSortValue, sortDir, sortKey]);

  const visibleRecords = React.useMemo(() => {
    if (rowLimit === 'all') return sortedRecords;
    return sortedRecords.slice(0, rowLimit);
  }, [rowLimit, sortedRecords]);

  const toggleSort = React.useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey]
  );

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">DAM</h1>
          <p className="mt-1 text-sm text-black/60">Live view of Airtable assets table (read-only).</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <div className="rounded-md border border-black/10 bg-white px-3 py-2 text-xs text-black/60 sm:mr-auto">
            <div>
              Records: <span className="font-semibold text-black">{data ? data.count : '—'}</span>
              <span className="text-black/30"> · </span>
              Matched: <span className="font-semibold text-black">{data ? filteredRecords.length : '—'}</span>
              <span className="text-black/30"> · </span>
              Showing: <span className="font-semibold text-black">{data ? visibleRecords.length : '—'}</span>
            </div>
            <div className="mt-1 text-[11px] text-black/35">
              Hidden: {hiddenPresent.length ? hiddenPresent.join(' • ') : '—'}
            </div>
          </div>

          <input
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm sm:w-[260px]"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-md border border-black/15 bg-white px-3 py-2 text-sm">
              <span className="text-xs text-black/60">Rows</span>
              <select
                className="bg-transparent text-sm outline-none"
                value={rowLimit}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '20') setRowLimit(20);
                  else if (v === '50') setRowLimit(50);
                  else setRowLimit('all');
                }}
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="all">Unlimited</option>
              </select>
            </label>
            <button
              className="rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
              onClick={() => void load()}
              type="button"
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="flex min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="h-full w-full overflow-auto">
          <table className="min-w-full table-auto text-left text-sm">
            <thead className="sticky top-0 z-20 bg-white text-xs uppercase tracking-wide text-black/60 shadow-sm">
              <tr>
                <th className="sticky left-0 z-30 bg-white px-4 py-3">
                  <span>Preview</span>
                </th>
                {displayedColumns.map((c) => (
                  <th key={c} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort(c)}
                      className="inline-flex items-center gap-2 hover:text-black"
                      title="Sort"
                    >
                      <span>{c}</span>
                      <span className="text-[10px] text-black/40">
                        {sortKey === c ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((r) => (
                <tr key={r.id} className="border-t border-black/10 align-top">
                  <td className="sticky left-0 z-10 bg-white px-4 py-1">
                    {(() => {
                      const urls = extractUrls(r.fields?.['URL']);
                      const u = urls[0];
                      if (!u) return null;
                      return (
                        <a href={u} target="_blank" rel="noreferrer" title={u} className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <span className="block h-24 w-24 overflow-hidden rounded-md border border-black/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={u}
                              alt="asset"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                              className="block h-full w-full object-cover"
                            />
                          </span>
                        </a>
                      );
                    })()}
                  </td>
                  {displayedColumns.map((c) => {
                    if (c === 'Record ID') {
                      return (
                        <td key={c} className="px-4 py-3 font-mono text-xs text-black/70">
                          {r.id}
                        </td>
                      );
                    }
                    if (c === 'Collection Name') {
                      return (
                        <td key={c} className="px-4 py-3 whitespace-pre-wrap text-xs font-semibold text-black/80">
                          {renderCell(c, r.fields?.[c])}
                        </td>
                      );
                    }
                    if (c === 'First URL') {
                      const urls = extractUrls(r.fields?.['URL']);
                      const u = urls[0];
                      return (
                        <td key={c} className="px-4 py-3 whitespace-pre-wrap text-xs text-black/80">
                          {u ? (
                            <a
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-black/60 hover:text-black"
                              title={u}
                            >
                              {u}
                            </a>
                          ) : null}
                        </td>
                      );
                    }
                    return (
                      <td key={c} className="px-4 py-3 whitespace-pre-wrap text-xs text-black/80">
                        {renderCell(c, r.fields?.[c])}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {visibleRecords.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-sm text-black/50" colSpan={displayedColumns.length + 2}>
                    {loading ? 'Loading…' : 'No records.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
