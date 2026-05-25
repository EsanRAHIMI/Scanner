import { getDefaultTrainerApiBase } from '@/lib/public-urls';

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getTrainerApiBase(): string {
  const v = process.env.NEXT_PUBLIC_TRAINER_API_BASE?.trim();
  if (v) return trimBase(v);
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8010';
  return trimBase(getDefaultTrainerApiBase());
}
