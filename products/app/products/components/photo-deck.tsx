'use client';

import * as React from 'react';
import { isVideoUrl, getDriveDirectLink } from '../lib/product-utils';

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
  onMouseLeave
}: PhotoDeckProps) => {
  const visibleUrls = urls.slice(0, maxItems);
  if (visibleUrls.length === 0) return null;

  return (
    <div className="group relative h-24 w-24 flex items-center justify-center pointer-events-auto">
      {visibleUrls
        .slice()
        .reverse()
        .map((u, i) => {
          const revIdx = visibleUrls.length - 1 - i;
          const isVideo = isVideoUrl(u);
          const finalUrl = getDriveDirectLink(u);
          
          return (
            <button
              key={u + i}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenPreview?.(finalUrl);
              }}
              title={finalUrl ? `${isVideo ? 'Video' : 'Image'} ${revIdx + 1} of ${urls.length} (Click to maximize)` : 'No content'}
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={finalUrl}
                  alt={`Product view ${revIdx + 1}`}
                  loading="lazy"
                  decoding="async"
                  fetchPriority={revIdx === 0 ? "high" : "low"}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="block h-full w-full object-cover"
                />
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm border border-white/40 shadow-lg">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      {urls.length > 1 && (
        <div className="absolute bottom-1 right-1 z-[20] flex h-6 min-w-[24px] items-center justify-center rounded-full border border-white/30 bg-emerald-600 px-1.5 text-[10px] font-black text-white shadow-xl translate-x-[20%] translate-y-[20%] pointer-events-none group-hover:scale-110 transition-transform">
          +{urls.length - 1}
        </div>
      )}
    </div>
  );
});
PhotoDeck.displayName = 'PhotoDeck';

export { PhotoDeck };
