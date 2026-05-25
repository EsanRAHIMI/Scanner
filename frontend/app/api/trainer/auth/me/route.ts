import { NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

function resolveTrainerBase(req: Request) {
  const base = getTrainerApiBase();
  const host = req.headers.get('host') || '';
  const local = host.includes('localhost') || host.includes('127.0.0.1');
  if (local && !base.startsWith('http')) return 'http://localhost:8010';
  if (base.startsWith('/')) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}${base}`;
  }
  return base;
}

export async function GET(req: Request) {
  try {
    const base = resolveTrainerBase(req);
    const url = `${base}/auth/me`;
    const res = await fetch(url, {
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
  } catch {
    return NextResponse.json({ error: 'trainer_auth_unavailable' }, { status: 502 });
  }
}
