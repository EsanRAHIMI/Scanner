import { NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

// Always serve fresh data for interactive editing workflows
export const revalidate = 0;

export async function GET(req: Request) {
  const base = getTrainerApiBase();
  const reqUrl = new URL(req.url);
  const origin = reqUrl.origin;

  const baseResolved = base.startsWith('/') ? `${origin}${base}` : base;
  const targetUrl = new URL(`${baseResolved}/public/products/assets`);
  reqUrl.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));

  const res = await fetch(targetUrl.toString(), {
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
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
