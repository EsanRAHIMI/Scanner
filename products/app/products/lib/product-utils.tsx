import * as React from 'react';

import type { ProductsRecord } from '@/types/trainer';
import type { GalleryItem } from '../types/shared-types';

const LEGACY_APP_DOMAIN_RE = /ehsanrahimi\.com/gi;
const CURRENT_APP_DOMAIN = 'lorenzohome.ae';

/** Stored product media may still reference the previous deployment domain. */
export function rewriteLegacyAppDomainInUrl(url: string): string {
  const u = url.trim();
  if (!u || !LEGACY_APP_DOMAIN_RE.test(u)) return u;
  return u.replace(LEGACY_APP_DOMAIN_RE, CURRENT_APP_DOMAIN);
}

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

/** Collection Name (canonical spellings first, then legacy Name). */
export function resolveCollectionName(
  fields: Record<string, unknown> | undefined,
): string {
  if (!fields) return '';
  return (
    formatScalar(fields['Collection Name']) ||
    formatScalar(fields['Colecction Name']) ||
    formatScalar(fields['Name']) ||
    ''
  ).trim();
}

/** Collection Code (canonical spellings first, then legacy Code). */
export function resolveCollectionCode(
  fields: Record<string, unknown> | undefined,
): string {
  if (!fields) return '';
  return (
    formatScalar(fields['Collection Code']) ||
    formatScalar(fields['Colecction Code']) ||
    formatScalar(fields['Code']) ||
    ''
  ).trim();
}

/**
 * Stable group id for comparing rows: `name:…` when Collection Name is set, else `code:…`.
 */
export function getCollectionKey(
  fields: Record<string, unknown> | undefined,
): string {
  const name = resolveCollectionName(fields);
  if (name) return `name:${name.toLowerCase()}`;
  const code = resolveCollectionCode(fields);
  if (code) return `code:${code.toLowerCase()}`;
  return '';
}

/** Display label for UI / counts: Collection Name, else Collection Code. */
export function getCollectionDisplayKey(
  fields: Record<string, unknown> | undefined,
): string {
  const name = resolveCollectionName(fields);
  if (name) return name;
  return resolveCollectionCode(fields);
}

export function sameCollectionGroup(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  const ka = getCollectionKey(a);
  return Boolean(ka) && ka === getCollectionKey(b);
}

const COLLECTION_IDENTITY_FIELD_KEYS = new Set([
  'collection name',
  'colecction name',
  'name',
  'collection code',
  'colecction code',
  'code',
]);

export function isCollectionIdentityField(fieldName: string): boolean {
  return COLLECTION_IDENTITY_FIELD_KEYS.has(fieldName.trim().toLowerCase());
}

export function patchTouchesCollectionIdentity(fieldsPatch: Record<string, unknown>): boolean {
  return Object.keys(fieldsPatch).some((k) => isCollectionIdentityField(k));
}

/**
 * Extracts URLs from various input formats (string, array, objects).
 */
