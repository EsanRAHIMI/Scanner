'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/api';

function isPublicPath(pathname: string) {
  return pathname === '/trainer/login' || pathname === '/trainer/register';
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
          window.location.href = `/trainer/login?next=${encodeURIComponent(next)}`;
          return;
        }
        if (!res.ok) {
          window.location.href = '/trainer/login?next=/trainer';
          return;
        }
        setAllowed(true);
      } catch {
        if (!canceled) {
          window.location.href = '/trainer/login?next=/trainer';
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
