'use client';

import * as React from 'react';
import useSWR from 'swr';

import type { ProductsAssetsResponse } from '@/types/trainer';
import type { ProductsCacheContextValue } from './products/types/shared-types';

const ProductsCacheContext = React.createContext<ProductsCacheContextValue | null>(null);

export function useProductsCache() {
  const ctx = React.useContext(ProductsCacheContext);
  if (!ctx) throw new Error('ProductsCacheContext is not available');
  return ctx;
}

/**
 * FastAPI `/detail` payloads are plain strings, validation arrays, or nested objects —
 * flatten to one readable line without hiding the server's reason.
 */
function formatTrainerAssetsErrorMessage(rawBody: string, httpHint?: string): string {
  const raw = rawBody.trim();
  if (!raw) return httpHint || 'Request failed (empty response body).';
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown };
    const detail = parsed?.detail;
    if (typeof detail === 'string' && detail) return `${httpHint ? `${httpHint}: ` : ''}${detail}`;
    if (Array.isArray(detail)) {
      const parts = detail.map((entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        ('msg' in entry || 'type' in entry || 'loc' in entry)
          ? `${JSON.stringify(entry)}`
          : String(entry)
      );
      return `${httpHint ? `${httpHint}: ` : ''}${parts.join('; ')}`;
    }
    if (detail !== undefined && typeof detail !== 'object')
      return `${httpHint ? `${httpHint}: ` : ''}${String(detail)}`;
  } catch {
    /* not JSON — use raw snippet */
  }
  const clip = raw.length > 900 ? `${raw.slice(0, 900)}…` : raw;
  return `${httpHint ? `${httpHint}: ` : ''}${clip}`;
}

/** Typed fetch failures — network (offline / Trainer down) vs HTTP vs JSON. */
export class ProductsAssetsFetchError extends Error {
  readonly kind: 'network' | 'http' | 'parse';

  constructor(
    message: string,
    kind: 'network' | 'http' | 'parse',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProductsAssetsFetchError';
    this.kind = kind;
  }
}

function formatNetworkFetchMessage(cause: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'No network connection. Showing cached data.';
  }
  if (cause instanceof ProductsAssetsFetchError) return cause.message;
  if (cause instanceof TypeError) {
    // Browser / extension wrappers surface "Failed to fetch" for unreachable hosts.
    if (/failed to fetch|networkerror|load failed/i.test(cause.message)) {
      return (
        'Could not reach the Products API. Ensure the Trainer service is running ' +
        '(see README: Terminal 5 — Products depends on Trainer on port 8010).'
      );
    }
    return cause.message;
  }
  if (cause instanceof Error && cause.message.trim()) return cause.message.trim();
  return 'Network request failed while loading products.';
}

const DEFAULT_PRODUCT_COLUMNS = ['DAM', 'Space', 'Color', 'Material', 'Content Status'] as const;

/** Union column names from API pages and record fields so import-added columns appear in the grid. */
function mergeProductsColumnNames(
  current: string[],
  pageColumns: string[],
  records: ProductsAssetsResponse['records'],
): string[] {
  const names = new Set(current);
  for (const column of pageColumns) {
    if (column.trim()) names.add(column);
  }
  for (const record of records) {
    const fields = record.fields;
    if (!fields || typeof fields !== 'object') continue;
    for (const key of Object.keys(fields)) {
      if (key.trim()) names.add(key);
    }
  }
  for (const column of DEFAULT_PRODUCT_COLUMNS) names.add(column);
  return dedupeDimensionColumnNames(Array.from(names));
}

/** Keep one dimension column in the grid (legacy mm key; values shown as cm). */
function dedupeDimensionColumnNames(columns: string[]): string[] {
  const dimensionLike = columns.filter((column) => {
    const normalized = column.trim().toLowerCase();
    return (
      normalized.includes('dimension') ||
      normalized === 'dimensions' ||
      normalized === 'size'
    );
  });
  if (dimensionLike.length <= 1) {
    return columns.sort((a, b) => a.localeCompare(b));
  }

  const preferred =
    columns.find((column) => column.trim().toLowerCase() === 'dimension (mm)') ??
    columns.find((column) => column.trim().toLowerCase() === 'dimension (cm)') ??
    dimensionLike[0];

  const drop = new Set(dimensionLike.filter((column) => column !== preferred));
  return columns.filter((column) => !drop.has(column)).sort((a, b) => a.localeCompare(b));
}

/**
 * Deterministic business order for ALL Products list loading paths (cold first
 * page, background pages, warm cache revalidation, full refresh). Matches the
 * client's default Num sort so the visible rows never jump/reorder. Never mix
 * `created_at` pagination with `Num` ordering for the Products list.
 */
