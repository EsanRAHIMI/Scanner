import { getPublicServiceUrl, getTrainerWebUrl } from '@/lib/public-urls';

import type { ScannerServiceUrls } from '@/lib/scanner-account-menu';

export type ProductServiceUrls = ScannerServiceUrls;

export function resolveProductServiceUrls(): ProductServiceUrls {
  return {
    trainerWeb: getTrainerWebUrl(),
    trainerAdminUsers: getTrainerWebUrl('/admin/users'),
    hubWeb: getPublicServiceUrl('hub'),
    productsWeb: getPublicServiceUrl('products'),
    marketingWeb: getPublicServiceUrl('marketing'),
  };
}

export const LOCAL_PRODUCT_SERVICE_URLS: ProductServiceUrls = {
  trainerWeb: 'http://localhost:3010',
  trainerAdminUsers: 'http://localhost:3010/admin/users',
  hubWeb: 'http://localhost:3003',
  productsWeb: 'http://localhost:3004',
  marketingWeb: 'http://localhost:3005',
};
