import { NextResponse } from 'next/server';

import { resolveImageServiceUrls } from '@/lib/service-urls';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(resolveImageServiceUrls(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
