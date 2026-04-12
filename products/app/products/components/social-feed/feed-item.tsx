import React, { useEffect, useRef, useState } from 'react';
import { FeedVariant } from './types';
import { FeedMedia } from './feed-media';
import { FeedActions } from './feed-actions';
import { FeedCaption } from './feed-caption';

interface FeedItemProps {
  variant: FeedVariant;
  isActive: boolean; // True when this variant is taking up the main screen vertically
  shouldPreload?: boolean; // True if this item is adjacent to the active one
  isSelected: boolean;
  onToggleSelect: () => void;
  onDownloadMedia: (mediaUrl: string) => Promise<void>;
  onShareMedia: (variant: FeedVariant, mediaUrl: string) => Promise<void>;
  onShowCollection: () => void;
  onDeleteMedia?: (mediaUrl: string) => void;
  activeCollectionFilter?: string | null;
  selectedCount: number;
  canEdit?: boolean;
  onAddMedia?: (variantId: string, url: string) => Promise<void>;
  onUpdateVariant?: (id: string, fields: Record<string, any>) => Promise<void>;
  triggerFilterHint?: boolean;
}

export function FeedItem({
  variant,
  isActive,
  shouldPreload,
  isSelected,
  onToggleSelect,
  onDownloadMedia,
  onShareMedia,
  onShowCollection,
  onDeleteMedia,
  activeCollectionFilter,
  selectedCount,
  canEdit,
  onAddMedia,
  onUpdateVariant,
  triggerFilterHint
}: FeedItemProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // Monitor horizontal scrolling to determine which media is "Primary"
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const width = el.clientWidth;
      if (width === 0) return;
      
      const scrollX = el.scrollLeft;
      // Round to nearest index
      const newIndex = Math.round(scrollX / width);
      if (newIndex !== activeMediaIndex) {
        setActiveMediaIndex(newIndex);
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    // Run once on mount incase not 0
    handleScroll();
    
    return () => el.removeEventListener('scroll', handleScroll);
  }, [activeMediaIndex]);

  const allMedia = variant.allMedia || [];
  const currentMediaUrl = allMedia[activeMediaIndex]?.url || variant.url;

  // Keyboard navigation for Horizontal Scroll (Media within variant)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if focus is in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight') {
        if (activeMediaIndex < allMedia.length - 1) {
          e.preventDefault();
          const nextIndex = activeMediaIndex + 1;
          scrollContainerRef.current?.scrollTo({
            left: nextIndex * scrollContainerRef.current.clientWidth,
            behavior: 'smooth'
          });
          setActiveMediaIndex(nextIndex);
        }
      } else if (e.key === 'ArrowLeft') {
        if (activeMediaIndex > 0) {
          e.preventDefault();
          const prevIndex = activeMediaIndex - 1;
          scrollContainerRef.current?.scrollTo({
            left: prevIndex * scrollContainerRef.current.clientWidth,
            behavior: 'smooth'
          });
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
                onToggleSelect={onToggleSelect}
                isSelected={isSelected}
              />
            </div>
          ))}
        </div>
      )}

      {/* VIGNETTES & OVERLAYS */}
      
      {/* Top Vignette (for readability and edge masking) */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/60 to-transparent z-10" />

      {/* Bottom Vignette (for caption readability) */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />

      {/* Top Media Info (Counter & Pagination Dots) */}
      {allMedia.length > 1 && (
        <div className="absolute top-[env(safe-area-inset-top)] left-1/2 -translate-x-1/2 z-50 mt-4 flex flex-col items-center gap-2 pointer-events-none">
          {/* Counter Pill */}
          <div className="px-3 py-1 rounded-full bg-black/30 backdrop-blur-md text-white/90 text-[11px] font-bold tracking-widest border border-white/10 shadow-sm">
            {activeMediaIndex + 1} / {allMedia.length}
          </div>
          
          {/* Dots Indicator */}
          <div className="flex justify-center gap-1.5">
            {allMedia.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 rounded-full transition-all duration-300 ${
                  activeMediaIndex === i ? 'w-4 bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]' : 'w-1 bg-white/40'
                }`} 
              />
            ))}
          </div>
        </div>
      )}

      {/* Actions (Right) */}
      <FeedActions 
        variant={variant} 
        isSelected={isSelected} 
        onToggleSelect={onToggleSelect} 
        onDownload={() => onDownloadMedia(currentMediaUrl)} 
        onShare={() => onShareMedia(variant, currentMediaUrl)} 
        onShowCollection={onShowCollection} 
        onDelete={onDeleteMedia ? () => onDeleteMedia(currentMediaUrl) : undefined}
        activeCollectionFilter={activeCollectionFilter}
        selectedCount={selectedCount}
        canEdit={canEdit}
        onAddMedia={onAddMedia}
        triggerFilterHint={triggerFilterHint}
      />

      {/* Caption (Bottom) */}
      <FeedCaption 
        variant={variant} 
        canEdit={canEdit} 
        onUpdateVariant={onUpdateVariant} 
      />

    </div>
  );
}
