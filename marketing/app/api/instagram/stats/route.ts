import { NextResponse } from 'next/server';

import { fetchInstagramStatsForUrl } from '@/lib/calendar/instagram-stats';
import { parseInstagramUrl } from '@/lib/calendar/instagram';

export async function GET(req: Request) {
  const rawUrl = new URL(req.url).searchParams.get('url');
  if (!rawUrl?.trim()) {
    return NextResponse.json({ error: 'URL_REQUIRED' }, { status: 400 });
  }

  if (!parseInstagramUrl(rawUrl)) {
    return NextResponse.json({ error: 'INVALID_INSTAGRAM_URL' }, { status: 400 });
  }

  const stats = await fetchInstagramStatsForUrl(rawUrl);
  if (!stats) {
    return NextResponse.json({ error: 'INVALID_INSTAGRAM_URL' }, { status: 400 });
  }

  return NextResponse.json(stats);
}
