import {
  parseInstagramUrl,
  type InstagramPostType,
  type ParsedInstagramUrl,
} from './instagram';

export interface InstagramStatsResponse {
  permalink: string;
  type: InstagramPostType;
  views: number | null;
  display: string | null;
  unavailableReason?: 'INSTAGRAM_TOKEN_REQUIRED' | 'VIEWS_NOT_FOUND' | 'FETCH_FAILED' | 'PAGE_UNAVAILABLE';
}

const SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function formatViewCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value >= 1_000_000) {
    const scaled = value / 1_000_000;
    return `${scaled >= 10 ? Math.round(scaled) : scaled.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 10_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  if (value >= 1_000) {
    const scaled = value / 1_000;
    return `${scaled.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return value.toLocaleString('en-US');
}

/** Instagram shortcode → numeric media id for Graph API. */
export function shortcodeToMediaId(shortcode: string): string {
  let id = BigInt(0);
  const base = BigInt(64);
  for (const char of shortcode) {
    const index = SHORTCODE_ALPHABET.indexOf(char);
    if (index < 0) throw new Error('INVALID_SHORTCODE');
    id = id * base + BigInt(index);
  }
  return id.toString();
}

function getInstagramAccessToken(): string | null {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  return token || null;
}

function getGraphApiVersion(): string {
  return process.env.INSTAGRAM_GRAPH_API_VERSION?.trim() || 'v22.0';
}

function parseInsightValue(data: {
  data?: Array<{
    name?: string;
    values?: Array<{ value?: number }>;
    total_value?: { value?: number };
  }>;
}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of data.data ?? []) {
    if (!row.name) continue;
    const raw = row.values?.[0]?.value ?? row.total_value?.value;
    if (typeof raw === 'number' && raw >= 0) {
      out[row.name] = raw;
    }
  }
  return out;
}

async function fetchViewsViaGraphApi(
  parsed: ParsedInstagramUrl,
  accessToken: string,
): Promise<number | null> {
  const mediaId = shortcodeToMediaId(parsed.shortcode);
  const version = getGraphApiVersion();

  const metricList =
    parsed.type === 'reel' || parsed.type === 'tv'
      ? ['views', 'plays', 'ig_reels_aggregated_all_plays_count', 'video_views']
      : ['views', 'video_views', 'plays'];

  const url = new URL(`https://graph.facebook.com/${version}/${mediaId}/insights`);
  url.searchParams.set('metric', metricList.join(','));
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url, { cache: 'no-store' });
  const body = (await res.json()) as {
    data?: Array<{
      name?: string;
      values?: Array<{ value?: number }>;
      total_value?: { value?: number };
    }>;
    error?: { message?: string; type?: string; code?: number };
  };

  if (!res.ok) {
    return null;
  }

  const metrics = parseInsightValue(body);

  for (const key of ['views', 'ig_reels_aggregated_all_plays_count', 'plays', 'video_views']) {
    if (metrics[key] != null && metrics[key] > 0) {
      return metrics[key];
    }
  }

  return null;
}

/** Optional: resolve media id via oEmbed when shortcode conversion fails on some edge cases. */
async function fetchMediaIdViaOembed(
  permalink: string,
  accessToken: string,
): Promise<string | null> {
  const version = getGraphApiVersion();
  const url = new URL(`https://graph.facebook.com/${version}/instagram_oembed`);
  url.searchParams.set('url', permalink);
  url.searchParams.set('access_token', accessToken);

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { media_id?: string; id?: string };
    const id = data.media_id ?? data.id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

export async function fetchInstagramStatsForUrl(
  rawUrl: string,
): Promise<InstagramStatsResponse | null> {
  const parsed = parseInstagramUrl(rawUrl);
  if (!parsed) return null;

  const base = {
    permalink: parsed.permalink,
    type: parsed.type,
    views: null as number | null,
    display: null as string | null,
  };

  const accessToken = getInstagramAccessToken();
  if (!accessToken) {
    return {
      ...base,
      unavailableReason: 'INSTAGRAM_TOKEN_REQUIRED',
    };
  }

  try {
    let views = await fetchViewsViaGraphApi(parsed, accessToken);

    if (views === null) {
      const mediaId = await fetchMediaIdViaOembed(parsed.permalink, accessToken);
      if (mediaId) {
        const version = getGraphApiVersion();
        const url = new URL(`https://graph.facebook.com/${version}/${mediaId}/insights`);
        url.searchParams.set('metric', 'views,plays,ig_reels_aggregated_all_plays_count,video_views');
        url.searchParams.set('access_token', accessToken);
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const metrics = parseInsightValue((await res.json()) as { data?: [] });
          views =
            metrics.views ??
            metrics.ig_reels_aggregated_all_plays_count ??
            metrics.plays ??
            metrics.video_views ??
            null;
        }
      }
    }

    if (views === null || views <= 0) {
      return {
        ...base,
        unavailableReason: 'VIEWS_NOT_FOUND',
      };
    }

    return {
      ...base,
      views,
      display: formatViewCount(views),
    };
  } catch {
    return {
      ...base,
      unavailableReason: 'FETCH_FAILED',
    };
  }
}
