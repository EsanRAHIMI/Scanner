'use client';

import * as React from 'react';

import type { ProductsAssetsResponse } from '@/types/trainer';

type ProductsCacheContextValue = {
  data: ProductsAssetsResponse | null;
  loading: boolean;
  error: string | null;
};

const ProductsCacheContext = React.createContext<ProductsCacheContextValue | null>(null);

export function useProductsCache() {
  const ctx = React.useContext(ProductsCacheContext);
  if (!ctx) throw new Error('ProductsCacheContext is not available');
  return ctx;
}

export function ProductsCacheProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<ProductsAssetsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const didFetchRef = React.useRef(false);

  React.useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
        const res = await fetch(`${basePath}/api/products/assets`, { cache: 'no-store' });
        const text = await res.text();
        if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
        const json = JSON.parse(text) as ProductsAssetsResponse;
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load Products');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = React.useMemo<ProductsCacheContextValue>(() => ({ data, loading, error }), [data, error, loading]);

  return <ProductsCacheContext.Provider value={value}>{children}</ProductsCacheContext.Provider>;
}
