import { NextResponse } from 'next/server';

import { resolveTrainerServiceUrls } from '@/lib/service-urls';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(resolveTrainerServiceUrls(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
