'use client';

import { useEffect } from 'react';

import { getPwaBasePath, withBasePath } from '@/lib/pwa';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

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
