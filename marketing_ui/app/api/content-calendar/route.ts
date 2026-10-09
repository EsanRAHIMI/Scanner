import { NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

function resolveTrainerBase(req: Request) {
  const base = getTrainerApiBase();
  const origin = new URL(req.url).origin;
  return base.startsWith('/') ? `${origin}${base}` : base;
}

export async function GET(req: Request) {
  const baseResolved = resolveTrainerBase(req);
  const url = new URL(`${baseResolved}/content-calendar`);

  const inbound = new URL(req.url);
  inbound.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      cookie: req.headers.get('cookie') ?? '',
      authorization: req.headers.get('authorization') ?? '',
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

export async function POST(req: Request) {
  const baseResolved = resolveTrainerBase(req);
  const url = `${baseResolved}/content-calendar`;

  const body = await req.text();

  const res = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': req.headers.get('content-type') ?? 'application/json',
      accept: 'application/json',
      cookie: req.headers.get('cookie') ?? '',
      authorization: req.headers.get('authorization') ?? '',
    },
    body,
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });
}
