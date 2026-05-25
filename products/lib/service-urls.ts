import { getPublicServiceUrl, getTrainerWebUrl } from '@/lib/public-urls';

export type ProductServiceUrls = {
  trainerWeb: string;
  trainerAdminUsers: string;
  hubWeb: string;
};

export function resolveProductServiceUrls(): ProductServiceUrls {
  return {
    trainerWeb: getTrainerWebUrl(),
    trainerAdminUsers: getTrainerWebUrl('/admin/users'),
    hubWeb: getPublicServiceUrl('hub'),
  };
}

export const LOCAL_PRODUCT_SERVICE_URLS: ProductServiceUrls = {
  trainerWeb: 'http://localhost:3010',
  trainerAdminUsers: 'http://localhost:3010/admin/users',
  hubWeb: 'http://localhost:3003',
};
