import { NextResponse } from 'next/server';

import { collectServiceHealth } from '@/lib/service-health';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const hubOrigin = host ? `${proto}://${host}` : undefined;

  const snapshot = await collectServiceHealth(hubOrigin);

  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
