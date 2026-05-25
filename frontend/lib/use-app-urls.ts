'use client';

import { useEffect, useState } from 'react';

import { LOCAL_APP_URLS, type AppUrls, isLocalHostname } from '@/lib/app-urls';

export function useAppUrls(): AppUrls | null {
  const [urls, setUrls] = useState<AppUrls | null>(null);

  useEffect(() => {
    const host = window.location.hostname;
    if (isLocalHostname(host)) {
      setUrls(LOCAL_APP_URLS);
      return;
    }

    let cancelled = false;
    fetch('/api/app-urls', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`app-urls ${res.status}`);
        return res.json() as Promise<AppUrls>;
      })
      .then((data) => {
        if (!cancelled) setUrls(data);
      })
      .catch(() => {
        if (!cancelled) setUrls(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return urls;
}

export function useIsLocalDashboard(): boolean {
  return (
    typeof window !== 'undefined' && isLocalHostname(window.location.hostname)
  );
}
