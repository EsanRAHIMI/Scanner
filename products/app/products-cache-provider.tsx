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

  // Keep each payload bounded; client aggregates pages into one snapshot for current UI logic.
  const PAGE_LIMIT = 500;
  // Hard stop to prevent infinite loops on malformed cursor responses.
  const MAX_PAGES = 200;

  const allRecords: ProductsAssetsResponse['records'] = [];
  let mergedColumns: string[] = [];
  let cursor: string | null = null;
  let pageCount = 0;

  while (pageCount < MAX_PAGES) {
    pageCount += 1;
    const reqUrl = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    reqUrl.searchParams.set('limit', String(PAGE_LIMIT));
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

    if (parsed.columns.length > 0 && mergedColumns.length === 0) {
      mergedColumns = parsed.columns;
    }
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

const swrFetcher = (url: string) => fetchProductsAssets(url);

/** Delay (ms) before background revalidation after an optimistic update. */
const REVALIDATION_DELAY_MS = 2500;
/** Cap exponential backoff when background sync keeps failing (Trainer down, offline). */
const REVALIDATION_BACKOFF_MAX_MS = 60_000;

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

  const {
    data: swrData,
    error: swrError,
    isLoading,
    mutate: swrMutate,
  } = useSWR<ProductsAssetsResponse>(
    cacheKey,
    swrFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      keepPreviousData: true,
      fallbackData: clientStorageReady ? (hydratedCache ?? undefined) : undefined,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      dedupingInterval: 2000,
    }
  );

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
    revalidationInFlightRef.current = true;

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
        scheduleRevalidationRetry('pending');
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
    scheduleRevalidationRetry('pending');
  }, [scheduleRevalidationRetry]);

  const loading = isLoading;
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
      error,
      isStaleOfflineSnapshot,
      notePendingDelete,
      clearPendingDelete,
      clearPendingDeletes,
      getRawSnapshot,
      applyCacheUpdate,
      commitOptimisticSnapshot,
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
