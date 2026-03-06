'use client';

import * as React from 'react';

import { Button } from '@/ui/button';

type Product = {
  id: string;
  name: string;
  collection: string;
  specs: {
    type: string;
    finish: string;
  };
};

type Detection = {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
  product: Product;
};

type DetectResponse = {
  detections: Detection[];
};

type BackendHealth = {
  status: string;
  model_path: string;
  model_exists: boolean;
  model_size_bytes: number | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatConfidence(value: number) {
  const pct = clamp(Math.round(value * 100), 0, 100);
  return `${pct}%`;
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

function drawDetections(args: {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  detections: Detection[];
  srcSize: { width: number; height: number };
  dstSize: { width: number; height: number };
}) {
  const { ctx, canvas, detections, srcSize, dstSize } = args;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (detections.length === 0) return;

  const scaleX = dstSize.width / srcSize.width;
  const scaleY = dstSize.height / srcSize.height;

  ctx.save();
  ctx.lineWidth = 3;
  ctx.font = '14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  ctx.textBaseline = 'top';

  for (const det of detections) {
    const [x1, y1, x2, y2] = det.bbox;
    const x = x1 * scaleX;
    const y = y1 * scaleY;
    const w = (x2 - x1) * scaleX;
    const h = (y2 - y1) * scaleY;

    const label = `${det.product.name} · ${formatConfidence(det.confidence)}`;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';

    ctx.strokeRect(x, y, w, h);

    const paddingX = 8;
    const paddingY = 6;
    const textWidth = ctx.measureText(label).width;
    const boxW = textWidth + paddingX * 2;
    const boxH = 14 + paddingY * 2;

    const bx = clamp(x, 0, dstSize.width - boxW);
    const by = clamp(y - boxH - 6, 0, dstSize.height - boxH);

    ctx.fillRect(bx, by, boxW, boxH);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText(label, bx + paddingX, by + paddingY);
  }

  ctx.restore();
}

export default function ScannerPage() {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const isRequestInFlightRef = React.useRef(false);

  const captureSizeRef = React.useRef<{ width: number; height: number } | null>(null);

  const [isStarted, setIsStarted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastDetection, setLastDetection] = React.useState<Detection | null>(null);
  const [trainerClasses, setTrainerClasses] = React.useState<Array<{ id: string; name: string }> | null>(null);
  const [trainerClassesError, setTrainerClassesError] = React.useState<string | null>(null);
  const [airtableCollectionCode, setAirtableCollectionCode] = React.useState<string | null>(null);
  const [airtableCollectionCodeError, setAirtableCollectionCodeError] = React.useState<string | null>(null);
  const [apiStatus, setApiStatus] = React.useState<'idle' | 'loading' | 'error'>('idle');
  const [backendHealth, setBackendHealth] = React.useState<BackendHealth | null>(null);
  const [backendHealthError, setBackendHealthError] = React.useState<string | null>(null);

  const loadTrainerClasses = React.useCallback(async () => {
    try {
      setTrainerClassesError(null);

      const isLocal =
        typeof window === 'undefined'
          ? true
          : window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      const base = isLocal ? 'http://localhost:8010' : '/trainer/api';
      const res = await fetch(`${base}/classes`, { cache: 'no-store' });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Classes failed (${res.status})`);

      const data = JSON.parse(text) as unknown;
      if (!Array.isArray(data)) throw new Error('Invalid classes response');
      const normalized = data
        .map((v) => {
          if (!v || typeof v !== 'object') return null;
          const id = (v as { id?: unknown }).id;
          const name = (v as { name?: unknown }).name;
          if (typeof id !== 'string' || typeof name !== 'string') return null;
          return { id: id.trim(), name: name.trim() };
        })
        .filter((v): v is { id: string; name: string } => !!v && !!v.id && !!v.name);

      setTrainerClasses(normalized);
    } catch (e) {
      setTrainerClasses(null);
      setTrainerClassesError(e instanceof Error ? e.message : 'Failed to load classes');
    }
  }, []);

  const loadBackendHealth = React.useCallback(async () => {
    try {
      setBackendHealthError(null);
      const res = await fetch('/api/health', { cache: 'no-store' });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Health failed (${res.status})`);
      setBackendHealth(JSON.parse(text) as BackendHealth);
    } catch (e) {
      setBackendHealth(null);
      setBackendHealthError(e instanceof Error ? e.message : 'Health failed');
    }
  }, []);

  const syncOverlayToVideo = React.useCallback(() => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas) return;

    const rect = video.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }, []);

  const clearOverlay = React.useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const ensureCamera = React.useCallback(async () => {
    if (streamRef.current) return streamRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera is not supported on this device/browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
      },
      audio: false,
    });

    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) throw new Error('Video element not ready.');

    video.srcObject = stream;

    await new Promise<void>((resolve) => {
      const onLoaded = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        resolve();
      };
      video.addEventListener('loadedmetadata', onLoaded);
    });

    await video.play();

    syncOverlayToVideo();

    return stream;
  }, [syncOverlayToVideo]);

  const captureAndSendFrame = React.useCallback(async () => {
    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!video || !overlayCanvas) return;

    if (isRequestInFlightRef.current) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    isRequestInFlightRef.current = true;
    setApiStatus('loading');

    try {
      const srcW = video.videoWidth;
      const srcH = video.videoHeight;

      const targetW = 640;
      const scale = targetW / srcW;
      const targetH = Math.round(srcH * scale);

      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = targetW;
      captureCanvas.height = targetH;

      const captureCtx = captureCanvas.getContext('2d');
      if (!captureCtx) throw new Error('Failed to get 2D context for capture.');

      captureCtx.drawImage(video, 0, 0, targetW, targetH);

      const blob = await new Promise<Blob>((resolve, reject) => {
        captureCanvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error('Failed to encode frame.'));
              return;
            }
            resolve(b);
          },
          'image/jpeg',
          0.7
        );
      });

      captureSizeRef.current = { width: targetW, height: targetH };

      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      const res = await fetch('/api/detect', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let details = '';
        try {
          details = await res.text();
        } catch {
          details = '';
        }
        throw new Error(`Detection API error (${res.status}). ${details}`.trim());
      }

      const data: DetectResponse = (await res.json()) as DetectResponse;
      const detections = Array.isArray(data.detections) ? data.detections : [];

      if (detections.length > 0) {
        setLastDetection(detections[0]);
      }

      syncOverlayToVideo();

      const ctx = overlayCanvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context for overlay.');

      const srcSize = captureSizeRef.current;
      if (!srcSize) return;

      drawDetections({
        ctx,
        canvas: overlayCanvas,
        detections,
        srcSize,
        dstSize: { width: overlayCanvas.width, height: overlayCanvas.height },
      });

      setApiStatus('idle');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error.';
      setApiStatus('error');
      setError(message);
    } finally {
      isRequestInFlightRef.current = false;
    }
  }, [syncOverlayToVideo]);

  const startLoop = React.useCallback(() => {
    if (timerRef.current !== null) return;

    timerRef.current = window.setInterval(() => {
      void captureAndSendFrame();
    }, 800);
  }, [captureAndSendFrame]);

  const stopLoop = React.useCallback(() => {
    if (timerRef.current === null) return;
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const handleStart = React.useCallback(async () => {
    setError(null);

    try {
      await loadBackendHealth();
      await ensureCamera();
      setIsStarted(true);
      startLoop();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error.';
      setError(message);
      setIsStarted(false);
      stopLoop();
      clearOverlay();
      stopStream(streamRef.current);
      streamRef.current = null;
    }
  }, [clearOverlay, ensureCamera, startLoop, stopLoop]);

  const handleStop = React.useCallback(() => {
    setError(null);
    setApiStatus('idle');
    stopLoop();
    clearOverlay();
    stopStream(streamRef.current);
    streamRef.current = null;
    setIsStarted(false);
  }, [clearOverlay, stopLoop]);

  const onStart = React.useCallback(async () => {
    await handleStart();
  }, [handleStart]);

  const onStop = React.useCallback(() => {
    handleStop();
  }, [handleStop]);

  React.useEffect(() => {
    void loadBackendHealth();
  }, [loadBackendHealth]);

  React.useEffect(() => {
    void loadTrainerClasses();
  }, [loadTrainerClasses]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    syncOverlayToVideo();

    const ro = new ResizeObserver(() => {
      syncOverlayToVideo();
    });

    ro.observe(video);
    window.addEventListener('orientationchange', syncOverlayToVideo);
    window.addEventListener('resize', syncOverlayToVideo);

    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', syncOverlayToVideo);
      window.removeEventListener('resize', syncOverlayToVideo);
    };
  }, [syncOverlayToVideo]);

  React.useEffect(() => {
    return () => {
      stopLoop();
      clearOverlay();
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [clearOverlay, stopLoop]);

  const displayName = lastDetection?.product.name ?? '—';
  const displayConfidence = lastDetection ? formatConfidence(lastDetection.confidence) : '—';
  const lowConfidence = (lastDetection?.confidence ?? 1) < 0.2;
  const damUrl =
    displayName && displayName !== '—' ? `http://dam.lorenzohome.ae/#${encodeURIComponent(displayName)}` : null;

  const onShareDam = React.useCallback(async () => {
    if (!damUrl) return;

    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        await (navigator as unknown as { share: (data: { url: string; title?: string }) => Promise<void> }).share({
          url: damUrl,
          title: displayName && displayName !== '—' ? displayName : 'DAM',
        });
        return;
      }
    } catch {
      // ignore
    }

    try {
      await navigator.clipboard.writeText(damUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = damUrl;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }, [damUrl, displayName]);

  const resolveAirtableCollectionCode = React.useCallback(async (name: string) => {
    try {
      setAirtableCollectionCodeError(null);

      const isLocal =
        typeof window === 'undefined'
          ? true
          : window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      const base = isLocal ? 'http://localhost:8010' : '/trainer/api';
      const url = `${base}/dam/collection-code?collection_name=${encodeURIComponent(name)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Lookup failed (${res.status})`);

      const data = JSON.parse(text) as unknown;
      const code =
        data && typeof data === 'object' && typeof (data as { collection_code?: unknown }).collection_code === 'string'
          ? ((data as { collection_code: string }).collection_code || '').trim()
          : '';

      setAirtableCollectionCode(code || null);
    } catch (e) {
      setAirtableCollectionCode(null);
      setAirtableCollectionCodeError(e instanceof Error ? e.message : 'Lookup failed');
    }
  }, []);

  React.useEffect(() => {
    if (!lastDetection) return;
    if (!displayName || displayName === '—') return;
    void resolveAirtableCollectionCode(displayName);
  }, [displayName, lastDetection, resolveAirtableCollectionCode]);

  const matchedClass = React.useMemo(() => {
    if (!lastDetection || !trainerClasses?.length) return null;

    const candidates: string[] = [];
    if (typeof lastDetection.class === 'string' && lastDetection.class) candidates.push(lastDetection.class);
    if (typeof lastDetection.product?.id === 'string' && lastDetection.product.id)
      candidates.push(lastDetection.product.id);

    for (const code of candidates) {
      const hit = trainerClasses.find((c) => c.id === code);
      if (hit) return hit;
    }
    return null;
  }, [lastDetection, trainerClasses]);

  const collectionCode = matchedClass?.id ?? '—';
  const collectionName = matchedClass?.name ?? '—';

  const resolvedCollectionCode = airtableCollectionCode ?? collectionCode;

  return (
    <main className="fixed inset-0 h-screen min-h-dvh overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/0 to-black/70" />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col">
        <div className="relative z-30 flex items-start justify-between gap-3 px-3 pt-3 sm:px-5 sm:pt-5">
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur">
            <div className="text-xs tracking-[0.25em] text-white/70">LORENZO</div>
            <div className="text-sm font-semibold">Chandelier Scanner</div>
            <details className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 backdrop-blur">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-white/90">
                Backend status
              </summary>
              <div className="px-3 pb-3">
                <div className="space-y-2">
                  {backendHealth ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-white/70">model_exists</div>
                        <div className="text-xs font-medium">{backendHealth.model_exists ? 'true' : 'false'}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-white/70">size</div>
                        <div className="text-xs font-medium">
                          {typeof backendHealth.model_size_bytes === 'number'
                            ? `${Math.round(backendHealth.model_size_bytes / 1024 / 1024)} MB`
                            : '—'}
                        </div>
                      </div>
                      <div className="max-w-[260px] break-words text-xs text-white/60">{backendHealth.model_path}</div>
                    </>
                  ) : (
                    <div className="max-w-[260px] break-words text-xs text-white/70">
                      {backendHealthError ?? 'Loading…'}
                    </div>
                  )}
                </div>
              </div>
            </details>
          </div>

          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <span
              className={
                'rounded-full px-2 py-1 text-xs ' +
                (apiStatus === 'loading'
                  ? 'bg-white/15 text-white'
                  : apiStatus === 'error'
                    ? 'bg-red-500/20 text-red-100'
                    : 'bg-emerald-500/20 text-emerald-100')
              }
            >
              {apiStatus === 'loading' ? 'Detecting…' : apiStatus === 'error' ? 'Error' : 'Ready'}
            </span>

            {lastDetection ? (
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/90">
                {displayConfidence}
              </span>
            ) : null}

          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          {error ? (
            <div className="mb-3 rounded-xl border border-red-500/30 bg-red-950/35 px-4 py-3 text-sm text-white backdrop-blur">
              <div className="font-medium">Camera / API error</div>
              <div className="mt-1 break-words text-xs text-white/75">{error}</div>
            </div>
          ) : null}

          {lastDetection && lowConfidence ? (
            <div className="mb-2 w-full text-center text-xs text-yellow-100/80">
              Low confidence. Adjust distance/lighting and try again.
            </div>
          ) : null}

          <div className="mx-auto max-h-[45vh] max-w-xl overflow-auto rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs text-white/60">Collection Code</div>
                <div className="mt-0.5 truncate text-lg font-semibold">{resolvedCollectionCode}</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs text-white/60">Collection Name</div>
              <div className="mt-0.5 truncate text-base font-medium">{displayName}</div>
            </div>

            {trainerClassesError ? (
              <div className="mt-3 text-xs text-red-200/90">Classes unavailable: {trainerClassesError}</div>
            ) : null}
            {airtableCollectionCodeError ? (
              <div className="mt-2 text-xs text-red-200/90">Airtable lookup failed: {airtableCollectionCodeError}</div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                variant="outline"
                onClick={onStop}
                disabled={!isStarted}
                className={
                  'w-full ' +
                  (isStarted
                    ? 'border-red-200/40 bg-red-950/35 text-red-100 hover:bg-red-950/55'
                    : 'border-white/15 bg-black/10 text-white/50')
                }
                type="button"
              >
                Stop
              </Button>

              <Button
                variant="outline"
                onClick={() => void onShareDam()}
                disabled={!damUrl}
                className="w-full border-white/30 bg-black/25 text-white hover:bg-white/10 disabled:opacity-50"
                type="button"
              >
                Share
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (!damUrl) return;
                  window.open(damUrl, '_blank', 'noopener,noreferrer');
                }}
                disabled={!damUrl}
                className="w-full border-white/30 bg-black/25 text-white hover:bg-white/10 disabled:opacity-50"
                type="button"
              >
                Images
              </Button>

              <Button
                className="w-full bg-white text-black hover:bg-white/90"
                type="button"
              >
                Reserve
              </Button>
            </div>
          </div>
        </div>

        {!isStarted ? (
          <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-6 text-center">
            <div className="max-w-sm rounded-2xl border border-white/10 bg-black/50 p-5 text-white shadow-lg backdrop-blur">
              <div className="text-sm font-medium">Ready to scan</div>
              <div className="mt-2 text-xs text-white/75">
                Tap “Start” to use your camera. Keep the chandelier centered.
              </div>
            </div>
          </div>
        ) : null}

        {!isStarted ? (
          <div className="fixed left-1/2 top-1/2 z-40 -translate-x-1/2 translate-y-[72px]">
            <Button onClick={() => void onStart()} className="bg-white text-black shadow-lg hover:bg-white/90" type="button">
              Start
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
