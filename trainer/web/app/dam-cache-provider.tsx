'use client';

import * as React from 'react';

import { apiJson } from '@/lib/api';
import type { DamAssetsResponse } from '@/types/trainer';

type DamCacheContextValue = {
  data: DamAssetsResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const DamCacheContext = React.createContext<DamCacheContextValue | null>(null);

export function useDamCache() {
  const ctx = React.useContext(DamCacheContext);
  if (!ctx) throw new Error('DamCacheContext is not available');
  return ctx;
}

export function DamCacheProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<DamAssetsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const didFetchRef = React.useRef(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<DamAssetsResponse>('/dam/assets');
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load DAM');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;
    void refresh();
  }, [refresh]);

  const value = React.useMemo<DamCacheContextValue>(
    () => ({ data, loading, error, refresh }),
    [data, error, loading, refresh]
  );

  return <DamCacheContext.Provider value={value}>{children}</DamCacheContext.Provider>;
}