export function extractUrls(v: unknown): string[] {
  const isSupportedUrl = (value: string) => /^(https?:\/\/|\/)/i.test(value);
  if (typeof v === 'string') {
    const parts = v.split(/[\s,\n]+/).map((s) => s.trim()).filter(Boolean);
    return parts.filter(isSupportedUrl).map(rewriteLegacyAppDomainInUrl);
  }
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === 'string') {
        const s = item.trim();
        if (isSupportedUrl(s)) out.push(rewriteLegacyAppDomainInUrl(s));
      } else if (item && typeof item === 'object') {
        const maybe = (item as Record<string, unknown>).url;
        if (typeof maybe === 'string') {
          const s = maybe.trim();
          if (isSupportedUrl(s)) out.push(rewriteLegacyAppDomainInUrl(s));
        }
      }
    }
    return out;
  }
  if (v && typeof v === 'object') {
    const maybe = (v as Record<string, unknown>).url;
    if (typeof maybe === 'string') {
      const s = maybe.trim();
      return isSupportedUrl(s) ? [rewriteLegacyAppDomainInUrl(s)] : [];
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
/** URL column row thumbnails (~28px cell, ~3× retina). */
export const DRIVE_IMAGE_WIDTH_THUMB = 96;
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
  const u = rewriteLegacyAppDomainInUrl(url);

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

/** Stable key for trainer-hosted product images (/files/, product_images/). */
export function extractHostedMediaKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  const googleId = extractGoogleHostedAssetId(u);
  if (googleId) return `g:${googleId}`;
  const productImg = u.match(/product_images\/[a-f0-9]+\/([a-f0-9]+)/i);
  if (productImg?.[1]) return `t:${productImg[1]}`;
  const files = u.match(/\/files\/([a-f0-9]+)/i);
  if (files?.[1]) return `f:${files[1]}`;
  return null;
}

/** Match Drive, lh3, or trainer-hosted URLs that refer to the same asset. */
export function sameProductMediaUrl(aRaw: string, bRaw: string): boolean {
  const a = rewriteLegacyAppDomainInUrl(aRaw);
  const b = rewriteLegacyAppDomainInUrl(bRaw);
  if (!a || !b) return false;
  if (a === b) return true;
  if (sameGoogleHostedMediaUrl(a, b)) return true;
  const ka = extractHostedMediaKey(a);
  const kb = extractHostedMediaKey(b);
  if (ka && kb && ka === kb) return true;
  try {
    const na = new URL(a, 'https://local.invalid').pathname;
    const nb = new URL(b, 'https://local.invalid').pathname;
    if (na === nb) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function findUrlFieldName(columns: string[]): string {
  return columns.find(c => c.trim().toLowerCase() === 'url') || 'URL';
}

/** URL / Image / DAM / Video columns that may store media links. */
export function resolveMediaFieldNames(columns: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (canonical: string) => {
    const exact = columns.find(c => c.trim().toLowerCase() === canonical.toLowerCase());
    if (exact && !seen.has(exact)) {
      seen.add(exact);
      out.push(exact);
    }
  };
  add('URL');
  add('Image');
  add('DAM');
  add('Video');
  for (const c of columns) {
    const kl = c.trim().toLowerCase();
    if (
      (kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url')) &&
      !seen.has(c)
    ) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

export function mergeProductMediaUrls(...values: unknown[]): string {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const value of values) {
    for (const url of extractUrls(value)) {
      const key = url.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      urls.push(key);
    }
  }
  return urls.join('\n');
}

export function findUrlFieldValue(fields: Record<string, unknown> | undefined): unknown {
  if (!fields) return undefined;
  const entry = Object.entries(fields).find(([k]) => {
    const kl = k.trim().toLowerCase();
    return kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url');
  });
  return entry?.[1];
}

/** Actual URL field key on a record (handles aliases like "Product URL"). */
export function resolveUrlFieldKey(
  fields: Record<string, unknown> | undefined,
  columns: string[],
): string {
  if (fields) {
    const entry = Object.entries(fields).find(([k]) => {
      const kl = k.trim().toLowerCase();
      return kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url');
    });
    if (entry) return entry[0];
  }
  return findUrlFieldName(columns);
}

/** Same merged list as the URL column in list view (URL + Image + DAM). */
export function collectMergedProductMediaUrls(
  fields: Record<string, unknown> | undefined,
  columns: string[],
): string[] {
  if (!fields) return [];
  const keys = resolveMediaFieldKeys(fields, columns);
  return extractUrls(
    mergeProductMediaUrls(
      fields[keys.url] ?? findUrlFieldValue(fields),
      keys.image ? fields[keys.image] : undefined,
      keys.dam ? fields[keys.dam] : undefined,
    ),
  );
}

export type MediaFieldKeys = {
  url: string;
  image: string | null;
  dam: string | null;
};

export function resolveMediaFieldKeys(
  fields: Record<string, unknown>,
  columns: string[],
): MediaFieldKeys {
  return {
    url: resolveUrlFieldKey(fields, columns),
    image: columns.find((c) => c.trim().toLowerCase() === 'image') ?? null,
    dam: columns.find((c) => c.trim().toLowerCase() === 'dam') ?? null,
  };
}

function findUrlInFieldValue(fieldValue: unknown, listItem: string): string | undefined {
  return extractUrls(fieldValue).find((u) => sameProductMediaUrl(u, listItem));
}

/** Keep the best existing stored string for a merged-list item (URL / Image / DAM variant). */
function resolveStoredUrlForListItem(
  listItem: string,
  fields: Record<string, unknown>,
  keys: MediaFieldKeys,
): string {
  return (
    findUrlInFieldValue(fields[keys.url], listItem) ??
    (keys.image ? findUrlInFieldValue(fields[keys.image], listItem) : undefined) ??
    (keys.dam ? findUrlInFieldValue(fields[keys.dam], listItem) : undefined) ??
    listItem.trim()
  );
}

function fieldUrlsJoined(fieldValue: unknown): string {
  return extractUrls(fieldValue).join('\n');
}

function buildImageFieldValueFromMediaList(
  fields: Record<string, unknown>,
  keys: MediaFieldKeys,
  nextUrls: string[],
): string {
  if (!keys.image) return '';
  const imageUrls = extractUrls(fields[keys.image]);
  if (imageUrls.length === 0) return '';

  const used = new Set<number>();
  const next: string[] = [];

  for (const u of nextUrls) {
    if (isVideoUrl(u)) continue;
    const matchIdx = imageUrls.findIndex(
      (img, i) => !used.has(i) && sameProductMediaUrl(img, u),
    );
    if (matchIdx >= 0) {
      used.add(matchIdx);
      next.push(imageUrls[matchIdx]!);
    }
  }

  return next.join('\n');
}

/** Drop DAM rows that now live in the URL list — prevents URL + DAM duplicates after reorder/move. */
function buildDamFieldValueFromMediaList(
  fields: Record<string, unknown>,
  keys: MediaFieldKeys,
  urlFieldValue: string,
  nextUrls: string[],
): string {
  if (!keys.dam) return '';
  const damUrls = extractUrls(fields[keys.dam]);
  if (damUrls.length === 0) return '';

  const urlFieldUrls = extractUrls(urlFieldValue);
  const kept = damUrls.filter((d) => {
    const representedInUrl = urlFieldUrls.some((u) => sameProductMediaUrl(u, d));
    const representedInList = nextUrls.some((n) => sameProductMediaUrl(n, d));
    return !representedInUrl && !representedInList;
  });

  return kept.join('\n');
}

/**
 * Apply a new merged media list (URL column order) to URL, Image, and DAM together.
 * Use for reorder, move, replace, and remove — not for gallery hide (Gallery Hidden only).
 */
export function applyMediaListChange(
  fields: Record<string, unknown>,
  columns: string[],
  nextUrls: string[],
): Record<string, unknown> {
  const keys = resolveMediaFieldKeys(fields, columns);
  const normalizedNext = nextUrls.map((u) => u.trim()).filter(Boolean);
  const patch: Record<string, unknown> = {};

  const urlValue = normalizedNext
    .map((u) => resolveStoredUrlForListItem(u, fields, keys))
    .join('\n');
  const prevUrlJoined = fieldUrlsJoined(fields[keys.url] ?? findUrlFieldValue(fields));
  if (prevUrlJoined !== urlValue) {
    patch[keys.url] = urlValue;
  }

  if (keys.image) {
    const imageValue = buildImageFieldValueFromMediaList(fields, keys, normalizedNext);
    const prevImageJoined = fieldUrlsJoined(fields[keys.image]);
    if (prevImageJoined !== imageValue) {
      patch[keys.image] = imageValue;
    }
  }

  if (keys.dam) {
    const damValue = buildDamFieldValueFromMediaList(fields, keys, urlValue, normalizedNext);
    const prevDamJoined = fieldUrlsJoined(fields[keys.dam]);
    if (prevDamJoined !== damValue) {
      patch[keys.dam] = damValue;
    }
  }

  return patch;
}

export function removeUrlFromFieldValue(fieldValue: unknown, urlToRemove: string): string {
  const filtered = extractUrls(fieldValue).filter(u => !sameProductMediaUrl(u, urlToRemove));
  return filtered.length === 0 ? '' : filtered.join('\n');
}

export function buildFieldsAfterRemovingMediaUrl(
  fields: Record<string, unknown>,
  urlToRemove: string,
  columns: string[],
): Record<string, unknown> {
  const merged = collectMergedProductMediaUrls(fields, columns);
  const next = merged.filter((u) => !sameProductMediaUrl(u, urlToRemove));
  return applyMediaListChange(fields, columns, next);
}

export function buildFieldsAfterReplacingMediaUrl(
  fields: Record<string, unknown>,
  oldUrl: string,
  newUrl: string,
  columns: string[],
): Record<string, unknown> {
  const trimmed = newUrl.trim();
  const merged = collectMergedProductMediaUrls(fields, columns);
  const next = merged.map((u) => (sameProductMediaUrl(u, oldUrl) ? trimmed : u));
  return applyMediaListChange(fields, columns, next);
}

/** Internal field: URLs hidden from Image column / Feed (still listed under URL). */
export const GALLERY_HIDDEN_FIELD = 'Gallery Hidden';

export const CONTENT_STATUS_FIELD = 'Content Status';

export function isContentStatusFieldName(fieldName: string): boolean {
  return fieldName.trim().toLowerCase() === CONTENT_STATUS_FIELD.toLowerCase();
}

export function resolveContentStatusFieldName(columns: string[]): string {
  return (
    columns.find(c => isContentStatusFieldName(c)) ?? CONTENT_STATUS_FIELD
  );
}

export function resolveGalleryHiddenFieldName(columns: string[]): string {
  return (
    columns.find(c => c.trim().toLowerCase() === GALLERY_HIDDEN_FIELD.toLowerCase()) ??
    GALLERY_HIDDEN_FIELD
  );
}

export function isGalleryHiddenFieldName(fieldName: string): boolean {
  return fieldName.trim().toLowerCase() === GALLERY_HIDDEN_FIELD.toLowerCase();
}

export function extractGalleryHiddenUrls(
  fields: Record<string, unknown> | undefined,
  columns: string[],
): string[] {
  if (!fields) return [];
  const key = resolveGalleryHiddenFieldName(columns);
  return extractUrls(fields[key]);
}

export function isGalleryMediaHidden(
  url: string,
  fields: Record<string, unknown> | undefined,
  columns: string[],
): boolean {
  const hidden = extractGalleryHiddenUrls(fields, columns);
  return hidden.some(h => sameProductMediaUrl(h, url));
}

/** Drop URLs marked hidden — for Image column, PhotoDeck, and Feed only. */
export function filterUrlsForGalleryDisplay(
  urls: string[],
  fields: Record<string, unknown> | undefined,
  columns: string[],
): string[] {
  return urls.filter(u => !isGalleryMediaHidden(u, fields, columns));
}

/** Image column deck: URL field order first, then Image-only links not already listed. */
export function getImageColumnDisplayUrls(
  fields: Record<string, unknown> | undefined,
  columns: string[],
): string[] {
  if (!fields) return [];

  const urlFieldKey = resolveUrlFieldKey(fields, columns);
  const urlFieldValue = fields[urlFieldKey] ?? findUrlFieldValue(fields);
  const urlOrdered = extractUrls(urlFieldValue).filter(u => !isVideoUrl(u));

  const imageField = columns.find(c => c.trim().toLowerCase() === 'image');
  const imageUrls = imageField
    ? extractUrls(fields[imageField]).filter(u => !isVideoUrl(u))
    : [];

  if (urlOrdered.length === 0) {
    return filterUrlsForGalleryDisplay(imageUrls, fields, columns);
  }

  const usedImageIdx = new Set<number>();
  const result: string[] = [];

  const appendUnique = (raw: string) => {
    const u = raw.trim();
    if (!u || result.some(r => sameProductMediaUrl(r, u))) return;
    result.push(u);
  };

  for (const u of urlOrdered) {
    const matchIdx = imageUrls.findIndex(
      (img, i) => !usedImageIdx.has(i) && sameProductMediaUrl(img, u),
    );
    if (matchIdx >= 0) {
      usedImageIdx.add(matchIdx);
      appendUnique(imageUrls[matchIdx]!);
    } else {
      appendUnique(u);
    }
  }

  for (let i = 0; i < imageUrls.length; i++) {
    if (!usedImageIdx.has(i)) appendUnique(imageUrls[i]!);
  }

  return filterUrlsForGalleryDisplay(result, fields, columns);
}

/** After URL reorder, sync URL / Image / DAM from the merged list. */
export function buildImageFieldOrderPatch(
  fields: Record<string, unknown>,
  columns: string[],
  reorderedUrlList: string[],
): Record<string, unknown> {
  return applyMediaListChange(fields, columns, reorderedUrlList);
}

export function buildFieldsAfterHidingGalleryMedia(
  fields: Record<string, unknown>,
  urlToHide: string,
  columns: string[],
): Record<string, unknown> {
  const key = resolveGalleryHiddenFieldName(columns);
  const hidden = extractGalleryHiddenUrls(fields, columns);
  if (hidden.some(h => sameProductMediaUrl(h, urlToHide))) return {};
  const next = [...hidden, urlToHide.trim()].join('\n');
  return { [key]: next };
}

export function buildFieldsAfterUnhidingGalleryMedia(
  fields: Record<string, unknown>,
  urlToShow: string,
  columns: string[],
): Record<string, unknown> {
  const key = resolveGalleryHiddenFieldName(columns);
  const hidden = extractGalleryHiddenUrls(fields, columns);
  const next = hidden.filter(h => !sameProductMediaUrl(h, urlToShow));
  return { [key]: next.length === 0 ? '' : next.join('\n') };
}

/** Trainer-hosted paths (/api/trainer/files/, product_images/). */
export function isTrainerHostedMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.trim().toLowerCase();
  return (
    /\/api\/static\/product_images\//i.test(lower) ||
    lower.startsWith('/api/trainer/files/') ||
    lower.startsWith('/files/') ||
    lower.includes('/api/trainer/files/') ||
    Boolean(extractHostedMediaKey(url)?.startsWith('t:') || extractHostedMediaKey(url)?.startsWith('f:'))
  );
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

/** Main variant for a collection family key; falls back to first sibling when Main is unset. */
export function findMainGalleryItemForCollection<
  T extends {
    id: string;
    collectionNameNormalized?: string;
    fields?: Record<string, unknown>;
    isMain?: boolean;
  },
>(items: T[], collectionKeyOrDisplay: string): T | null {
  const needle = collectionKeyOrDisplay.trim().toLowerCase();
  if (!needle) return null;
  const siblings = items.filter((x) => {
    if (x.fields) {
      const groupKey = getCollectionKey(x.fields);
      if (groupKey === `name:${needle}` || groupKey === `code:${needle}`) return true;
    }
    const display = (
      x.collectionNameNormalized ||
      getCollectionDisplayKey(x.fields) ||
      ''
    )
      .trim()
      .toLowerCase();
    return display === needle;
  });
  if (siblings.length === 0) return null;
  return (
    siblings.find((x) => x.isMain === true || x.fields?.Main === true) ?? siblings[0]
  );
}

/** Scroll a row into view inside a scrollable container (more reliable than scrollIntoView). */
export function scrollElementIntoContainer(container: HTMLElement, row: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const offset = rowRect.top - containerRect.top + container.scrollTop;
  const target = offset - (container.clientHeight - rowRect.height) / 2;
  container.scrollTop = Math.max(0, target);
}

/** Keep a row at the same distance from the top of the scroll container's viewport. */
export function scrollRowToViewportOffset(
  container: HTMLElement,
  row: HTMLElement,
  viewportTop: number,
) {
  const containerRect = container.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const target = rowRect.top - containerRect.top + container.scrollTop - viewportTop;
  container.scrollTop = Math.max(0, target);
}

/** Topmost visible list row (DOM order) — what the user sees without scrolling. */
export function getFirstVisibleListRecordId(container: HTMLElement | null): string | null {
  if (!container) return null;
  const containerRect = container.getBoundingClientRect();
  const rows = container.querySelectorAll('[data-product-row-id]');

  for (const row of rows) {
    if (!(row instanceof HTMLElement)) continue;
    const rect = row.getBoundingClientRect();
    if (rect.bottom > containerRect.top + 8 && rect.top < containerRect.bottom - 8) {
      const id = row.getAttribute('data-product-row-id');
      if (id) return id;
    }
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
