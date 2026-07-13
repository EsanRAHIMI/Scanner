'use client';

import type { ReactNode } from 'react';

import { AppAccountMenu } from '@/components/scanner-account-menu';

type AppShellProps = {
  children: ReactNode;
  /** Show account menu fixed top-right */
  showAccountMenu?: boolean;
  onAuthChange?: () => void;
};

/** Optional chrome wrapper with unified account menu. */
export function AppShell({ children, showAccountMenu = true, onAuthChange }: AppShellProps) {
  return (
    <>
      {showAccountMenu ? (
        <div className="pointer-events-none fixed right-4 top-4 z-[100]">
          <div className="pointer-events-auto">
            <AppAccountMenu app="frontend" surface="dark" onAuthChange={onAuthChange} />
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
