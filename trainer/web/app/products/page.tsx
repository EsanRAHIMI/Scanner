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

function renderCell(column: string, value: unknown) {
  if (value === null || value === undefined) return null;

  const col = column.trim().toLowerCase();
  if (col === 'image') {
    const urls = extractUrls(value);
    const u = urls[0];
    if (!u) return null;
    return (
      <a href={u} target="_blank" rel="noreferrer" title={u} className="block">
        <span className="block h-20 w-20 overflow-hidden rounded-md border border-black/10 bg-black/5">
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

  const columns: string[] = data?.columns ?? [];
  const records: ProductsAirtableRecord[] = data?.records ?? [];

  const displayedColumns = React.useMemo(() => {
    const desiredOrder = ['Colecction Name', 'Colecction Code', 'Variant Number', 'Image'] as const;
    const available = new Set(columns);

    const out: string[] = [];
    for (const key of desiredOrder) {
      if (available.has(key)) out.push(key);
      else out.push(key);
    }

    const desiredSet = new Set<string>(desiredOrder as readonly string[]);
    const extras = columns
      .filter((c) => !desiredSet.has(c))
      .sort((a, b) => a.localeCompare(b));
    out.push(...extras);

    return out;
  }, [columns]);

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-black/60"></p>
        </div>
        <div className="flex h-[64px] w-full flex-none flex-col overflow-x-hidden overflow-y-auto rounded-md border border-black/10 bg-white px-3 py-2 pr-4 text-xs leading-tight text-black/60 sm:w-[360px]">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-black/50">Records</span>
              <span className="font-semibold text-black">{data ? data.count : '—'}</span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-black/50">Columns</span>
              <span className="font-semibold text-black">{data ? columns.length : '—'}</span>
            </div>
          </div>
          <div className="mt-1 text-justify text-[11px] text-black/35">Cached in session (no refresh)</div>
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
                {displayedColumns.map((c) => (
                  <th key={c} className="px-4 py-3">
                    <span>{c}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-black/10 align-top">
                  {displayedColumns.map((c) => (
                    <td key={c} className="px-4 py-3 whitespace-pre-wrap text-xs text-black/80">
                      {renderCell(c, r.fields?.[c])}
                    </td>
                  ))}
                </tr>
              ))}
              {records.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-sm text-black/50" colSpan={displayedColumns.length + 1}>
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
