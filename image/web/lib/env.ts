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

/** Browser calls go through the Next.js proxy to avoid CORS and double /api prefixes. */
export const IMAGE_CLIENT_API_PREFIX = '/api/image';

export function getTrainerApiBase(): string {
  const v = process.env.NEXT_PUBLIC_TRAINER_API_BASE?.trim();
  if (v) return trimBase(v);
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8010';
  return trimBase(getDefaultTrainerApiBase());
}
