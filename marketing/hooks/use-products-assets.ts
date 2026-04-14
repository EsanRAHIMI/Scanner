'use client';

import { useState, useCallback } from 'react';

interface ProductsAssetsResponse {
  columns: string[];
  records: { id: string; fields: Record<string, unknown> }[];
}

export function useProductsAssets() {
  const [data, setData] = useState<ProductsAssetsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (data || loading) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/products/assets', { cache: 'no-store' });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
      const json = JSON.parse(text);
      const columns = Array.isArray(json.columns) ? json.columns.filter((c: any): c is string => typeof c === 'string') : [];
      const records = Array.isArray(json.records) ? json.records : [];
      setData({ columns, records: records as { id: string; fields: Record<string, unknown> }[] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [data, loading]);

  return {
    data,
    loading,
    error,
    fetchAssets,
  };
}
