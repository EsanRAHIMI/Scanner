import { NextResponse } from 'next/server';

import { parseInstagramUrl, type InstagramPreviewResponse } from '@/lib/calendar/instagram';

function extractOgImage(html: string): string | null {
  const match =
    html.match(/property="og:image" content="([^"]+)"/i) ??
    html.match(/content="([^"]+)" property="og:image"/i);
  if (!match?.[1]) return null;
  return match[1].replace(/&amp;/g, '&');
}

export async function GET(req: Request) {
  const rawUrl = new URL(req.url).searchParams.get('url');
  if (!rawUrl?.trim()) {
    return NextResponse.json({ error: 'URL_REQUIRED' }, { status: 400 });
  }

  const parsed = parseInstagramUrl(rawUrl);
  if (!parsed) {
    return NextResponse.json({ error: 'INVALID_INSTAGRAM_URL' }, { status: 400 });
  }

  const baseResponse: InstagramPreviewResponse = {
    mode: 'embed',
    permalink: parsed.permalink,
    type: parsed.type,
    embedUrl: parsed.embedUrl,
    isVideo: parsed.type !== 'p',
  };

  try {
    const oembedRes = await fetch(
      `https://api.instagram.com/oembed?url=${encodeURIComponent(parsed.permalink)}&omitscript=true&maxwidth=640`,
      {
        cache: 'no-store',
        headers: { accept: 'application/json' },
        redirect: 'follow',
      },
    );

    const contentType = oembedRes.headers.get('content-type') ?? '';
    if (oembedRes.ok && contentType.includes('application/json')) {
      const data = (await oembedRes.json()) as {
        thumbnail_url?: string;
        thumbnail_width?: number;
        thumbnail_height?: number;
        html?: string;
      };

      if (typeof data.thumbnail_url === 'string' && data.thumbnail_url.trim()) {
        return NextResponse.json({
          ...baseResponse,
          mode: 'thumbnail',
          thumbnailUrl: data.thumbnail_url,
          width: data.thumbnail_width,
          height: data.thumbnail_height,
          isVideo:
            parsed.type !== 'p' ||
            /video|reel|play/i.test(String(data.html ?? '')),
        } satisfies InstagramPreviewResponse);
      }
    }
  } catch {
    // Fall through to embed mode or og:image scrape.
  }

  try {
    const pageRes = await fetch(parsed.permalink, {
      cache: 'no-store',
      headers: {
        'user-agent': 'facebookexternalhit/1.1',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (pageRes.ok) {
      const html = await pageRes.text();
      const thumbnailUrl = extractOgImage(html);
      if (thumbnailUrl) {
        return NextResponse.json({
          ...baseResponse,
          mode: 'thumbnail',
          thumbnailUrl,
          isVideo: parsed.type !== 'p',
        } satisfies InstagramPreviewResponse);
      }
    }
  } catch {
    // Fall through to cropped embed fallback.
  }

  return NextResponse.json(baseResponse satisfies InstagramPreviewResponse);
}
