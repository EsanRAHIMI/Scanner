import { NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

export async function GET(req: Request) {
  const base = getTrainerApiBase();
  const origin = new URL(req.url).origin;

  const baseResolved = base.startsWith('/') ? `${origin}${base}` : base;
  const url = `${baseResolved}/public/products/assets`;

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
    },
  });
}
