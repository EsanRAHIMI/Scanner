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
  const res = await fetch(url);
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

function collectPendingDeletions(
  pendingDeleted: Set<string>,
  pendingFields: PendingFieldValues,
  previousData: ProductsAssetsResponse | null,
  nextData: ProductsAssetsResponse
) {
  const nextIds = new Set(nextData.records.map(r => r.id));
  for (const r of previousData?.records ?? []) {
    if (!nextIds.has(r.id)) {
      pendingDeleted.add(r.id);
      delete pendingFields[r.id];
    }
  }
  // Rollback (e.g. failed DELETE): record is present again in the next optimistic snapshot.
  for (const id of [...pendingDeleted]) {
    if (nextIds.has(id)) {
      pendingDeleted.delete(id);
    }
  }
}

function reconcilePendingDeletions(pendingDeleted: Set<string>, freshData: ProductsAssetsResponse) {
  for (const id of [...pendingDeleted]) {
    const stillThere = freshData.records.some(r => r.id === id);
    if (!stillThere) {
      pendingDeleted.delete(id);
    }
  }
}

function applyPendingDeletes(
  data: ProductsAssetsResponse,
  pendingDeleted: Set<string>
): ProductsAssetsResponse {
  if (pendingDeleted.size === 0) return data;
  const records = data.records.filter(r => !pendingDeleted.has(r.id));
  return {
    ...data,
    records,
    count: records.length,
  };
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

function applyPendingFieldValues(
  data: ProductsAssetsResponse,
  pending: PendingFieldValues
): ProductsAssetsResponse {
  if (!hasPendingFieldValues(pending)) return data;

  return {
    ...data,
    records: data.records.map(record => {
      const pendingFields = pending[record.id];
      if (!pendingFields || Object.keys(pendingFields).length === 0) return record;

      return {
        ...record,
        fields: {
          ...(record.fields ?? {}),
          ...pendingFields,
        },
      };
    }),
  };
}

export function ProductsCacheProvider({ children }: { children: React.ReactNode }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const cacheKey = `${basePath}/api/products/assets`;
  const [hydratedCache, setHydratedCache] = React.useState<ProductsAssetsResponse | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('products_assets_cache_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw) as ProductsAssetsResponse;
      if (parsed && Array.isArray(parsed.records)) {
        setHydratedCache(parsed);
      }
    } catch {
      // Ignore invalid cached payload
    }
  }, []);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(PENDING_DELETES_STORAGE_KEY);
      if (!raw) return;
      const ids = JSON.parse(raw) as unknown;
      if (!Array.isArray(ids)) return;
      let added = false;
      for (const id of ids) {
        if (typeof id === 'string' && id.length > 0) {
          pendingDeletedIdsRef.current.add(id);
          added = true;
        }
      }
      if (added) setPendingDeletedRenderTick(t => t + 1);
    } catch {
      // ignore
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
      fallbackData: hydratedCache ?? undefined,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      dedupingInterval: 2000, // SWR default — prevents redundant requests on fast re-renders
    }
  );

  const persistedCacheJsonRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!swrData) return;

    let t: ReturnType<typeof setTimeout> | null = null;
    try {
      const json = JSON.stringify(swrData);
      if (json === persistedCacheJsonRef.current) return;

      /** Debounced write: large payloads on every mutate were blocking the main thread. */
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
      // Ignore serialization failures on odd proxy objects.
      return undefined;
    }
  }, [swrData]);

  const [localOverride, setLocalOverride] = React.useState<ProductsAssetsResponse | null>(null);
  const revalidationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFieldValuesRef = React.useRef<PendingFieldValues>({});
  const pendingDeletedIdsRef = React.useRef<Set<string>>(new Set());
  const [pendingDeletedRenderTick, setPendingDeletedRenderTick] = React.useState(0);

  const rawData = localOverride ?? swrData ?? null;
  const data = React.useMemo(() => {
    if (!rawData) return null;
    if (pendingDeletedIdsRef.current.size === 0) return rawData;
    return applyPendingDeletes(rawData, pendingDeletedIdsRef.current);
  }, [rawData, pendingDeletedRenderTick]);

  const dataRef = React.useRef<ProductsAssetsResponse | null>(data);

  React.useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Cleanup the revalidation timer on unmount
  React.useEffect(() => {
    return () => {
      if (revalidationTimerRef.current) {
        clearTimeout(revalidationTimerRef.current);
      }
    };
  }, []);

  const runRevalidation = React.useCallback(async () => {
    const freshData = await fetcher(cacheKey);
    reconcilePendingFieldValues(pendingFieldValuesRef.current, freshData);
    const deletedSizeBefore = pendingDeletedIdsRef.current.size;
    reconcilePendingDeletions(pendingDeletedIdsRef.current, freshData);
    if (pendingDeletedIdsRef.current.size !== deletedSizeBefore) {
      persistPendingDeleteIds(pendingDeletedIdsRef.current);
      setPendingDeletedRenderTick(t => t + 1);
    }

    const hasPending = hasAnyPending(
      pendingFieldValuesRef.current,
      pendingDeletedIdsRef.current
    );
    let nextData = freshData;
    if (hasPendingFieldValues(pendingFieldValuesRef.current)) {
      nextData = applyPendingFieldValues(nextData, pendingFieldValuesRef.current);
    }
    if (pendingDeletedIdsRef.current.size > 0) {
      nextData = applyPendingDeletes(nextData, pendingDeletedIdsRef.current);
    }

    await swrMutate(nextData, {
      revalidate: false,
      populateCache: true,
    });
    dataRef.current = nextData;
    setLocalOverride(hasPending ? nextData : null);

    if (hasPending) {
      revalidationTimerRef.current = setTimeout(() => {
        revalidationTimerRef.current = null;
        void runRevalidation();
      }, REVALIDATION_DELAY_MS);
    }
  }, [cacheKey, swrMutate]);

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
      (swrError.message.trim() || 'Failed to load Products')
    : swrError ?
      (typeof swrError === 'object' && swrError !== null && String(swrError) !== '[object Object]' ?
        String(swrError)
      : 'Failed to load Products')
    : null;

  const notePendingDelete = React.useCallback((recordId: string) => {
    if (pendingDeletedIdsRef.current.has(recordId)) return;
    pendingDeletedIdsRef.current.add(recordId);
    delete pendingFieldValuesRef.current[recordId];
    persistPendingDeleteIds(pendingDeletedIdsRef.current);
    setPendingDeletedRenderTick(t => t + 1);
  }, []);

  const value = React.useMemo<ProductsCacheContextValue>(
    () => ({ 
      data, 
      loading, 
      error, 
      isStaleOfflineSnapshot,
      notePendingDelete,
      setData: (updater) => {
        setLocalOverride(prev => {
          const base = prev ?? swrData ?? null;
          const next = typeof updater === 'function' ? updater(base) : updater;
          return next;
        });
      },
      mutate: async (optimisticData?: ProductsAssetsResponse) => {
        if (optimisticData) {
          collectPendingFieldValues(pendingFieldValuesRef.current, dataRef.current, optimisticData);
          const deletedBeforeCollect = pendingDeletedIdsRef.current.size;
          collectPendingDeletions(
            pendingDeletedIdsRef.current,
            pendingFieldValuesRef.current,
            dataRef.current,
            optimisticData
          );
          if (pendingDeletedIdsRef.current.size !== deletedBeforeCollect) {
            persistPendingDeleteIds(pendingDeletedIdsRef.current);
            setPendingDeletedRenderTick(t => t + 1);
          }
          dataRef.current = optimisticData;

          // Keep a stable local source of truth during rapid edits to avoid
          // falling back to stale swrData between back-to-back mutations.
          setLocalOverride(optimisticData);

          // 1. Update SWR cache immediately without revalidation
          await swrMutate(optimisticData, {
            revalidate: false,
            populateCache: true,
          });
          
          // 2. Sync in the background, but preserve pending edits if the
          // public list briefly returns stale data after a successful PATCH.
          scheduleRevalidation();
        } else {
          pendingFieldValuesRef.current = {};
          pendingDeletedIdsRef.current.clear();
          persistPendingDeleteIds(pendingDeletedIdsRef.current);
          setPendingDeletedRenderTick(t => t + 1);
          if (revalidationTimerRef.current) {
            clearTimeout(revalidationTimerRef.current);
            revalidationTimerRef.current = null;
          }
          const freshData = await swrMutate();
          dataRef.current = freshData ?? null;
          setLocalOverride(null);
        }
      }
    }),
    [data, error, isStaleOfflineSnapshot, loading, notePendingDelete, scheduleRevalidation, swrMutate, swrData]
  );

  return <ProductsCacheContext.Provider value={value}>{children}</ProductsCacheContext.Provider>;
}
