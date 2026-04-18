'use client';

import * as React from 'react';
import useSWR from 'swr';

import type { ProductsAssetsResponse } from '@/types/trainer';

type ProductsCacheContextValue = {
  data: ProductsAssetsResponse | null;
  loading: boolean;
  error: string | null;
  setData: React.Dispatch<React.SetStateAction<ProductsAssetsResponse | null>>;
  mutate: () => Promise<void>;
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
    mutate: swrMutate,
  } = useSWR<ProductsAssetsResponse>(
    `${basePath}/api/products/assets`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      keepPreviousData: true,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      dedupingInterval: 0,
    }
  );

  const [localOverride, setLocalOverride] = React.useState<ProductsAssetsResponse | null>(null);

  const data = localOverride ?? swrData ?? null;
  const loading = isLoading;
  const error = swrError ? (swrError instanceof Error ? swrError.message : 'Failed to load Products') : null;

  const value = React.useMemo<ProductsCacheContextValue>(
    () => ({ 
      data, 
      loading, 
      error, 
      setData: (updater: any) => {
        setLocalOverride(prev => {
          const base = prev ?? swrData;
          const next = typeof updater === 'function' ? updater(base) : updater;
          return next;
        });
      },
      mutate: async (optimisticData?: ProductsAssetsResponse) => {
        if (optimisticData) {
          // Use SWR's native optimistic update
          await swrMutate(optimisticData, {
            revalidate: true,
            populateCache: true,
            rollbackOnError: true,
          });
          setLocalOverride(null);
        } else {
          await swrMutate();
          setLocalOverride(null);
        }
      }
    }),
    [data, error, loading, swrMutate, swrData]
  );

  return <ProductsCacheContext.Provider value={value}>{children}</ProductsCacheContext.Provider>;
}