const PRODUCTS_SORT = 'num';

/** Dev-only diagnostics for the single progressive background loader. */
const PRODUCTS_BG_DEBUG = process.env.NODE_ENV !== 'production';
function bgLog(...args: unknown[]) {
  if (PRODUCTS_BG_DEBUG) console.log('[ProductsCache/bg]', ...args);
}

/** Shared GET for SWR and background revalidation — never leaves raw TypeError uncaught. */
async function fetchProductsAssets(
  url: string,
  init?: RequestInit,
): Promise<ProductsAssetsResponse> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ProductsAssetsFetchError(
      'No network connection. Showing cached data.',
      'network',
    );
  }

  // Background full refresh (post-edit reconcile only). Bounded page size — never
  // the old heavy 500; matches the progressive background page size.
  const PAGE_LIMIT = 200;
  // Hard stop to prevent infinite loops on malformed cursor responses.
  const MAX_PAGES = 500;

  const allRecords: ProductsAssetsResponse['records'] = [];
  let mergedColumns: string[] = [];
  let cursor: string | null = null;
  let pageCount = 0;

  while (pageCount < MAX_PAGES) {
    pageCount += 1;
    const reqUrl = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    reqUrl.searchParams.set('limit', String(PAGE_LIMIT));
    reqUrl.searchParams.set('sort', PRODUCTS_SORT);
    if (cursor) reqUrl.searchParams.set('cursor', cursor);

    let res: Response;
    try {
      res = await fetch(reqUrl.toString(), { cache: 'no-store', ...init });
    } catch (cause) {
      throw new ProductsAssetsFetchError(formatNetworkFetchMessage(cause), 'network');
    }

    const text = await res.text();
    if (!res.ok) {
      const formatted = formatTrainerAssetsErrorMessage(text, `HTTP ${res.status}`);
      throw new ProductsAssetsFetchError(
        formatted || `Request failed (${res.status})`,
        'http',
        res.status,
      );
    }

    let parsed: ProductsAssetsResponse;
    try {
      parsed = JSON.parse(text) as ProductsAssetsResponse;
    } catch {
      throw new ProductsAssetsFetchError('Invalid JSON from products API.', 'parse');
    }
    if (!parsed || !Array.isArray(parsed.records)) {
      throw new ProductsAssetsFetchError('Invalid products payload from server.', 'parse');
    }

    mergedColumns = mergeProductsColumnNames(mergedColumns, parsed.columns, parsed.records);
    allRecords.push(...parsed.records);

    const nextCursor = typeof parsed.next_cursor === 'string' && parsed.next_cursor.trim()
      ? parsed.next_cursor
      : null;
    const hasMore = Boolean(parsed.has_more && nextCursor);
    if (!hasMore) {
      return {
        ...parsed,
        columns: mergedColumns.length > 0 ? mergedColumns : parsed.columns,
        records: allRecords,
        count: allRecords.length,
        has_more: false,
        next_cursor: null,
      };
    }
    cursor = nextCursor;
  }

  throw new ProductsAssetsFetchError(
    'Products pagination exceeded safe page limit. Refine query or increase server page size.',
    'parse',
  );
}

/** First paint shows only the first page; further pages load ON DEMAND (scroll). */
const FIRST_PAGE_LIMIT = 40;
/** Next-page size for demand-based (scroll) loading — small, one request at a time. */
const NEXT_PAGE_LIMIT = 80;

/** Fetch a SINGLE page (first page or an on-demand next page). */
async function fetchProductsPage(
  url: string,
  opts: { limit: number; cursor?: string | null; sort?: string; signal?: AbortSignal },
): Promise<ProductsAssetsResponse> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ProductsAssetsFetchError('No network connection. Showing cached data.', 'network');
  }
  const reqUrl = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  reqUrl.searchParams.set('limit', String(opts.limit));
  if (opts.cursor) reqUrl.searchParams.set('cursor', opts.cursor);
  if (opts.sort) reqUrl.searchParams.set('sort', opts.sort);

  let res: Response;
  try {
    res = await fetch(reqUrl.toString(), { cache: 'no-store', signal: opts.signal });
  } catch (cause) {
    throw new ProductsAssetsFetchError(formatNetworkFetchMessage(cause), 'network');
  }

  const text = await res.text();
  if (!res.ok) {
    const formatted = formatTrainerAssetsErrorMessage(text, `HTTP ${res.status}`);
    throw new ProductsAssetsFetchError(formatted || `Request failed (${res.status})`, 'http', res.status);
  }

  let parsed: ProductsAssetsResponse;
  try {
    parsed = JSON.parse(text) as ProductsAssetsResponse;
  } catch {
    throw new ProductsAssetsFetchError('Invalid JSON from products API.', 'parse');
  }
  if (!parsed || !Array.isArray(parsed.records)) {
    throw new ProductsAssetsFetchError('Invalid products payload from server.', 'parse');
  }

  const nextCursor =
    typeof parsed.next_cursor === 'string' && parsed.next_cursor.trim() ? parsed.next_cursor : null;
  const hasMore = Boolean(parsed.has_more && nextCursor);
  return {
    ...parsed,
    columns: mergeProductsColumnNames([], parsed.columns, parsed.records),
    records: parsed.records,
    count: parsed.records.length,
    has_more: hasMore,
    next_cursor: hasMore ? nextCursor : null,
  };
}

