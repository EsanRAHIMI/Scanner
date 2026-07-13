/** Legacy default when domain env vars are unset. */
const DEFAULT_APP_BASE_DOMAIN = 'ehsanrahimi.com';
const DEFAULT_HUB_SUBDOMAIN = 'dashboard';

export type PublicServiceKey = 'hub' | 'trainer' | 'products' | 'marketing' | 'image' | 'proposals';

const SERVICE_URL_ENV: Record<PublicServiceKey, string> = {
  hub: 'NEXT_PUBLIC_HUB_URL',
  trainer: 'NEXT_PUBLIC_TRAINER_URL',
  products: 'NEXT_PUBLIC_PRODUCTS_URL',
  marketing: 'NEXT_PUBLIC_MARKETING_URL',
  image: 'NEXT_PUBLIC_IMAGE_URL',
  proposals: 'NEXT_PUBLIC_PROPOSALS_URL',
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

/** Primary domain source (client build + server runtime). */
export function getAppBaseDomain(): string {
  return (
    process.env.NEXT_PUBLIC_APP_BASE_DOMAIN?.trim() ||
    process.env.APP_BASE_DOMAIN?.trim() ||
    DEFAULT_APP_BASE_DOMAIN
  );
}

/** Hub subdomain (default: dashboard). */
export function getHubSubdomain(): string {
  return (
    process.env.NEXT_PUBLIC_HUB_SUBDOMAIN?.trim() ||
    process.env.HUB_SUBDOMAIN?.trim() ||
    DEFAULT_HUB_SUBDOMAIN
  );
}

function getHubBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_HUB_URL?.trim() ||
    process.env.NEXT_PUBLIC_LORENZO_URL?.trim();
  if (explicit) return trimTrailingSlashes(explicit);

  const domain = getAppBaseDomain();
  const sub = getHubSubdomain();
  return `https://${sub}.${domain}`;
}

/** Public HTTPS URL for a service. */
export function getPublicServiceUrl(service: PublicServiceKey, path = ''): string {
  if (service === 'hub') return joinUrl(getHubBaseUrl(), path);

  const explicit = process.env[SERVICE_URL_ENV[service]]?.trim();
  if (explicit) return joinUrl(explicit, path);

  const domain = getAppBaseDomain();
  return joinUrl(`https://${service}.${domain}`, path);
}

export function getDefaultBackendDetectUrl(): string {
  return getPublicServiceUrl('hub', '/api/detect');
}

export function getDefaultTrainerApiBase(): string {
  return getPublicServiceUrl('trainer', '/api');
}

export function getDefaultScannerUrl(): string {
  return getPublicServiceUrl('hub', '/scanner');
}
