/**
 * In-memory preview URL cache for list / gallery thumbnails and hover prefetch.
 *
 * - Success entries are LRU-bounded so long scroll sessions do not grow RAM without limit.
 * - Failed entries are a separate short-TTL negative cache to avoid retry storms on broken links.
 * - Keys combine host asset id + URL fingerprint so edited sharing links do not reuse stale previews.
 *
 * Eviction only drops this module's Map; mounted `<img>` nodes keep their src. The browser HTTP
 * cache may still serve bytes after eviction. Call `invalidateMediaPreviewForUrl` after URL edits.
 */
import {
  DRIVE_IMAGE_WIDTH_FULL,
  DRIVE_IMAGE_WIDTH_GALLERY,
  DRIVE_IMAGE_WIDTH_HOVER,
  DRIVE_IMAGE_WIDTH_LIST,
  DRIVE_IMAGE_WIDTH_THUMB,
  extractHostedMediaKey,
  getDriveDirectLink,
} from './product-utils';

/** All lh3 widths used in the UI — invalidate clears every variant for a URL. */
const PREVIEW_CACHE_WIDTHS = [
  DRIVE_IMAGE_WIDTH_THUMB,
  DRIVE_IMAGE_WIDTH_LIST,
  DRIVE_IMAGE_WIDTH_GALLERY,
  DRIVE_IMAGE_WIDTH_HOVER,
  DRIVE_IMAGE_WIDTH_FULL,
] as const;

/** ~130 product media × ~3 widths (thumb / list / hover) in the working scroll window. */
const MAX_PREVIEW_CACHE_DESKTOP = 1200;
const MAX_PREVIEW_CACHE_MOBILE = 480;

/** Recent load failures — short TTL so transient CDN/network errors can recover. */
const FAILED_PREVIEW_TTL_MS = 120_000;
const MAX_FAILED_PREVIEW_CACHE_DESKTOP = 256;
const MAX_FAILED_PREVIEW_CACHE_MOBILE = 128;

const MAX_CONCURRENT_PREFETCH_DESKTOP = 8;
const MAX_CONCURRENT_PREFETCH_MOBILE = 4;

type FailedPreviewEntry = { failedAt: number };

/**
 * LRU map: `Map` insertion order = oldest → newest.
 * `get`/`set` refresh recency; overflow evicts from the front.
 */
class LruCache<V> {
  private maxSize: number;
  private readonly map = new Map<string, V>();
  private readonly onEvict: (key: string) => void;

  constructor(maxSize: number, onEvict: (key: string) => void) {
    this.maxSize = Math.max(1, maxSize);
    this.onEvict = onEvict;
  }

  get size(): number {
    return this.map.size;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  peek(key: string): V | undefined {
    return this.map.get(key);
  }

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    this.trimToMax();
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  setMaxSize(next: number): void {
    this.maxSize = Math.max(1, next);
    this.trimToMax();
  }

  private trimToMax(): void {
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
      this.onEvict(oldest);
    }
  }
}

const loadPromises = new Map<string, Promise<string | null>>();

/** Keys that successfully decoded at least once — survives LRU eviction for instant remount. */
const loadedOnceKeys = new Set<string>();

function onPreviewCacheEvict(key: string): void {
  loadPromises.delete(key);
}

let maxPreviewCacheEntries = MAX_PREVIEW_CACHE_DESKTOP;
let maxFailedPreviewCacheEntries = MAX_FAILED_PREVIEW_CACHE_DESKTOP;

/** Kept in sync via resize listener; called before writes only (not on hot read path). */
function syncPreviewCacheCapacity(): void {
  if (!narrowViewportMq) return;
  const narrow = narrowViewportMq.matches;
  const nextLoaded = narrow ? MAX_PREVIEW_CACHE_MOBILE : MAX_PREVIEW_CACHE_DESKTOP;
  const nextFailed = narrow ? MAX_FAILED_PREVIEW_CACHE_MOBILE : MAX_FAILED_PREVIEW_CACHE_DESKTOP;
  if (nextLoaded !== maxPreviewCacheEntries) {
    maxPreviewCacheEntries = nextLoaded;
    loadedSrcByKey.setMaxSize(nextLoaded);
  }
  if (nextFailed !== maxFailedPreviewCacheEntries) {
    maxFailedPreviewCacheEntries = nextFailed;
    failedByKey.setMaxSize(nextFailed);
  }
}

let narrowViewportMq: MediaQueryList | null = null;

