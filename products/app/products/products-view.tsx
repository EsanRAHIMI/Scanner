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

function renderCell(column: string, value: unknown, onImageClick?: (url: string) => void) {
  if (value === null || value === undefined) return null;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  const col = column.trim().toLowerCase();
  if (col === 'price') {
    const formatted = formatPrice(value);
    if (!formatted) return formatScalar(value);
    return (
      <span className="inline-flex items-baseline gap-1">
        <span className="inline-flex items-baseline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${basePath}/fonts/Dirham%20Currency%20Symbol%20-%20Black.svg`}
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
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onImageClick?.(u);
        }}
        title={u}
        className="block text-left"
      >
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
      </button>
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

export function ProductsView({
  title,
  titleNode,
  mobileTitleNode,
}: {
  title: string;
  titleNode?: React.ReactNode;
  mobileTitleNode?: React.ReactNode;
}) {
  const { data, loading, error } = useProductsCache();
  const [search, setSearch] = React.useState<string>('');
  const [sortKey, setSortKey] = React.useState<string>('Num');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = React.useState<'list' | 'gallery'>('list');
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [familyCollectionName, setFamilyCollectionName] = React.useState<string | null>(null);

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

  const getSearchText = React.useCallback((r: ProductsAirtableRecord, usedColumns: string[]) => {
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
  }, []);

  const filteredRecords = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => getSearchText(r, displayedColumns).includes(q));
  }, [displayedColumns, getSearchText, records, search]);

  const getSortValue = React.useCallback((r: ProductsAirtableRecord, key: string) => {
    const k = key.trim().toLowerCase();

    if (k === 'image') {
      const urls = extractUrls(r.fields?.[key]);
      return urls[0] ?? '';
    }

    const v = r.fields?.[key];
    if (v === null || v === undefined) return '';

    if (k === 'price') {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const cleaned = v.trim().replace(/,/g, '');
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : '';
      }
      return '';
    }

    if (k === 'num' || k === 'variant number') {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = Number(v.trim());
        return Number.isFinite(n) ? n : '';
      }
      return '';
    }

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
      if (typeof obj.url === 'string') return obj.url.toLowerCase();
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

  const baseGalleryItems = React.useMemo(() => {
    return sortedRecords
      .map((r) => {
        const fields = r.fields ?? {};
        const url = extractUrls(r.fields?.Image)[0] ?? '';
        const collectionName =
          formatScalar(r.fields?.['Colecction Name']) || formatScalar(r.fields?.Name) || '';
        const collectionNameNormalized = collectionName.trim();
        const title = collectionName || 'Product';
        const code = formatScalar(r.fields?.['Colecction Code']) || formatScalar(r.fields?.Code);
        const variant = formatScalar(r.fields?.['Variant Number']) || formatScalar(r.fields?.Num);
        const price = formatPrice(r.fields?.Price) ?? null;

        const dimensionKey = (() => {
          const keys = Object.keys(fields);
          const normalized = keys.map((k) => ({ k, n: k.trim().toLowerCase() }));
          const mm = normalized.find((x) => x.n.includes('dimension') && x.n.includes('mm'))?.k;
          if (mm) return mm;
          const dim = normalized.find((x) => x.n.startsWith('dimension'))?.k;
          if (dim) return dim;
          return null;
        })();

        const dimension =
          formatScalar(fields['DIMENSION (mm)']) ||
          formatScalar(fields['Dimension (mm)']) ||
          (dimensionKey ? formatScalar(fields[dimensionKey]) : '') ||
          formatScalar(fields['DIMENSION']) ||
          formatScalar(fields['DIMENSIONS']) ||
          formatScalar(fields['Dimension']) ||
          formatScalar(fields['Dimensions']);

        const noteKey = (() => {
          const keys = Object.keys(fields);
          const normalized = keys.map((k) => ({ k, n: k.trim().toLowerCase() }));
          return normalized.find((x) => x.n === 'note' || x.n.startsWith('note ' ) || x.n.includes('note'))?.k ?? null;
        })();

        const note =
          formatScalar(fields['Note']) ||
          formatScalar(fields['NOTE']) ||
          (noteKey ? formatScalar(fields[noteKey]) : '');

        return {
          id: r.id,
          url,
          title,
          collectionName,
          collectionNameNormalized,
          code,
          variant,
          dimension,
          note,
          price,
        };
      })
      .filter((x) => Boolean(x.url));
  }, [sortedRecords]);

  const galleryItems = React.useMemo(() => {
    if (!familyCollectionName) return baseGalleryItems;
    const key = familyCollectionName.trim();
    return baseGalleryItems.filter((x) => x.collectionNameNormalized === key);
  }, [baseGalleryItems, familyCollectionName]);

  const openPreviewByUrl = React.useCallback(
    (url: string) => {
      if (!url) return;
      const idx = galleryItems.findIndex((x) => x.url === url);
      const resolvedIndex = idx >= 0 ? idx : 0;
      const resolved = galleryItems[resolvedIndex];
      setPreviewIndex(resolvedIndex);
      setPreviewId(resolved?.id ?? null);
    },
    [galleryItems]
  );

  const closePreview = React.useCallback(() => {
    setPreviewIndex(null);
    setPreviewId(null);
  }, []);

  const goPrev = React.useCallback(() => {
    setPreviewIndex((i) => {
      if (i === null) return i;
      const n = galleryItems.length;
      if (n <= 1) return i;
      const nextIndex = (i - 1 + n) % n;
      const next = galleryItems[nextIndex];
      setPreviewId(next?.id ?? null);
      return nextIndex;
    });
  }, [galleryItems]);

  React.useEffect(() => {
    if (previewIndex === null) return;
    if (!previewId) return;

    const idx = galleryItems.findIndex((x) => x.id === previewId);
    if (idx >= 0) {
      if (idx !== previewIndex) setPreviewIndex(idx);
      return;
    }

    if (galleryItems.length > 0) {
      setPreviewIndex(0);
      setPreviewId(galleryItems[0].id);
    }
  }, [galleryItems, previewId, previewIndex]);

  const toggleSelected = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const getSelectedItems = React.useCallback(
    (fallbackIndex: number | null) => {
      const byId = new Map(baseGalleryItems.map((x) => [x.id, x] as const));
      const picked = [...selectedIds].map((id) => byId.get(id)).filter((x): x is (typeof galleryItems)[number] => !!x);
      if (picked.length > 0) return picked;
      if (fallbackIndex === null) return [];
      const current = galleryItems[fallbackIndex];
      return current ? [current] : [];
    },
    [baseGalleryItems, galleryItems, selectedIds]
  );

  const downloadSelected = React.useCallback(async () => {
    const items = getSelectedItems(previewIndex);
    if (items.length === 0) return;

    for (const item of items) {
      try {
        const res = await fetch(item.url, { cache: 'no-store' });
        if (!res.ok) continue;
        const blob = await res.blob();
        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const filenameBase = (item.code || item.title || 'image').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 64);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${filenameBase}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      } catch {
        // ignore
      }
    }
  }, [getSelectedItems, previewIndex]);

  const selectedCount = selectedIds.size;
  const selectedFirst = React.useMemo(() => {
    if (selectedIds.size === 0) return null;
    const firstId = selectedIds.values().next().value as string | undefined;
    if (!firstId) return null;
    return baseGalleryItems.find((x) => x.id === firstId) ?? null;
  }, [baseGalleryItems, selectedIds]);

  const currentIndex = React.useMemo(() => {
    if (previewId) {
      const idx = galleryItems.findIndex((x) => x.id === previewId);
      return idx >= 0 ? idx : null;
    }
    if (previewIndex === null) return null;
    return previewIndex;
  }, [galleryItems, previewId, previewIndex]);

  const currentItem = React.useMemo(() => {
    if (previewId) {
      const found = galleryItems.find((x) => x.id === previewId);
      if (found) return found;
    }
    if (previewIndex === null) return null;
    return galleryItems[previewIndex] ?? null;
  }, [galleryItems, previewId, previewIndex]);

  const shareSelected = React.useCallback(async () => {
    const items = getSelectedItems(previewIndex);
    if (items.length === 0) return;

    const urls = items.map((x) => x.url);

    try {
      const canNativeShare =
        typeof navigator !== 'undefined' &&
        typeof (navigator as Navigator & { share?: unknown }).share === 'function' &&
        typeof (navigator as Navigator & { canShare?: unknown }).canShare === 'function';

      if (canNativeShare) {
        const files: File[] = [];
        for (const item of items) {
          const res = await fetch(item.url, { cache: 'no-store' });
          if (!res.ok) continue;
          const blob = await res.blob();
          const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
          const filenameBase = (item.code || item.title || 'image').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 64);
          files.push(new File([blob], `${filenameBase}.${ext}`, { type: blob.type || 'image/jpeg' }));
        }

        const shareData = {
          title: items.length === 1 ? items[0].title : 'Products',
          text: items.length === 1 ? items[0].title : `Selected: ${items.length}`,
          files,
        };

        const nav = navigator as Navigator & { share: (data: unknown) => Promise<void>; canShare: (data: unknown) => boolean };
        if (files.length > 0 && nav.canShare(shareData)) {
          await nav.share(shareData);
          return;
        }
      }
    } catch {
      // fallthrough
    }

    try {
      await navigator.clipboard.writeText(urls.join('\n'));
    } catch {
      // ignore
    }
  }, [getSelectedItems, previewIndex]);

  const goNext = React.useCallback(() => {
    setPreviewIndex((i) => {
      if (i === null) return i;
      const n = galleryItems.length;
      if (n <= 1) return i;
      const nextIndex = (i + 1) % n;
      const next = galleryItems[nextIndex];
      setPreviewId(next?.id ?? null);
      return nextIndex;
    });
  }, [galleryItems]);

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

  React.useEffect(() => {
    if (previewIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePreview, goNext, goPrev, previewIndex]);

  React.useEffect(() => {
    const v = window.localStorage.getItem('products_view_mode');
    if (v === 'gallery') setViewMode('gallery');
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem('products_view_mode', viewMode);
  }, [viewMode]);

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-2 sm:gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex w-full items-center gap-2 sm:hidden">
          {mobileTitleNode ?? <h1 className="min-w-0 flex-none truncate text-lg font-semibold">{title}</h1>}
          <input
            className="h-10 w-full min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 text-base"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="hidden w-full sm:flex sm:items-center sm:justify-between">
          <div>
            {titleNode ?? <h1 className="text-2xl font-semibold">{title}</h1>}
            <p className="mt-1 text-sm text-black/60"></p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-[64px] w-[360px] flex-none flex-col overflow-x-hidden overflow-y-auto rounded-md border border-black/10 bg-white px-3 py-2 pr-4 text-xs leading-tight text-black/60">
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="flex items-baseline gap-1">
                  <span className="text-black/50">Records:</span>
                  <span className="font-semibold text-black"> {data ? data.count : '—'}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-black/50">Matched:</span>
                  <span className="font-semibold text-black"> {data ? filteredRecords.length : '—'}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-black/50">Columns:</span>
                  <span className="font-semibold text-black"> {data ? columns.length : '—'}</span>
                </div>
              </div>
              <div className="mt-1 text-justify text-[11px] text-black/35">Cached in session (no refresh)</div>
            </div>

            <input
              className="h-[64px] w-[260px] flex-none rounded-md border border-black/15 bg-white px-3 text-sm"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="flex items-center justify-end">
        <div className="inline-flex items-center rounded-full border border-black/10 bg-black/5 p-1">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            className={
              (viewMode === 'list'
                ? 'bg-white text-black shadow-sm '
                : 'bg-transparent text-black/70 hover:text-black hover:bg-white/50 ') +
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition'
            }
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M8 6h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M8 12h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M8 18h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M3.5 6h.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <path d="M3.5 12h.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <path d="M3.5 18h.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span>List</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('gallery')}
            aria-pressed={viewMode === 'gallery'}
            className={
              (viewMode === 'gallery'
                ? 'bg-white text-black shadow-sm '
                : 'bg-transparent text-black/70 hover:text-black hover:bg-white/50 ') +
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition'
            }
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <path
                d="M4.5 5.5h6.5v6.5H4.5V5.5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M13 5.5h6.5v6.5H13V5.5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M4.5 13h6.5v6.5H4.5V13Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M13 13h6.5v6.5H13V13Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            <span>Gallery</span>
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="flex min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="h-full w-full overflow-auto">
            <table className="min-w-full table-auto text-left text-sm">
              <thead className="sticky top-0 z-20 bg-white text-xs uppercase tracking-wide text-black/60 shadow-sm">
                <tr>
                  {displayedColumns.map((c, idx) => (
                    <th key={c} className={(idx === 0 ? 'sticky left-0 z-30 bg-white ' : '') + 'px-4 py-3'}>
                      <button
                        type="button"
                        onClick={() => toggleSort(c)}
                        className="inline-flex items-center gap-2 hover:text-black"
                        title="Sort"
                      >
                        <span>{c}</span>
                        {sortKey === c ? (
                          <span className="text-[10px] text-black/40">{sortDir === 'asc' ? '▲' : '▼'}</span>
                        ) : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((r) => (
                  <tr
                    key={r.id}
                    className={
                      'border-t border-black/10 align-middle ' +
                      (selectedIds.has(r.id) ? 'bg-emerald-50' : 'bg-white')
                    }
                  >
                    {displayedColumns.map((c, idx) => (
                      <td
                        key={c}
                        className={
                          (idx === 0
                            ? 'sticky left-0 z-10 ' + (selectedIds.has(r.id) ? 'bg-emerald-50 ' : 'bg-white ')
                            : '') +
                          (idx === 0
                            ? 'px-4 py-1 whitespace-pre-wrap text-xs text-black/80'
                            : 'px-4 py-3 whitespace-pre-wrap text-xs text-black/80')
                        }
                        onClick={() => {
                          if (c.trim().toLowerCase() === 'image') {
                            const u = extractUrls(r.fields?.[c])[0] ?? '';
                            if (u) openPreviewByUrl(u);
                            return;
                          }
                          toggleSelected(r.id);
                        }}
                      >
                        {renderCell(c, r.fields?.[c], openPreviewByUrl)}
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
      ) : (
        <div className="min-h-0 w-full flex-1 overflow-auto rounded-xl border border-black/10 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {sortedRecords.map((r) => {
              const img = extractUrls(r.fields?.Image)[0] ?? '';
              const name = formatScalar(r.fields?.['Colecction Name']) || formatScalar(r.fields?.Name);
              const code = formatScalar(r.fields?.['Colecction Code']) || formatScalar(r.fields?.Code);
              const variant = formatScalar(r.fields?.['Variant Number']) || formatScalar(r.fields?.Num);
              const fields = r.fields ?? {};
              const dimensionKey = (() => {
                const keys = Object.keys(fields);
                const normalized = keys.map((k) => ({ k, n: k.trim().toLowerCase() }));
                const mm = normalized.find((x) => x.n.includes('dimension') && x.n.includes('mm'))?.k;
                if (mm) return mm;
                const dim = normalized.find((x) => x.n.startsWith('dimension'))?.k;
                if (dim) return dim;
                const size = normalized.find((x) => x.n.startsWith('size'))?.k;
                if (size) return size;
                return null;
              })();

              const size =
                formatScalar(fields['DIMENSION (mm)']) ||
                formatScalar(fields['Dimension (mm)']) ||
                (dimensionKey ? formatScalar(fields[dimensionKey]) : '') ||
                formatScalar(fields['DIMENSION']) ||
                formatScalar(fields['DIMENSIONS']) ||
                formatScalar(fields['Dimension']) ||
                formatScalar(fields['Dimensions']) ||
                formatScalar(fields['SIZE']) ||
                formatScalar(fields['Size']);
              const price = formatPrice(r.fields?.Price) ?? null;

              return (
                <div key={r.id} className="overflow-hidden rounded-xl border border-black/10 bg-white">
                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => {
                      if (img) openPreviewByUrl(img);
                    }}
                    title={img || 'No image'}
                    disabled={!img}
                  >
                    <div className="aspect-square w-full bg-black/5">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt="product"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-black/40">No image</div>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    className={
                      'block w-full text-left space-y-0.5 p-2.5 ' +
                      (selectedIds.has(r.id) ? 'bg-emerald-50' : 'bg-white')
                    }
                    onClick={() => toggleSelected(r.id)}
                    title={selectedIds.has(r.id) ? 'Selected' : 'Select'}
                    aria-pressed={selectedIds.has(r.id)}
                  >
                    <div className="flex items-start justify-between gap-2 leading-snug">
                      <div className="line-clamp-2 min-w-0 text-sm font-semibold text-black">{name || '—'}</div>
                      <div className="flex-none text-sm font-semibold text-black">{price ? `AED ${price}` : ''}</div>
                    </div>
                    <div className="text-xs leading-snug text-black/60">{code ? `Code: ${code}` : ' '}</div>
                    <div className="flex items-center justify-between gap-2 text-xs leading-snug text-black/70">
                      <span className="truncate">{variant ? `Variant: ${variant}` : ''}</span>
                      <span className={selectedIds.has(r.id) ? 'text-emerald-700' : 'text-black/35'}>
                        {selectedIds.has(r.id) ? 'Selected' : ''}
                      </span>
                    </div>
                    <div className="text-xs leading-snug text-black/55">{size ? `Size: ${size}` : ' '}</div>
                  </button>
                </div>
              );
            })}
          </div>

          {records.length === 0 ? (
            <div className="px-2 py-6 text-sm text-black/50">{loading ? 'Loading…' : 'No records.'}</div>
          ) : null}
        </div>
      )}

      {selectedCount > 0 && !currentItem ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <div className="mx-auto max-w-xl transform transition-all duration-200 ease-out translate-y-0 opacity-100">
            <div className="rounded-2xl border border-white/10 bg-black/35 p-2 text-white shadow-lg backdrop-blur">
              <div className="flex items-center justify-between gap-3 px-2 pb-2">
                <div className="text-xs font-medium text-white/70">Selected: {selectedCount}</div>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs font-semibold text-white/70 hover:text-white"
                >
                  Clear
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-1 backdrop-blur">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => void downloadSelected()}
                    className="h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/10 px-2 text-[11px] font-medium tracking-wide text-white/90 hover:bg-white/10"
                  >
                    <span className="truncate">Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void shareSelected()}
                    className="h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/10 px-2 text-[11px] font-medium tracking-wide text-white/90 hover:bg-white/10"
                  >
                    <span className="truncate">Share</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (familyCollectionName) {
                        setFamilyCollectionName(null);
                        return;
                      }
                      const key = (selectedFirst?.collectionNameNormalized || '').trim();
                      if (!key) return;
                      setFamilyCollectionName(key);
                    }}
                    disabled={!familyCollectionName && !(selectedFirst?.collectionNameNormalized || '').trim()}
                    className={
                      'h-11 w-full min-w-0 rounded-xl border px-2 text-[11px] font-medium tracking-wide ' +
                      (familyCollectionName
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                        : (selectedFirst?.collectionNameNormalized || '').trim()
                          ? 'border-white/15 bg-black/10 text-white/90 hover:bg-white/10'
                          : 'border-white/10 bg-black/10 text-white/45')
                    }
                  >
                    <span className="truncate">{familyCollectionName ? 'ALL' : 'Family'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {currentItem?.url ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closePreview();
          }}
        >
          {selectedIds.has(currentItem.id) ? (
            <div
              className="fixed right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200/60 bg-emerald-500/20 text-emerald-50 shadow-lg backdrop-blur"
              onPointerDown={(e) => e.stopPropagation()}
              title="Selected"
              aria-label="Selected"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ) : null}

          <div
            className="fixed left-3 top-3 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur-md"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {(typeof currentIndex === 'number' ? currentIndex + 1 : 1)} / {galleryItems.length}
          </div>

          <div className="relative flex items-center justify-center" onPointerDown={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentItem.url}
              alt={currentItem.title}
              className="max-h-[90vh] w-auto max-w-[95vw] select-none object-contain"
              draggable={false}
              onClick={() => toggleSelected(currentItem.id)}
            />
          </div>

          {galleryItems.length > 1 ? (
            <button
              type="button"
              onClick={goPrev}
              onPointerDown={(e) => e.stopPropagation()}
              className="fixed left-0 top-0 flex h-full w-[68px] items-center justify-center bg-transparent"
              aria-label="Previous"
            >
              <span className="pointer-events-none inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-black/20 text-lg font-semibold text-white shadow-sm backdrop-blur transition">
                ‹
              </span>
            </button>
          ) : null}

          {galleryItems.length > 1 ? (
            <button
              type="button"
              onClick={goNext}
              onPointerDown={(e) => e.stopPropagation()}
              className="fixed right-0 top-0 flex h-full w-[68px] items-center justify-center bg-transparent"
              aria-label="Next"
            >
              <span className="pointer-events-none inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-black/20 text-lg font-semibold text-white shadow-sm backdrop-blur transition">
                ›
              </span>
            </button>
          ) : null}

          <div
            className="fixed bottom-0 left-0 right-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              className={
                'mx-auto max-h-[45vh] max-w-xl overflow-auto rounded-2xl border p-4 pb-28 text-white shadow-lg backdrop-blur ' +
                (selectedIds.has(currentItem.id) ? 'border-emerald-200/40 bg-emerald-900/20' : 'border-white/10 bg-black/35')
              }
              onClick={() => toggleSelected(currentItem.id)}
            >
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/10">
                <div className="grid grid-cols-5 gap-px bg-white/10">
                  <div className="min-h-10 bg-black/20 px-3 py-2 text-[11px] font-medium leading-tight text-white/70">
                    Collection Name
                  </div>
                  <div className="min-h-10 bg-black/20 px-3 py-2 text-[11px] font-medium leading-tight text-white/70">
                    Collection Code
                  </div>
                  <div className="min-h-10 bg-black/20 px-3 py-2 text-[11px] font-medium leading-tight text-white/70">
                    Variant Number
                  </div>
                  <div className="min-h-10 bg-black/20 px-3 py-2 text-[11px] font-medium leading-tight text-white/70">
                    DIMENSION (mm)
                  </div>
                  <div className="min-h-10 bg-black/20 px-3 py-2 text-[11px] font-medium leading-tight text-white/70">
                    Price
                  </div>

                  <div className="bg-black/20 px-3 py-2 text-sm font-semibold leading-tight text-white">
                    <div className="truncate">{currentItem.title}</div>
                  </div>
                  <div className="bg-black/20 px-3 py-2 text-sm font-semibold leading-tight text-white">
                    <div className="truncate">{currentItem.code || '—'}</div>
                  </div>
                  <div className="bg-black/20 px-3 py-2 text-sm font-semibold leading-tight text-white">
                    <div className="truncate">{currentItem.variant || '—'}</div>
                  </div>
                  <div className="bg-black/20 px-3 py-2 text-sm font-semibold leading-tight text-white">
                    <div className="truncate">{currentItem.dimension || '—'}</div>
                  </div>
                  <div className="bg-black/20 px-3 py-2 text-sm font-semibold leading-tight text-white">
                    <div className="truncate">
                      {currentItem.price ? `AED ${currentItem.price}` : '—'}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div
            className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mx-auto max-w-xl transform transition-all duration-200 ease-out translate-y-0 opacity-100">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-2 text-white shadow-lg backdrop-blur">
                <div className="flex items-center justify-between gap-3 px-2 pb-2">
                  <div className="text-xs font-medium text-white/70">Selected: {selectedCount}</div>
                  {selectedCount > 0 ? (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setSelectedIds(new Set())}
                      className="text-xs font-semibold text-white/70 hover:text-white"
                    >
                      Clear
                    </button>
                  ) : (
                    <div className="text-xs font-semibold text-white/35">Clear</div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-1 backdrop-blur">
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => void downloadSelected()}
                      className="h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/10 px-2 text-[11px] font-medium tracking-wide text-white/90 hover:bg-white/10"
                    >
                      <span className="truncate">Download</span>
                    </button>

                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => void shareSelected()}
                      className="h-11 w-full min-w-0 rounded-xl border border-white/15 bg-black/10 px-2 text-[11px] font-medium tracking-wide text-white/90 hover:bg-white/10"
                    >
                      <span className="truncate">Share</span>
                    </button>

                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        if (familyCollectionName) {
                          setFamilyCollectionName(null);
                          return;
                        }
                        const current =
                          (previewId ? baseGalleryItems.find((x) => x.id === previewId) : null) ??
                          currentItem;
                        const key = (current?.collectionNameNormalized || '').trim();
                        if (!key) return;
                        setFamilyCollectionName(key);
                      }}
                      disabled={!familyCollectionName && !(currentItem?.collectionNameNormalized || '').trim()}
                      className={
                        'h-11 w-full min-w-0 rounded-xl border px-2 text-[11px] font-medium tracking-wide ' +
                        (familyCollectionName
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                          : (currentItem?.collectionNameNormalized || '').trim()
                            ? 'border-white/15 bg-black/10 text-white/90 hover:bg-white/10'
                            : 'border-white/10 bg-black/10 text-white/45')
                      }
                    >
                      <span className="truncate">{familyCollectionName ? 'ALL' : 'Family'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
