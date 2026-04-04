'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/api';

function isPublicPath(pathname: string) {
  return pathname === '/login' || pathname === '/register';
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = React.useState(false);

  React.useEffect(() => {
    const pathname = window.location.pathname;
    if (isPublicPath(pathname)) {
      setAllowed(true);
      return;
    }

    let canceled = false;
    (async () => {
      try {
        const res = await apiFetch('/auth/me');
        if (canceled) return;
        if (res.status === 401) {
          const next = `${pathname}${window.location.search ?? ''}`;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
        if (!res.ok) {
          window.location.href = '/login?next=/';
          return;
        }
        setAllowed(true);
      } catch {
        if (!canceled) {
          window.location.href = '/login?next=/';
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  if (!allowed) {
    return <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-black/60">Loading...</div>;
  }

  return <>{children}</>;
}
