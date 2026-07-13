import { NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

function resolveTrainerBase(req: Request) {
  const base = getTrainerApiBase();
  const origin = new URL(req.url).origin;
  return base.startsWith('/') ? `${origin}${base}` : base;
}

function forwardHeaders(req: Request) {
  return {
    accept: 'application/json',
    cookie: req.headers.get('cookie') ?? '',
    authorization: req.headers.get('authorization') ?? '',
  };
}

export async function GET(req: Request) {
  const baseResolved = resolveTrainerBase(req);
  const url = `${baseResolved}/admin/marketing-performance`;

  const res = await fetch(url, {
    cache: 'no-store',
    headers: forwardHeaders(req),
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });
}

export async function PUT(req: Request) {
  const baseResolved = resolveTrainerBase(req);
  const url = `${baseResolved}/admin/marketing-performance`;
  const body = await req.text();

  const res = await fetch(url, {
    method: 'PUT',
    cache: 'no-store',
    headers: {
      ...forwardHeaders(req),
      'content-type': req.headers.get('content-type') ?? 'application/json',
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
