import { NextResponse } from 'next/server';

import { resolveScannerServiceUrls } from '@/lib/service-urls';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const hubOrigin = host ? `${proto}://${host}` : undefined;

  return NextResponse.json(resolveScannerServiceUrls(hubOrigin), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
