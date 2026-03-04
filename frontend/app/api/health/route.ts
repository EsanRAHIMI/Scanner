import { NextResponse } from 'next/server';

function getBackendHealthUrl() {
  const v = process.env.BACKEND_HEALTH_URL;
  if (v) return v;

  const detect = process.env.BACKEND_DETECT_URL;
  if (detect) {
    try {
      const u = new URL(detect);
      u.pathname = u.pathname.replace(/\/detect\/?$/, '/health');
      return u.toString();
    } catch {
      return detect.replace(/\/detect\/?$/, '/health');
    }
  }

  if (process.env.NODE_ENV === 'production') return 'http://backend:8000/health';
  return 'http://127.0.0.1:8000/health';
}

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
