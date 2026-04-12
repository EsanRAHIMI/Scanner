import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FeedVariant } from './types';
import { FeedItem } from './feed-item';

export interface SocialFeedProps {
  variants: FeedVariant[];
  initialVariantId: string | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onClose: () => void;
  onFilterCollection: (collectionName: string | null) => void;
  activeCollectionName?: string | null;
  selectedCount: number;
  canEdit?: boolean;
  onAddMedia?: (variantId: string, url: string) => Promise<void>;
}

export function SocialFeed({
  variants,
  initialVariantId,
  selectedIds,
  onToggleSelect,
  onClose,
  onFilterCollection,
  activeCollectionName,
  selectedCount,
  canEdit,
  onAddMedia
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
    if (containerRef.current) {
      if (initialIndex > 0) {
        containerRef.current.scrollTop = initialIndex * containerRef.current.clientHeight;
      }
      containerRef.current.focus();
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

  // Keyboard navigation for Vertical Scroll (Products)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if focus is in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowDown') {
        if (activeIndex < variants.length - 1) {
          e.preventDefault();
          const nextIndex = activeIndex + 1;
          const height = containerRef.current?.clientHeight || window.innerHeight;
          containerRef.current?.scrollTo({
            top: nextIndex * height,
            behavior: 'smooth'
          });
          setActiveIndex(nextIndex);
        }
      } else if (e.key === 'ArrowUp') {
        if (activeIndex > 0) {
          e.preventDefault();
          const prevIndex = activeIndex - 1;
          const height = containerRef.current?.clientHeight || window.innerHeight;
          containerRef.current?.scrollTo({
            top: prevIndex * height,
            behavior: 'smooth'
          });
          setActiveIndex(prevIndex);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, variants.length, onClose]);

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

  const handleShareMedia = async (variant: FeedVariant, mediaUrl: string) => {
    const message = `📦 مشخصات محصول
------------------
🏷️ نام: ${variant.title || '---'}
🔢 کد: ${variant.codeNumber || variant.code || '---'}
🆔 ورینت: ${variant.variant || '---'}
📏 سایز: ${variant.dimension || '---'}
💰 قیمت: ${variant.price || '---'}

🔗 لینک: ${mediaUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: variant.title,
          text: message,
          url: mediaUrl,
        });
      } else {
        await navigator.clipboard.writeText(message);
        alert('مشخصات محصول در حافظه کپی شد!');
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        alert('خطا در اشتراک‌گذاری');
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-black text-white focus:outline-none"
      tabIndex={0}
      onMouseDown={() => containerRef.current?.focus()}
    >
      
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
        <div className="w-10" />
      </div>

      {/* Vertical Snap Container */}
      <div 
        ref={containerRef}
        tabIndex={-1}
        className="h-full w-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory scrollbar-none focus:outline-none"
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
              onShareMedia={(v, url) => handleShareMedia(v, url)}
              onShowCollection={() => {
                const key = variant.collectionNameNormalized;
                if (key) {
                  // Toggle behavior: If already filtering THIS collection, clear it.
                  if (activeCollectionName === key) {
                    onFilterCollection(null);
                  } else {
                    onFilterCollection(key);
                  }
                  // We NO LONGER call onClose() here to stay in the feed
                }
              }}
              activeCollectionFilter={activeCollectionName}
              selectedCount={selectedCount}
              canEdit={canEdit}
              onAddMedia={onAddMedia}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

