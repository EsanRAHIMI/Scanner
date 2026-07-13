const DEFAULT_APP_BASE_DOMAIN = 'ehsanrahimi.com';
const DEFAULT_HUB_SUBDOMAIN = 'dashboard';

export type PublicServiceKey = 'hub' | 'trainer' | 'products' | 'marketing';

const SERVICE_URL_ENV: Record<PublicServiceKey, string> = {
  hub: 'NEXT_PUBLIC_HUB_URL',
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

export function getAppBaseDomain(): string {
  return (
    process.env.NEXT_PUBLIC_APP_BASE_DOMAIN?.trim() ||
    process.env.APP_BASE_DOMAIN?.trim() ||
    DEFAULT_APP_BASE_DOMAIN
  );
}

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
    process.env.NEXT_PUBLIC_LORENZO_URL?.trim() ||
    process.env.NEXT_PUBLIC_SCANNER_URL?.trim()?.replace(/\/scanner\/?$/, '');
  if (explicit) return trimTrailingSlashes(explicit);

  const domain = getAppBaseDomain();
  return `https://${getHubSubdomain()}.${domain}`;
}

export function getPublicServiceUrl(service: PublicServiceKey, path = ''): string {
  if (service === 'hub') return joinUrl(getHubBaseUrl(), path);

  const explicit = process.env[SERVICE_URL_ENV[service]]?.trim();
  if (explicit) return joinUrl(explicit, path);

  const domain = getAppBaseDomain();
  return joinUrl(`https://${service}.${domain}`, path);
}

export function getDefaultTrainerApiBase(): string {
  return getPublicServiceUrl('trainer', '/api');
}

export function getDefaultScannerUrl(): string {
  return getPublicServiceUrl('hub', '/scanner');
}
