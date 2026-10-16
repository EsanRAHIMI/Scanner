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

function applyAuthCookies(nextRes: NextResponse, setCookies: string[], requestHost: string) {
  for (const raw of setCookies) {
    const [pair, ...attrs] = raw.split(';').map((part) => part.trim());
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const options: {
      path?: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'lax' | 'strict' | 'none';
      maxAge?: number;
      domain?: string;
    } = {};
    for (const attr of attrs) {
      const splitAt = attr.indexOf('=');
      const key = (splitAt === -1 ? attr : attr.slice(0, splitAt)).toLowerCase();
      const attrValue = splitAt === -1 ? '' : attr.slice(splitAt + 1);
      if (key === 'path' && attrValue) options.path = attrValue;
      else if (key === 'httponly') options.httpOnly = true;
      else if (key === 'secure') options.secure = true;
      else if (key === 'samesite' && (attrValue === 'lax' || attrValue === 'strict' || attrValue === 'none')) options.sameSite = attrValue;
      else if (key === 'max-age' && attrValue) options.maxAge = Number(attrValue);
      else if (key === 'domain' && attrValue) {
        const domain = attrValue.replace(/^\./, '');
        if (requestHost === domain || requestHost.endsWith(`.${domain}`)) options.domain = attrValue;
      }
    }
    nextRes.cookies.set(name, value, options);
  }
}

export async function POST(req: Request) {
  const baseResolved = resolveTrainerBase(req);
  const url = `${baseResolved}/auth/login`;

  const body = await req.text();

  const res = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': req.headers.get('content-type') ?? 'application/json',
      accept: 'application/json',
    },
    body,
  });

  const text = await res.text();
  const nextRes = new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });

  applyAuthCookies(nextRes, getSetCookieHeaders(res), new URL(req.url).hostname);

  return nextRes;
}
