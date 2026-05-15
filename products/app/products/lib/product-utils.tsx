import * as React from 'react';

import type { ProductsRecord } from '@/types/trainer';
import type { GalleryItem } from '../types/shared-types';

/**
 * Checks if a URL points to a video file.
 */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const l = url.toLowerCase();
  const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkw', '.flv', '.wmv', '.m4v'];
  return (
    videoExts.some(ext => l.includes(ext)) || 
    l.includes('youtube.com') || 
    l.includes('youtu.be') || 
    l.includes('vimeo.com') || 
    l.includes('#video') ||
    (l.includes('drive.google.com') && l.includes('video'))
  );
}

/**
 * Checks if a URL points to an image file.
 */
export function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const l = url.toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic'];
  if (l.includes('lh3.googleusercontent.com/d/')) return true;
  return imageExts.some(ext => l.includes(ext));
}

/**
 * True when `next/image` can safely optimise this remote URL (configured in next.config remotePatterns).
 * Non‑lh3 URLs keep using `<img>` so arbitrary CDNs and edge cases stay unchanged.
 */
export function supportsNextJsImageOptimization(url: string | null | undefined): boolean {
  if (!url || isVideoUrl(url)) return false;
  try {
    const hostname = new URL(url.trim()).hostname;
    return hostname === 'lh3.googleusercontent.com';
  } catch {
    return /^https:\/\/lh3\.googleusercontent\.com\b/i.test(url.trim());
  }
}

/**
 * Formats a scalar value into a string.
 */
export function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return '';
}

/**
 * Extracts URLs from various input formats (string, array, objects).
 */
export function extractUrls(v: unknown): string[] {
  const isSupportedUrl = (value: string) => /^(https?:\/\/|\/)/i.test(value);
  if (typeof v === 'string') {
    const parts = v.split(/[\s,\n]+/).map((s) => s.trim()).filter(Boolean);
    return parts.filter(isSupportedUrl);
  }
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === 'string') {
        const s = item.trim();
        if (isSupportedUrl(s)) out.push(s);
      } else if (item && typeof item === 'object') {
        const maybe = (item as Record<string, unknown>).url;
        if (typeof maybe === 'string') {
          const s = maybe.trim();
          if (isSupportedUrl(s)) out.push(s);
        }
      }
    }
    return out;
  }
  if (v && typeof v === 'object') {
    const maybe = (v as Record<string, unknown>).url;
    if (typeof maybe === 'string') {
      const s = maybe.trim();
      return isSupportedUrl(s) ? [s] : [];
    }
  }
  return [];
}

/** Whether a cell value is treated as empty for "Num-only stub" bulk cleanup. */
export function isEmptyProductValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'boolean') return value !== true;
  if (typeof value === 'number') return !Number.isFinite(value);
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) return false;
      if (typeof item === 'number' && Number.isFinite(item)) return false;
      if (typeof item === 'boolean' && item) return false;
      if (item && typeof item === 'object') {
        if (extractUrls(item).length > 0) return false;
        const o = item as Record<string, unknown>;
        if (typeof o.filename === 'string' && o.filename.trim()) return false;
        if (typeof o.url === 'string' && o.url.trim()) return false;
      }
    }
    return true;
  }
  if (typeof value === 'object') {
    if (extractUrls(value).length > 0) return false;
    return Object.keys(value as object).length === 0;
  }
  return false;
}

/**
 * Row has a filled Num field and every other field is empty (stubs / placeholders).
 */
export function isNumOnlyStubRow(
  fields: Record<string, unknown> | undefined,
  columns: string[],
): boolean {
  if (!fields) return false;
  const numKey =
    columns.find(c => c.trim().toLowerCase() === 'num') ??
    Object.keys(fields).find(k => k.trim().toLowerCase() === 'num') ??
    null;
  if (!numKey || !(numKey in fields)) return false;
  if (isEmptyProductValue(fields[numKey])) return false;
  for (const [k, v] of Object.entries(fields)) {
    if (k === numKey) continue;
    if (!isEmptyProductValue(v)) return false;
  }
  return true;
}

export function collectNumOnlyStubIds(records: ProductsRecord[], columns: string[]): string[] {
  return records.filter(r => isNumOnlyStubRow(r.fields, columns)).map(r => r.id);
}

/** Full-size lh3 width for lightbox / downloads. */
export const DRIVE_IMAGE_WIDTH_FULL = 1200;
/** List / deck thumbnails (~96px cell, 2× retina). */
export const DRIVE_IMAGE_WIDTH_LIST = 256;
/** Hover popover (~200px, 2× retina). */
export const DRIVE_IMAGE_WIDTH_HOVER = 420;

function lh3DirectUrl(fileId: string, width: number): string {
  const id = fileId.split('=')[0] ?? fileId;
  return `https://lh3.googleusercontent.com/d/${id}=w${width}`;
}

/**
 * Converts a Google Drive link into a high-performance direct link via lh3.
 * Handles /d/ paths, ?id= query params, and existing lh3 URLs.
 * @param width — lh3 max width; use `DRIVE_IMAGE_WIDTH_LIST` for small previews.
 */
