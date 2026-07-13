type LightboxTrace = {
  id: number;
  t0: number;
};

declare global {
  interface Window {
    __productsLightboxTrace?: LightboxTrace;
    __productsLightboxTraceCounter?: number;
  }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function beginLightboxTrace(source: string): number | null {
  if (typeof window === 'undefined') return null;
  const id = (window.__productsLightboxTraceCounter ?? 0) + 1;
  window.__productsLightboxTraceCounter = id;
  const t0 = now();
  window.__productsLightboxTrace = { id, t0 };
  console.info(`[lightbox-perf #${id}] click:start source=${source} t=0.00ms`);
  return id;
}

export function markLightboxTrace(step: string, extra?: string): void {
  if (typeof window === 'undefined') return;
  const trace = window.__productsLightboxTrace;
  if (!trace) return;
  const dt = now() - trace.t0;
  console.info(
    `[lightbox-perf #${trace.id}] ${step} t=${dt.toFixed(2)}ms${extra ? ` ${extra}` : ''}`,
  );
}

export function endLightboxTrace(step = 'trace:end'): void {
  if (typeof window === 'undefined') return;
  const trace = window.__productsLightboxTrace;
  if (!trace) return;
  const dt = now() - trace.t0;
  console.info(`[lightbox-perf #${trace.id}] ${step} t=${dt.toFixed(2)}ms`);
  window.__productsLightboxTrace = undefined;
}
