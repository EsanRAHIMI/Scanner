import { NextResponse } from 'next/server';

import { resolveProductServiceUrls } from '@/lib/service-urls';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(resolveProductServiceUrls(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
