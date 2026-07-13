'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { MarketingNavbar } from './marketing-navbar';

/** Calendar is a full-viewport tool with its own header — skip outer shell padding. */
export function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isCalendar = pathname === '/calendar' || pathname?.startsWith('/calendar/');

  if (isCalendar) {
    return <div className="flex h-dvh min-h-0 flex-col overflow-hidden">{children}</div>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNavbar />
      <main className="app-main flex-1 overflow-y-auto">
        <div className="app-main-inner">{children}</div>
      </main>
    </div>
  );
}
