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

  const headers = new Headers();
  const reqContentType = req.headers.get('Content-Type');
  const contentType = reqContentType ? reqContentType.split(',')[0].trim() : 'application/json';
  
  headers.set('Content-Type', contentType);
  headers.set('Accept', 'application/json');
  if (cookieHeader) headers.set('Cookie', cookieHeader);
  if (authHeader) headers.set('Authorization', authHeader);

  const res = await fetch(targetUrl.toString(), {
    method,
    cache: 'no-store',
    headers,
    ...(body ? { body } : {}),
  });

  const resText = await res.text();

  const resContentType = res.headers.get('Content-Type');
  const finalContentType = resContentType ? resContentType.split(',')[0].trim() : 'application/json';

  const nextRes = new NextResponse(resText, {
    status: res.status,
    headers: {
      'Content-Type': finalContentType,
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