/** Delay (ms) before background revalidation after an optimistic update. */
const REVALIDATION_DELAY_MS = 2500;
/** Cap exponential backoff when background sync keeps failing (Trainer down, offline). */
const REVALIDATION_BACKOFF_MAX_MS = 60_000;
/**
 * Defensive cap. Optimistic pending field/delete values normally reconcile within a few
 * revalidations (once the matching PATCH/DELETE lands server-side). If a value is recorded
 * as pending but is never persisted — e.g. a display-only normalization wrongly marked as a
 * pending edit — the 'pending' retry would otherwise reschedule `fetchProductsAssets`
 * (limit=200) forever. After this many consecutive NON-reconciling attempts we stop retrying
 * and emit a dev warning instead of looping. NOTE: this is hardening only — the real fix is
 * that such normalizations use `applyDisplayPatch` and never become pending in the first place.
 */
const MAX_PENDING_REVALIDATION_RETRIES = 8;

const PENDING_DELETES_STORAGE_KEY = 'products_pending_delete_ids_v1';

function persistPendingDeleteIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    if (ids.size === 0) {
      window.sessionStorage.removeItem(PENDING_DELETES_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(PENDING_DELETES_STORAGE_KEY, JSON.stringify([...ids]));
    }
  } catch {
    // ignore
  }
}

type PendingFieldValues = Record<string, Record<string, unknown>>;

