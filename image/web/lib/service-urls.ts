import type { ScannerServiceUrls } from '@/lib/scanner-account-menu';

import { getPublicServiceUrl } from '@/lib/public-urls';

function trim(url: string): string {
  return url.replace(/\/+$/, '');
}

export function resolveImageServiceUrls(): ScannerServiceUrls {
  const trainerWeb = trim(getPublicServiceUrl('trainer'));
  return {
    trainerWeb,
    trainerAdminUsers: `${trainerWeb}/admin/users`,
    hubWeb: trim(getPublicServiceUrl('lorenzo')),
    productsWeb: trim(getPublicServiceUrl('products')),
    marketingWeb: trim(getPublicServiceUrl('marketing')),
    imageWeb: trim(getPublicServiceUrl('image')),
  };
}
