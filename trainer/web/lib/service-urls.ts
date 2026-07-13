import type { ScannerServiceUrls } from '@/lib/scanner-account-menu';

import { getPublicServiceUrl } from '@/lib/public-urls';

function trim(url: string): string {
  return url.replace(/\/+$/, '');
}

export function resolveTrainerServiceUrls(): ScannerServiceUrls {
  const trainerWeb = trim(
    process.env.NEXT_PUBLIC_TRAINER_URL?.trim() ||
      (process.env.NODE_ENV !== 'production' ? 'http://localhost:3010' : getPublicServiceUrl('trainer')),
  );
  return {
    trainerWeb,
    trainerAdminUsers: `${trainerWeb}/admin/users`,
    hubWeb: trim(
      process.env.NEXT_PUBLIC_HUB_URL?.trim() ||
        process.env.NEXT_PUBLIC_SCANNER_URL?.trim()?.replace(/\/scanner\/?$/, '') ||
        (process.env.NODE_ENV !== 'production' ? 'http://localhost:3003' : getPublicServiceUrl('hub')),
    ),
    productsWeb: trim(
      process.env.NEXT_PUBLIC_PRODUCTS_URL?.trim() ||
        (process.env.NODE_ENV !== 'production' ? 'http://localhost:3004' : getPublicServiceUrl('products')),
    ),
    marketingWeb: trim(
      process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
        (process.env.NODE_ENV !== 'production' ? 'http://localhost:3005' : getPublicServiceUrl('marketing')),
    ),
  };
}
