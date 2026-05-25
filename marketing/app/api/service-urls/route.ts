import { NextResponse } from 'next/server';

import { resolveMarketingServiceUrls } from '@/lib/service-urls';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(resolveMarketingServiceUrls(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
