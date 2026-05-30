import { HUB_TRAINER_API_PREFIX } from '@/lib/hub-paths';
import {
  getDefaultBackendDetectUrl,
  getDefaultTrainerApiBase,
} from '@/lib/public-urls';

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Backend detect endpoint (server proxy). Explicit BACKEND_DETECT_URL overrides. */
export function getBackendDetectUrl(): string {
  const explicit = process.env.BACKEND_DETECT_URL?.trim();
  if (explicit) return explicit;
  if (process.env.NODE_ENV !== 'production') return 'http://127.0.0.1:8000/detect';
  return getDefaultBackendDetectUrl();
}

/** Backend health endpoint derived from detect URL or base domain. */
export function getBackendHealthUrl(): string {
  const explicit = process.env.BACKEND_HEALTH_URL?.trim();
  if (explicit) return explicit;

  const detect = process.env.BACKEND_DETECT_URL?.trim() || getBackendDetectUrl();
  try {
    const u = new URL(detect);
    u.pathname = u.pathname.replace(/\/detect\/?$/, '/health');
    return u.toString();
  } catch {
    return detect.replace(/\/detect\/?$/, '/health');
  }
}

/** Server-side Trainer API base (proxy target). TRAINER_API_BASE / NEXT_PUBLIC_TRAINER_API_BASE override. */
export function getTrainerApiBase(): string {
  const server = process.env.TRAINER_API_BASE?.trim();
  if (server) return trimBase(server);

  const pub = process.env.NEXT_PUBLIC_TRAINER_API_BASE?.trim();
  if (pub) return trimBase(pub);

  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8010';
  return trimBase(getDefaultTrainerApiBase());
}

/** Browser Trainer API base (same-origin proxy when possible). */
export function getTrainerApiBaseForBrowser(isLocal: boolean): string {
  if (isLocal) return 'http://localhost:8010';

  const pub = process.env.NEXT_PUBLIC_TRAINER_API_BASE?.trim();
  if (pub) return trimBase(pub);

  return HUB_TRAINER_API_PREFIX;
}
