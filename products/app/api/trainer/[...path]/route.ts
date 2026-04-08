import { NextRequest, NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

export const dynamic = 'force-dynamic';

function resolveTrainerBase(req: NextRequest) {
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

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const baseResolved = resolveTrainerBase(req);
  const pathStr = path.join('/');
  
  const targetUrl = new URL(`${baseResolved}/${pathStr}`);
  new URL(req.url).searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

  const method = req.method;
  const cookieHeader = req.headers.get('cookie');
  const authHeader = req.headers.get('authorization');

  let body: any = null;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await req.text();
    } catch (e) {
      // ignore
    }
  }

  const res = await fetch(targetUrl.toString(), {
    method,
    cache: 'no-store',
    headers: {
      'Content-Type': req.headers.get('Content-Type') || 'application/json',
      accept: 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    ...(body ? { body } : {}),
  });

  const resText = await res.text();

  const nextRes = new NextResponse(resText, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    },
  });

  // Forward set-cookie headers back to the browser
  for (const cookie of getSetCookieHeaders(res)) {
    nextRes.headers.append('set-cookie', cookie);
  }

  return nextRes;
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const PUT = proxyRequest;
