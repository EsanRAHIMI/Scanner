import './globals.css';

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Lorenzo Trainer',
  description: 'Admin dashboard for labeling and training',
};

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
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-black">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8">
          <header className="flex flex-col gap-3 border-b border-black/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
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
            </nav>
          </header>
          {children}
          <footer className="border-t border-black/10 pt-4 text-xs text-black/50">
            Trainer/Admin service
          </footer>
        </div>
      </body>
    </html>
  );
}
