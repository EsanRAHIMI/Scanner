'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  extractUrls,
  getDriveDirectLink,
  formatScalar,
  highlightMatches,
  formatPrice,
  supportsNextJsImageOptimization,
  mergeProductMediaUrls,
  filterUrlsForGalleryDisplay,
  resolveCollectionName,
  resolveCollectionCode,
  getCollectionDisplayKey,
} from '../lib/product-utils';
import type { ProductsRecord } from '@/types/trainer';

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
  const img = getDriveDirectLink(rawImg);
  const useNextImg = Boolean(img && supportsNextJsImageOptimization(img));
  const [imageFailed, setImageFailed] = React.useState(false);
  React.useEffect(() => {
    setImageFailed(false);
  }, [img]);

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
        <div className="relative aspect-square w-full bg-black/5 dark:bg-white/5">
          {img && !imageFailed ? (
            <button
              type="button"
              className="relative h-full w-full outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/30"
              onClick={() => openPreviewByUrl?.(img)}
              title="Click to maximize"
            >
              {useNextImg ?
                (
                  <Image
                    src={img}
                    alt="product"
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                    loading="lazy"
                    placeholder="empty"
                    referrerPolicy="no-referrer"
                    className="object-cover"
                    onError={() => setImageFailed(true)}
                  />
                )
              : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={img}
                  alt="product"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                  className="h-full w-full object-cover"
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
          (isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-white dark:bg-black/10')
        }
        onClick={() => toggleSelected(r.id)}
        title={isSelected ? 'Selected' : 'Select'}
        aria-pressed={isSelected}
      >
        <div className="flex items-start justify-between gap-2 leading-snug">
          <div className="line-clamp-2 min-w-0 text-sm font-semibold text-black dark:text-white">{highlightMatches(name || '—', search)}</div>
          <div className="flex-none text-sm font-semibold text-black dark:text-white">
            {price ? (
              <>
                <span className="hidden sm:inline">AED </span>
                {price}
              </>
            ) : (
              ''
            )}
          </div>
        </div>
        <div className="text-xs leading-snug text-black/60 dark:text-white/55">{code ? <span>Code: {highlightMatches(code, search)}</span> : ' '}</div>
        <div className="flex items-center justify-between gap-2 text-xs leading-snug text-black/70 dark:text-white/65">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span className="truncate">{variant ? <span>Variant: {highlightMatches(variant, search)}</span> : ''}</span>
            {familyMode === 'main' && familyLabel && (variantCounts[familyLabel] || 0) > 1 && (
              <span className="flex-none rounded bg-black/5 px-1 py-0.5 text-[9px] font-bold text-black/40 dark:bg-white/10 dark:text-white/40">
                +{(variantCounts[familyLabel] || 0) - 1}
              </span>
            )}
          </div>
          <span className={isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-black/35 dark:text-white/30'}>
            {isSelected ? 'Selected' : ''}
          </span>
        </div>
        <div className="text-xs leading-snug text-black/55 dark:text-white/50">{size ? `Size: ${size}` : ' '}</div>
      </button>
    </div>
  );
}
