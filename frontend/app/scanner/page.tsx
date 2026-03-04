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
  const [apiStatus, setApiStatus] = React.useState<'idle' | 'loading' | 'error'>('idle');
  const [backendHealth, setBackendHealth] = React.useState<BackendHealth | null>(null);
  const [backendHealthError, setBackendHealthError] = React.useState<string | null>(null);

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
      } else {
        setLastDetection(null);
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

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs tracking-[0.25em] text-white/60">LORENZO</div>
            <h1 className="text-lg font-semibold">Chandelier Scanner</h1>
          </div>

          {!isStarted ? (
            <Button onClick={() => void handleStart()} className="bg-white text-black hover:bg-white/90">
              Start Scanning
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handlePauseResume}
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
          )}
        </div>

        <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black">
          <video
            ref={videoRef}
            className="block h-auto w-full"
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={overlayCanvasRef}
            className="pointer-events-none absolute left-0 top-0 h-full w-full"
          />

          {!isStarted ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-6 text-center">
              <p className="text-sm text-white/80">Tap “Start Scanning” to use your camera.</p>
            </div>
          ) : null}

          {apiStatus === 'loading' && !isPaused ? (
            <div className="absolute right-3 top-3 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
              Detecting…
            </div>
          ) : null}
        </div>

        {error ? (
          <Card className="border-red-500/30 bg-red-950/30 text-white">
            <CardHeader className="p-4">
              <CardTitle className="text-base">Camera / API error</CardTitle>
              <CardDescription className="text-white/70">{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader className="p-4">
            <CardTitle className="text-base">Detection</CardTitle>
            <CardDescription className="text-white/70">
              Product and confidence from the latest frame.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70">Product</div>
              <div className="text-sm font-medium">{displayName}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70">Confidence</div>
              <div className="text-sm font-medium">{displayConfidence}</div>
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

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader className="p-4">
            <CardTitle className="text-base">Backend Model Status</CardTitle>
            <CardDescription className="text-white/70">
              بررسی وجود فایل مدل و دسترسی backend به آن
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
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
                <div className="text-xs text-white/60">{backendHealth.model_path}</div>
              </>
            ) : (
              <div className="text-sm text-white/70">{backendHealthError ?? 'Loading…'}</div>
            )}
          </CardContent>
          <CardFooter className="p-4 pt-0">
            <Button
              variant="outline"
              onClick={() => void loadBackendHealth()}
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              Refresh
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
