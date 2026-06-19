'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { Me } from '@/lib/types';

const MeContext = createContext<Me | null>(null);

export function useMe(): Me | null {
  return useContext(MeContext);
}

const NAV = [
  { href: '/', label: 'Proposals' },
  { href: '/new', label: 'New Proposal' },
  { href: '/templates', label: 'Templates', admin: true },
  { href: '/assets', label: 'Assets' },
  { href: '/admin', label: 'Admin', admin: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const [me, setMe] = useState<Me | null>(null);
  const [authState, setAuthState] = useState<'loading' | 'ok' | 'unauthenticated' | 'error'>(
    'loading'
  );

  useEffect(() => {
    if (isLoginPage) return;
    let cancelled = false;
    setAuthState('loading');
    api<Me>('/auth/me')
      .then((m) => {
        if (cancelled) return;
        setMe(m);
        setAuthState('ok');
      })
      .catch((e: Error & { status?: number }) => {
        if (cancelled) return;
        setAuthState(e.status === 401 || e.status === 403 ? 'unauthenticated' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [isLoginPage, pathname]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (authState !== 'ok') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="mb-2 font-serif text-2xl tracking-widest">LORENZO HOME</div>
          <h1 className="mb-3 text-lg font-semibold">Proposal Builder</h1>
          {authState === 'unauthenticated' ? (
            <>
              <p className="mb-6 text-sm text-gray-600">
                Sign in with your Lorenzo platform account to continue. Proposals uses the same
                login as the rest of the dashboard.
              </p>
              <a
                className="btn-primary w-full"
                href={`/login?next=${encodeURIComponent(pathname || '/')}`}
              >
                Sign in
              </a>
              <p className="mt-4 text-xs text-gray-400">
                Use the same email and password as the Lorenzo dashboard.
              </p>
            </>
          ) : (
            <p className="text-sm text-red-600">
              The proposals service is unreachable. Check that the API (port 8030) and MongoDB are
              running.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-serif text-lg font-semibold tracking-[0.18em]">LORENZO</span>
              <span className="text-[11px] uppercase tracking-[0.3em] text-gray-500">
                Proposals
              </span>
            </Link>
            <nav className="flex flex-1 items-center gap-1">
              {NAV.filter((n) => !n.admin || me?.is_admin).map((n) => {
                const active =
                  n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`rounded-md px-3 py-1.5 text-sm transition ${
                      active
                        ? 'bg-accent-100 font-medium text-brand-burgundy'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-gray-500 sm:inline">
                {me?.username || me?.email}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                  me?.is_admin
                    ? 'border-accent-300 bg-accent-50 text-brand-burgundy'
                    : 'border-gray-300 bg-gray-50 text-gray-600'
                }`}
              >
                {me?.is_admin ? 'admin' : me?.role}
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6">{children}</main>
      </div>
    </MeContext.Provider>
  );
}
