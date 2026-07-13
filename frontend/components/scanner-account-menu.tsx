'use client';

import { HUB_SERVICE_URLS_PATH, HUB_TRAINER_API_PREFIX } from '@/lib/hub-paths';
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
      authApiPrefix={HUB_TRAINER_API_PREFIX}
      serviceUrlsPath={HUB_SERVICE_URLS_PATH}
      onAuthChange={onAuthChange}
      onActivityLogs={onActivityLogs}
      surface={surface}
      className={className}
    />
  );
}
