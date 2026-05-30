import {
  getDefaultScannerUrl,
  getPublicServiceUrl,
} from '@/lib/public-urls';

export type AppUrls = {
  trainer: string;
  products: string;
  marketing: string;
  calendar: string;
  scanner: string;
  status: string;
  apiDocs: string;
  trainerApiDocs: string;
  trainerLogin: string;
  backendHealth: string;
  trainerHealth: string;
  mongodbHealth: string;
};

function trim(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Resolve dashboard link targets from runtime server env + current request host. */
export function resolveAppUrls(hubOrigin?: string): AppUrls {
  const hub = hubOrigin ? trim(hubOrigin) : trim(getPublicServiceUrl('hub'));

  return {
    trainer: `${trim(getPublicServiceUrl('trainer'))}/`,
    products: trim(getPublicServiceUrl('products')),
    marketing: trim(getPublicServiceUrl('marketing')),
    calendar: `${trim(getPublicServiceUrl('marketing'))}/calendar`,
    scanner: hubOrigin ? `${hub}/scanner` : getDefaultScannerUrl(),
    status: hubOrigin ? `${hub}/status` : `${trim(getPublicServiceUrl('hub'))}/status`,
    apiDocs: hubOrigin ? `${hub}/status` : `${trim(getPublicServiceUrl('hub'))}/status`,
    trainerApiDocs: hubOrigin ? `${hub}/status` : `${trim(getPublicServiceUrl('hub'))}/status`,
    trainerLogin: getPublicServiceUrl('trainer', '/login?next=/'),
    backendHealth: getPublicServiceUrl('hub', '/api/health'),
    trainerHealth: getPublicServiceUrl('trainer', '/api/health'),
    mongodbHealth: getPublicServiceUrl('trainer', '/api/mongodb/health'),
  };
}

export const LOCAL_APP_URLS: AppUrls = {
  trainer: 'http://localhost:3010/',
  products: 'http://localhost:3004',
  marketing: 'http://localhost:3005',
  calendar: 'http://localhost:3005/calendar',
  scanner: 'http://localhost:3003/scanner',
  status: 'http://localhost:3003/status',
  apiDocs: 'http://localhost:3003/status',
  trainerApiDocs: 'http://localhost:3003/status',
  trainerLogin: 'http://localhost:3010/login?next=/',
  backendHealth: 'http://localhost:8000/health',
  trainerHealth: 'http://localhost:8010/health',
  mongodbHealth: 'http://localhost:8010/mongodb/health',
};

export function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}
