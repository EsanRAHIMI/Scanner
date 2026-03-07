import './globals.css';

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { DamCacheProvider } from './dam-cache-provider';

export const metadata: Metadata = {
  title: 'Lorenzo Trainer',
  description: 'Admin dashboard for labeling and training',
};

function getScannerUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SCANNER_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return process.env.NODE_ENV === 'production' ? '/scanner' : 'http://localhost:3003/scanner';
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-sm text-black/70 hover:bg-black/5 hover:text-black"
    >
      {label}
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const scannerUrl = getScannerUrl();

  return (
    <html lang="en">
      <body className="h-dvh overflow-hidden bg-white text-black">
        <div className="mx-auto flex h-dvh w-full max-w-none flex-col gap-6 box-border px-5 py-6">
          <header className="sticky top-0 z-30 -mx-5 border-b border-black/10 bg-white/90 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:mx-0 sm:px-0">
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
              <NavLink href={scannerUrl} label="Scanner" />
            </nav>
            </div>
          </header>
          <DamCacheProvider>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
          </DamCacheProvider>
        </div>
      </body>
    </html>
  );
}
