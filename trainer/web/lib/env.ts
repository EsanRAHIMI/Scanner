import { getDefaultScannerUrl, getDefaultTrainerApiBase } from '@/lib/public-urls';

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getTrainerApiBase(): string {
  const v = process.env.NEXT_PUBLIC_TRAINER_API_BASE?.trim();
  if (v) return trimBase(v);
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8010';
  return trimBase(getDefaultTrainerApiBase());
}

/** Client/server prefix for ScannerAccountMenu auth calls */
export function getTrainerAuthApiPrefix(): string {
  const v = process.env.NEXT_PUBLIC_TRAINER_API_BASE?.trim();
  if (v) return trimBase(v);
  if (process.env.NODE_ENV !== 'production') return '/api';
  return trimBase(getDefaultTrainerApiBase());
}

export function getScannerUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SCANNER_URL?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3003/scanner';
  return getDefaultScannerUrl();
}
