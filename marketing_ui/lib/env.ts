import { getDefaultTrainerApiBase } from '@/lib/public-urls';

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getMarketingApiBase(): string {
  const v = process.env.MARKETING_API_BASE?.trim();
  if (v) return trimBase(v);
  return 'http://127.0.0.1:8050';
}

export function getTrainerApiBase(): string {
  const v = process.env.NEXT_PUBLIC_TRAINER_API_BASE?.trim();
  if (v) return trimBase(v);
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8010';
  return trimBase(getDefaultTrainerApiBase());
}
