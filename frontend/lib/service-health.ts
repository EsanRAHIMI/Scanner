import { LOCAL_APP_URLS, resolveAppUrls, isLocalHostname } from '@/lib/app-urls';
import { getBackendHealthUrl } from '@/lib/env';

export type ServiceHealthState = 'online' | 'degraded' | 'offline';

export type ServiceHealthEntry = {
  name: string;
  status: ServiceHealthState;
  /** URL used for the health probe */
  checkUrl: string;
  /** URL opened when the user clicks the tile */
  openUrl: string;
  responseTime?: number;
  error?: string;
  detail?: string;
};

export type ServiceHealthSnapshot = {
  frontend: Record<string, ServiceHealthEntry>;
  backend: Record<string, ServiceHealthEntry>;
  checkedAt: string;
};

export const FRONTEND_SERVICE_NAMES = [
  'Products App',
  'Scanner UI',
  'Trainer Web',
  'Marketing App',
] as const;

export const BACKEND_SERVICE_NAMES = [
  'Inference API',
  'Trainer API',
  'MongoDB',
] as const;

function resolveUrls(hubOrigin?: string) {
  if (!hubOrigin) return resolveAppUrls();
  try {
    if (isLocalHostname(new URL(hubOrigin).hostname)) return LOCAL_APP_URLS;
  } catch {
    /* ignore */
  }
  return resolveAppUrls(hubOrigin);
}

/** Server-side health probes (no browser CORS). */
export async function collectServiceHealth(hubOrigin?: string): Promise<ServiceHealthSnapshot> {
  const urls = resolveUrls(hubOrigin);
  const local = hubOrigin
    ? isLocalHostname(new URL(hubOrigin).hostname)
    : process.env.NODE_ENV !== 'production';

  const backendHealthUrl = local ? urls.backendHealth : getBackendHealthUrl();

  const [products, scanner, trainerWeb, marketing, inference, trainerApi, mongo] = await Promise.all([
    checkWebAppHealth('Products App', urls.products, urls.products),
    checkWebAppHealth('Scanner UI', urls.scanner, urls.scanner),
    checkWebAppHealth('Trainer Web', urls.trainer.replace(/\/+$/, ''), urls.trainer),
    checkWebAppHealth('Marketing App', urls.marketing, urls.marketing),
    checkBackendHealth(backendHealthUrl),
    checkTrainerHealth(urls.trainerHealth),
    checkMongoHealth(urls.mongodbHealth),
  ]);

  return {
    frontend: {
      [products.name]: products,
      [scanner.name]: scanner,
      [trainerWeb.name]: trainerWeb,
      [marketing.name]: marketing,
    },
    backend: {
      [inference.name]: inference,
      [trainerApi.name]: trainerApi,
      [mongo.name]: mongo,
    },
    checkedAt: new Date().toISOString(),
  };
}

async function fetchWithTiming(
  url: string,
  init?: RequestInit,
): Promise<{ response: Response; responseTime: number }> {
  const start = Date.now();
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
    ...init,
  });
  return { response, responseTime: Date.now() - start };
}

async function checkBackendHealth(url: string): Promise<ServiceHealthEntry> {
  try {
    const { response, responseTime } = await fetchWithTiming(url);
    const text = await response.text();
    let body: { status?: string } = {};
    try {
      body = JSON.parse(text) as { status?: string };
    } catch {
      /* ignore */
    }

    if (response.ok && (body.status === 'healthy' || body.status === 'ok')) {
      return { name: 'Inference API', status: 'online', checkUrl: url, openUrl: url, responseTime };
    }

    if (response.status === 503 && body.status === 'degraded') {
      return {
        name: 'Inference API',
        status: 'degraded',
        checkUrl: url,
        openUrl: url,
        responseTime,
        detail: 'Inference probe degraded',
      };
    }

    return {
      name: 'Inference API',
      status: 'offline',
      checkUrl: url,
      openUrl: url,
      responseTime,
      error: body.status ? `status=${body.status}` : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: 'Inference API',
      status: 'offline',
      checkUrl: url,
      openUrl: url,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

async function checkTrainerHealth(url: string): Promise<ServiceHealthEntry> {
  try {
    const { response, responseTime } = await fetchWithTiming(url);
    if (response.ok) {
      return { name: 'Trainer API', status: 'online', checkUrl: url, openUrl: url, responseTime };
    }
    return {
      name: 'Trainer API',
      status: 'offline',
      checkUrl: url,
      openUrl: url,
      responseTime,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: 'Trainer API',
      status: 'offline',
      checkUrl: url,
      openUrl: url,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

async function checkMongoHealth(url: string): Promise<ServiceHealthEntry> {
  try {
    const { response, responseTime } = await fetchWithTiming(url);
    const text = await response.text();
    let body: { status?: string } = {};
    try {
      body = JSON.parse(text) as { status?: string };
    } catch {
      /* ignore */
    }

    if (response.ok && (body.status === 'online' || body.status === 'connected')) {
      return { name: 'MongoDB', status: 'online', checkUrl: url, openUrl: url, responseTime };
    }

    return {
      name: 'MongoDB',
      status: 'offline',
      checkUrl: url,
      openUrl: url,
      responseTime,
      error: body.status ? `status=${body.status}` : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: 'MongoDB',
      status: 'offline',
      checkUrl: url,
      openUrl: url,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

async function checkWebAppHealth(
  name: string,
  checkUrl: string,
  openUrl: string,
): Promise<ServiceHealthEntry> {
  try {
    const { response, responseTime } = await fetchWithTiming(checkUrl, {
      headers: { Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
    });
    if (response.ok) {
      return { name, status: 'online', checkUrl, openUrl, responseTime };
    }
    return {
      name,
      status: 'offline',
      checkUrl,
      openUrl,
      responseTime,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      status: 'offline',
      checkUrl,
      openUrl,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}
