'use client';

import * as React from 'react';

import { Button } from '@/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/ui/card';

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
  const [isPaused, setIsPaused] = React.useState(false);
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
    setIsPaused(false);

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

  React.useEffect(() => {
    void loadBackendHealth();
  }, [loadBackendHealth]);

  React.useEffect(() => {
    void loadTrainerClasses();
  }, [loadTrainerClasses]);

  const handlePauseResume = React.useCallback(() => {
    setError(null);

    setIsPaused((prev: boolean) => {
      const next = !prev;
      if (next) {
        stopLoop();
      } else {
        startLoop();
      }
      return next;
    });
  }, [startLoop, stopLoop]);

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
  const lowConfidence = (lastDetection?.confidence ?? 1) < 0.6;

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
  const damUrl = displayName && displayName !== '—' ? `http://dam.lorenzohome.ae/#${encodeURIComponent(displayName)}` : null;

  const resolvedCollectionCode = airtableCollectionCode ?? collectionCode;

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 lg:py-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="text-xs tracking-[0.25em] text-white/60">LORENZO</div>
            <h1 className="text-lg font-semibold lg:text-xl">Chandelier Scanner</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isStarted ? (
              <Button
                onClick={() => void handleStart()}
                className="w-full bg-white text-black hover:bg-white/90 sm:w-auto"
              >
                Start Scanning
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handlePauseResume}
                  className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 sm:w-auto"
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void loadBackendHealth()}
                  className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 sm:w-auto"
                >
                  Refresh status
                </Button>
              </>
            )}

            <div className="ml-auto flex items-center gap-2 text-xs text-white/70 lg:ml-0">
              <span
                className={
                  'rounded-full px-2 py-1 ' +
                  (apiStatus === 'loading'
                    ? 'bg-white/10 text-white'
                    : apiStatus === 'error'
                      ? 'bg-red-500/15 text-red-200'
                      : 'bg-emerald-500/15 text-emerald-200')
                }
              >
                {apiStatus === 'loading' ? 'Detecting…' : apiStatus === 'error' ? 'Error' : 'Ready'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
              <div className="relative aspect-[3/4] w-full sm:aspect-video">
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <canvas
                  ref={overlayCanvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />

                {!isStarted ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-6 text-center">
                    <p className="max-w-xs text-sm text-white/85">
                      Tap “Start Scanning” to use your camera.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {error ? (
              <Card className="mt-4 border-red-500/30 bg-red-950/30 text-white">
                <CardHeader className="p-4">
                  <CardTitle className="text-base">Camera / API error</CardTitle>
                  <CardDescription className="break-words text-white/70">{error}</CardDescription>
                </CardHeader>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4 lg:col-span-5">
            <Card className="border-white/10 bg-white/5 text-white">
              <CardHeader className="p-4">
                <CardTitle className="text-base">Detection</CardTitle>
                <CardDescription className="text-white/70">Latest detection result.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-white/70">Confidence</div>
                  <div className="text-sm font-medium">{displayConfidence}</div>
                </div>

                <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-white/70">Collection Code</div>
                      <div className="truncate text-sm font-medium">{resolvedCollectionCode}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-white/70">Collection Name</div>
                      <div className="truncate text-sm font-medium">{displayName}</div>
                    </div>
                  </div>

                  {trainerClassesError ? (
                    <div className="mt-3 text-xs text-red-200/90">Classes unavailable: {trainerClassesError}</div>
                  ) : null}

                  {airtableCollectionCodeError ? (
                    <div className="mt-2 text-xs text-red-200/90">Airtable lookup failed: {airtableCollectionCodeError}</div>
                  ) : null}

                  <div className="mt-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!damUrl) return;
                        window.open(damUrl, '_blank', 'noopener,noreferrer');
                      }}
                      disabled={!damUrl}
                      className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 disabled:opacity-50"
                    >
                      Open in DAM
                    </Button>
                  </div>
                </div>

                {lastDetection && lowConfidence ? (
                  <div className="rounded-md border border-yellow-500/30 bg-yellow-950/20 p-3 text-sm text-yellow-100">
                    Low confidence. Adjust distance/lighting and try again.
                  </div>
                ) : null}
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <div className="text-xs text-white/50">
                  Tip: use bright light and keep the chandelier centered.
                </div>
              </CardFooter>
            </Card>

            <details className="rounded-xl border border-white/10 bg-white/5">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-white/90">
                Backend Model Status
              </summary>
              <div className="px-4 pb-4">
                <div className="space-y-2">
                  {backendHealth ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/70">model_exists</div>
                        <div className="text-sm font-medium">
                          {backendHealth.model_exists ? 'true' : 'false'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/70">size</div>
                        <div className="text-sm font-medium">
                          {typeof backendHealth.model_size_bytes === 'number'
                            ? `${Math.round(backendHealth.model_size_bytes / 1024 / 1024)} MB`
                            : '—'}
                        </div>
                      </div>
                      <div className="break-words text-xs text-white/60">{backendHealth.model_path}</div>
                    </>
                  ) : (
                    <div className="break-words text-sm text-white/70">
                      {backendHealthError ?? 'Loading…'}
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <Button
                    variant="outline"
                    onClick={() => void loadBackendHealth()}
                    className="w-full border-white/30 bg-transparent text-white hover:bg-white/10"
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </main>
  );
}
