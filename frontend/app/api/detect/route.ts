import { NextResponse } from 'next/server';

function getBackendDetectUrl() {
  const v = process.env.BACKEND_DETECT_URL;
  if (v) return v;
  if (process.env.NODE_ENV === 'production') return 'http://backend:8000/detect';
  return 'http://127.0.0.1:8000/detect';
}

function getOptionalBackendDetectSignal(): AbortSignal | undefined {
  const raw = process.env.BACKEND_DETECT_TIMEOUT_MS;
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const ms = Number.parseInt(raw, 10);
  if (!(ms > 0) || !(ms <= 3_600_000)) return undefined;
  return AbortSignal.timeout(ms);
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Expected multipart/form-data' },
        { status: 400 }
      );
    }

    const form = await request.formData();

    const inboundFile = form.get('file');
    if (!(inboundFile instanceof File)) {
      return NextResponse.json(
        { error: 'Missing form-data field "file"' },
        { status: 400 }
      );
    }

    const forwardForm = new FormData();

    for (const [key, value] of Array.from(form.entries())) {
      if (typeof value === 'string') {
        forwardForm.append(key, value);
        continue;
      }

      if (value instanceof File) {
        const bytes = await value.arrayBuffer();
        const cloned = new File([bytes], value.name, { type: value.type });
        forwardForm.append(key, cloned);
      }
    }

    let backendRes: Response;
    try {
      const timeoutSignal = getOptionalBackendDetectSignal();
      backendRes = await fetch(getBackendDetectUrl(), {
        method: 'POST',
        body: forwardForm,
        ...(timeoutSignal ? { signal: timeoutSignal } : {}),
      });
    } catch {
      return NextResponse.json(
        { error: 'BACKEND_UNAVAILABLE' },
        { status: 502 }
      );
    }

    const payloadText = await backendRes.text();
    let payload: unknown;
    try {
      payload = JSON.parse(payloadText) as unknown;
    } catch {
      return NextResponse.json(
        { error: 'BACKEND_UNAVAILABLE' },
        { status: 502 }
      );
    }

    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
