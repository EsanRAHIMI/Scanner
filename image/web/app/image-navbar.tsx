'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BrandHeader } from '@/lib/brand-header';
import { getServiceUrlsPath, getTrainerAuthApiPrefix } from '@/lib/env';
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
  return (
    <Link href={item.href} className={active ? 'nav-link-active' : 'nav-link'} aria-current={active ? 'page' : undefined}>
      {item.label}
    </Link>
  );
}

export function ImageNavbar() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { href: '/', label: 'Import' },
    { href: '/outputs', label: 'Outputs' },
    { href: '/settings', label: 'Settings' },
  ];

  const accountMenu = (
    <ScannerAccountMenu
      app="image"
      authApiPrefix={getTrainerAuthApiPrefix()}
      serviceUrlsPath={getServiceUrlsPath()}
      surface="light"
      className="shrink-0"
    />
  );

  return (
    <header className="sticky top-0 z-[200] shrink-0 border-b-2 border-brand-burgundy bg-brand-white/95 shadow-[0_4px_24px_-12px_rgba(30,30,30,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-brand-white/90">
      <div className="app-container py-2.5 sm:py-3">
        <div className="flex min-h-[5.25rem] flex-col justify-center gap-2 lg:hidden">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <BrandHeader appName="Image" tagline="Chandelier platform" compact />
            {accountMenu}
          </div>
          <nav className="nav-rail" aria-label="Primary">
            {navItems.map((item) => (
              <NavLinkItem key={item.label} item={item} pathname={pathname} />
            ))}
          </nav>
        </div>

        <div className="hidden min-h-[4.25rem] min-w-0 items-center gap-4 lg:flex lg:gap-6">
          <BrandHeader appName="Image" tagline="Chandelier platform" />
          <nav className="flex min-w-0 flex-1 justify-center" aria-label="Primary">
            <div className="grid grid-cols-3 gap-1">
              {navItems.map((item) => (
                <NavLinkItem key={item.label} item={item} pathname={pathname} />
              ))}
            </div>
          </nav>
          <div className="shrink-0">{accountMenu}</div>
        </div>
      </div>
    </header>
  );
}
