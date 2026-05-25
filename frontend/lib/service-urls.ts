import type { ScannerServiceUrls } from '@/lib/scanner-account-menu';

import { resolveAppUrls } from '@/lib/app-urls';
import { getPublicServiceUrl } from '@/lib/public-urls';

function trim(url: string): string {
  return url.replace(/\/+$/, '');
}

export function resolveScannerServiceUrls(hubOrigin?: string): ScannerServiceUrls {
  const urls = resolveAppUrls(hubOrigin);
  const trainer = trim(urls.trainer);
  return {
    trainerWeb: trainer,
    trainerAdminUsers: `${trainer}/admin/users`,
    hubWeb: hubOrigin ? trim(hubOrigin) : trim(getPublicServiceUrl('hub')),
    productsWeb: trim(urls.products),
    marketingWeb: trim(urls.marketing),
  };
}
