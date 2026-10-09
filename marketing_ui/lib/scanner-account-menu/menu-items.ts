import type { AccountMenuItem, ScannerAccountMenuApp, ScannerServiceUrls } from './types';

export const LOCAL_SERVICE_URLS: ScannerServiceUrls = {
  trainerWeb: 'http://localhost:3010',
  trainerAdminUsers: 'http://localhost:3010/admin/users',
  hubWeb: 'http://localhost:3003',
  productsWeb: 'http://localhost:3004',
  marketingWeb: 'http://localhost:3005',
};

export function buildDefaultMenuItems(
  app: ScannerAccountMenuApp,
  urls: ScannerServiceUrls | null,
  handlers: { onActivityLogs?: () => void },
): AccountMenuItem[] {
  const productsBase = app === 'products' ? '' : (urls?.productsWeb ?? '');
  const productPath = (path: string) => (productsBase ? `${productsBase}${path}` : app === 'products' ? path : '#');
  const manageUsersHref =
    app === 'trainer' ? '/admin/users' : (urls?.trainerAdminUsers ?? '#');

  const items: AccountMenuItem[] = [
    {
      kind: 'link',
      id: 'manage-users',
      label: 'Manage users',
      href: manageUsersHref,
      adminOnly: true,
    },
    {
      kind: 'link',
      id: 'system-dashboard',
      label: 'System Dashboard',
      href: productPath('/dashboard'),
      variant: 'primary',
      adminOnly: true,
    },
  ];

  if (app === 'products') {
    items.push({
      kind: 'link',
      id: 'excel-imports',
      label: 'Excel Imports',
      href: '/products/imports',
      adminOnly: true,
    });
  }

  if (handlers.onActivityLogs) {
    items.push({
      kind: 'action',
      id: 'activity-logs',
      label: 'Activity Logs',
      onClick: handlers.onActivityLogs,
      adminOnly: true,
    });
  } else {
    items.push({
      kind: 'link',
      id: 'activity-logs',
      label: 'Activity Logs',
      href: productPath('/dashboard'),
      adminOnly: true,
    });
  }

  return items;
}
