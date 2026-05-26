'use client';

import * as React from 'react';
import {
  extractUrls,
  getDriveDirectLink,
  formatScalar,
  highlightMatches,
  formatPrice,
  mergeProductMediaUrls,
  filterUrlsForGalleryDisplay,
  resolveCollectionName,
  resolveCollectionCode,
  getCollectionDisplayKey,
  DRIVE_IMAGE_WIDTH_FULL,
  DRIVE_IMAGE_WIDTH_GALLERY,
} from '../lib/product-utils';
import { useInView } from '../hooks/use-in-view';
import { CachedMediaPreview } from './cached-media-preview';

import { GalleryCardProps } from '../types/products-ui';

export function GalleryCard({
  record,
  columns,
  search,
  selectedIds,
  toggleSelected,
  openPreviewByUrl,
  familyMode,
  variantCounts,
}: GalleryCardProps) {
  const r = record;
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>('200px 0px');
  const urlEntry = Object.entries(r.fields || {}).find(([k]) => {
    const kl = k.trim().toLowerCase();
    return kl === 'url' || kl.endsWith(' url') || kl.endsWith('_url') || kl.endsWith('-url');
  });
  const urlValue = urlEntry?.[1];
  const visibleUrls = filterUrlsForGalleryDisplay(
    extractUrls(mergeProductMediaUrls(urlValue, r.fields?.DAM, r.fields?.Image)),
    r.fields,
    columns,
  );
  const rawImg = visibleUrls[0] ?? '';
  const thumbSrc = rawImg ? getDriveDirectLink(rawImg, DRIVE_IMAGE_WIDTH_GALLERY) : '';
  const lightboxSrc = rawImg ? getDriveDirectLink(rawImg, DRIVE_IMAGE_WIDTH_FULL) : '';
  const [imageFailed, setImageFailed] = React.useState(false);
  React.useEffect(() => {
    setImageFailed(false);
  }, [rawImg]);

  const name = resolveCollectionName(r.fields);
  const code = resolveCollectionCode(r.fields);
  const familyLabel = getCollectionDisplayKey(r.fields);
  const variant = formatScalar(r.fields?.['Variant Number']) || formatScalar(r.fields?.Num);
  const fields = r.fields ?? {};

  const dimensionKey = (() => {
    const keys = Object.keys(fields);
    const normalized = keys.map((k) => ({ k, n: k.trim().toLowerCase() }));
    const mm = normalized.find((x) => x.n.includes('dimension') && x.n.includes('mm'))?.k;
    if (mm) return mm;
    const dim = normalized.find((x) => x.n.startsWith('dimension'))?.k;
    if (dim) return dim;
    const size = normalized.find((x) => x.n.startsWith('size'))?.k;
    if (size) return size;
    return null;
  })();

  const size =
    formatScalar(fields['DIMENSION (mm)']) ||
    formatScalar(fields['Dimension (mm)']) ||
    (dimensionKey ? formatScalar(fields[dimensionKey]) : '') ||
    formatScalar(fields['DIMENSION']) ||
    formatScalar(fields['DIMENSIONS']) ||
    formatScalar(fields['Dimension']) ||
    formatScalar(fields['Dimensions']) ||
    formatScalar(fields['SIZE']) ||
    formatScalar(fields['Size']);

  const price = formatPrice(r.fields?.Price) ?? null;
  const isSelected = selectedIds.has(r.id);

  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-black/20">
      <div className="block w-full">
        <div ref={inViewRef} className="relative aspect-square w-full bg-black/5 dark:bg-white/5">
          {thumbSrc && !imageFailed ? (
            <button
              type="button"
              className="relative h-full w-full outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/30"
              onClick={() => openPreviewByUrl?.(lightboxSrc || thumbSrc)}
              title="Click to maximize"
            >
              <CachedMediaPreview
                url={rawImg}
                width={DRIVE_IMAGE_WIDTH_GALLERY}
                enabled={inView}
                priority={inView}
                onBroken={() => setImageFailed(true)}
                className="absolute inset-0 h-full w-full object-cover"
                alt="product"
              />
            </button>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black/5 text-xs italic text-black/40 dark:bg-white/5 dark:text-white/40">
              No image
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className={
          'block w-full text-left space-y-0.5 p-2 ' +
          (isSelected ? 'bg-emerald-50/80 dark:bg-emerald-900/30' : '')
        }
        onClick={() => toggleSelected(r.id)}
      >
        <div className="truncate text-xs font-bold text-black dark:text-white">
          {highlightMatches(name || '—', search)}
        </div>
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span className="truncate text-[10px] text-black/60 dark:text-white/60">
            {highlightMatches(code || '—', search)}
          </span>
          {familyMode === 'main' && familyLabel ? (
            <span className="flex-none rounded bg-black/5 px-1 py-0.5 text-[9px] font-bold text-black/40 dark:bg-white/10 dark:text-white/40">
              {variantCounts[familyLabel] ? `+${variantCounts[familyLabel] - 1}` : ''}
            </span>
          ) : null}
        </div>
        <div className="truncate text-[10px] text-black/50 dark:text-white/50">
          {highlightMatches(variant || '—', search)}
        </div>
        {size ? (
          <div className="truncate text-[10px] text-black/45 dark:text-white/45">{highlightMatches(size, search)}</div>
        ) : null}
        {price ? (
          <div className="text-[11px] font-bold text-black dark:text-white">{price}</div>
        ) : null}
      </button>
    </div>
  );
}
