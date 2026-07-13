import { NextResponse } from 'next/server';

import { getBackendHealthUrl } from '@/lib/env';

export async function GET() {
  try {
    let backendRes: Response;
    try {
      backendRes = await fetch(getBackendHealthUrl(), { cache: 'no-store' });
    } catch {
      return NextResponse.json({ error: 'BACKEND_UNAVAILABLE' }, { status: 502 });
    }

    const payloadText = await backendRes.text();
    let payload: unknown;
    try {
      payload = JSON.parse(payloadText) as unknown;
    } catch {
      return NextResponse.json({ error: 'INVALID_BACKEND_RESPONSE' }, { status: 502 });
    }

    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
