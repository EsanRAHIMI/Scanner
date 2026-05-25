'use client';

import { ScannerAccountMenu } from '@/lib/scanner-account-menu';

type AppAccountMenuProps = {
  app?: 'products' | 'marketing' | 'frontend' | 'trainer';
  onAuthChange?: () => void;
  onActivityLogs?: () => void;
  /** Dashboard hub uses dark chrome */
  surface?: 'light' | 'dark';
  className?: string;
};

/** Unified account menu — configured per app shell. */
export function AppAccountMenu({
  app = 'frontend',
  onAuthChange,
  onActivityLogs,
  surface = 'dark',
  className,
}: AppAccountMenuProps) {
  return (
    <ScannerAccountMenu
      app={app}
      authApiPrefix="/api/trainer"
      serviceUrlsPath="/api/service-urls"
      onAuthChange={onAuthChange}
      onActivityLogs={onActivityLogs}
      surface={surface}
      className={className}
    />
  );
}