export function getDriveDirectLink(
  url: string | null | undefined,
  width: number = DRIVE_IMAGE_WIDTH_FULL,
): string {
  if (!url) return '';
  const u = url.trim();

  const isPotentialUrl = u.startsWith('http') || u.startsWith('//') || u.startsWith('/');
  if (!isPotentialUrl) return '';

  if (!u.includes('drive.google.com') && !u.includes('google.com/file/d/') && !u.includes('googleusercontent.com')) return u;

  const lh3Match = u.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) {
    return lh3DirectUrl(lh3Match[1], width);
  }

  let id = '';
  const matchD = u.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{25,})/);
  if (matchD && matchD[1]) {
    id = matchD[1];
  } else {
    const matchId = u.match(/[?&](?:id|fileId|docid|fileid)=([a-zA-Z0-9_-]{25,})/);
    if (matchId && matchId[1]) {
      id = matchId[1];
    }
  }

  if (id) {
    return lh3DirectUrl(id, width);
  }
  return u;
}

const GOOGLE_ASSET_ID = /^[a-zA-Z0-9_-]{10,}$/;

/**
 * Best-effort canonical file ID for lh3 thumbnails or Drive URLs (sizes like =w600 vs =w1200 share the same id).
 */
export function extractGoogleHostedAssetId(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  try {
    const lh = u.match(/lh3\.googleusercontent\.com\/d\/([^/?#\s]+)/i);
    if (lh?.[1]) {
      const id = lh[1].split('=')[0] ?? '';
      if (GOOGLE_ASSET_ID.test(id)) return id;
    }
    const dSlash = u.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,})\b/);
    if (dSlash?.[1]) return dSlash[1];
    const qp = u.match(/[?&](?:id|fileId|docid|fileid)=([a-zA-Z0-9_-]{10,})\b/i);
    if (qp?.[1]) return qp[1];
  } catch {
    /* ignore */
  }
  return null;
}

/** True when two URLs refer to the same Google-hosted file (handles drive link vs lh3, width suffixes). */
export function sameGoogleHostedMediaUrl(aRaw: string, bRaw: string): boolean {
  const a = aRaw.trim();
  const b = bRaw.trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const ia = extractGoogleHostedAssetId(a);
  const ib = extractGoogleHostedAssetId(b);
  if (ia && ib && ia === ib) return true;
  const da = getDriveDirectLink(a);
  const db = getDriveDirectLink(b);
  return Boolean(da && db && da === db);
}

const GALLERY_LOOKUP_ASSET_PREFIX = '__gallery_asset__:';

/**
 * Build a URL → gallery index map in a single pass when `galleryItems` changes.
 * Opening a preview then resolves in O(1) instead of scanning thousands of rows per click.
 */
export function buildGalleryOpenUrlIndexMap(items: GalleryItem[]): Map<string, number> {
  const map = new Map<string, number>();
  const put = (raw: string | null | undefined, idx: number) => {
    if (typeof raw !== 'string') return;
    const t = raw.trim();
    if (!t) return;
    if (!map.has(t)) map.set(t, idx);
    const direct = getDriveDirectLink(t);
    if (direct && !map.has(direct)) map.set(direct, idx);
    const id = extractGoogleHostedAssetId(t);
    if (id) {
      const key = `${GALLERY_LOOKUP_ASSET_PREFIX}${id}`;
      if (!map.has(key)) map.set(key, idx);
    }
  };

  items.forEach((item, idx) => {
    put(item.url, idx);
    put(item.originalUrl, idx);
    for (const m of item.allMedia) {
      put(m.url, idx);
      put(m.originalUrl, idx);
    }
  });
  return map;
}

/** Resolve gallery row index from the URL emitted by list / deck / gallery cards (O(1)). */
export function resolveGalleryIndexFromOpenMap(map: Map<string, number>, clicked: string): number {
  const c = clicked.trim();
  if (!c) return -1;
  const directHit = map.get(c);
  if (directHit !== undefined) return directHit;
  const transformed = getDriveDirectLink(c);
  if (transformed) {
    const tHit = map.get(transformed);
    if (tHit !== undefined) return tHit;
  }
  const id = extractGoogleHostedAssetId(c);
  if (id) {
    const idHit = map.get(`${GALLERY_LOOKUP_ASSET_PREFIX}${id}`);
    if (idHit !== undefined) return idHit;
  }
  return -1;
}

/**
 * Formats a price value with locale-aware number formatting.
 */
export function formatPrice(value: unknown): string | null {
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  });
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatter.format(value);
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;
    const cleaned = raw.replace(/,/g, '');
    const n = Number(cleaned);
    if (Number.isFinite(n)) return formatter.format(n);
  }
  return null;
}

/**
 * Highlight matching text in a string for search results.
 */
export function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === query.trim().toLowerCase() 
      ? <mark key={i} className="bg-emerald-500/40 text-emerald-950 dark:text-emerald-100 rounded-px px-0.5 no-underline ring-1 ring-emerald-500/20">{part}</mark> 
      : part
  );
}
