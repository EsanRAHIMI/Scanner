import React, { useEffect, useRef, useState, useMemo, useCallback, useLayoutEffect, startTransition } from 'react';
import { FeedVariant } from './types';
import { FeedItem } from './feed-item';
import { endLightboxTrace, markLightboxTrace } from '../../lib/lightbox-perf';

export interface SocialFeedProps {
  variants: FeedVariant[];
  initialVariantId: string | null;
  /** Optional row index from parent (same order as `variants`) to skip O(n) id lookup on open. */
  initialVariantIndex?: number | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onClose: () => void;
  onFilterCollection: (collectionName: string | null) => void;
  activeCollectionName?: string | null;
  selectedCount: number;
  canEdit?: boolean;
  canEditField?: (fieldName: string) => boolean;
  onAddMedia?: (variantId: string, url: string) => Promise<void>;
  onUpdateVariant?: (id: string, fields: Record<string, any>) => Promise<void>;
}

export function SocialFeed({
  variants,
  initialVariantId,
  initialVariantIndex,
  selectedIds,
  onToggleSelect,
  onClose,
  onFilterCollection,
  activeCollectionName,
  selectedCount,
  canEdit,
  canEditField,
  onAddMedia,
  onUpdateVariant
}: SocialFeedProps) {

  // Resolve initial index — prefer explicit index (O(1)) over scanning all variants by id (O(n))
  const initialIndex = useMemo(() => {
    if (
      typeof initialVariantIndex === 'number' &&
      Number.isFinite(initialVariantIndex) &&
      initialVariantIndex >= 0 &&
      initialVariantIndex < variants.length
    ) {
      return initialVariantIndex;
    }
    if (!initialVariantId) return 0;
    const idx = variants.findIndex((v) => v.id === initialVariantId);
    return idx >= 0 ? idx : 0;
  }, [variants, initialVariantId, initialVariantIndex]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [hydrationRadius, setHydrationRadius] = useState(2);
  const activeIndexRef = useRef(initialIndex);
  useLayoutEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const variantsLengthRef = useRef(variants.length);
  useLayoutEffect(() => {
    variantsLengthRef.current = variants.length;
  }, [variants.length]);

  const [showFilterHint, setShowFilterHint] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerHint = () => {
    if (!activeCollectionName || showFilterHint) return;
    setShowFilterHint(true);
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = setTimeout(() => setShowFilterHint(false), 1500);
  };

  const triggerHintRef = useRef(triggerHint);
  triggerHintRef.current = triggerHint;

  // Set initial scroll position logic on mount
  useEffect(() => {
    markLightboxTrace('socialFeed:mount');
    if (containerRef.current) {
      if (initialIndex > 0) {
        containerRef.current.scrollTop = initialIndex * containerRef.current.clientHeight;
      }
      containerRef.current.focus();
    }
  }, []); // Only on mount

  useLayoutEffect(() => {
    markLightboxTrace('socialFeed:first-frame');
    endLightboxTrace('overlay:first-frame');
  }, []);

  // Keep initial mount cheap: render a small window first, then progressively hydrate farther items.
  useEffect(() => {
    setHydrationRadius(2);
  }, [initialIndex, variants.length]);

  useEffect(() => {
    if (variants.length <= 0) return;
    let cancelled = false;
    const grow = () => {
      if (cancelled) return;
      setHydrationRadius((prev) => {
        if (prev >= variants.length) return prev;
        return Math.min(prev + 8, variants.length);
      });
    };

    const schedule =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? () =>
            (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout?: number }) => number })
              .requestIdleCallback(grow, { timeout: 120 })
        : () => window.setTimeout(grow, 60);

    const cancel =
      typeof window !== 'undefined' && 'cancelIdleCallback' in window
        ? (id: number) =>
            (window as Window & { cancelIdleCallback: (idleId: number) => void }).cancelIdleCallback(id)
        : (id: number) => window.clearTimeout(id);

    let timerId = 0;
    const tick = () => {
      if (cancelled) return;
      timerId = schedule();
    };
    tick();

    const intervalId = window.setInterval(() => {
      setHydrationRadius((prev) => {
        if (prev >= variants.length) {
          window.clearInterval(intervalId);
          return prev;
        }
        const next = Math.min(prev + 16, variants.length);
        return next;
      });
      tick();
    }, 120);

    return () => {
      cancelled = true;
      cancel(timerId);
      window.clearInterval(intervalId);
    };
  }, [variants.length]);

  // Vertical snap: one listener, rAF + startTransition — avoid re-attaching per activeIndex (was freezing scroll)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    const handleScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const height = el.clientHeight;
        if (height <= 0) return;
        const index = Math.round(el.scrollTop / height);
        const max = variantsLengthRef.current - 1;
        const clamped = max >= 0 ? Math.max(0, Math.min(max, index)) : 0;
        if (clamped !== activeIndexRef.current) {
          activeIndexRef.current = clamped;
          startTransition(() => setActiveIndex(clamped));
        }
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('scroll', handleScroll);
    };
  }, []);

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
          activeIndexRef.current = nextIndex;
          setActiveIndex(nextIndex);
        } else if (activeCollectionName) {
          triggerHint();
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
          activeIndexRef.current = prevIndex;
          setActiveIndex(prevIndex);
        }
      } else if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
        } else {
          onClose();
        }
      } else if (e.key === '/' && !showSearch) {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, variants.length, onClose, activeCollectionName, showFilterHint, showSearch]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q) return;

    const lowerQ = q.toLowerCase().trim();
    // Try search by code first, then title
    const foundIdx = variants.findIndex(v => {
      const code = (v.codeNumber || v.code || '').toLowerCase();
      const title = (v.title || '').toLowerCase();
      return code.includes(lowerQ) || title.includes(lowerQ);
    });

    if (foundIdx >= 0 && foundIdx !== activeIndex) {
      const height = containerRef.current?.clientHeight || window.innerHeight;
      containerRef.current?.scrollTo({
        top: foundIdx * height,
        behavior: 'smooth'
      });
      activeIndexRef.current = foundIdx;
      setActiveIndex(foundIdx);
    }
  };

  // Touch/Wheel overscroll detection — stable listeners (refs), not tied to activeIndex
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStartY = 0;

    const handleWheel = (e: WheelEvent) => {
      if (
        e.deltaY > 0 &&
        activeIndexRef.current === variantsLengthRef.current - 1 &&
        variantsLengthRef.current > 0
      ) {
        triggerHintRef.current();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      if (
        deltaY > 20 &&
        activeIndexRef.current === variantsLengthRef.current - 1 &&
        variantsLengthRef.current > 0
      ) {
        triggerHintRef.current();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: true });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  const handleDownloadMedia = useCallback(async (url: string) => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const blob = await res.blob();
      const ext =
        blob.type === 'image/png'
          ? 'png'
          : blob.type === 'image/webp'
            ? 'webp'
            : blob.type.includes('video')
              ? 'mp4'
              : 'jpg';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `media_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {}
  }, []);

  const handleShareMedia = useCallback(async (variant: FeedVariant, mediaUrl: string) => {
    // 1. Structure the minimalist English metadata
    const specs = [
      `Collection: ${variant.collectionName || variant.title || '---'}`,
      `Code: ${variant.codeNumber || variant.code || '---'}`,
      `Variant: No. ${variant.variant || variant.num || '---'}`,
      variant.price ? `Price: ${variant.price} AED` : null,
      variant.material ? `Material: ${variant.material}` : null,
      variant.dimension ? `Dimension: ${variant.dimension}` : null,
      variant.category ? `Category: ${variant.category}` : null,
    ].filter(Boolean).join('\n');

    const message = `PRODUCT SPECIFICATIONS\n----------------------\n${specs}\n\nLink: ${mediaUrl}`;

    try {
      if (navigator.share) {
        const shareData: ShareData = {
          title: variant.collectionName || variant.title,
          text: message,
        };

        // 2. Attempt to share as a file if it's an image
        const isImage = !mediaUrl.toLowerCase().includes('.mp4') && !mediaUrl.toLowerCase().includes('#video');
        
        if (isImage && navigator.canShare && navigator.canShare({ files: [] })) {
          try {
            const response = await fetch(mediaUrl, { mode: 'cors' });
            if (response.ok) {
              const blob = await response.blob();
              const extension = mediaUrl.split('.').pop()?.split(/[#?]/)[0] || 'jpg';
              const file = new File([blob], `product-${variant.code || 'image'}.${extension}`, { type: blob.type });
              
              if (navigator.canShare({ files: [file] })) {
                shareData.files = [file];
                // When sharing files, some platforms prefer the text to be in the 'text' field, 
                // and some sometimes ignore 'url' if 'files' is present.
              }
            }
          } catch (fetchErr) {
            console.warn('Could not fetch image for sharing (CORS or Network):', fetchErr);
            // Fallback to URL if fetch fails
            shareData.url = mediaUrl;
          }
        } else {
          shareData.url = mediaUrl;
        }

        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(message);
        alert('Product specifications copied to clipboard!');
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        alert('Error sharing product detail');
      }
    }
  }, []);

  const handleCollectionTap = useCallback(
    (key: string | null | undefined) => {
      if (!key) return;
      if (activeCollectionName === key) onFilterCollection(null);
      else onFilterCollection(key);
    },
    [activeCollectionName, onFilterCollection],
  );

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
          title="Back to gallery"
          className="flex h-12 w-12 items-center justify-center text-white/70 hover:text-white transition-all pointer-events-auto active:scale-90"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 DropShadow" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        
        <button 
          type="button"
          onClick={() => setShowSearch(true)}
          title="Search"
          className="flex h-12 w-12 items-center justify-center text-white/70 hover:text-white transition-all pointer-events-auto active:scale-90"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 DropShadow" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
      </div>

      {/* Quick Search Overlay */}
      {showSearch && (
        <>
          {/* Backdrop for click-outside to close - transparent to see live results */}
          <div 
            className="absolute inset-0 z-[1999] animate-fade-in" 
            onClick={() => { setShowSearch(false); setSearchQuery(''); }}
          />
          <div className="absolute inset-x-0 top-24 z-[2000] flex justify-center px-4 animate-fade-in">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-zinc-950/60 p-1 backdrop-blur-3xl shadow-2xl ring-1 ring-white/10">
              <div className="relative flex items-center">
                <div className="absolute left-4 text-white/40">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <input 
                  autoFocus
                  type="text"
                  placeholder="Type product code or name..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowSearch(false);
                      setSearchQuery('');
                    } else if (e.key === 'Escape') {
                      setShowSearch(false);
                      setSearchQuery('');
                    }
                  }}
                  className="h-14 w-full bg-transparent pl-12 pr-4 text-sm font-black text-white outline-none placeholder:text-white/20"
                />
                <button 
                  onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                  className="mr-3 flex h-8 items-center rounded-lg bg-white/10 px-3 text-[11px] font-black uppercase text-white/50 hover:bg-white/20 hover:text-white transition-all ring-1 ring-white/10"
                >
                  Esc
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
            {Math.abs(idx - activeIndex) <= hydrationRadius ? (
              <FeedItem 
                variant={variant}
                isActive={idx === activeIndex}
                shouldPreload={Math.abs(idx - activeIndex) === 1}
                isSelected={selectedIds.has(variant.id)}
                onToggleSelectById={onToggleSelect}
                onDownloadMedia={handleDownloadMedia}
                onShareMedia={handleShareMedia}
                onCollectionFilterTap={handleCollectionTap}
                activeCollectionFilter={activeCollectionName}
                selectedCount={selectedCount}
                canEdit={canEdit}
                canEditField={canEditField}
                onAddMedia={onAddMedia}
                onUpdateVariant={onUpdateVariant}
                triggerFilterHint={idx === activeIndex ? showFilterHint : false}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

