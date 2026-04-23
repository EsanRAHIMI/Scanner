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

export function ProductsCacheProvider({ children }: { children: React.ReactNode }) {
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
      dedupingInterval: 2000, // SWR default — prevents redundant requests on fast re-renders
    }
  );

  const [localOverride, setLocalOverride] = React.useState<ProductsAssetsResponse | null>(null);
  const revalidationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup the revalidation timer on unmount
  React.useEffect(() => {
    return () => {
      if (revalidationTimerRef.current) {
        clearTimeout(revalidationTimerRef.current);
      }
    };
  }, []);

  const data = localOverride ?? swrData ?? null;
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
          // 1. Update SWR cache immediately without revalidation
          await swrMutate(optimisticData, {
            revalidate: false,
            populateCache: true,
          });
          // 2. Clear local state override
          setLocalOverride(null);
          
          // 3. Cancel any pending revalidation and schedule a new one
          if (revalidationTimerRef.current) {
            clearTimeout(revalidationTimerRef.current);
          }
          revalidationTimerRef.current = setTimeout(() => {
            swrMutate();
            revalidationTimerRef.current = null;
          }, REVALIDATION_DELAY_MS);
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
