/** Legacy default when APP_BASE_DOMAIN / NEXT_PUBLIC_APP_BASE_DOMAIN are unset. */
const DEFAULT_APP_BASE_DOMAIN = 'ehsanrahimi.com';

export type PublicServiceKey = 'lorenzo' | 'trainer' | 'products' | 'marketing';

const SERVICE_URL_ENV: Record<PublicServiceKey, string> = {
  lorenzo: 'NEXT_PUBLIC_LORENZO_URL',
  trainer: 'NEXT_PUBLIC_TRAINER_URL',
  products: 'NEXT_PUBLIC_PRODUCTS_URL',
  marketing: 'NEXT_PUBLIC_MARKETING_URL',
};

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

function joinUrl(base: string, path: string): string {
  const b = trimTrailingSlashes(base);
  if (!path) return b;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

/** Primary domain source (client + server). */
export function getAppBaseDomain(): string {
  return (
    process.env.NEXT_PUBLIC_APP_BASE_DOMAIN?.trim() ||
    process.env.APP_BASE_DOMAIN?.trim() ||
    DEFAULT_APP_BASE_DOMAIN
  );
}

/** Public HTTPS URL for a service (hub links, health checks, docs). */
export function getPublicServiceUrl(service: PublicServiceKey, path = ''): string {
  const explicit = process.env[SERVICE_URL_ENV[service]]?.trim();
  if (explicit) return joinUrl(explicit, path);

  const domain = getAppBaseDomain();
  return joinUrl(`https://${service}.${domain}`, path);
}

export function getDefaultBackendDetectUrl(): string {
  return getPublicServiceUrl('lorenzo', '/api/detect');
}

export function getDefaultTrainerApiBase(): string {
  return getPublicServiceUrl('trainer', '/api');
}

export function getDefaultScannerUrl(): string {
  return getPublicServiceUrl('lorenzo', '/scanner');
}
