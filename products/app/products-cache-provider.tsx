'use client';

import * as React from 'react';
import useSWR from 'swr';

import type { ProductsAssetsResponse } from '@/types/trainer';

type ProductsCacheContextValue = {
  data: ProductsAssetsResponse | null;
  loading: boolean;
  error: string | null;
  setData: React.Dispatch<React.SetStateAction<ProductsAssetsResponse | null>>;
};

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

export function ProductsCacheProvider({ children }: { children: React.ReactNode }) {
  // SWR provides: automatic deduplication, stale-while-revalidate, keepPreviousData
  // — so switching tabs or remounting won't trigger a new full fetch.
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const {
    data: swrData,
    error: swrError,
    isLoading,
  } = useSWR<ProductsAssetsResponse>(
    `${basePath}/api/products/assets`,
    fetcher,
    {
      revalidateOnFocus: false,       // Don't hammer backend when tab regains focus
      revalidateOnReconnect: true,    // Revalidate after network comes back
      dedupingInterval: 60_000,       // 60s dedup — only one in-flight request per minute
      keepPreviousData: true,         // Show old data instantly while fetching new
      shouldRetryOnError: true,
      errorRetryCount: 3,
    }
  );

  // Allow optimistic mutations via setData (same API as before)
  const [localOverride, setLocalOverride] = React.useState<ProductsAssetsResponse | null>(null);

  // When SWR gets fresh data, clear any local override so the canonical data wins
  React.useEffect(() => {
    if (swrData) setLocalOverride(null);
  }, [swrData]);

  const data = localOverride ?? swrData ?? null;
  const loading = isLoading;
  const error = swrError ? (swrError instanceof Error ? swrError.message : 'Failed to load Products') : null;

  const value = React.useMemo<ProductsCacheContextValue>(
    () => ({ data, loading, error, setData: setLocalOverride }),
    [data, error, loading]
  );

  return <ProductsCacheContext.Provider value={value}>{children}</ProductsCacheContext.Provider>;
}
