import { NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

// Cache this route on the Next.js server for 60s; serves stale while revalidating
export const revalidate = 0;

export async function GET(req: Request) {
  const base = getTrainerApiBase();
  const origin = new URL(req.url).origin;

  const baseResolved = base.startsWith('/') ? `${origin}${base}` : base;
  const url = `${baseResolved}/public/products/assets`;

  // Disable revalidation
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
    },
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
