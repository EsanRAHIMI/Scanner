'use client';

import { useEffect, useState } from 'react';

import type { DashboardPayload } from '@/lib/os/types';

export function useLiveDashboard(month: string | null) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    let closed = false;
    let opened = false;
    let fallbackTried = false;
    const source = new EventSource(`/api/os/live${query}`);

    source.onopen = () => {
      opened = true;
    };
    source.onmessage = (event) => {
      if (closed) return;
      try {
        setData(JSON.parse(event.data) as DashboardPayload);
        setAuthRequired(false);
        setError(null);
      } catch {
        setError('The live feed sent an unreadable update.');
      }
    };
    source.onerror = () => {
      if (closed || opened || fallbackTried) return;
      fallbackTried = true;
      void fetch(`/api/os/dashboard${query}`, { cache: 'no-store' }).then(async (res) => {
        if (res.status === 401) {
          source.close();
          setAuthRequired(true);
          return;
        }
        if (!res.ok) {
          setError('Marketing API is not reachable.');
          return;
        }
        setData((await res.json()) as DashboardPayload);
        setAuthRequired(false);
      }).catch(() => setError('Marketing API is not reachable.'));
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [month]);

  async function refresh() {
    setSyncing(true);
    try {
      const res = await fetch('/api/os/sync', { method: 'POST' });
      if (res.status === 401) setAuthRequired(true);
      if (res.status === 403) setError('Only an admin can refresh the live sources.');
    } finally {
      setSyncing(false);
    }
  }

  async function signIn(email: string, password: string) {
    const res = await fetch('/api/trainer/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setError('Sign-in failed.');
      return;
    }
    setAuthRequired(false);
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    const dash = await fetch(`/api/os/dashboard${query}`, { cache: 'no-store' });
    if (dash.ok) setData((await dash.json()) as DashboardPayload);
  }

  return { data, authRequired, error, syncing, refresh, signIn };
}
