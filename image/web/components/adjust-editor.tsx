'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  adjustItem,
  DEFAULT_TRANSFORM,
  getSettings,
  resetItemAdjustments,
  resolveMediaUrl,
  type AdjustTransform,
  type BatchItem,
} from '@/lib/api';

type Mode = 'move' | 'erase';
type DragKind = 'move' | 'scale' | 'rotate' | 'pan' | null;
type Snapshot = { transform: AdjustTransform; mask: string | null };

const FALLBACK = { fillRatio: 0.82, outW: 1080, outH: 1440, defaultBg: 'lorenzo-default' };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function AdjustEditor({
  item,
  onSaved,
  onClose,
}: {
  item: BatchItem;
  onSaved: (item: BatchItem) => void;
  onClose: () => void;
}) {
  const [transform, setTransform] = useState<AdjustTransform>({ ...DEFAULT_TRANSFORM, ...(item.adjustments?.transform ?? {}) });
  const [mode, setMode] = useState<Mode>('move');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [brushSize, setBrushSize] = useState(36);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });

  const cfg = useRef({ ...FALLBACK });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const subjRef = useRef<HTMLImageElement | null>(null);
  const bgRef = useRef<HTMLImageElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null); // erase strokes (subject px)
  const maskedRef = useRef<HTMLCanvasElement | null>(null); // subject w/ mask applied
  const eraseRectRef = useRef({ x: 0, y: 0, w: 1, h: 1 }); // contain rect in erase mode (canvas px)
  const drag = useRef<{ kind: DragKind; sx: number; sy: number; st: AdjustTransform; d0: number; pan0: { x: number; y: number } }>({
    kind: null, sx: 0, sy: 0, st: DEFAULT_TRANSFORM, d0: 0, pan0: { x: 0, y: 0 },
  });
  const history = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [, force] = useState(0);

  const brandedUrl = resolveMediaUrl(item.final_url);

  // ---- load config + images ------------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getSettings();
        cfg.current = {
          fillRatio: s.settings.subject_fill_ratio ?? FALLBACK.fillRatio,
          outW: s.runtime.output_width ?? FALLBACK.outW,
          outH: s.runtime.output_height ?? FALLBACK.outH,
          defaultBg: s.settings.default_background_id ?? FALLBACK.defaultBg,
        };
      } catch {
        /* fallback */
      }
      const bgId = item.background_id || cfg.current.defaultBg;
      const subjSrc = resolveMediaUrl(item.processed_url) ?? '';
      const bgSrc = resolveMediaUrl(`/api/v1/assets/backgrounds/${bgId}`) ?? '';
      try {
        const [subj, bg] = await Promise.all([loadImage(subjSrc), loadImage(bgSrc).catch(() => null as unknown as HTMLImageElement)]);
        if (!alive) return;
        subjRef.current = subj;
        bgRef.current = bg;
        const m = document.createElement('canvas');
        m.width = subj.naturalWidth; m.height = subj.naturalHeight;
        maskRef.current = m;
        maskedRef.current = document.createElement('canvas');
        // Restore a previously-saved erase mask so re-editing is non-destructive.
        const mk = item.adjustments?.mask_key;
        if (mk) {
          try {
            const url = resolveMediaUrl(`/api/v1/files/${mk}`);
            if (url) {
              const r = await fetch(url, { cache: 'no-store' });
              if (r.ok) {
                const bmp = await createImageBitmap(await r.blob());
                m.getContext('2d')!.drawImage(bmp, 0, 0, m.width, m.height);
              }
            }
          } catch { /* start clean if mask can't be loaded */ }
        }
        recomputeMasked();
        if (!alive) return;
        setReady(true);
        requestAnimationFrame(redraw);
      } catch (e) {
        setError('Could not load image');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- masked subject ------------------------------------------------------
  const recomputeMasked = useCallback(() => {
    const subj = subjRef.current; const mc = maskedRef.current; const mask = maskRef.current;
    if (!subj || !mc || !mask) return;
    mc.width = subj.naturalWidth; mc.height = subj.naturalHeight;
    const ctx = mc.getContext('2d')!;
    ctx.clearRect(0, 0, mc.width, mc.height);
    ctx.drawImage(subj, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0, mc.width, mc.height);
    ctx.globalCompositeOperation = 'source-over';
  }, []);

  // ---- geometry helpers ----------------------------------------------------
  function fitDims() {
    const c = canvasRef.current!;
    return { Wf: c.width, Hf: c.height };
  }
  function subjectBox() {
    // returns center + drawn size in doc (fit) space
    const { Wf, Hf } = fitDims();
    const ms = maskedRef.current!;
    const base = cfg.current.fillRatio * transform.scale;
    const maxW = Wf * base, maxH = Hf * base;
    const f = Math.min(maxW / ms.width, maxH / ms.height);
    const dw = ms.width * f, dh = ms.height * f;
    const cx = Wf / 2 + transform.offset_x * Wf;
    const cy = Hf / 2 + transform.offset_y * Hf;
    return { cx, cy, dw, dh };
  }
  function docToScreen(x: number, y: number) {
    return { x: x * zoom + pan.x, y: y * zoom + pan.y };
  }
  function screenToDoc(ex: number, ey: number) {
    return { x: (ex - pan.x) / zoom, y: (ey - pan.y) / zoom };
  }
  function evtCanvas(e: React.PointerEvent) {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { ex: (e.clientX - r.left) * (c.width / r.width), ey: (e.clientY - r.top) * (c.height / r.height), rx: e.clientX - r.left, ry: e.clientY - r.top };
  }

  // ---- draw ----------------------------------------------------------------
  const redraw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#f3f1ee'; ctx.fillRect(0, 0, c.width, c.height);

    // Images may not be loaded yet (resize can fire first) — bail safely.
    if (!maskedRef.current || !subjRef.current) return;

    if (mode === 'erase') {
      // Subject upright, contained, for precise painting.
      const ms = maskedRef.current; if (!ms) return;
      const pad = 24;
      const availW = c.width - pad * 2, availH = c.height - pad * 2;
      const f = Math.min(availW / ms.width, availH / ms.height);
      const w = ms.width * f, h = ms.height * f;
      const x = (c.width - w) / 2, y = (c.height - h) / 2;
      eraseRectRef.current = { x, y, w, h };
      // checkerboard
      const sq = 14; for (let yy = 0; yy < c.height; yy += sq) for (let xx = 0; xx < c.width; xx += sq) { ctx.fillStyle = ((xx / sq + yy / sq) % 2 === 0) ? '#ffffff' : '#e6e6e6'; ctx.fillRect(xx, yy, sq, sq); }
      ctx.drawImage(ms, x, y, w, h);
      // show erased areas tint
      return;
    }

    ctx.save();
    ctx.translate(pan.x, pan.y); ctx.scale(zoom, zoom);
    const { Wf, Hf } = fitDims();
    // background
    if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0, Wf, Hf);
    else { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, Wf, Hf); }
    // subject
    const ms = maskedRef.current;
    const { cx, cy, dw, dh } = subjectBox();
    if (ms) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.scale(transform.flip_h ? -1 : 1, transform.flip_v ? -1 : 1);
      ctx.drawImage(ms, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
    // guides
    const lw = 1 / zoom;
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(120,120,120,0.5)'; ctx.strokeRect(0, 0, Wf, Hf); // canvas border
    ctx.setLineDash([6 / zoom, 6 / zoom]);
    ctx.strokeStyle = 'rgba(150,30,60,0.35)';
    ctx.strokeRect(Wf * 0.08, Hf * 0.08, Wf * 0.84, Hf * 0.84); // safe margins
    ctx.beginPath(); ctx.moveTo(Wf / 2, 0); ctx.lineTo(Wf / 2, Hf); ctx.moveTo(0, Hf / 2); ctx.lineTo(Wf, Hf / 2); ctx.stroke();
    ctx.setLineDash([]);
    // subject bbox + handles
    ctx.strokeStyle = 'rgba(150,30,60,0.9)'; ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(cx - dw / 2, cy - dh / 2, dw, dh);
    const hs = 7 / zoom;
    ctx.fillStyle = '#9b1c34';
    ctx.fillRect(cx + dw / 2 - hs / 2, cy + dh / 2 - hs / 2, hs, hs); // scale handle BR
    // rotate handle
    const rhx = cx, rhy = cy - dh / 2 - 24 / zoom;
    ctx.beginPath(); ctx.moveTo(cx, cy - dh / 2); ctx.lineTo(rhx, rhy); ctx.stroke();
    ctx.beginPath(); ctx.arc(rhx, rhy, hs * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }, [mode, zoom, pan, transform]);

  useEffect(() => { if (ready) redraw(); }, [ready, redraw]);

  // resize canvas to wrapper, keep output aspect
  useEffect(() => {
    function resize() {
      const wrap = wrapRef.current, c = canvasRef.current; if (!wrap || !c) return;
      const w = Math.max(320, wrap.clientWidth);
      const aspect = cfg.current.outH / cfg.current.outW;
      c.width = w; c.height = Math.round(w * aspect);
      redraw();
    }
    resize();
    const ro = new ResizeObserver(resize); if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [redraw, ready]);

  // ---- history -------------------------------------------------------------
  const maskDataUrl = useCallback(() => maskRef.current ? maskRef.current.toDataURL('image/png') : null, []);
  const snapshot = useCallback((): Snapshot => ({ transform, mask: maskDataUrl() }), [transform, maskDataUrl]);
  const pushHistory = useCallback(() => { history.current.push(snapshot()); if (history.current.length > 50) history.current.shift(); future.current = []; force((n) => n + 1); }, [snapshot]);
  const applySnapshot = useCallback((s: Snapshot) => {
    setTransform(s.transform);
    const m = maskRef.current; const ctx = m?.getContext('2d');
    if (m && ctx) { ctx.clearRect(0, 0, m.width, m.height); if (s.mask) { const img = new Image(); img.onload = () => { ctx.drawImage(img, 0, 0, m.width, m.height); recomputeMasked(); redraw(); }; img.src = s.mask; } else { recomputeMasked(); redraw(); } }
  }, [recomputeMasked, redraw]);
  function undo() { const s = history.current.pop(); if (!s) return; future.current.push(snapshot()); applySnapshot(s); setDirty(true); force((n) => n + 1); }
  function redo() { const s = future.current.pop(); if (!s) return; history.current.push(snapshot()); applySnapshot(s); setDirty(true); force((n) => n + 1); }

  // ---- pointer interactions ------------------------------------------------
  function paintErase(ex: number, ey: number) {
    const mask = maskRef.current; const ctx = mask?.getContext('2d'); const subj = subjRef.current;
    if (!mask || !ctx || !subj) return;
    const { x, y, w, h } = eraseRectRef.current;
    const sx = ((ex - x) / w) * subj.naturalWidth;
    const sy = ((ey - y) / h) * subj.naturalHeight;
    const r = (brushSize / 2) * (subj.naturalWidth / w);
    const grd = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r);
    grd.addColorStop(0, `rgba(220,40,40,${brushOpacity})`);
    grd.addColorStop(1, 'rgba(220,40,40,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    recomputeMasked();
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!ready || showResult) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const { ex, ey } = evtCanvas(e);
    if (mode === 'erase') { drag.current.kind = 'move'; paintErase(ex, ey); redraw(); return; }
    const d = screenToDoc(ex, ey);
    const { cx, cy, dw, dh } = subjectBox();
    const tol = 12 / zoom;
    const brX = cx + dw / 2, brY = cy + dh / 2;
    const rhx = cx, rhy = cy - dh / 2 - 24 / zoom;
    let kind: DragKind = 'pan';
    if (Math.hypot(d.x - rhx, d.y - rhy) < tol + 6 / zoom) kind = 'rotate';
    else if (Math.hypot(d.x - brX, d.y - brY) < tol + 6 / zoom) kind = 'scale';
    else if (d.x > cx - dw / 2 && d.x < cx + dw / 2 && d.y > cy - dh / 2 && d.y < cy + dh / 2) kind = 'move';
    drag.current = { kind, sx: ex, sy: ey, st: { ...transform }, d0: Math.hypot(d.x - cx, d.y - cy) || 1, pan0: { ...pan } };
  }

  function onPointerMove(e: React.PointerEvent) {
    const { ex, ey, rx, ry } = evtCanvas(e);
    if (mode === 'erase') setCursor({ x: rx, y: ry, show: true });
    if (!drag.current.kind) return;
    if (mode === 'erase') { paintErase(ex, ey); redraw(); return; }
    const d = screenToDoc(ex, ey);
    const { Wf, Hf } = fitDims();
    const cx = Wf / 2 + drag.current.st.offset_x * Wf;
    const cy = Hf / 2 + drag.current.st.offset_y * Hf;
    if (drag.current.kind === 'pan') {
      setPan({ x: drag.current.pan0.x + (ex - drag.current.sx), y: drag.current.pan0.y + (ey - drag.current.sy) });
    } else if (drag.current.kind === 'move') {
      const start = screenToDoc(drag.current.sx, drag.current.sy);
      setTransform((t) => ({ ...t, offset_x: drag.current.st.offset_x + (d.x - start.x) / Wf, offset_y: drag.current.st.offset_y + (d.y - start.y) / Hf }));
    } else if (drag.current.kind === 'scale') {
      const dist = Math.hypot(d.x - cx, d.y - cy);
      const next = Math.max(0.2, Math.min(2, drag.current.st.scale * (dist / drag.current.d0)));
      setTransform((t) => ({ ...t, scale: next }));
    } else if (drag.current.kind === 'rotate') {
      const ang = (Math.atan2(d.y - cy, d.x - cx) + Math.PI / 2) * (180 / Math.PI);
      setTransform((t) => ({ ...t, rotation: Math.max(-180, Math.min(180, Math.round(ang))) }));
    }
    setDirty(true);
  }

  function onPointerUp() {
    const kind = drag.current.kind;
    if (!kind) return;
    drag.current.kind = null;
    if (kind === 'pan') return; // panning isn't an edit
    pushHistory();
    setDirty(true);
  }

  // ---- transform helpers ----------------------------------------------------
  function setT(patch: Partial<AdjustTransform>) { setTransform((t) => ({ ...t, ...patch })); setDirty(true); }
  function commit() { pushHistory(); }
  function fitView() { setZoom(1); setPan({ x: 0, y: 0 }); }
  function clearErase() { const m = maskRef.current; const ctx = m?.getContext('2d'); if (m && ctx) ctx.clearRect(0, 0, m.width, m.height); recomputeMasked(); redraw(); setDirty(true); pushHistory(); }

  // ---- save / reset --------------------------------------------------------
  async function save() {
    setSaving(true); setError(null);
    try {
      const ink = maskHasInk();
      const res = await adjustItem(item.id, { transform, mask_base64: ink ? maskDataUrl() : null, clear_mask: !ink });
      onSaved(res.item);
      setDirty(false); setSaved(true); setShowResult(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }
  function maskHasInk(): boolean {
    const m = maskRef.current; if (!m) return false;
    try { const ctx = m.getContext('2d')!; const d = ctx.getImageData(0, 0, m.width, m.height).data; for (let i = 3; i < d.length; i += 4) { if (d[i] > 8) return true; } } catch { return true; }
    return false;
  }
  async function revert() {
    setSaving(true); setError(null);
    try {
      const res = await resetItemAdjustments(item.id);
      setTransform({ ...DEFAULT_TRANSFORM });
      const m = maskRef.current; const ctx = m?.getContext('2d'); if (m && ctx) ctx.clearRect(0, 0, m.width, m.height);
      recomputeMasked(); history.current = []; future.current = [];
      onSaved(res.item); setDirty(false); setShowResult(false); redraw();
    } catch (err) { setError(err instanceof Error ? err.message : 'Reset failed'); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brandedFresh = brandedUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/75 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true">
      <div className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-brand-medium-gray/20 bg-brand-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-brand-medium-gray/10 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-black">Touch up — {item.display_name}</p>
            <p className="text-[11px] text-brand-medium-gray">
              {dirty ? <span className="text-amber-600">● Unsaved changes</span> : saved ? <span className="text-emerald-600">✓ Saved</span> : 'Original is always kept'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-full border border-brand-medium-gray/25 text-[11px]">
              <button type="button" className={`px-3 py-1 ${mode === 'move' && !showResult ? 'bg-brand-burgundy text-white' : 'text-brand-medium-gray'}`} onClick={() => { setShowResult(false); setMode('move'); }}>Move</button>
              <button type="button" className={`px-3 py-1 ${mode === 'erase' && !showResult ? 'bg-brand-burgundy text-white' : 'text-brand-medium-gray'}`} onClick={() => { setShowResult(false); setMode('erase'); }}>Erase</button>
              <button type="button" className={`px-3 py-1 ${showResult ? 'bg-brand-burgundy text-white' : 'text-brand-medium-gray'}`} onClick={() => setShowResult(true)}>Result</button>
            </div>
            <button type="button" className="btn-outline shrink-0 px-3 py-1.5 text-xs" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="grid flex-1 grid-rows-[1fr_auto] overflow-hidden lg:grid-cols-[1fr_280px] lg:grid-rows-1">
          {/* Canvas / result */}
          <div ref={wrapRef} className="relative flex items-center justify-center overflow-hidden bg-brand-light-gray/30 p-3">
            {!ready ? <p className="text-sm text-brand-medium-gray">Loading…</p> : null}
            {showResult ? (
              <div className="flex h-full w-full items-center justify-center">
                {brandedFresh ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brandedFresh} alt="Saved result" className="max-h-full max-w-full rounded-lg object-contain shadow" />
                ) : <p className="text-sm text-brand-medium-gray">No saved output yet</p>}
              </div>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  className={`max-h-full max-w-full touch-none rounded-lg shadow-sm ${mode === 'erase' ? 'cursor-none' : 'cursor-grab'}`}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={() => { onPointerUp(); setCursor((c) => ({ ...c, show: false })); }}
                  onWheel={(e) => { const f = e.deltaY < 0 ? 1.1 : 1 / 1.1; setZoom((z) => Math.max(0.3, Math.min(5, z * f))); }}
                />
                {mode === 'erase' && cursor.show ? (
                  <div className="pointer-events-none absolute rounded-full border border-brand-burgundy/80" style={{ left: cursor.x - brushSize / 2, top: cursor.y - brushSize / 2, width: brushSize, height: brushSize }} />
                ) : null}
                {mode === 'move' ? (
                  <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-black/55 px-3 py-1 text-[10px] text-white">
                    Drag to move · corner = scale · top dot = rotate · scroll = zoom
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4 overflow-y-auto border-t border-brand-medium-gray/10 p-4 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2">
              <button type="button" className="flex-1 rounded-lg border border-brand-medium-gray/25 px-2 py-1.5 text-xs" onClick={undo} title="Undo (⌘Z)">Undo</button>
              <button type="button" className="flex-1 rounded-lg border border-brand-medium-gray/25 px-2 py-1.5 text-xs" onClick={redo} title="Redo (⇧⌘Z)">Redo</button>
              <button type="button" className="rounded-lg border border-brand-medium-gray/25 px-2 py-1.5 text-xs" onClick={fitView} title="Fit view">Fit</button>
              <button type="button" className="rounded-lg border border-brand-medium-gray/25 px-2 py-1.5 text-xs" onClick={() => { setZoom(1); }} title="100%">1:1</button>
            </div>

            {mode === 'erase' ? (
              <div className="space-y-3 rounded-lg border border-brand-medium-gray/15 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-medium-gray">Erase</p>
                <label className="block space-y-1 text-xs">
                  <span className="flex justify-between"><span>Brush size</span><span className="font-mono text-[10px]">{brushSize}px</span></span>
                  <input type="range" min={6} max={140} value={brushSize} className="w-full accent-brand-burgundy" onChange={(e) => setBrushSize(Number(e.target.value))} />
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="flex justify-between"><span>Strength</span><span className="font-mono text-[10px]">{Math.round(brushOpacity * 100)}%</span></span>
                  <input type="range" min={10} max={100} value={Math.round(brushOpacity * 100)} className="w-full accent-brand-burgundy" onChange={(e) => setBrushOpacity(Number(e.target.value) / 100)} />
                </label>
                <button type="button" className="w-full rounded-lg border border-brand-medium-gray/25 px-2 py-1.5 text-[11px]" onClick={clearErase}>Clear erase</button>
                <p className="text-[10px] text-brand-medium-gray">Paint over leftovers/halos to remove them. Undo restores.</p>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-brand-medium-gray/15 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-medium-gray">Position</p>
                <label className="block space-y-1 text-xs">
                  <span className="flex justify-between"><span>Scale</span><span className="font-mono text-[10px]">{Math.round(transform.scale * 100)}%</span></span>
                  <input type="range" min={20} max={200} value={Math.round(transform.scale * 100)} className="w-full accent-brand-burgundy" onChange={(e) => setT({ scale: Number(e.target.value) / 100 })} onMouseUp={commit} onTouchEnd={commit} />
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="flex justify-between"><span>Rotate</span><span className="font-mono text-[10px]">{transform.rotation}°</span></span>
                  <input type="range" min={-180} max={180} value={transform.rotation} className="w-full accent-brand-burgundy" onChange={(e) => setT({ rotation: Number(e.target.value) })} onMouseUp={commit} onTouchEnd={commit} />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" className="rounded-lg border border-brand-medium-gray/25 px-2 py-1.5 text-[11px]" onClick={() => { setT({ flip_h: !transform.flip_h }); commit(); }}>Flip H</button>
                  <button type="button" className="rounded-lg border border-brand-medium-gray/25 px-2 py-1.5 text-[11px]" onClick={() => { setT({ flip_v: !transform.flip_v }); commit(); }}>Flip V</button>
                  <button type="button" className="rounded-lg border border-brand-medium-gray/25 px-2 py-1.5 text-[11px]" onClick={() => { setT({ offset_x: 0, offset_y: 0 }); commit(); }}>Center</button>
                </div>
                <button type="button" className="w-full rounded-lg border border-brand-medium-gray/25 px-2 py-1.5 text-[11px]" onClick={() => { setTransform({ ...DEFAULT_TRANSFORM }); setDirty(true); commit(); }}>Reset transform</button>
              </div>
            )}

            {error ? <p className="rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-700">{error}</p> : null}

            <div className="space-y-2 border-t border-brand-medium-gray/10 pt-3">
              <button type="button" className="btn-primary w-full px-3 py-2 text-sm" disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : dirty ? 'Save touch-up' : 'Save touch-up'}
              </button>
              <button type="button" className="btn-outline w-full px-3 py-2 text-xs" disabled={saving} onClick={() => void revert()}>Revert to original</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
