'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';

import { BrandHeader } from '@/lib/brand-header';
import { api } from '@/lib/api';
import type { Me } from '@/lib/types';

import { ProposalsNavbar } from './proposals-navbar';

const MeContext = createContext<Me | null>(null);

export function useMe(): Me | null {
  return useContext(MeContext);
}

function isEditorRoute(pathname: string): boolean {
  return /^\/proposals\/[^/]+/.test(pathname);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const isLoginPage = pathname === '/login';
  const isEditor = isEditorRoute(pathname);
  const [me, setMe] = useState<Me | null>(null);
  const [authState, setAuthState] = useState<'loading' | 'ok' | 'unauthenticated' | 'error'>(
    'loading',
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
      <div className="flex min-h-dvh items-center justify-center text-sm text-brand-dark-gray">
        Loading…
      </div>
    );
  }

  if (authState !== 'ok') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="dash-panel w-full max-w-md">
          <div className="dash-panel-body text-center">
            <div className="mb-6 flex justify-center">
              <BrandHeader appName="Proposals" tagline="Sales proposal builder" />
            </div>
            {authState === 'unauthenticated' ? (
              <>
                <p className="dash-desc mb-6">
                  Sign in with your Lorenzo platform account to continue. Proposals uses the same
                  login as the rest of the dashboard.
                </p>
                <Link
                  className="btn-primary w-full"
                  href={`/login?next=${encodeURIComponent(pathname || '/')}`}
                >
                  Sign in
                </Link>
                <p className="mt-4 text-xs text-brand-medium-gray">
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
      </div>
    );
  }

  return (
    <MeContext.Provider value={me}>
      <div
        className={
          isEditor
            ? 'flex h-dvh max-h-dvh flex-col overflow-hidden'
            : 'flex min-h-dvh flex-col'
        }
      >
        <ProposalsNavbar isAdmin={me?.is_admin} />
        <main className={`app-main flex-1 ${isEditor ? 'min-h-0 overflow-hidden' : ''}`}>
          {isEditor ? (
            <div className="app-main-editor">{children}</div>
          ) : (
            <div className="app-main-inner">{children}</div>
          )}
        </main>
      </div>
    </MeContext.Provider>
  );
}
