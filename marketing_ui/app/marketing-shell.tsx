'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { CommandPalette, CREATE, NAV, SETUP } from '@/components/os/command-palette';
import { Icon } from '@/components/os/icons';
import { SessionGate } from '@/components/os/session';
import { cx } from '@/components/os/ui';
import { ScannerAccountMenu } from '@/lib/scanner-account-menu';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function active(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/targets' && pathname === '/strategy') return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  entry,
  pathname,
  compact,
  onNavigate,
}: {
  entry: (typeof NAV)[number];
  pathname: string;
  compact: boolean;
  onNavigate?: () => void;
}) {
  const on = active(pathname, entry.href);
  const EntryIcon = Icon[entry.icon];
  return (
    <Link
      href={entry.href}
      onClick={onNavigate}
      aria-current={on ? 'page' : undefined}
      title={compact ? entry.label : undefined}
      className={cx('os-nav', on && 'os-nav-on', compact && 'justify-center px-0')}
    >
      <EntryIcon className="h-[18px] w-[18px] shrink-0" />
      {compact ? <span className="sr-only">{entry.label}</span> : <span className="truncate">{entry.label}</span>}
    </Link>
  );
}

function NavList({ pathname, compact, onNavigate }: { pathname: string; compact: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Primary">
      {NAV.map((entry) => (
        <NavItem key={entry.href} entry={entry} pathname={pathname} compact={compact} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

function SetupNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <details className="mt-auto border-t border-black/[0.06] pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-medium-gray [&::-webkit-details-marker]:hidden">
        Setup
      </summary>
      <nav className="mt-1 flex flex-col gap-0.5" aria-label="Setup">
        {SETUP.map((entry) => (
          <NavItem key={entry.href} entry={entry} pathname={pathname} compact={false} onNavigate={onNavigate} />
        ))}
      </nav>
    </details>
  );
}

function Logo({ compact }: { compact: boolean }) {
  return (
    <Link href="/" className={cx('flex items-center gap-2.5', compact ? 'justify-center' : 'px-2')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${basePath}/Lorenzo_Logo1.png`} alt="Lorenzo" className={cx('w-auto object-contain', compact ? 'h-6 max-w-[2.5rem]' : 'h-7 max-w-[6rem]')} />
      {compact ? null : <span className="border-l border-black/10 pl-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-burgundy">Marketing</span>}
    </Link>
  );
}

function CreateMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button type="button" className="btn-primary gap-1.5 px-3 py-1.5 text-[13px]" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon.plus className="h-4 w-4" />
        <span className="hidden sm:inline">Create</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-[300] mt-2 w-48 overflow-hidden rounded-xl bg-white p-1 shadow-xl ring-1 ring-black/5">
          {CREATE.map((item) => {
            const ItemIcon = Icon[item.icon];
            return (
              <Link key={item.href} role="menuitem" href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-brand-black hover:bg-black/[0.04]">
                <ItemIcon className="h-4 w-4 text-brand-dark-gray" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  if (pathname === '/privacy' || pathname.startsWith('/privacy/')) return children;
  const isCalendar = pathname === '/calendar' || pathname.startsWith('/calendar/');
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const closePalette = useCallback(() => setPalette(false), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <SessionGate>
      <div className="print-flow flex h-dvh overflow-hidden bg-[#f4f2f0]">
        <aside className="no-print hidden w-[4.25rem] shrink-0 flex-col gap-5 border-r border-black/[0.06] bg-white px-2 py-4 md:flex xl:w-60 xl:px-3">
          <div className="xl:hidden">
            <Logo compact />
          </div>
          <div className="hidden xl:block">
            <Logo compact={false} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col xl:hidden">
            <NavList pathname={pathname} compact />
          </div>
          <div className="hidden min-h-0 flex-1 flex-col xl:flex">
            <NavList pathname={pathname} compact={false} />
            <SetupNav pathname={pathname} />
          </div>
        </aside>

        {drawer ? (
          <div className="fixed inset-0 z-[450] md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} />
            <aside className="relative flex h-full w-72 max-w-[85vw] flex-col gap-5 bg-white px-3 py-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl animate-in slide-in-from-left-8 duration-200">
              <div onClickCapture={() => setDrawer(false)}>
                <Logo compact={false} />
              </div>
              <NavList pathname={pathname} compact={false} onNavigate={() => setDrawer(false)} />
              <SetupNav pathname={pathname} onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        ) : null}

        <div className="print-flow flex min-w-0 flex-1 flex-col">
          <header className="no-print z-[200] flex h-14 shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white/85 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-5">
            <button type="button" className="-ml-1 rounded-lg p-2 text-brand-black hover:bg-black/5 md:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}>
              <Icon.menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg bg-black/[0.04] px-3 text-left text-sm text-brand-dark-gray transition hover:bg-black/[0.06] sm:max-w-md"
            >
              <Icon.search className="h-4 w-4 shrink-0" />
              <span className="truncate">Search or jump to…</span>
              <kbd className="ml-auto hidden rounded border border-black/10 bg-white px-1.5 text-[10px] font-medium sm:block">⌘K</kbd>
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <CreateMenu />
              <ScannerAccountMenu app="marketing" authApiPrefix="/api/trainer" serviceUrlsPath="/api/service-urls" surface="light" className="shrink-0" />
            </div>
          </header>

          {isCalendar ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
          ) : (
            <main className="print-flow min-h-0 flex-1 overflow-y-auto overscroll-contain" id="main">
              <div className="mx-auto w-full max-w-[88rem] px-3 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-7">{children}</div>
            </main>
          )}
        </div>
      </div>
      <CommandPalette open={palette} onClose={closePalette} />
    </SessionGate>
  );
}
