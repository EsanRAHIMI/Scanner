const DEFAULT_APP_BASE_DOMAIN = 'ehsanrahimi.com';

export type PublicServiceKey = 'lorenzo' | 'trainer' | 'products' | 'marketing' | 'image';

const SERVICE_URL_ENV: Record<PublicServiceKey, string> = {
  lorenzo: 'NEXT_PUBLIC_LORENZO_URL',
  trainer: 'NEXT_PUBLIC_TRAINER_URL',
  products: 'NEXT_PUBLIC_PRODUCTS_URL',
  marketing: 'NEXT_PUBLIC_MARKETING_URL',
  image: 'NEXT_PUBLIC_IMAGE_URL',
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

export function getPublicServiceUrl(service: PublicServiceKey, path = ''): string {
  const explicit = process.env[SERVICE_URL_ENV[service]]?.trim();
  if (explicit) return joinUrl(explicit, path);

  const domain = getAppBaseDomain();
  return joinUrl(`https://${service}.${domain}`, path);
}

export function getDefaultTrainerApiBase(): string {
  return getPublicServiceUrl('trainer', '/api');
}
