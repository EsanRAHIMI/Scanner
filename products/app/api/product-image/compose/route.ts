import { NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin BFF proxy to the Image service's official composition endpoint.
 *
 * The browser requests `/api/product-image/compose?src=<cutoutUrl>` and this
 * route forwards it server-side to `${IMAGE_API_BASE}/api/v1/compose`, so the
 * Image service never needs to be exposed publicly and there are no CORS issues.
 * The Image service performs the OFFICIAL composition (cutout on the real
 * Lorenzo background) — this route only proxies and caches the bytes.
 */

export const dynamic = 'force-dynamic';

function imageApiBase(): string {
  const v = process.env.IMAGE_API_BASE?.trim();
  if (v) return v.replace(/\/+$/, '');
  // Local dev default (Image service runs on 8020). In production set IMAGE_API_BASE.
  return process.env.NODE_ENV !== 'production' ? 'http://localhost:8020' : '';
}

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('src');
  const bg = req.nextUrl.searchParams.get('bg');
  const base = imageApiBase();

  if (!src) {
    return new NextResponse('Missing src', { status: 400 });
  }
  if (!base) {
    return new NextResponse('IMAGE_API_BASE not configured', { status: 503 });
  }

  const target = new URL(`${base}/api/v1/compose`);
  target.searchParams.set('src', src);
  if (bg) target.searchParams.set('bg', bg);

  try {
    const res = await fetch(target.toString(), { cache: 'no-store' });
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
        // Composed output is deterministic for a given src+bg → safe to cache.
        'Cache-Control': res.ok ? 'public, max-age=86400' : 'no-store',
      },
    });
  } catch {
    return new NextResponse('Compose proxy failed', { status: 502 });
  }
}