function valuesEqual(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function hasPendingFieldValues(pending: PendingFieldValues) {
  return Object.values(pending).some(fields => Object.keys(fields).length > 0);
}

function hasAnyPending(
  pendingFields: PendingFieldValues,
  pendingDeleted: Set<string>
) {
  return hasPendingFieldValues(pendingFields) || pendingDeleted.size > 0;
}

/** Total count of unreconciled pending items — used to detect retry progress vs. a stall. */
function countPending(
  pendingFields: PendingFieldValues,
  pendingDeleted: Set<string>
) {
  let total = pendingDeleted.size;
  for (const fields of Object.values(pendingFields)) {
    total += Object.keys(fields).length;
  }
  return total;
}

function collectPendingFieldValues(
  pending: PendingFieldValues,
  previousData: ProductsAssetsResponse | null,
  nextData: ProductsAssetsResponse
) {
  const previousById = new Map(previousData?.records.map(record => [record.id, record]) ?? []);

  for (const nextRecord of nextData.records) {
    const previousRecord = previousById.get(nextRecord.id);
    if (!previousRecord) continue;

    const previousFields = previousRecord.fields ?? {};
    const nextFields = nextRecord.fields ?? {};
    const fieldNames = new Set([...Object.keys(previousFields), ...Object.keys(nextFields)]);

    for (const fieldName of fieldNames) {
      if (valuesEqual(previousFields[fieldName], nextFields[fieldName])) continue;

      pending[nextRecord.id] = {
        ...(pending[nextRecord.id] ?? {}),
        [fieldName]: nextFields[fieldName],
      };
    }
  }
}

function reconcilePendingFieldValues(pending: PendingFieldValues, freshData: ProductsAssetsResponse) {
  const freshById = new Map(freshData.records.map(record => [record.id, record]));

  for (const [recordId, fields] of Object.entries(pending)) {
    const freshFields = freshById.get(recordId)?.fields ?? {};

    for (const [fieldName, pendingValue] of Object.entries(fields)) {
      if (valuesEqual(freshFields[fieldName], pendingValue)) {
        delete fields[fieldName];
      }
    }

    if (Object.keys(fields).length === 0) {
      delete pending[recordId];
    }
  }
}

/** Drop pending-delete markers once the server no longer returns those rows. */
function reconcilePendingDeletions(pendingDeleted: Set<string>, freshData: ProductsAssetsResponse) {
  for (const id of [...pendingDeleted]) {
    const stillThere = freshData.records.some(r => r.id === id);
    if (!stillThere) {
      pendingDeleted.delete(id);
    }
  }
}

/** Clear stale sessionStorage pending-delete ids when the server still has the product. */
function clearFalsePendingDeletes(pendingDeleted: Set<string>, freshData: ProductsAssetsResponse) {
  for (const id of [...pendingDeleted]) {
    if (freshData.records.some(r => r.id === id)) {
      pendingDeleted.delete(id);
    }
  }
}

/**
 * Merge server snapshot with in-flight edits. Never drops rows unless explicitly
 * pending-deleted. Restores rows from fallback when the server list is briefly stale.
 */
function buildMergedSnapshot(
  fresh: ProductsAssetsResponse,
  pendingFields: PendingFieldValues,
  pendingDeleted: Set<string>,
  fallbackSnapshot: ProductsAssetsResponse | null,
): ProductsAssetsResponse {
  const byId = new Map(fresh.records.map(r => [r.id, r]));

  for (const [recordId, fields] of Object.entries(pendingFields)) {
    if (Object.keys(fields).length === 0) continue;
    const existing = byId.get(recordId);
    if (existing) {
      byId.set(recordId, {
        ...existing,
        fields: { ...(existing.fields ?? {}), ...fields },
      });
      continue;
    }
    const fromFallback = fallbackSnapshot?.records.find(r => r.id === recordId);
    if (fromFallback) {
      byId.set(recordId, {
        ...fromFallback,
        fields: { ...(fromFallback.fields ?? {}), ...fields },
      });
    }
  }

  const records = [...byId.values()].filter(r => !pendingDeleted.has(r.id));
  return {
    ...fresh,
    columns: fresh.columns.length > 0 ? fresh.columns : (fallbackSnapshot?.columns ?? []),
    records,
    count: records.length,
  };
}

export function ProductsCacheProvider({ children }: { children: React.ReactNode }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  /**
   * Base path must be path-only (e.g. "" or "/products").
   * Ignore accidental full URL/env noise to prevent cross-origin/mixed-content fetch failures.
   */
  const normalizedBasePath = React.useMemo(() => {
    const raw = basePath.trim();
    if (!raw) return '';
    if (
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('//')
    ) {
      return '';
    }
    const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/+$/, '');
  }, [basePath]);
  const cacheKey = `${normalizedBasePath}/api/products/assets`;
  /** Avoid reading sessionStorage before mount — prevents SSR/client HTML drift. */
  const [clientStorageReady, setClientStorageReady] = React.useState(false);
  const [hydratedCache, setHydratedCache] = React.useState<ProductsAssetsResponse | null>(null);
  const pendingFieldValuesRef = React.useRef<PendingFieldValues>({});
  const pendingDeletedIdsRef = React.useRef<Set<string>>(new Set());
  const [pendingDeletedRenderTick, setPendingDeletedRenderTick] = React.useState(0);
  const [pendingFieldsRenderTick, setPendingFieldsRenderTick] = React.useState(0);

  // True while an on-demand "load more" page request is in flight (subtle indicator).
  const [backgroundLoading, setBackgroundLoading] = React.useState(false);
  // Mutual-exclusion flag shared with the post-edit revalidation path.
  const bgRunningRef = React.useRef(false);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('products_assets_cache_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as ProductsAssetsResponse;
        if (parsed && Array.isArray(parsed.records)) {
          setHydratedCache(parsed);
        }
      }

      const pendingRaw = window.sessionStorage.getItem(PENDING_DELETES_STORAGE_KEY);
      if (pendingRaw) {
        const ids = JSON.parse(pendingRaw) as unknown;
        if (Array.isArray(ids)) {
          let added = false;
          for (const id of ids) {
            if (typeof id === 'string' && id.length > 0) {
              pendingDeletedIdsRef.current.add(id);
              added = true;
            }
          }
          if (added) setPendingDeletedRenderTick(t => t + 1);
        }
      }
    } catch {
      // Ignore invalid cached payload
    } finally {
      setClientStorageReady(true);
    }
  }, []);

  /**
   * ALWAYS fetch only the FIRST page (limit=40, sort=num) for the initial paint —
   * warm OR cold. The warm cache shows instantly via fallbackData (kept visible by
   * the no-shrink guard in `data`), and the remaining pages stream in via the SINGLE
   * throttled background loader. There is no full limit=500/200 foreground loop here.
   */
  const swrFetcherLocal = React.useCallback((url: string) => {
    return fetchProductsPage(url, { limit: FIRST_PAGE_LIMIT, sort: PRODUCTS_SORT });
  }, []);

  const {
    data: swrData,
    error: swrError,
    isLoading,
    mutate: swrMutate,
  } = useSWR<ProductsAssetsResponse>(
    // Wait until sessionStorage is read so warm/cold is known before the first fetch.
    clientStorageReady ? cacheKey : null,
    swrFetcherLocal,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      // Warm (a cached snapshot is present) → do NOT auto-refetch on mount: show the
      // cache instantly with 0 requests and no shrink. Cold → fetch the first page once.
      revalidateOnMount: clientStorageReady ? !hydratedCache : undefined,
      keepPreviousData: true,
      fallbackData: clientStorageReady ? (hydratedCache ?? undefined) : undefined,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      dedupingInterval: 2000,
    }
  );

  // ── Demand-based pagination (NO automatic background full-catalog loading) ──
  // The first page (40, sort=num) is shown immediately. Further pages are fetched
  // ONLY when the UI calls loadMore() (e.g. the user scrolls near the end). One
  // request at a time, single-flight, cursor advances from the snapshot — never a
  // loop. If the user does not scroll, no more assets requests are made.
  const loadMoreInFlightRef = React.useRef(false);
  const paginationRef = React.useRef<{ cursor: string | null; hasMore: boolean }>({
    cursor: null,
    hasMore: false,
  });

  React.useEffect(() => {
    if (!swrData) return;
    paginationRef.current = {
      cursor: typeof swrData.next_cursor === 'string' ? swrData.next_cursor : null,
      hasMore: Boolean(swrData.has_more && swrData.next_cursor),
    };
  }, [swrData]);

  const loadMore = React.useCallback(async () => {
    if (loadMoreInFlightRef.current || bgRunningRef.current) return;
    const { cursor, hasMore } = paginationRef.current;
    if (!hasMore || !cursor) return;
    loadMoreInFlightRef.current = true;
    setBackgroundLoading(true);
    bgLog(`loadMore: limit=${NEXT_PAGE_LIMIT} cursor=${cursor}`);
    try {
      const page = await fetchProductsPage(cacheKey, {
        limit: NEXT_PAGE_LIMIT,
        cursor,
        sort: PRODUCTS_SORT,
      });
      await swrMutate(
        (prev) => {
          const base = prev;
          if (!base) return page;
          return {
            ...base,
            columns: mergeProductsColumnNames(base.columns, page.columns, page.records),
            records: [...base.records, ...page.records],
            count: base.records.length + page.records.length,
            has_more: page.has_more,
            next_cursor: page.next_cursor,
          };
        },
        { revalidate: false, populateCache: true },
      );
      bgLog(`loadMore done: +${page.records.length} has_more=${page.has_more} next=${page.next_cursor}`);
    } catch (e) {
      bgLog('loadMore error', e);
    } finally {
      loadMoreInFlightRef.current = false;
      setBackgroundLoading(false);
    }
  }, [cacheKey, swrMutate]);

  const persistedCacheJsonRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!swrData) return;

    let t: ReturnType<typeof setTimeout> | null = null;
    try {
      const json = JSON.stringify(swrData);
      if (json === persistedCacheJsonRef.current) return;

      const flush = () => {
        try {
          window.sessionStorage.setItem('products_assets_cache_v1', json);
          persistedCacheJsonRef.current = json;
        } catch {
          // Ignore storage failures / quota exceeded.
        }
      };

      t = setTimeout(flush, 450);
      return () => {
        if (t) clearTimeout(t);
      };
    } catch {
      return undefined;
    }
  }, [swrData]);

  const [localOverride, setLocalOverride] = React.useState<ProductsAssetsResponse | null>(null);
  /** Background sync after optimistic edits — separate from initial SWR load error. */
  const [backgroundSyncError, setBackgroundSyncError] = React.useState<string | null>(null);
  const revalidationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const revalidationInFlightRef = React.useRef(false);
  const revalidationBackoffMsRef = React.useRef(REVALIDATION_DELAY_MS);
  const runRevalidationRef = React.useRef<(() => Promise<void>) | null>(null);
  /** Consecutive non-reconciling 'pending' revalidation attempts (caps the retry loop). */
  const pendingRevalidationRetriesRef = React.useRef(0);
  /** Pending count at the previous attempt — a drop means reconciliation is progressing. */
  const lastPendingCountRef = React.useRef(0);

  /** Authoritative full snapshot (localOverride ?? swr). */
  const rawSnapshotRef = React.useRef<ProductsAssetsResponse | null>(null);
  /** Serialize optimistic updates so rapid edits (reorder, move URL) never race. */
  const mutationChainRef = React.useRef<Promise<void>>(Promise.resolve());

  const clearRevalidationTimer = React.useCallback(() => {
    if (revalidationTimerRef.current) {
      clearTimeout(revalidationTimerRef.current);
      revalidationTimerRef.current = null;
    }
  }, []);

  const scheduleRevalidationRetry = React.useCallback((reason: 'pending' | 'backoff') => {
    clearRevalidationTimer();
    const delay =
      reason === 'pending' ?
        REVALIDATION_DELAY_MS
      : revalidationBackoffMsRef.current;
    revalidationTimerRef.current = setTimeout(() => {
      revalidationTimerRef.current = null;
      void runRevalidationRef.current?.();
    }, delay);
  }, [clearRevalidationTimer]);

  const bumpPendingFieldsTick = React.useCallback(() => {
    setPendingFieldsRenderTick((t) => t + 1);
  }, []);

  const bumpPendingDeletesTick = React.useCallback(() => {
    setPendingDeletedRenderTick((t) => t + 1);
  }, []);

  const getRawSnapshot = React.useCallback((): ProductsAssetsResponse | null => {
    return rawSnapshotRef.current ?? localOverride ?? swrData ?? null;
  }, [localOverride, swrData]);

  const rawData = localOverride ?? swrData ?? null;

  React.useEffect(() => {
    rawSnapshotRef.current = rawData;
  }, [rawData]);

  const data = React.useMemo(() => {
    if (!rawData) return null;
    // loadMore only APPENDS (never shrinks), so a plain merged snapshot is stable.
    return buildMergedSnapshot(
      rawData,
      pendingFieldValuesRef.current,
      pendingDeletedIdsRef.current,
      rawSnapshotRef.current,
    );
  }, [rawData, pendingDeletedRenderTick, pendingFieldsRenderTick]);

  React.useEffect(() => {
    if (!swrData || pendingDeletedIdsRef.current.size === 0) return;
    const before = pendingDeletedIdsRef.current.size;
    clearFalsePendingDeletes(pendingDeletedIdsRef.current, swrData);
    if (pendingDeletedIdsRef.current.size !== before) {
      persistPendingDeleteIds(pendingDeletedIdsRef.current);
      bumpPendingDeletesTick();
    }
  }, [swrData, bumpPendingDeletesTick]);

  React.useEffect(() => {
    return () => {
      clearRevalidationTimer();
    };
  }, [clearRevalidationTimer]);

  const runRevalidation = React.useCallback(async () => {
    if (revalidationInFlightRef.current) return;
    // Single-flight: never run a full revalidation while the progressive background
    // loader is active — that would create a parallel duplicate loading loop.
    if (bgRunningRef.current) {
      scheduleRevalidationRetry('pending');
      return;
    }
    revalidationInFlightRef.current = true;
    bgRunningRef.current = true; // also block the background loop from starting concurrently

    const fallback = rawSnapshotRef.current;
    const hasPendingBefore = hasAnyPending(
      pendingFieldValuesRef.current,
      pendingDeletedIdsRef.current,
    );

    try {
      const freshData = await fetchProductsAssets(cacheKey);

      setBackgroundSyncError(null);
      revalidationBackoffMsRef.current = REVALIDATION_DELAY_MS;

      reconcilePendingFieldValues(pendingFieldValuesRef.current, freshData);
      bumpPendingFieldsTick();

      const deletedSizeBefore = pendingDeletedIdsRef.current.size;
      reconcilePendingDeletions(pendingDeletedIdsRef.current, freshData);
      if (pendingDeletedIdsRef.current.size !== deletedSizeBefore) {
        persistPendingDeleteIds(pendingDeletedIdsRef.current);
        bumpPendingDeletesTick();
      }

      const hasPending = hasAnyPending(
        pendingFieldValuesRef.current,
        pendingDeletedIdsRef.current,
      );

      const nextData = buildMergedSnapshot(
        freshData,
        pendingFieldValuesRef.current,
        pendingDeletedIdsRef.current,
        fallback,
      );

      await swrMutate(nextData, {
        revalidate: false,
        populateCache: true,
      });

      rawSnapshotRef.current = nextData;
      setLocalOverride(hasPending ? nextData : null);

      if (hasPending) {
        const pendingCount = countPending(
          pendingFieldValuesRef.current,
          pendingDeletedIdsRef.current,
        );
        // Reset the cap whenever reconciliation makes real progress (fewer pending items
        // than the previous attempt). Only a fully STALLED pending set should trip the cap.
        if (pendingCount < lastPendingCountRef.current) {
          pendingRevalidationRetriesRef.current = 0;
        }
        lastPendingCountRef.current = pendingCount;
        pendingRevalidationRetriesRef.current += 1;

        if (pendingRevalidationRetriesRef.current > MAX_PENDING_REVALIDATION_RETRIES) {
          // Defensive stop: pending values are not reconciling. Keep the optimistic
          // snapshot visible (do NOT discard the user's edits) but stop scheduling further
          // revalidations so we never loop `fetchProductsAssets` (limit=200) indefinitely.
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              `[ProductsCache] ${pendingCount} pending field/delete value(s) did not reconcile ` +
                `after ${MAX_PENDING_REVALIDATION_RETRIES} revalidation attempts — stopping ` +
                `retries to avoid an infinite /products/assets loop. This usually means a value ` +
                `was recorded as a pending edit but never persisted server-side (such ` +
                `normalizations should use applyDisplayPatch).`,
              {
                pendingFields: pendingFieldValuesRef.current,
                pendingDeletes: Array.from(pendingDeletedIdsRef.current),
              },
            );
          }
          // Counter stays above the cap, so retries remain stopped until either the pending
          // set clears (reset below) or a fresh user edit / reconnect resets the counter.
        } else {
          scheduleRevalidationRetry('pending');
        }
      } else {
        pendingRevalidationRetriesRef.current = 0;
        lastPendingCountRef.current = 0;
      }
    } catch (cause) {
      const message = formatNetworkFetchMessage(cause);
      setBackgroundSyncError(message);

      if (process.env.NODE_ENV === 'development') {
        console.warn('[ProductsCache] background revalidation failed:', cause);
      }

      const shouldRetry =
        hasPendingBefore ||
        hasAnyPending(pendingFieldValuesRef.current, pendingDeletedIdsRef.current) ||
        localOverride !== null;

      if (shouldRetry) {
        revalidationBackoffMsRef.current = Math.min(
          Math.max(revalidationBackoffMsRef.current, REVALIDATION_DELAY_MS) * 2,
          REVALIDATION_BACKOFF_MAX_MS,
        );
        scheduleRevalidationRetry('backoff');
      }
    } finally {
      revalidationInFlightRef.current = false;
      bgRunningRef.current = false;
    }
  }, [
    cacheKey,
    localOverride,
    swrMutate,
    bumpPendingFieldsTick,
    bumpPendingDeletesTick,
    scheduleRevalidationRetry,
  ]);

  runRevalidationRef.current = runRevalidation;

  React.useEffect(() => {
    const onOnline = () => {
      revalidationBackoffMsRef.current = REVALIDATION_DELAY_MS;
      // Reconnecting may let previously-stalled pending values finally reconcile.
      pendingRevalidationRetriesRef.current = 0;
      lastPendingCountRef.current = 0;
      const needsSync =
        localOverride !== null ||
        hasAnyPending(pendingFieldValuesRef.current, pendingDeletedIdsRef.current) ||
        backgroundSyncError !== null;
      if (needsSync) {
        clearRevalidationTimer();
        void runRevalidationRef.current?.();
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [localOverride, backgroundSyncError, clearRevalidationTimer]);

  const scheduleRevalidation = React.useCallback(() => {
    revalidationBackoffMsRef.current = REVALIDATION_DELAY_MS;
    // A fresh user edit is new pending state — allow the retry loop again even if a
    // previous (now-cleared) stall had tripped the cap.
    pendingRevalidationRetriesRef.current = 0;
    lastPendingCountRef.current = 0;
    scheduleRevalidationRetry('pending');
  }, [scheduleRevalidationRetry]);

  // Skeleton shows until sessionStorage is read and the FIRST page resolves — not
  // until the whole catalog is loaded (that streams in via backgroundLoading).
  const loading = isLoading || !clientStorageReady;
  const syncErrorMessage = backgroundSyncError?.trim() || null;
  const loadErrorMessage =
    swrError instanceof Error ?
      swrError.message.trim() || 'Failed to load Products'
    : swrError ?
      typeof swrError === 'object' && swrError !== null && String(swrError) !== '[object Object]' ?
        String(swrError)
      : 'Failed to load Products'
    : null;

  const isStaleOfflineSnapshot = Boolean((swrError || syncErrorMessage) && data);

  const error = loadErrorMessage ?? syncErrorMessage;

  const notePendingDelete = React.useCallback((recordId: string) => {
    if (pendingDeletedIdsRef.current.has(recordId)) return;
    pendingDeletedIdsRef.current.add(recordId);
    delete pendingFieldValuesRef.current[recordId];
    persistPendingDeleteIds(pendingDeletedIdsRef.current);
    bumpPendingDeletesTick();
  }, [bumpPendingDeletesTick]);

  const clearPendingDelete = React.useCallback((recordId: string) => {
    if (!pendingDeletedIdsRef.current.has(recordId)) return;
    pendingDeletedIdsRef.current.delete(recordId);
    persistPendingDeleteIds(pendingDeletedIdsRef.current);
    bumpPendingDeletesTick();
  }, [bumpPendingDeletesTick]);

  const clearPendingDeletes = React.useCallback((recordIds: Iterable<string>) => {
    let changed = false;
    for (const id of recordIds) {
      if (pendingDeletedIdsRef.current.delete(id)) changed = true;
    }
    if (!changed) return;
    persistPendingDeleteIds(pendingDeletedIdsRef.current);
    bumpPendingDeletesTick();
  }, [bumpPendingDeletesTick]);

  const commitOptimisticSnapshot = React.useCallback(
    async (optimisticData: ProductsAssetsResponse) => {
      const run = async () => {
        const previousSnapshot = rawSnapshotRef.current ?? getRawSnapshot();

        collectPendingFieldValues(
          pendingFieldValuesRef.current,
          previousSnapshot,
          optimisticData,
        );
        bumpPendingFieldsTick();

        rawSnapshotRef.current = optimisticData;
        setLocalOverride(optimisticData);

        await swrMutate(optimisticData, {
          revalidate: false,
          populateCache: true,
        });

        scheduleRevalidation();
      };

      const chained = mutationChainRef.current.then(run);
      mutationChainRef.current = chained.catch(() => {});
      await chained;
    },
    [getRawSnapshot, scheduleRevalidation, swrMutate, bumpPendingFieldsTick],
  );

  const applyCacheUpdate = React.useCallback(
    async (
      updater: (prev: ProductsAssetsResponse) => ProductsAssetsResponse,
    ): Promise<ProductsAssetsResponse | null> => {
      const prev = getRawSnapshot();
      if (!prev) return null;
      const next = updater(prev);
      await commitOptimisticSnapshot(next);
      return next;
    },
    [commitOptimisticSnapshot, getRawSnapshot],
  );

  const value = React.useMemo<ProductsCacheContextValue>(
    () => ({
      data,
      loading,
      backgroundLoading,
      hasMore: Boolean(swrData?.has_more && swrData?.next_cursor),
      loadMore,
      error,
      isStaleOfflineSnapshot,
      notePendingDelete,
      clearPendingDelete,
      clearPendingDeletes,
      getRawSnapshot,
      applyCacheUpdate,
      commitOptimisticSnapshot,
      // Display-only cache write: updates the visible snapshot WITHOUT recording
      // pending field values or scheduling revalidation. Used for client-side
      // normalizations (e.g. the Main flag) that must never hit the server or
      // trigger a background reconcile loop.
      applyDisplayPatch: async (
        updater: (prev: ProductsAssetsResponse) => ProductsAssetsResponse,
      ): Promise<void> => {
        const prev = getRawSnapshot();
        if (!prev) return;
        const next = updater(prev);
        if (!next) return;
        rawSnapshotRef.current = next;
        await swrMutate(next, { revalidate: false, populateCache: true });
      },
      setData: (updater) => {
        const prev = getRawSnapshot();
        if (!prev) return;
        const next =
          typeof updater === 'function' ?
            updater(prev)
          : updater;
        if (!next) return;
        void commitOptimisticSnapshot(next);
      },
      mutate: async (optimisticData?: ProductsAssetsResponse) => {
        if (optimisticData) {
          await commitOptimisticSnapshot(optimisticData);
          return;
        }

        pendingFieldValuesRef.current = {};
        bumpPendingFieldsTick();
        pendingDeletedIdsRef.current.clear();
        persistPendingDeleteIds(pendingDeletedIdsRef.current);
        bumpPendingDeletesTick();

        clearRevalidationTimer();
        setBackgroundSyncError(null);
        revalidationBackoffMsRef.current = REVALIDATION_DELAY_MS;

        // Allow a fresh first-page load (demand-based pagination restarts from page 1).
        loadMoreInFlightRef.current = false;

        const freshData = await swrMutate();
        rawSnapshotRef.current = freshData ?? null;
        setLocalOverride(null);
      },
    }),
    [
      data,
      error,
      isStaleOfflineSnapshot,
      loading,
      backgroundLoading,
      swrData,
      loadMore,
      notePendingDelete,
      clearPendingDelete,
      clearPendingDeletes,
      getRawSnapshot,
      applyCacheUpdate,
      commitOptimisticSnapshot,
      swrMutate,
      bumpPendingFieldsTick,
      bumpPendingDeletesTick,
      clearRevalidationTimer,
    ],
  );

  return <ProductsCacheContext.Provider value={value}>{children}</ProductsCacheContext.Provider>;
}
