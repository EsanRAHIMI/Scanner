'use client';

import { useEffect } from 'react';

import { getPwaBasePath, withBasePath } from '@/lib/pwa';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // In development, do NOT register the service worker — it would intercept dev
    // requests (incl. /api/... cursor pagination) and produce noisy errors. Also
    // proactively unregister any stale SW left from a previous prod build/run.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations?.()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }

    const base = getPwaBasePath();
    const scope = base ? `${base}/` : '/';
    const swUrl = withBasePath('/sw.js');

    navigator.serviceWorker
      .register(swUrl, { scope, updateViaCache: 'none' })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[PWA] Service worker registration failed:', err);
        }
      });
  }, []);

  return null;
}
