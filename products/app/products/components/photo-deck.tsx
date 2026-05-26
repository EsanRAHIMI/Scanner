'use client';

import * as React from 'react';
import {
  DRIVE_IMAGE_WIDTH_FULL,
  DRIVE_IMAGE_WIDTH_LIST,
  getDriveDirectLink,
  isVideoUrl,
} from '../lib/product-utils';
import { beginLightboxTrace, markLightboxTrace } from '../lib/lightbox-perf';
import { useInView } from '../hooks/use-in-view';
import { CachedMediaPreview } from './cached-media-preview';

import { PhotoDeckProps } from '../types/products-ui';

const PhotoDeck = React.memo(({
  urls,
  maxItems = 4,
  onOpenPreview,
  onDragStart,
  onDragEnd,
  linkHoverTimerRef,
  recordId,
  column,
  onMouseEnter,
  onMouseLeave,
}: PhotoDeckProps) => {
  const visibleUrls = urls.slice(0, maxItems);
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>('280px 0px');
  const [stackExpanded, setStackExpanded] = React.useState(false);

  if (visibleUrls.length === 0) return null;

  return (
    <div
      ref={inViewRef}
      className="group relative flex h-24 w-24 items-center justify-center pointer-events-auto"
      onMouseEnter={() => setStackExpanded(true)}
      onMouseLeave={() => setStackExpanded(false)}
    >
      {visibleUrls
        .slice()
        .reverse()
        .map((u, i) => {
          const revIdx = visibleUrls.length - 1 - i;
          const isVideo = isVideoUrl(u);
          const previewUrl = getDriveDirectLink(u, DRIVE_IMAGE_WIDTH_FULL);
          const isTopCard = revIdx === 0;
          const shouldLoadImage = inView && (isTopCard || stackExpanded);

          return (
            <button
              key={u + i}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                beginLightboxTrace('photo-deck');
                markLightboxTrace('click:handler');
                onOpenPreview?.(previewUrl);
              }}
              title={previewUrl ? `${isVideo ? 'Video' : 'Image'} ${revIdx + 1} of ${urls.length} (Click to maximize)` : 'No content'}
              aria-label={`View ${isVideo ? 'video' : 'image'} ${revIdx + 1} of ${urls.length}`}
              style={{
                '--idx': revIdx,
                zIndex: 10 - revIdx,
              } as React.CSSProperties}
              className={`absolute transition-all duration-300 ease-out origin-bottom
                [transform:rotate(calc(var(--idx)*3.2deg))_translate(calc(var(--idx)*4px),calc(var(--idx)*-2px))]
                group-hover:[transform:rotate(calc(var(--idx)*8deg))_translate(calc(var(--idx)*16px),calc(var(--idx)*-5px))]
                hover:!scale-110 focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md
              `}
              draggable
              onMouseEnter={(e) => onMouseEnter?.(u, e)}
              onMouseLeave={() => onMouseLeave?.()}
              onDragStart={(e) => {
                if (linkHoverTimerRef?.current) clearTimeout(linkHoverTimerRef.current);
                e.dataTransfer.setData('text/plain', u);
                onDragStart?.(u);
              }}
              onDragEnd={() => onDragEnd?.()}
              tabIndex={0}
            >
              <div className="relative block h-24 w-24 overflow-hidden rounded-md border border-black/80 bg-white shadow-sm dark:border-white/25 dark:bg-black/60 ring-1 ring-black/10 dark:ring-white/10 backdrop-blur-[2px]">
                {isVideo ? (
                  <div className="flex h-full w-full items-center justify-center bg-black/10 dark:bg-white/10">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm border border-white/40 shadow-lg">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <CachedMediaPreview
                    url={u}
                    width={DRIVE_IMAGE_WIDTH_LIST}
                    enabled={shouldLoadImage}
                    priority={isTopCard && inView}
                    className="block h-full w-full object-cover"
                    alt={`Product view ${revIdx + 1}`}
                  />
                )}
              </div>
            </button>
          );
        })}
      {urls.length > 1 ? (
        <div className="pointer-events-none absolute bottom-1 right-1 z-[20] flex h-6 min-w-[24px] translate-x-[20%] translate-y-[20%] items-center justify-center rounded-full border border-white/30 bg-emerald-600 px-1.5 text-[10px] font-black text-white shadow-xl transition-transform group-hover:scale-110">
          +{urls.length - 1}
        </div>
      ) : null}
    </div>
  );
});
PhotoDeck.displayName = 'PhotoDeck';

export { PhotoDeck };
