'use client';

import { useCallback, useEffect, useState } from 'react';

import type { MarketingPerformanceSnapshot } from '@/lib/marketing-performance/types';

type TrainerMe = { is_admin?: boolean; email?: string };

export function useMarketingPerformance() {
  const [me, setMe] = useState<TrainerMe | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [snapshot, setSnapshot] = useState<MarketingPerformanceSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineCount, setPipelineCount] = useState<number | null>(null);

  const isAdmin = me?.is_admin === true;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/trainer/auth/me', { cache: 'no-store' });
        if (!cancelled) {
          if (res.ok) setMe(await res.json());
          else setMe(null);
        }
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSnapshot = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/marketing-performance', { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Admin access required');
        throw new Error('Failed to load performance snapshot');
      }
      const data = await res.json();
      setSnapshot(data.snapshot ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadPipeline = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/content-calendar', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const active = items.filter((it: { fields?: Record<string, unknown> }) => {
        const s = it.fields?.Status;
        return s === 'Scheduled' || s === 'Published' || s === 'In Progress';
      });
      setPipelineCount(active.length);
    } catch {
      setPipelineCount(null);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    void loadSnapshot();
    void loadPipeline();
  }, [authReady, isAdmin, loadSnapshot, loadPipeline]);

  const saveSnapshot = useCallback(
    async (next: MarketingPerformanceSnapshot) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/marketing-performance', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ snapshot: next }),
        });
        if (!res.ok) throw new Error('Save failed');
        const data = await res.json();
        setSnapshot(data.snapshot ?? next);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return {
    authReady,
    isAdmin,
    me,
    snapshot,
    loading,
    saving,
    error,
    pipelineCount,
    reload: loadSnapshot,
    saveSnapshot,
  };
}
