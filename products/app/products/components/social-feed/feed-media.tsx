import React, { useEffect, useRef, useState } from 'react';
import { FeedMediaItem } from './types';

interface FeedMediaProps {
  media: FeedMediaItem;
  isActive: boolean; // True if this variant is fully visible in vertical scroll
  shouldPreload?: boolean; // True if this media is adjacent to active
  isPrimary: boolean; // True if this media is fully visible in horizontal scroll
  onToggleSelect?: () => void;
  isSelected?: boolean;
}

export function FeedMedia({ media, isActive, shouldPreload, isPrimary, onToggleSelect, isSelected }: FeedMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  // Set shouldLoad if parent says to preload
  useEffect(() => {
    if (shouldPreload) {
      setShouldLoad(true);
    }
  }, [shouldPreload]);
  const [showHeart, setShowHeart] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Intersection observer to only lazily load actual iframe/video contents when near viewport
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px 0px' } // Load slightly before it comes into view
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Manage auto-playback of native videos based on activity
  useEffect(() => {
    if (media.isVideo && !media.driveId && videoRef.current) {
      if (isActive && isPrimary) {
        videoRef.current.play().catch(() => {
          // Ignore autoplay enforcement errors
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isActive, isPrimary, media.isVideo, media.driveId]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Detect double tap
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (onToggleSelect) {
        // Only select if not already selected, or just toggle?
        // TikTok usually selects (likes) on double tap.
        if (!isSelected) {
          onToggleSelect();
        }
        
        // Show animation
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 800);
      }
      lastTapRef.current = 0; // Reset
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative flex h-full w-full items-center justify-center snap-center bg-black cursor-pointer overflow-hidden"
      onPointerDown={handlePointerDown}
    >
      {!shouldLoad ? null : media.isVideo ? (
        media.driveId ? (
          // Drive videos cannot be reliably autoplayed via URL params in iframe, but we can display them cleanly
          <div className="relative h-full w-full pointer-events-none">
            <iframe
              src={`https://drive.google.com/file/d/${media.driveId}/preview`}
              className="absolute inset-0 h-full w-full border-0 select-none"
              allow="autoplay"
              allowFullScreen
              style={{ pointerEvents: isActive && isPrimary ? 'auto' : 'none' }}
            />
            {/* Overlay to catch vertical swipes over the iframe so it doesn't trap scroll */}
            <div className="absolute inset-y-0 left-0 w-8 z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-8 z-10 pointer-events-none" />
            <div className="absolute inset-0 z-0 pointer-events-none" /> 
          </div>
        ) : (
          <video
            ref={videoRef}
            src={media.originalUrl}
            controls={isActive && isPrimary}
            loop
            playsInline
            muted
            className="max-h-full w-auto max-w-full object-contain pointer-events-none"
          />
        )
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={media.url}
          alt="Product"
          className="max-h-full w-auto max-w-full object-contain select-none pointer-events-none"
          draggable={false}
          loading="lazy"
        />
      )}

      {/* Double Tap Heart Animation Overlay */}
      {showHeart && (
        <div className="pointer-events-none absolute inset-0 z-[100] flex items-center justify-center">
          <div className="animate-heart-pop text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]">
            <svg viewBox="0 0 24 24" className="h-24 w-24 fill-current">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
