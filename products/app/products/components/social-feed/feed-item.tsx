import React, { useEffect, useRef, useState, useCallback, useLayoutEffect, memo } from 'react';
import { FeedVariant } from './types';
import { FeedMedia } from './feed-media';
import { FeedActions } from './feed-actions';
import { FeedCaption } from './feed-caption';

interface FeedItemProps {
  variant: FeedVariant;
  isActive: boolean;
  shouldPreload?: boolean;
  isSelected: boolean;
  onToggleSelectById: (id: string) => void;
  onDownloadMedia: (mediaUrl: string) => Promise<void>;
  onShareMedia: (variant: FeedVariant, mediaUrl: string) => Promise<void>;
  /** Stable parent handler; variant key passed from this row */
  onCollectionFilterTap: (key: string | null | undefined) => void;
  onDeleteMedia?: (mediaUrl: string) => void;
  activeCollectionFilter?: string | null;
  selectedCount: number;
  canEdit?: boolean;
  onAddMedia?: (variantId: string, url: string) => Promise<void>;
  onUpdateVariant?: (id: string, fields: Record<string, any>) => Promise<void>;
  triggerFilterHint?: boolean;
}

function FeedItemInner({
  variant,
  isActive,
  shouldPreload,
  isSelected,
  onToggleSelectById,
  onDownloadMedia,
  onShareMedia,
  onCollectionFilterTap,
  onDeleteMedia,
  activeCollectionFilter,
  selectedCount,
  canEdit,
  onAddMedia,
  onUpdateVariant,
  triggerFilterHint,
}: FeedItemProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const activeMediaIndexRef = useRef(0);

  useLayoutEffect(() => {
    activeMediaIndexRef.current = activeMediaIndex;
  }, [activeMediaIndex]);

  const handleToggleSelected = useCallback(() => {
    onToggleSelectById(variant.id);
  }, [variant.id, onToggleSelectById]);

  const handleShowCollection = useCallback(() => {
    onCollectionFilterTap(variant.collectionNameNormalized);
  }, [variant.collectionNameNormalized, onCollectionFilterTap]);

  // Horizontal rail: listener attached once per row — do not re-bind on every activeMediaIndex tick
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const width = el.clientWidth;
      if (width === 0) return;

      const scrollX = el.scrollLeft;
      const newIndex = Math.round(scrollX / width);
      if (newIndex !== activeMediaIndexRef.current) {
        activeMediaIndexRef.current = newIndex;
        setActiveMediaIndex(newIndex);
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const allMedia = variant.allMedia || [];
  const currentMediaUrl = allMedia[activeMediaIndex]?.url || variant.url;

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight') {
        if (activeMediaIndex < allMedia.length - 1) {
          e.preventDefault();
          const nextIndex = activeMediaIndex + 1;
          scrollContainerRef.current?.scrollTo({
            left: nextIndex * (scrollContainerRef.current?.clientWidth ?? 0),
            behavior: 'smooth',
          });
          activeMediaIndexRef.current = nextIndex;
          setActiveMediaIndex(nextIndex);
        }
      } else if (e.key === 'ArrowLeft') {
        if (activeMediaIndex > 0) {
          e.preventDefault();
          const prevIndex = activeMediaIndex - 1;
          scrollContainerRef.current?.scrollTo({
            left: prevIndex * (scrollContainerRef.current?.clientWidth ?? 0),
            behavior: 'smooth',
          });
          activeMediaIndexRef.current = prevIndex;
          setActiveMediaIndex(prevIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, activeMediaIndex, allMedia.length]);

  return (
    <div className="relative h-full w-full snap-start snap-always bg-black flex-none overflow-hidden touch-pan-y">
      {allMedia.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center text-white/50 text-sm">
          No Media Available
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scrollbar-none"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {allMedia.map((media, idx) => (
            <div key={idx} className="h-full min-w-full w-full snap-center flex-none">
              <FeedMedia
                media={media}
                isActive={isActive}
                shouldPreload={shouldPreload}
                isPrimary={isActive && activeMediaIndex === idx}
                onToggleSelect={handleToggleSelected}
                isSelected={isSelected}
              />
            </div>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/60 to-transparent z-10" />

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />

      {allMedia.length > 1 && (
        <div className="absolute top-[env(safe-area-inset-top)] left-1/2 -translate-x-1/2 z-50 mt-4 flex flex-col items-center gap-2 pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-black/30 backdrop-blur-md text-white/90 text-[11px] font-bold tracking-widest border border-white/10 shadow-sm">
            {activeMediaIndex + 1} / {allMedia.length}
          </div>

          <div className="flex justify-center gap-1.5">
            {allMedia.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  activeMediaIndex === i ?
                    'w-4 bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]'
                  : 'w-1 bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <FeedActions
        variant={variant}
        isSelected={isSelected}
        onToggleSelect={handleToggleSelected}
        onDownload={() => onDownloadMedia(currentMediaUrl)}
        onShare={() => onShareMedia(variant, currentMediaUrl)}
        onShowCollection={handleShowCollection}
        onDelete={onDeleteMedia ? () => onDeleteMedia(currentMediaUrl) : undefined}
        activeCollectionFilter={activeCollectionFilter}
        selectedCount={selectedCount}
        canEdit={canEdit}
        onAddMedia={onAddMedia}
        triggerFilterHint={triggerFilterHint}
      />

      <FeedCaption variant={variant} canEdit={canEdit} onUpdateVariant={onUpdateVariant} />
    </div>
  );
}

export const FeedItem = memo(FeedItemInner);
