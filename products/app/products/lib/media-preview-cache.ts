import {
  DRIVE_IMAGE_WIDTH_THUMB,
  extractHostedMediaKey,
  getDriveDirectLink,
} from './product-utils';

const loadedSrcByKey = new Map<string, string>();
const loadPromises = new Map<string, Promise<string | null>>();

const MAX_CONCURRENT_PREFETCH = 8;
let activePrefetches = 0;
const prefetchQueue: Array<() => void> = [];

function drainPrefetchQueue() {
  while (activePrefetches < MAX_CONCURRENT_PREFETCH && prefetchQueue.length > 0) {
    const run = prefetchQueue.shift();
    if (run) run();
  }
}

function schedulePrefetch<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activePrefetches += 1;
      void task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activePrefetches -= 1;
          drainPrefetchQueue();
        });
    };
    if (activePrefetches < MAX_CONCURRENT_PREFETCH) run();
    else prefetchQueue.push(run);
  });
}

function previewCacheKey(url: string, width: number): string {
  const hostKey = extractHostedMediaKey(url);
  return hostKey ? `${hostKey}|w${width}` : `${url.trim()}|w${width}`;
}

export function resolvePreviewSrc(url: string, width: number): string {
  const key = previewCacheKey(url, width);
  return loadedSrcByKey.get(key) ?? getDriveDirectLink(url, width);
}

export function isPreviewLoaded(url: string, width: number): boolean {
  return loadedSrcByKey.has(previewCacheKey(url, width));
}

function loadImageSrc(src: string, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.onload = () => {
      loadedSrcByKey.set(key, src);
      loadPromises.delete(key);
      resolve(src);
    };
    img.onerror = () => {
      loadPromises.delete(key);
      resolve(null);
    };
    img.src = src;
  });
}

/** Prefetch a sized preview once; subsequent calls reuse the in-memory + browser cache. */
export function prefetchMediaPreview(
  url: string,
  width: number = DRIVE_IMAGE_WIDTH_THUMB,
): Promise<string | null> {
  const key = previewCacheKey(url, width);
  const cached = loadedSrcByKey.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = loadPromises.get(key);
  if (pending) return pending;

  const src = getDriveDirectLink(url, width);
  if (!src) return Promise.resolve(null);

  const promise = schedulePrefetch(() => loadImageSrc(src, key));
  loadPromises.set(key, promise);
  return promise;
}
