import { NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

export const dynamic = 'force-dynamic';

function resolveTrainerFetchUrl(req: Request, path: string): string {
  const base = getTrainerApiBase().replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (base.startsWith('http')) return `${base}${normalizedPath}`;

  const origin = new URL(req.url).origin;
  const prefix = base.startsWith('/') ? base : `/${base}`;
  return `${origin}${prefix}${normalizedPath}`;
}

export async function GET(req: Request) {
  const target = resolveTrainerFetchUrl(req, '/public/platform/stats');

  try {
    const res = await fetch(target, { cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: 'TRAINER_STATS_UNAVAILABLE', detail: text.slice(0, 300) },
        { status: res.status },
      );
    }

    return NextResponse.json(JSON.parse(text), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return NextResponse.json({ error: 'TRAINER_STATS_UNAVAILABLE', detail: message }, { status: 502 });
  }
}
