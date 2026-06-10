import { getDefaultTrainerApiBase } from '@/lib/public-urls';

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getImageApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_IMAGE_API_BASE?.trim();
  if (explicit) return trimBase(explicit);
  return 'http://localhost:8020';
}

export function getTrainerApiBase(): string {
  const v = process.env.NEXT_PUBLIC_TRAINER_API_BASE?.trim();
  if (v) return trimBase(v);
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8010';
  return trimBase(getDefaultTrainerApiBase());
}
