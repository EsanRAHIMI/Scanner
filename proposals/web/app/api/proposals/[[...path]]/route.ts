import { NextRequest, NextResponse } from 'next/server';

import { getProposalsApiBase } from '@/lib/env';

export const dynamic = 'force-dynamic';

function getSetCookieHeaders(res: Response): string[] {
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  const list = anyHeaders.getSetCookie?.();
  if (Array.isArray(list) && list.length) return list;
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

async function proxyRequest(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const base = getProposalsApiBase();
  const segments = path ?? [];
  const suffix = segments.length ? `/${segments.join('/')}` : '';
  const targetUrl = new URL(`${base}/api/proposals${suffix}`);
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

  const nextRes = new NextResponse(resBody, {
    status: res.status,
    headers: {
      'Content-Type': resContentType ? resContentType.trim() : 'application/octet-stream',
    },
  });
  const disposition = res.headers.get('Content-Disposition');
  if (disposition) nextRes.headers.set('Content-Disposition', disposition);
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
