'use client';

import { useEffect, useState } from 'react';

import { LOCAL_APP_URLS, type AppUrls, isLocalHostname } from '@/lib/app-urls';
import { HUB_APP_URLS_PATH } from '@/lib/hub-paths';

export function useAppUrls(): AppUrls | null {
  const [urls, setUrls] = useState<AppUrls | null>(null);

  useEffect(() => {
    const host = window.location.hostname;
    if (isLocalHostname(host)) {
      setUrls(LOCAL_APP_URLS);
      return;
    }

    let cancelled = false;
    fetch(HUB_APP_URLS_PATH, { cache: 'no-store' })
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
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    setIsLocal(isLocalHostname(window.location.hostname));
  }, []);

  return isLocal;
}
