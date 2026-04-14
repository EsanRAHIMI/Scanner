'use client';

import { useState, useCallback, useEffect } from 'react';
import { ContentItem, ContentCalendarListResponse } from '../lib/calendar/types';
import { useToast } from '../components/ui/toast-provider';

export function useCalendarData() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const { error: toastError } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/content-calendar', { cache: 'no-store' });
      
      if (response.status === 401) {
        setAuthRequired(true);
        return;
      }
      
      if (!response.ok) throw new Error(`Request failed (${response.status})`);

      const data = await response.json() as ContentCalendarListResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
      setAuthRequired(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load calendar data';
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    items,
    setItems,
    loading,
    error,
    authRequired,
    setAuthRequired,
    refresh: fetchData,
  };
}
