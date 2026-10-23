import { NextRequest, NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

export const dynamic = 'force-dynamic';

function resolveTrainerBase(req: NextRequest) {
  const base = getTrainerApiBase();
  const origin = new URL(req.url).origin;
  return base.startsWith('/') ? `${origin}${base}` : base;
}

async function proxy(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = new URL(`${resolveTrainerBase(req)}/${path.join('/')}`);
  req.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  const authorization = req.headers.get('authorization');
  const contentType = req.headers.get('content-type');
  if (cookie) headers.set('cookie', cookie);
  if (authorization) headers.set('authorization', authorization);
  if (contentType) headers.set('content-type', contentType);
  headers.set('accept', req.headers.get('accept') ?? 'application/json');

  const res = await fetch(target, {
    method: req.method,
    headers,
    cache: 'no-store',
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
  });

  const next = new NextResponse(await res.arrayBuffer(), {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
    },
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const cookieValue of setCookies) next.headers.append('set-cookie', cookieValue);
  return next;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
