import { NextRequest, NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const base = getTrainerApiBase();
  const origin = new URL(req.url).origin;

  const baseResolved = base.startsWith('/') ? `${origin}${base}` : base;
  const url = `${baseResolved}/products/assets/${id}`;

  const body = await req.json();
  const cookieHeader = req.headers.get('cookie');

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