if (typeof window !== 'undefined') {
  narrowViewportMq = window.matchMedia('(max-width: 639px)');
  const narrow = narrowViewportMq.matches;
  maxPreviewCacheEntries = narrow ? MAX_PREVIEW_CACHE_MOBILE : MAX_PREVIEW_CACHE_DESKTOP;
  maxFailedPreviewCacheEntries = narrow ? MAX_FAILED_PREVIEW_CACHE_MOBILE : MAX_FAILED_PREVIEW_CACHE_DESKTOP;
  narrowViewportMq.addEventListener('change', syncPreviewCacheCapacity);
}

/** Resolved lh3 (or direct) src strings after a successful decode. */
const loadedSrcByKey = new LruCache<string>(maxPreviewCacheEntries, onPreviewCacheEvict);
/** Recent failures; peek-only reads so repeated hovers do not extend the block window. */
const failedByKey = new LruCache<FailedPreviewEntry>(maxFailedPreviewCacheEntries, () => {});

function isFailedKey(key: string): boolean {
  const entry = failedByKey.peek(key);
  if (!entry) return false;
  if (Date.now() - entry.failedAt > FAILED_PREVIEW_TTL_MS) {
    failedByKey.delete(key);
    return false;
  }
  return true;
}

function clearFailedKey(key: string): void {
  failedByKey.delete(key);
}

/** Blocks prefetch / resolve for this key until TTL expires or a load succeeds. */
function rememberFailed(key: string): void {
  syncPreviewCacheCapacity();
  if (isFailedKey(key)) return;
  loadedSrcByKey.delete(key);
  loadPromises.delete(key);
  failedByKey.set(key, { failedAt: Date.now() });
}

function maxConcurrentPrefetches(): number {
  if (typeof window === 'undefined') return MAX_CONCURRENT_PREFETCH_DESKTOP;
  return window.matchMedia('(max-width: 639px)').matches
    ? MAX_CONCURRENT_PREFETCH_MOBILE
    : MAX_CONCURRENT_PREFETCH_DESKTOP;
}

let activePrefetches = 0;
const prefetchQueue: Array<() => void> = [];

function drainPrefetchQueue() {
  while (activePrefetches < maxConcurrentPrefetches() && prefetchQueue.length > 0) {
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
    if (activePrefetches < maxConcurrentPrefetches()) run();
    else prefetchQueue.push(run);
  });
}

/**
 * Fingerprint of the stored URL string. Different sharing links to the same Drive file
 * must not share one preview cache slot (host id alone is not enough).
 */
