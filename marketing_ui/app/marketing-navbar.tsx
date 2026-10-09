'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { BrandHeader } from '@/lib/brand-header';
import { ScannerAccountMenu } from '@/lib/scanner-account-menu';

type NavItem = {
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match) return item.match(pathname);
  if (item.href === '/') return pathname === '/';
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLinkItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  const className = active ? 'nav-link-active' : 'nav-link';

  return (
    <Link href={item.href} prefetch className={className} aria-current={active ? 'page' : undefined}>
      {item.label}
    </Link>
  );
}

const NAV_HREFS = ['/', '/calendar', '/targets', '/budgets', '/connections'];

export function MarketingNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    for (const href of NAV_HREFS) router.prefetch(href);
  }, [router]);

  const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard' },
    { href: '/calendar', label: 'Calendar', match: (p) => p === '/calendar' || p.startsWith('/calendar/') },
    { href: '/targets', label: 'Targets', match: (p) => p === '/targets' || p.startsWith('/targets/') || p === '/strategy' },
    { href: '/budgets', label: 'Budgets', match: (p) => p === '/budgets' || p.startsWith('/budgets/') },
    { href: '/connections', label: 'Connections', match: (p) => p === '/connections' || p.startsWith('/connections/') },
  ];

  const accountMenu = (
    <ScannerAccountMenu
      app="marketing"
      authApiPrefix="/api/trainer"
      serviceUrlsPath="/api/service-urls"
      surface="light"
      className="shrink-0"
    />
  );

  return (
    <header className="sticky top-0 z-[200] shrink-0 border-b-2 border-brand-burgundy bg-brand-white/95 shadow-[0_4px_24px_-12px_rgba(30,30,30,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-brand-white/90">
      <div className="app-container py-2.5 sm:py-3">
        <div className="flex flex-col gap-2 lg:hidden">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <BrandHeader appName="Marketing" tagline="Chandelier platform" compact />
            {accountMenu}
          </div>
          <nav className="nav-rail" aria-label="Primary">
            {navItems.map((item) => (
              <NavLinkItem key={item.label} item={item} pathname={pathname} />
            ))}
          </nav>
        </div>

        <div className="hidden min-w-0 items-center gap-4 lg:flex lg:gap-6">
          <BrandHeader appName="Marketing" tagline="Chandelier platform" />
          <nav
            className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1"
            aria-label="Primary"
          >
            {navItems.map((item) => (
              <NavLinkItem key={item.label} item={item} pathname={pathname} />
            ))}
          </nav>
          <div className="shrink-0">{accountMenu}</div>
        </div>
      </div>
    </header>
  );
}
