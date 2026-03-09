'use client';

import * as React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-md px-3 py-2 text-sm text-black/70 hover:bg-black/5 hover:text-black">
      {label}
    </Link>
  );
}

export function TrainerNavbar({ scannerUrl }: { scannerUrl: string }) {
  const pathname = usePathname();
  const shouldAutoHide = pathname === '/product';

  const [collapsed, setCollapsed] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!shouldAutoHide) {
      setCollapsed(false);
      return;
    }

    setCollapsed(false);
    const t = window.setTimeout(() => setCollapsed(true), 250);
    return () => window.clearTimeout(t);
  }, [shouldAutoHide]);

  return (
    <div
      className={
        'sticky top-0 z-30 -mx-5 overflow-hidden sm:mx-0 ' +
        'transition-[max-height,transform,opacity] duration-300 ease-in-out ' +
        (collapsed ? '-translate-y-full opacity-0 max-h-0 pointer-events-none' : 'translate-y-0 opacity-100 max-h-[140px]')
      }
    >
      <header className="border-b border-black/10 bg-white/90 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:px-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs tracking-[0.35em] text-black/60">LORENZO</div>
            <div className="text-lg font-semibold">Trainer</div>
          </div>
          <nav className="flex flex-wrap gap-1">
            <NavLink href="/" label="Dashboard" />
            <NavLink href="/upload" label="Upload" />
            <NavLink href="/queue" label="Queue" />
            <NavLink href="/classes" label="Classes" />
            <NavLink href="/train" label="Train" />
            <NavLink href="/dam" label="DAM" />
            <NavLink href="/products" label="Products" />
            <a href={scannerUrl} className="rounded-md px-3 py-2 text-sm text-black/70 hover:bg-black/5 hover:text-black">
              Scanner
            </a>
          </nav>
        </div>
      </header>
    </div>
  );
}
