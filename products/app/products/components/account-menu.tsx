'use client';

import { ScannerAccountMenu } from '@/lib/scanner-account-menu';

type AccountMenuProps = {
  onAuthChange?: () => void;
  onActivityLogs?: () => void;
};

export function AccountMenu({ onAuthChange, onActivityLogs }: AccountMenuProps) {
  return (
    <ScannerAccountMenu
      app="products"
      authApiPrefix="/api/trainer"
      serviceUrlsPath="/api/service-urls"
      onAuthChange={onAuthChange}
      onActivityLogs={onActivityLogs}
    />
  );
}
