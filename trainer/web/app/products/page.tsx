'use client';

import * as React from 'react';

import { useProductsCache } from '../products-cache-provider';
import type { ProductsAirtableRecord } from '@/types/trainer';

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return '';
}

function extractUrls(v: unknown): string[] {
  if (typeof v === 'string') {
    const s = v.trim();
    return /^https?:\/\//i.test(s) ? [s] : [];
  }
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === 'string') {
        const s = item.trim();
        if (/^https?:\/\//i.test(s)) out.push(s);
      } else if (item && typeof item === 'object') {
        const maybe = (item as Record<string, unknown>).url;
        if (typeof maybe === 'string') {
          const s = maybe.trim();
          if (/^https?:\/\//i.test(s)) out.push(s);
        }
      }
    }
    return out;
  }
  if (v && typeof v === 'object') {
    const maybe = (v as Record<string, unknown>).url;
    if (typeof maybe === 'string') {
      const s = maybe.trim();
      return /^https?:\/\//i.test(s) ? [s] : [];
    }
  }
  return [];
}

function formatPrice(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('en-US').format(value);
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;

    const cleaned = raw.replace(/,/g, '');
    const n = Number(cleaned);
    if (Number.isFinite(n)) return new Intl.NumberFormat('en-US').format(n);
  }
  return null;
}

function renderCell(column: string, value: unknown) {
  if (value === null || value === undefined) return null;

  const col = column.trim().toLowerCase();
  if (col === 'price') {
    const formatted = formatPrice(value);
    if (!formatted) return formatScalar(value);
    return (
      <span className="inline-flex items-baseline gap-1">
        <span className="inline-flex items-baseline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/trainer/fonts/Dirham%20Currency%20Symbol%20-%20Black.svg"
            alt="AED"
            className="inline-block h-[9px] w-auto"
            onLoad={(e) => {
              const parent = e.currentTarget.parentElement;
              const fallback = parent?.querySelector('[data-dirham-fallback]') as HTMLElement | null;
              if (fallback) fallback.style.display = 'none';
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span data-dirham-fallback className="text-[11px] text-black/80">
            AED
          </span>
        </span>
        <span>{formatted}</span>
      </span>
    );
  }
  if (col === 'image') {
    const urls = extractUrls(value);
    const u = urls[0];
    if (!u) return null;
    return (
      <a href={u} target="_blank" rel="noreferrer" title={u} className="block">
        <span className="block h-24 w-24 overflow-hidden rounded-md border border-black/10 bg-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u}
            alt="product"
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
  }

  if (Array.isArray(value)) {
    const arr = value as unknown[];
    const allStrings = arr.every((x) => typeof x === 'string');
    if (allStrings) {
      const items = arr as string[];
      return (
        <div className="flex flex-wrap gap-1">
          {items.map((label) => (
            <span
              key={label}
              className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px]"
              title={label}
            >
              <span className="max-w-[240px] truncate">{label}</span>
            </span>
          ))}
        </div>
      );
    }

    return <span className="text-xs text-black/60">[{arr.length}]</span>;
  }

  const scalar = formatScalar(value);
  if (scalar) return scalar;

  if (typeof value === 'object') {
    const maybe = value as Record<string, unknown>;
    if (typeof maybe.name === 'string') return maybe.name;
    if (typeof maybe.url === 'string') return maybe.url;
    return <span className="text-xs text-black/60">Object</span>;
  }

  return String(value);
}

export default function ProductsPage() {
  const { data, loading, error } = useProductsCache();
  const [search, setSearch] = React.useState<string>('');

  const columns: string[] = data?.columns ?? [];
  const records: ProductsAirtableRecord[] = data?.records ?? [];

  const displayedColumns = React.useMemo(() => {
    const primary = ['Image', 'Price', 'Colecction Name', 'Colecction Code', 'Variant Number'] as const;
    const trailing = ['CODE NUMBER', 'L000', 'Num'] as const;
    const primarySet = new Set<string>(primary as readonly string[]);
    const trailingSet = new Set<string>(trailing as readonly string[]);

    const out: string[] = [];

    for (const key of primary) out.push(key);

    const extras = columns
      .filter((c) => !primarySet.has(c) && !trailingSet.has(c))
      .sort((a, b) => a.localeCompare(b));
    out.push(...extras);

    for (const key of trailing) {
      if (columns.includes(key)) out.push(key);
    }

    return out;
  }, [columns]);

  const getSearchText = React.useCallback(
    (r: ProductsAirtableRecord, usedColumns: string[]) => {
      const parts: string[] = [];
      for (const c of usedColumns) {
        const v = r.fields?.[c];
        if (v === null || v === undefined) continue;

        if (c.trim().toLowerCase() === 'image') {
          const urls = extractUrls(v);
          if (urls[0]) parts.push(urls[0]);
          continue;
        }

        if (Array.isArray(v)) {
          const arr = v as unknown[];
          const allStrings = arr.every((x) => typeof x === 'string');
          if (allStrings) parts.push((arr as string[]).join(' | '));
          else parts.push(String(arr.length));
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
    []
  );

  const filteredRecords = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => getSearchText(r, displayedColumns).includes(q));
  }, [getSearchText, records, search, displayedColumns]);

  const sortedRecords = React.useMemo(() => {
    const base = [...filteredRecords];
    const getNum = (r: ProductsAirtableRecord) => {
      const raw = (r.fields?.['Num'] ?? r.fields?.['Variant Number']) as unknown;
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string') {
        const n = Number(raw.trim());
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };

    base.sort((a, b) => {
      const av = getNum(a);
      const bv = getNum(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    });
    return base;
  }, [filteredRecords]);

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-black/60"></p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <div className="flex h-[64px] w-full flex-none flex-col overflow-x-hidden overflow-y-auto rounded-md border border-black/10 bg-white px-3 py-2 pr-4 text-xs leading-tight text-black/60 sm:w-[360px]">
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-black/50">Records</span>
                <span className="font-semibold text-black">{data ? data.count : '—'}</span>
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-black/50">Matched</span>
                <span className="font-semibold text-black">{data ? filteredRecords.length : '—'}</span>
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-black/50">Columns</span>
                <span className="font-semibold text-black">{data ? columns.length : '—'}</span>
              </div>
            </div>
            <div className="mt-1 text-justify text-[11px] text-black/35">Cached in session (no refresh)</div>
          </div>

          <input
            className="h-[64px] w-full rounded-md border border-black/15 bg-white px-3 text-sm sm:w-[260px]"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                {displayedColumns.map((c, idx) => (
                  <th key={c} className={(idx === 0 ? 'sticky left-0 z-30 bg-white ' : '') + 'px-4 py-3'}>
                    <span>{c}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((r) => (
                <tr key={r.id} className="border-t border-black/10 align-middle">
                  {displayedColumns.map((c, idx) => (
                    <td
                      key={c}
                      className={
                        (idx === 0 ? 'sticky left-0 z-10 bg-white ' : '') +
                        (idx === 0
                          ? 'px-4 py-1 whitespace-pre-wrap text-xs text-black/80'
                          : 'px-4 py-3 whitespace-pre-wrap text-xs text-black/80')
                      }
                    >
                      {renderCell(c, r.fields?.[c])}
                    </td>
                  ))}
                </tr>
              ))}
              {records.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-sm text-black/50" colSpan={displayedColumns.length}>
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