function urlPreviewFingerprint(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 96) return trimmed;
  let h = 2166136261;
  for (let i = 0; i < trimmed.length; i++) {
    h ^= trimmed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv${(h >>> 0).toString(36)}`;
}

/** hostKey dedupes identical URLs across rows; fingerprint separates different links to the same file. */
function previewCacheKey(url: string, width: number): string {
  const trimmed = url.trim();
  if (!trimmed) return `|w${width}`;
  const hostKey = extractHostedMediaKey(trimmed);
  const fingerprint = urlPreviewFingerprint(trimmed);
  if (hostKey) return `${hostKey}|${fingerprint}|w${width}`;
  return `${fingerprint}|w${width}`;
}

function dropPreviewCacheEntry(key: string): void {
  loadedSrcByKey.delete(key);
  failedByKey.delete(key);
  loadPromises.delete(key);
}

/** Drop cached / failed / in-flight preview state for a URL (call after link edits). */
export function invalidateMediaPreviewForUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) return;
  for (const width of PREVIEW_CACHE_WIDTHS) {
    dropPreviewCacheEntry(previewCacheKey(trimmed, width));
  }
}

function rememberLoadedSrc(key: string, src: string): void {
  syncPreviewCacheCapacity();
  clearFailedKey(key);
  loadedOnceKeys.add(key);
  loadedSrcByKey.set(key, src);
}

/** True when a recent load failure blocks prefetch / direct-link attempts for this url+width. */
export function isPreviewLoadBlocked(url: string, width: number): boolean {
  return isFailedKey(previewCacheKey(url, width));
}

export function resolvePreviewSrc(url: string, width: number): string {
  const key = previewCacheKey(url, width);
  // Empty string → CachedMediaPreview shows placeholder without mounting a doomed <img>.
  if (isFailedKey(key)) return '';
  return loadedSrcByKey.get(key) ?? getDriveDirectLink(url, width);
}

export function isPreviewLoaded(url: string, width: number): boolean {
  const key = previewCacheKey(url, width);
  return loadedSrcByKey.has(key) || loadedOnceKeys.has(key);
}

/** True after a successful decode — used to show browser-cached src without waiting on the queue. */
export function wasPreviewEverLoaded(url: string, width: number): boolean {
  return loadedOnceKeys.has(previewCacheKey(url, width));
}

/** Record a failed preview load so prefetch and `<img>` do not retry in a tight loop. */
export function registerPreviewFailed(url: string, width: number): void {
  rememberFailed(previewCacheKey(url, width));
}

/** Called when a preview `<img>` finishes loading (avoids duplicate prefetch fetches). */
export function registerPreviewLoaded(url: string, width: number, loadedSrc: string): void {
  const key = previewCacheKey(url, width);
  rememberLoadedSrc(key, loadedSrc);
  loadPromises.delete(key);
}

function loadImageSrc(src: string, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.onload = () => {
      rememberLoadedSrc(key, src);
      loadPromises.delete(key);
      resolve(src);
    };
    img.onerror = () => {
      rememberFailed(key);
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
  syncPreviewCacheCapacity();
  const key = previewCacheKey(url, width);
  if (isFailedKey(key)) return Promise.resolve(null);

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

type SequentialJob = {
  orderKey: string;
  tier: number;
  url: string;
  width: number;
  generation: number;
  resolve: (src: string | null) => void;
};

const MAX_CONCURRENT_BY_TIER: Record<number, number> = {
  0: 8,
  1: 2,
  2: 4,
};

const sequentialJobs: SequentialJob[] = [];
const activeSequentialByTier = new Map<number, number>();
let sequentialDrainRunning = false;
let mediaLoadGeneration = 0;

/** Drop queued work and invalidate in-flight sequential resolves (search / filter / scroll jump). */
export function resetSequentialMediaQueue(): number {
  mediaLoadGeneration += 1;
  for (const job of sequentialJobs) {
    job.resolve(null);
  }
  sequentialJobs.length = 0;
  sequentialDrainRunning = false;
  activeSequentialByTier.clear();
  return mediaLoadGeneration;
}

export function getMediaLoadGeneration(): number {
  return mediaLoadGeneration;
}

function drainSequentialJobs() {
  if (sequentialDrainRunning) return;
  sequentialDrainRunning = true;

  const tierOf = (job: SequentialJob) => job.tier;
  const activeForTier = (tier: number) => activeSequentialByTier.get(tier) ?? 0;

  const runNext = () => {
    sequentialJobs.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.orderKey.localeCompare(b.orderKey);
    });

    const jobIndex = sequentialJobs.findIndex(
      (job) => activeForTier(job.tier) < (MAX_CONCURRENT_BY_TIER[job.tier] ?? 1),
    );

    if (jobIndex === -1) {
      sequentialDrainRunning = false;
      return;
    }

    const job = sequentialJobs.splice(jobIndex, 1)[0]!;
    const tier = tierOf(job);
    activeSequentialByTier.set(tier, activeForTier(tier) + 1);
    const genAtStart = job.generation;

    void prefetchMediaPreview(job.url, job.width)
      .then((src) => {
        if (genAtStart === mediaLoadGeneration) job.resolve(src);
        else job.resolve(null);
      })
      .finally(() => {
        activeSequentialByTier.set(tier, Math.max(0, activeForTier(tier) - 1));
        runNext();
      });
  };

  runNext();
}

const TIER_BY_LOAD: Record<string, number> = {
  visible: 0,
  bootstrap: 2,
  lookahead: 1,
  off: 3,
};

/**
 * Instagram-style ordered preview load — visible rows run in parallel (tier 0),
 * lookahead rows are throttled (tier 1).
 */
export function acquireSequentialPreview(
  url: string,
  width: number,
  orderKey: string,
  loadTier: keyof typeof TIER_BY_LOAD = 'visible',
): Promise<string | null> {
  syncPreviewCacheCapacity();
  const key = previewCacheKey(url, width);
  if (isFailedKey(key)) return Promise.resolve(null);

  const cached = loadedSrcByKey.peek(key);
  if (cached) return Promise.resolve(cached);
  if (loadedOnceKeys.has(key)) {
    return Promise.resolve(getDriveDirectLink(url, width));
  }

  const pending = loadPromises.get(key);
  if (pending) return pending;

  const tier = TIER_BY_LOAD[loadTier] ?? 0;
  if (tier >= 3) return Promise.resolve(null);

  if (tier === 0 || tier === 2) {
    return prefetchMediaPreview(url, width);
  }

  const generation = mediaLoadGeneration;
  return new Promise((resolve) => {
    sequentialJobs.push({ orderKey, tier, url, width, generation, resolve });
    drainSequentialJobs();
  });
}
