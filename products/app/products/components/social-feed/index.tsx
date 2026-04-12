import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FeedVariant } from './types';
import { FeedItem } from './feed-item';

export interface SocialFeedProps {
  variants: FeedVariant[];
  initialVariantId: string | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onClose: () => void;
  onFilterCollection: (collectionName: string) => void;
}

export function SocialFeed({
  variants,
  initialVariantId,
  selectedIds,
  onToggleSelect,
  onClose,
  onFilterCollection
}: SocialFeedProps) {

  // Resolve initial index
  const initialIndex = useMemo(() => {
    if (!initialVariantId) return 0;
    const idx = variants.findIndex(v => v.id === initialVariantId);
    return idx >= 0 ? idx : 0;
  }, [variants, initialVariantId]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  // Set initial scroll position logic on mount
  useEffect(() => {
    if (containerRef.current && initialIndex > 0) {
      containerRef.current.scrollTop = initialIndex * window.innerHeight;
    }
  }, []); // Only on mount

  // Simple scroll detection for active index
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const height = el.clientHeight;
      if (height > 0) {
        const scrollY = el.scrollTop;
        const index = Math.round(scrollY / height);
        if (index !== activeIndex) {
          setActiveIndex(index);
        }
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [activeIndex]);

  const handleDownloadMedia = async (url: string) => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const blob = await res.blob();
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : blob.type.includes('video') ? 'mp4' : 'jpg';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `media_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {}
  };

  const handleShareMedia = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    } catch {
      alert('Failed to copy link');
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black text-white touch-none">
      
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-[1050] flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <button 
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition-colors pointer-events-auto active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div className="font-bold tracking-widest text-[13px] drop-shadow-md text-white/90">
          PRODUCTS FEED
        </div>
        <div className="w-10" />
      </div>

      {/* Vertical Snap Container */}
      <div 
        ref={containerRef}
        className="h-full w-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {variants.map((variant, idx) => (
          <div 
            key={variant.id} 
            className="h-screen w-full flex-none snap-start snap-always" 
            style={{ 
              height: '100vh',
              // Use content-visibility for performance with few hundred items
              contentVisibility: Math.abs(idx - activeIndex) > 3 ? 'hidden' : 'auto' 
            }}
          >
            <FeedItem 
              variant={variant}
              isActive={idx === activeIndex}
              isSelected={selectedIds.has(variant.id)}
              onToggleSelect={() => onToggleSelect(variant.id)}
              onDownloadMedia={handleDownloadMedia}
              onShareMedia={handleShareMedia}
              onShowCollection={() => {
                const key = variant.collectionNameNormalized;
                if (key) {
                  onFilterCollection(key);
                  onClose();
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

