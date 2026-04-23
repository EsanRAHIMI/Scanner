'use client';

import * as React from 'react';
import { isVideoUrl, getDriveDirectLink } from '../lib/product-utils';
import { ProductDetailsPanel } from './product-details-panel';
import type { GalleryItem, SwipeRefState } from '../types/shared-types';

interface LightboxViewerProps {
  currentItem: GalleryItem;
  galleryItems: GalleryItem[];
  currentIndex: number;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  closePreview: () => void;
  goPrev: () => void;
  goNext: () => void;
  swipeRef: React.MutableRefObject<SwipeRefState>;
  setFamilyCollectionName: (name: string | null) => void;
  setPreviewId: (id: string | null) => void;
  setPreviewIndex: (i: number | null | ((prev: number | null) => number | null)) => void;
  lightboxDetailsCollapsed: boolean;
  setLightboxDetailsCollapsed: (val: boolean | ((v: boolean) => boolean)) => void;
  currentCollectionVariants: GalleryItem[];
}

export function LightboxViewer({
  currentItem,
  galleryItems,
  currentIndex,
  selectedIds,
  toggleSelected,
  closePreview,
  goPrev,
  goNext,
  swipeRef,
  setFamilyCollectionName,
  setPreviewId,
  setPreviewIndex,
  lightboxDetailsCollapsed,
  setLightboxDetailsCollapsed,
  currentCollectionVariants
}: LightboxViewerProps) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/85 backdrop-blur-[2px] p-4 text-black dark:bg-black/85 dark:text-white"
      role="dialog"
      aria-modal="true"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) closePreview();
      }}
    >
      {/* Top Controls */}
      <div className="fixed left-3 top-3 z-[1010] flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/70 text-black/80 shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/35 dark:text-white/85 transition-colors hover:bg-white dark:hover:bg-black/50"
          onClick={(e) => {
            e.stopPropagation();
            closePreview();
          }}
          title="Close"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>

        <div className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold text-black/80 backdrop-blur-md dark:border-white/10 dark:bg-black/35 dark:text-white/85">
          {currentIndex + 1} / {galleryItems.length}
        </div>
      </div>

      {/* Selection Status */}
      {selectedIds.has(currentItem.id) && (
        <div
          className="fixed right-3 top-3 z-[1010] inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/70 bg-emerald-500/15 text-emerald-700 shadow-lg backdrop-blur dark:border-emerald-200/60 dark:bg-emerald-500/20 dark:text-emerald-50 animate-fade-in"
          onPointerDown={(e) => e.stopPropagation()}
          title="Selected"
          aria-label="Selected"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Media Container */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ transform: 'translateY(-15%)' }}
        onPointerDown={(e) => {
          const isIframe = (e.target as HTMLElement).tagName === 'IFRAME';
          if (isIframe) return; // Don't intercept pointer on iframe
          
          e.stopPropagation();
          if (galleryItems.length <= 1) return;
          swipeRef.current.pointerId = e.pointerId;
          swipeRef.current.startX = e.clientX;
          swipeRef.current.startY = e.clientY;
          swipeRef.current.moved = false;
          swipeRef.current.swiped = false;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        }}
        onPointerMove={(e) => {
          if (swipeRef.current.pointerId !== e.pointerId) return;
          const dx = e.clientX - swipeRef.current.startX;
          const dy = e.clientY - swipeRef.current.startY;
          if (!swipeRef.current.moved) {
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
            swipeRef.current.moved = true;
          }
          if (swipeRef.current.swiped) return;
          if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 40) {
            swipeRef.current.swiped = true;
            if (dx < 0) goNext(); else goPrev();
          }
        }}
        onPointerUp={(e) => { if (swipeRef.current.pointerId === e.pointerId) swipeRef.current.pointerId = null; }}
      >
        {isVideoUrl(currentItem.originalUrl) ? (
          currentItem.driveId ? (
            <div className="relative h-[80vh] w-[90vw] max-w-4xl overflow-hidden rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 shadow-2xl transition-all">
              <iframe
                src={`https://drive.google.com/file/d/${currentItem.driveId}/preview`}
                className="absolute inset-0 h-full w-full border-0"
                allow="autoplay"
                allowFullScreen
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
              {/* Invisible swipe bumper to allow gallery nav even if iframe is focused */}
              <div className="absolute inset-y-0 left-0 w-8 z-10 pointer-events-none" />
              <div className="absolute inset-y-0 right-0 w-8 z-10 pointer-events-none" />
            </div>
          ) : (
            <video
              src={currentItem.originalUrl}
              controls
              autoPlay
              className="max-h-[85vh] w-auto max-w-[95vw] rounded-xl shadow-2xl"
              onPointerDown={(e) => e.stopPropagation()}
            />
          )
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={getDriveDirectLink(currentItem.url)}
            alt={currentItem.title}
            className="max-h-[85vh] w-auto max-w-[95vw] select-none object-contain shadow-2xl transition-transform duration-300"
            draggable={false}
            style={{ touchAction: 'pan-y' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (swipeRef.current.swiped) return;
              if (e.shiftKey || e.pointerType === 'mouse') {
                toggleSelected(currentItem.id);
              }
            }}
          />
        )}
      </div>

      {/* Navigation Arrows */}
      {galleryItems.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed left-0 top-0 flex h-full w-[60px] items-center justify-center bg-transparent group"
            aria-label="Previous"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/55 text-lg font-semibold text-black shadow-sm backdrop-blur transition-all group-hover:bg-white dark:border-white/15 dark:bg-black/20 dark:text-white dark:group-hover:bg-black/40">
              ‹
            </span>
          </button>
          <button
            type="button"
            onClick={goNext}
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed right-0 top-0 flex h-full w-[60px] items-center justify-center bg-transparent group"
            aria-label="Next"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/55 text-lg font-semibold text-black shadow-sm backdrop-blur transition-all group-hover:bg-white dark:border-white/15 dark:bg-black/20 dark:text-white dark:group-hover:bg-black/40">
              ›
            </span>
          </button>
        </>
      )}

      <ProductDetailsPanel
        currentItem={currentItem}
        currentCollectionVariants={currentCollectionVariants}
        selectedIds={selectedIds}
        toggleSelected={toggleSelected}
        setFamilyCollectionName={setFamilyCollectionName}
        setPreviewId={setPreviewId}
        setPreviewIndex={setPreviewIndex}
        lightboxDetailsCollapsed={lightboxDetailsCollapsed}
        setLightboxDetailsCollapsed={setLightboxDetailsCollapsed}
      />
    </div>
  );
}
