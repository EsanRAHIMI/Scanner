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
  readDimensionValue,
  resolveMainImage,
  composedMainImageUrl,
  DRIVE_IMAGE_WIDTH_FULL,
  DRIVE_IMAGE_WIDTH_GALLERY,
} from '../lib/product-utils';
import { useInView } from '../hooks/use-in-view';
import { useMediaLoadGate } from './media-load-provider';
import { CachedMediaPreview } from './cached-media-preview';
import { BrandedImageFrame } from './branded-image-frame';

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
  mediaRowIndex,
}: GalleryCardProps) {
  const r = record;
  const mediaGateOpen = useMediaLoadGate(mediaRowIndex);
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>('200px 0px');
  const canLoadMedia = mediaGateOpen;
  const sequentialKey =
    mediaRowIndex !== undefined ? `${String(mediaRowIndex).padStart(5, '0')}:0` : undefined;
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
  // Main image: the dedicated `Main Image` field when set (→ official compose),
  // otherwise the first URL-column image (→ plain, no compose).
  const { url: rawImg, isMain } = resolveMainImage(r.fields, visibleUrls[0] ?? '');
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

  const size = readDimensionValue(fields);

  const price = formatPrice(r.fields?.Price) ?? null;
  const isSelected = selectedIds.has(r.id);

  return (
    <div className="group/card overflow-hidden rounded-2xl border border-brand-medium-gray/30 bg-brand-white shadow-brand-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-burgundy/40 hover:shadow-brand-card-hover dark:border-white/10 dark:bg-black/20 dark:hover:border-emerald-400/40">
      <div className="block w-full">
        <div ref={inViewRef} className="relative aspect-[3/4] w-full bg-black/[0.04] dark:bg-white/[0.06]">
          {thumbSrc && !imageFailed ? (
            <button
              type="button"
              className="relative h-full w-full outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/30"
              onClick={() => openPreviewByUrl?.(lightboxSrc || thumbSrc)}
              title="Click to maximize"
            >
              {isMain && canLoadMedia ? (
                <BrandedImageFrame
                  composedSrc={composedMainImageUrl(rawImg)}
                  cutoutSrc={thumbSrc}
                  alt="product"
                  onBroken={() => setImageFailed(true)}
                />
              ) : isMain ? (
                <span
                  aria-hidden
                  className="absolute inset-0 block h-full w-full bg-gradient-to-br from-black/[0.06] to-black/[0.12] dark:from-white/[0.05] dark:to-white/[0.10]"
                />
              ) : (
                <CachedMediaPreview
                  url={rawImg}
                  width={DRIVE_IMAGE_WIDTH_GALLERY}
                  enabled={canLoadMedia}
                  priority={canLoadMedia && mediaRowIndex === 0}
                  sequentialKey={sequentialKey}
                  mediaRowIndex={mediaRowIndex}
                  onBroken={() => setImageFailed(true)}
                  className="absolute inset-0 h-full w-full object-contain"
                  alt="product"
                />
              )}
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
