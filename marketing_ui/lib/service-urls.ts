import type { ScannerServiceUrls } from '@/lib/scanner-account-menu';

import { getPublicServiceUrl } from '@/lib/public-urls';
import { getTrainerApiBase } from '@/lib/env';

function trim(url: string): string {
  return url.replace(/\/+$/, '');
}

export function resolveMarketingServiceUrls(): ScannerServiceUrls {
  const trainerWeb = trim(getPublicServiceUrl('trainer'));
  return {
    trainerWeb,
    trainerAdminUsers: `${trainerWeb}/admin/users`,
    hubWeb: trim(getPublicServiceUrl('lorenzo')),
    productsWeb: trim(getPublicServiceUrl('products')),
    marketingWeb: trim(getPublicServiceUrl('marketing')),
  };
}
