'use client';

import * as React from 'react';

interface Variant {
  id: string;
  title: string;
  code?: string;
  variant?: string;
  dimension?: string;
  price?: string;
  collectionNameNormalized?: string;
}

interface ProductDetailsPanelProps {
  currentItem: any;
  currentCollectionVariants: Variant[];
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  setFamilyCollectionName: (name: string | null) => void;
  setPreviewId: (id: string | null) => void;
  setPreviewIndex: (fn: (prev: number | null) => number | null) => void;
  lightboxDetailsCollapsed: boolean;
  setLightboxDetailsCollapsed: (val: boolean | ((v: boolean) => boolean)) => void;
}

export function ProductDetailsPanel({
  currentItem,
  currentCollectionVariants,
  selectedIds,
  toggleSelected,
  setFamilyCollectionName,
  setPreviewId,
  setPreviewIndex,
  lightboxDetailsCollapsed,
  setLightboxDetailsCollapsed,
}: ProductDetailsPanelProps) {
  if (!currentItem) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={
          'mx-auto max-h-[45vh] max-w-xl rounded-2xl border p-4 pb-28 text-black shadow-lg backdrop-blur dark:text-white transition-all duration-300 ease-out ' +
          (selectedIds.has(currentItem.id)
            ? 'border-emerald-300/40 bg-emerald-500/10 dark:border-emerald-200/40 dark:bg-emerald-900/20'
            : 'border-black/10 bg-white/70 dark:border-white/10 dark:bg-black/35') +
          (lightboxDetailsCollapsed ? ' max-h-[120px] sm:max-h-[200px] overflow-hidden mt-8' : ' max-h-[55vh] sm:max-h-[45vh] overflow-auto')
        }
        onClick={() => {
          if (currentCollectionVariants.length > 1) {
            setLightboxDetailsCollapsed((v) => !v);
          }
        }}
      >
        <div className="relative">
          {currentCollectionVariants.length > 1 && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setLightboxDetailsCollapsed((v) => !v);
              }}
              className="absolute left-1/2 top-0 z-10 inline-flex h-10 w-10 -translate-x-1/2 -translate-y-[27px] items-center justify-center text-black/60 hover:text-black dark:text-white/55 dark:hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                className={'h-5 w-5 transition-transform duration-200 ease-out ' + (lightboxDetailsCollapsed ? '' : 'rotate-180')}
                fill="none"
              >
                <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          <div className="overflow-hidden rounded-xl border border-black/10 bg-black/5 transition-all duration-300 dark:border-white/10 dark:bg-black/10">
            <div className="grid grid-cols-5 gap-px bg-black/10 dark:bg-white/10">
              <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">Collection</div>
              <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">Code</div>
              <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">Variant</div>
              <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">Dimension</div>
              <div className="min-h-10 bg-white/60 px-3 py-2 text-[11px] font-medium leading-tight text-black/60 dark:bg-black/20 dark:text-white/70">Price</div>

              {currentCollectionVariants[0] && (
                <React.Fragment key={currentCollectionVariants[0].id}>
                  {(() => {
                    const v = currentCollectionVariants[0];
                    const baseClass = selectedIds.has(v.id)
                      ? 'bg-emerald-100 px-3 py-2 text-left text-sm leading-tight hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 font-semibold text-emerald-900 dark:text-emerald-100'
                      : 'bg-white/70 px-3 py-2 text-left text-sm leading-tight hover:bg-white dark:bg-black/20 dark:hover:bg-black/30 font-semibold text-black dark:text-white';
                    const handler = (e: React.PointerEvent | React.MouseEvent) => {
                      e.stopPropagation();
                      if (e.shiftKey) { toggleSelected(v.id); return; }
                      const key = (v.collectionNameNormalized || '').trim();
                      if (key) setFamilyCollectionName(key);
                      setPreviewId(v.id);
                      setPreviewIndex((i) => (i === null ? 0 : i));
                      setLightboxDetailsCollapsed(true);
                    };
                    return (
                      <>
                        <button type="button" className={baseClass} onClick={handler}><div className="truncate">{v.title}</div></button>
                        <button type="button" className={baseClass} onClick={handler}><div className="truncate">{v.code || '—'}</div></button>
                        <button type="button" className={baseClass} onClick={handler}><div className="truncate">{v.variant || '—'}</div></button>
                        <button type="button" className={baseClass} onClick={handler}><div className="truncate">{v.dimension || '—'}</div></button>
                        <button type="button" className={baseClass} onClick={handler}><div className="truncate">{v.price ? <><span className="hidden sm:inline">AED </span>{v.price}</> : '—'}</div></button>
                      </>
                    );
                  })()}
                </React.Fragment>
              )}
            </div>

            <div className={'transition-[max-height] duration-300 ease-out ' + (lightboxDetailsCollapsed ? 'max-h-0 pointer-events-none overflow-hidden' : 'max-h-[50vh] overflow-y-auto')}>
              <div className="grid grid-cols-5 gap-px bg-black/10 dark:bg-white/10">
                {currentCollectionVariants.slice(1).map((v) => (
                  <React.Fragment key={v.id}>
                    <button
                      type="button"
                      className={selectedIds.has(v.id) ? 'bg-emerald-100 px-3 py-2 text-left text-sm text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100' : 'bg-white/70 px-3 py-2 text-left text-sm text-black/70 hover:bg-white dark:bg-black/20 dark:text-white/65'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (e.shiftKey) { toggleSelected(v.id); return; }
                        const key = (v.collectionNameNormalized || '').trim();
                        if (key) setFamilyCollectionName(key);
                        setPreviewId(v.id);
                        setPreviewIndex((i) => (i === null ? 0 : i));
                        setLightboxDetailsCollapsed(true);
                      }}
                    >
                      <div className="truncate">{v.title}</div>
                    </button>
                    <div className="bg-white/70 px-3 py-2 text-sm dark:bg-black/20">{v.code || '—'}</div>
                    <div className="bg-white/70 px-3 py-2 text-sm dark:bg-black/20">{v.variant || '—'}</div>
                    <div className="bg-white/70 px-3 py-2 text-sm dark:bg-black/20">{v.dimension || '—'}</div>
                    <div className="bg-white/70 px-3 py-2 text-sm dark:bg-black/20">{v.price ? <><span className="hidden sm:inline">AED </span>{v.price}</> : '—'}</div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
