'use client';

import { ScannerAccountMenu } from '@/lib/scanner-account-menu';

type AccountMenuProps = {
  onAuthChange?: () => void;
  onActivityLogs?: () => void;
  backendDisconnected?: boolean;
};

export function AccountMenu({
  onAuthChange,
  onActivityLogs,
  backendDisconnected = false,
}: AccountMenuProps) {
  return (
    <ScannerAccountMenu
      app="products"
      authApiPrefix="/api/trainer"
      serviceUrlsPath="/api/service-urls"
      connectionStatus={backendDisconnected ? 'offline' : 'online'}
      onAuthChange={onAuthChange}
      onActivityLogs={onActivityLogs}
    />
  );
}
