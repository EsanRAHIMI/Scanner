import { NextResponse } from 'next/server';

import { resolveProposalsServiceUrls } from '@/lib/service-urls';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(resolveProposalsServiceUrls(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
