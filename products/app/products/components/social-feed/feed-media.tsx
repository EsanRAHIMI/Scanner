import React, { useEffect, useRef, useState } from 'react';
import { FeedMediaItem } from './types';

interface FeedMediaProps {
  media: FeedMediaItem;
  isActive: boolean; // True if this variant is fully visible in vertical scroll
  isPrimary: boolean; // True if this media is fully visible in horizontal scroll
}

export function FeedMedia({ media, isActive, isPrimary }: FeedMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

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

  return (
    <div ref={containerRef} className="relative flex h-full w-full items-center justify-center snap-center bg-black">
      {!shouldLoad ? null : media.isVideo ? (
        media.driveId ? (
          // Drive videos cannot be reliably autoplayed via URL params in iframe, but we can display them cleanly
          <div className="relative h-full w-full">
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
            className="max-h-full w-auto max-w-full object-contain"
          />
        )
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={media.url}
          alt="Product"
          className="max-h-full w-auto max-w-full object-contain select-none"
          draggable={false}
          loading="lazy"
        />
      )}
    </div>
  );
}
