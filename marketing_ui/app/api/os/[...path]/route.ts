import { getMarketingApiBase } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(req: Request, path: string[]) {
  const incoming = new URL(req.url);
  const url = `${getMarketingApiBase()}/api/v1/${path.join('/')}${incoming.search}`;
  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const authorization = req.headers.get('authorization');
  if (authorization) headers.set('authorization', authorization);
  const contentType = req.headers.get('content-type');
  if (contentType && req.method !== 'GET' && req.method !== 'HEAD') {
    headers.set('content-type', contentType);
  }

  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text(),
    cache: 'no-store',
  });

  const out = new Headers();
  const type = res.headers.get('content-type');
  if (type) out.set('content-type', type);
  out.set('cache-control', 'no-cache, no-transform');
  out.set('x-accel-buffering', 'no');
  return new Response(res.body, { status: res.status, headers: out });
}

export async function GET(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function PUT(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function POST(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return forward(req, path);
}
