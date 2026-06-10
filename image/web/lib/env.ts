import { getDefaultTrainerApiBase } from '@/lib/public-urls';

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Strip a trailing /api segment — FastAPI paths already include /api/v1/... */
export function normalizeImageApiBase(url: string): string {
  const trimmed = trimBase(url);
  return trimmed.replace(/\/api$/i, '');
}

export function getImageApiBase(): string {
  const serverOnly = process.env.IMAGE_API_BASE?.trim();
  if (serverOnly) return normalizeImageApiBase(serverOnly);

  const explicit = process.env.NEXT_PUBLIC_IMAGE_API_BASE?.trim();
  if (explicit) return normalizeImageApiBase(explicit);

  return 'http://localhost:8020';
}

/** Next.js-only routes (trainer proxy, service URLs) — not under /api (reserved for FastAPI). */
export const IMAGE_WEB_API_PREFIX = '/web-api';

export function getTrainerAuthApiPrefix(): string {
  return `${IMAGE_WEB_API_PREFIX}/trainer`;
}

export function getServiceUrlsPath(): string {
  return `${IMAGE_WEB_API_PREFIX}/service-urls`;
}

export function getTrainerApiBase(): string {
  const v = process.env.NEXT_PUBLIC_TRAINER_API_BASE?.trim();
  if (v) return trimBase(v);
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8010';
  return trimBase(getDefaultTrainerApiBase());
}
