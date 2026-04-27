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

async function fetcher(url: string): Promise<ProductsAssetsResponse> {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
  return JSON.parse(text) as ProductsAssetsResponse;
}

/** Delay (ms) before background revalidation after an optimistic update. */
const REVALIDATION_DELAY_MS = 2500;

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

  React.useEffect(() => {
    if (!swrData) return;
    try {
      window.sessionStorage.setItem('products_assets_cache_v1', JSON.stringify(swrData));
    } catch {
      // Ignore storage failures.
    }
  }, [swrData]);

  const [localOverride, setLocalOverride] = React.useState<ProductsAssetsResponse | null>(null);
  const revalidationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFieldValuesRef = React.useRef<PendingFieldValues>({});

  const data = localOverride ?? swrData ?? null;
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

    const hasPending = hasPendingFieldValues(pendingFieldValuesRef.current);
    const nextData = hasPending
      ? applyPendingFieldValues(freshData, pendingFieldValuesRef.current)
      : freshData;

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
  const error = swrError ? (swrError instanceof Error ? swrError.message : 'Failed to load Products') : null;

  const value = React.useMemo<ProductsCacheContextValue>(
    () => ({ 
      data, 
      loading, 
      error, 
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
    [data, error, loading, scheduleRevalidation, swrMutate, swrData]
  );

  return <ProductsCacheContext.Provider value={value}>{children}</ProductsCacheContext.Provider>;
}
