'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { apiJson } from '@/lib/api';
import { getTrainerApiBase } from '@/lib/env';
import type { Annotation, ClassItem, NormalizedBBox, QueueItem } from '@/types/trainer';

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

type Props = {
  params: { item_id: string };
};

function StatusPill({ status }: { status: string }) {
  const isPending = status === 'pending';
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-1 text-xs ' +
        (isPending ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800')
      }
    >
      {status}
    </span>
  );
}

export default function LabelItemPage({ params }: Props) {
  const itemId = params.item_id;
  const router = useRouter();

  const [item, setItem] = React.useState<QueueItem | null>(null);
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [classes, setClasses] = React.useState<ClassItem[]>([]);
  const [classId, setClassId] = React.useState<string>('');
  const [bbox, setBbox] = React.useState<NormalizedBBox | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const dragRef = React.useRef<{
    active: boolean;
    startX: number;
    startY: number;
  }>({ active: false, startX: 0, startY: 0 });

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [it, cls, q] = await Promise.all([
        apiJson<QueueItem>(`/queue/${encodeURIComponent(itemId)}`),
        apiJson<ClassItem[]>('/classes'),
        apiJson<QueueItem[]>('/queue'),
      ]);
      setItem(it);
      setClasses(cls);
      setQueue(Array.isArray(q) ? q : []);

      const existing = it.annotation;
      if (existing) {
        setClassId(existing.class_id);
        setBbox(existing.bbox);
      } else {
        setClassId(cls[0]?.id ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [itemId]);

  const nav = React.useMemo(() => {
    const idx = queue.findIndex((q) => q.item_id === itemId);
    const prevId = idx > 0 ? queue[idx - 1]?.item_id ?? null : null;
    const nextId = idx >= 0 && idx < queue.length - 1 ? queue[idx + 1]?.item_id ?? null : null;
    return { idx, prevId, nextId, total: queue.length };
  }, [queue, itemId]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && nav.prevId) {
        router.push(`/queue/${encodeURIComponent(nav.prevId)}`);
      }
      if (e.key === 'ArrowRight' && nav.nextId) {
        router.push(`/queue/${encodeURIComponent(nav.nextId)}`);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nav.nextId, nav.prevId, router]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const syncCanvas = React.useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const rect = img.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }, []);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!bbox) return;

    const x = bbox.x * canvas.width;
    const y = bbox.y * canvas.height;
    const w = bbox.w * canvas.width;
    const h = bbox.h * canvas.height;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(x, Math.max(0, y - 24), 180, 24);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = '14px ui-sans-serif, system-ui';
    ctx.fillText(classId || '—', x + 8, Math.max(0, y - 20));
  }, [bbox, classId]);

  React.useEffect(() => {
    syncCanvas();
    draw();
  }, [syncCanvas, draw]);

  React.useEffect(() => {
    const onResize = () => {
      syncCanvas();
      draw();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw, syncCanvas]);

  const toNormalized = React.useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x: clamp01(x), y: clamp01(y) };
  }, []);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = toNormalized(e.clientX, e.clientY);
      if (!p) return;
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
      dragRef.current = { active: true, startX: p.x, startY: p.y };
      setBbox({ x: p.x, y: p.y, w: 0.001, h: 0.001 });
    },
    [toNormalized]
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragRef.current.active) return;
      const p = toNormalized(e.clientX, e.clientY);
      if (!p) return;
      const sx = dragRef.current.startX;
      const sy = dragRef.current.startY;
      const x1 = Math.min(sx, p.x);
      const y1 = Math.min(sy, p.y);
      const x2 = Math.max(sx, p.x);
      const y2 = Math.max(sy, p.y);
      setBbox({ x: x1, y: y1, w: Math.max(0.001, x2 - x1), h: Math.max(0.001, y2 - y1) });
    },
    [toNormalized]
  );

  const handlePointerUp = React.useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const save = React.useCallback(async () => {
    if (!bbox || !classId) {
      setError('Select class and draw a bounding box first.');
      return;
    }

    setSaving(true);
    setError(null);
    const body: Annotation = { class_id: classId, bbox };

    try {
      await apiJson(`/queue/${encodeURIComponent(itemId)}/annotation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [bbox, classId, itemId, load]);

  const hardDelete = React.useCallback(async () => {
    const ok = window.confirm('این تصویر و اطلاعات مربوطه از سرور حذف می‌شود. ادامه می‌دهید؟');
    if (!ok) return;

    setDeleting(true);
    setError(null);
    try {
      await apiJson(`/queue/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });

      const go = nav.nextId ?? nav.prevId;
      if (go) {
        router.push(`/queue/${encodeURIComponent(go)}`);
      } else {
        router.push('/queue');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }, [itemId, nav.nextId, nav.prevId, router]);

  const imageUrl = item?.image_url ? `${getTrainerApiBase()}${item.image_url}` : null;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Label item</h1>
        <p className="mt-1 text-sm text-black/60">Draw one bounding box and choose a class.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <div className="text-black/60">
            Item: <span className="font-mono text-black">{itemId}</span>
          </div>
          {item?.status ? <StatusPill status={item.status} /> : null}
          {nav.idx >= 0 ? (
            <div className="text-black/50">
              {nav.idx + 1}/{nav.total}
            </div>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <button
              className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50"
              type="button"
              onClick={() => nav.prevId && router.push(`/queue/${encodeURIComponent(nav.prevId)}`)}
              disabled={!nav.prevId}
              title="Previous (ArrowLeft)"
            >
              Prev
            </button>
            <button
              className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50"
              type="button"
              onClick={() => nav.nextId && router.push(`/queue/${encodeURIComponent(nav.nextId)}`)}
              disabled={!nav.nextId}
              title="Next (ArrowRight)"
            >
              Next
            </button>
            <button
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
              type="button"
              onClick={() => void hardDelete()}
              disabled={deleting}
              title="Delete this image from server"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <div className="relative overflow-hidden rounded-xl border border-black/10 bg-black">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={imageUrl}
                alt={itemId}
                className="block h-auto w-full"
                onLoad={() => {
                  syncCanvas();
                  draw();
                }}
              />
            ) : (
              <div className="p-10 text-center text-sm text-white/70">Loading image…</div>
            )}

            <canvas
              ref={canvasRef}
              className="absolute left-0 top-0 h-full w-full"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium">Controls</div>

            <div className="mt-4 space-y-2">
              <div className="text-xs text-black/50">Class</div>
              <select
                className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-xs text-black/50">BBox (normalized)</div>
              <pre className="rounded-md bg-black/5 p-3 text-xs text-black/70">
                {bbox ? JSON.stringify(bbox, null, 2) : '—'}
              </pre>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-50"
                onClick={() => void save()}
                disabled={saving}
                type="button"
              >
                {saving ? 'Saving…' : 'Save annotation'}
              </button>
              <button
                className="rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5"
                onClick={() => setBbox(null)}
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
