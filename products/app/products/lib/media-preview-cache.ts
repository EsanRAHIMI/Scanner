import {
  DRIVE_IMAGE_WIDTH_THUMB,
  extractHostedMediaKey,
  getDriveDirectLink,
} from './product-utils';

const loadedSrcByKey = new Map<string, string>();
const loadPromises = new Map<string, Promise<string | null>>();

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

/** Prefetch a small preview once; subsequent calls reuse the in-memory + browser cache. */
export function prefetchMediaPreview(url: string, width: number = DRIVE_IMAGE_WIDTH_THUMB): Promise<string | null> {
  const key = previewCacheKey(url, width);
  const cached = loadedSrcByKey.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = loadPromises.get(key);
  if (pending) return pending;

  const src = getDriveDirectLink(url, width);
  if (!src) return Promise.resolve(null);

  const promise = new Promise<string | null>((resolve) => {
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

  loadPromises.set(key, promise);
  return promise;
}
