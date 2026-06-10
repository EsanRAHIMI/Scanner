import { NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

function resolveTrainerBase(req: Request) {
  const base = getTrainerApiBase();
  const origin = new URL(req.url).origin;
  return base.startsWith('/') ? `${origin}${base}` : base;
}

function getSetCookieHeaders(res: Response): string[] {
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  const list = anyHeaders.getSetCookie?.();
  if (Array.isArray(list) && list.length) return list;

  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

export async function POST(req: Request) {
  const baseResolved = resolveTrainerBase(req);
  const url = `${baseResolved}/auth/logout`;

  const res = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      cookie: req.headers.get('cookie') ?? '',
      authorization: req.headers.get('authorization') ?? '',
    },
  });

  const text = await res.text();
  const nextRes = new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });

  for (const cookie of getSetCookieHeaders(res)) {
    nextRes.headers.append('set-cookie', cookie);
  }

  return nextRes;
}
