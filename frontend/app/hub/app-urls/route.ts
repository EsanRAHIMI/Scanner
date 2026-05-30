import { NextResponse } from 'next/server';

import { resolveAppUrls } from '@/lib/app-urls';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const hubOrigin = host ? `${proto}://${host}` : undefined;

  return NextResponse.json(resolveAppUrls(hubOrigin), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
