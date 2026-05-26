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

async function fetcher(url: string): Promise<ProductsAssetsResponse> {
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) {
    const formatted = formatTrainerAssetsErrorMessage(text, `HTTP ${res.status}`);
    throw new Error(formatted || `Request failed (${res.status})`);
  }
  return JSON.parse(text) as ProductsAssetsResponse;
}

/** Delay (ms) before background revalidation after an optimistic update. */
const REVALIDATION_DELAY_MS = 2500;

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
  const cacheKey = `${basePath}/api/products/assets`;
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
    fetcher,
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
  const revalidationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Authoritative full snapshot (localOverride ?? swr). */
  const rawSnapshotRef = React.useRef<ProductsAssetsResponse | null>(null);
  /** Serialize optimistic updates so rapid edits (reorder, move URL) never race. */
  const mutationChainRef = React.useRef<Promise<void>>(Promise.resolve());

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
      if (revalidationTimerRef.current) {
        clearTimeout(revalidationTimerRef.current);
      }
    };
  }, []);

  const runRevalidation = React.useCallback(async () => {
    const fallback = rawSnapshotRef.current ?? localOverride;
    const freshData = await fetcher(cacheKey);

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
      revalidationTimerRef.current = setTimeout(() => {
        revalidationTimerRef.current = null;
        void runRevalidation();
      }, REVALIDATION_DELAY_MS);
    }
  }, [cacheKey, localOverride, swrMutate, bumpPendingFieldsTick, bumpPendingDeletesTick]);

  const scheduleRevalidation = React.useCallback(() => {
    if (revalidationTimerRef.current) {
      clearTimeout(revalidationTimerRef.current);
    }

    revalidationTimerRef.current = setTimeout(() => {
      revalidationTimerRef.current = null;
      void runRevalidation();
    }, REVALIDATION_DELAY_MS);
  }, [runRevalidation]);

  const loading = isLoading;
  const isStaleOfflineSnapshot = Boolean(swrError && data);

  const error =
    swrError instanceof Error ?
      swrError.message.trim() || 'Failed to load Products'
    : swrError ?
      typeof swrError === 'object' && swrError !== null && String(swrError) !== '[object Object]' ?
        String(swrError)
      : 'Failed to load Products'
    : null;

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

        if (revalidationTimerRef.current) {
          clearTimeout(revalidationTimerRef.current);
          revalidationTimerRef.current = null;
        }

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
    ],
  );

  return <ProductsCacheContext.Provider value={value}>{children}</ProductsCacheContext.Provider>;
}
