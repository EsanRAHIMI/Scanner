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

export async function proxyTrainerRequest(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const baseResolved = resolveTrainerBase(req);
  const pathStr = path.join('/');

  const targetUrl = new URL(`${baseResolved}/${pathStr}`);
  new URL(req.url).searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

  const method = req.method;
  const cookieHeader = req.headers.get('cookie');
  const authHeader = req.headers.get('authorization');

  let body: BodyInit | null = null;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const rawBody = await req.arrayBuffer();
      body = rawBody.byteLength > 0 ? rawBody : null;
    } catch {
      /* ignore */
    }
  }

  const headers = new Headers();
  const reqContentType = req.headers.get('Content-Type');
  const reqAccept = req.headers.get('Accept');

  if (reqContentType) headers.set('Content-Type', reqContentType.trim());
  headers.set('Accept', reqAccept ?? '*/*');
  if (cookieHeader) headers.set('Cookie', cookieHeader);
  if (authHeader) headers.set('Authorization', authHeader);

  const res = await fetch(targetUrl.toString(), {
    method,
    cache: 'no-store',
    headers,
    ...(body ? { body } : {}),
  });

  const resBody = await res.arrayBuffer();
  const resContentType = res.headers.get('Content-Type');
  const finalContentType = resContentType ? resContentType.trim() : 'application/octet-stream';

  const nextRes = new NextResponse(resBody, {
    status: res.status,
    headers: {
      'Content-Type': finalContentType,
    },
  });

  for (const cookie of getSetCookieHeaders(res)) {
    nextRes.headers.append('set-cookie', cookie);
  }

  return nextRes;
}
