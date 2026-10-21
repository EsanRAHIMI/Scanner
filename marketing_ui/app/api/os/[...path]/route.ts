import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';

import { getMarketingApiBase } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ path: string[] }> };

const CONNECT_MS = 800;
const WAIT_MS = 20_000;
const CONNECT_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNRESET',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConnectError(err: unknown): boolean {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
  return CONNECT_CODES.has(code);
}

/** TCP timeout only while the socket is still connecting. A slow response is left alone. */
function requestOnce(urlStr: string, method: string, headers: Headers, body: string | undefined): Promise<Response> {
  const url = new URL(urlStr);
  const lib = url.protocol === 'https:' ? https : http;
  const headerBag: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerBag[key] = value;
  });

  return new Promise((resolve, reject) => {
    const req = lib.request(url, { method, headers: headerBag }, (incoming) => {
      const status = incoming.statusCode ?? 502;
      const out = new Headers();
      const type = incoming.headers['content-type'];
      if (typeof type === 'string') out.set('content-type', type);
      resolve(new Response(Readable.toWeb(incoming) as ReadableStream<Uint8Array>, { status, headers: out }));
    });

    req.on('socket', (socket) => {
      if (!socket.connecting) return;
      socket.setTimeout(CONNECT_MS);
      const clear = () => socket.setTimeout(0);
      socket.once('connect', clear);
      socket.once('timeout', () => {
        clear();
        req.destroy(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }));
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function isStarting(status: number, text: string): boolean {
  if (status !== 503) return false;
  try {
    return (JSON.parse(text) as { detail?: string }).detail === 'STARTING';
  } catch {
    return false;
  }
}

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
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

  const deadline = Date.now() + WAIT_MS;
  let pause = 200;
  for (;;) {
    try {
      const res = await requestOnce(url, req.method, headers, body);
      if (res.status === 503) {
        const text = await res.text();
        if (isStarting(res.status, text) && Date.now() < deadline) {
          await sleep(pause);
          pause = Math.min(pause + 150, 800);
          continue;
        }
        return new Response(text, {
          status: 503,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
      }
      const out = new Headers();
      const type = res.headers.get('content-type');
      if (type) out.set('content-type', type);
      out.set('cache-control', 'no-cache, no-transform');
      out.set('x-accel-buffering', 'no');
      return new Response(res.body, { status: res.status, headers: out });
    } catch (err) {
      if (!isConnectError(err) || Date.now() >= deadline) {
        return Response.json({ detail: 'STARTING' }, { status: 503, headers: { 'cache-control': 'no-store' } });
      }
      await sleep(pause);
      pause = Math.min(pause + 150, 800);
    }
  }
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

export async function PATCH(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return forward(req, path);
}
