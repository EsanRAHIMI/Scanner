import React, { useState } from 'react';
import { FeedVariant } from './types';

interface FeedActionsProps {
  variant: FeedVariant;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDownload: () => Promise<void>;
  onShare: () => Promise<void>;
  onShowCollection: () => void;
  onDelete?: () => void;
  activeCollectionFilter?: string | null;
  selectedCount: number;
  canEdit?: boolean;
  onAddMedia?: (variantId: string, url: string) => Promise<void>;
  triggerFilterHint?: boolean;
}

export function FeedActions({ 
  variant, 
  isSelected, 
  onToggleSelect, 
  onDownload, 
  onShare, 
  onShowCollection, 
  onDelete,
  activeCollectionFilter,
  selectedCount,
  canEdit,
  onAddMedia,
  triggerFilterHint
}: FeedActionsProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    await onDownload();
    setIsDownloading(false);
  };

  return (
    <div className="absolute right-4 bottom-24 z-50 flex flex-col items-center gap-7" onPointerDown={(e) => e.stopPropagation()}>
      {/* SELECT / LIKE ACTION */}
      <div className="flex flex-col items-center gap-1.5">
        <button 
          type="button" 
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className={`flex h-[48px] w-[48px] items-center justify-center transition-all duration-300 active:scale-95 ${
            isSelected ? 'text-red-500' : 'text-white/80 hover:text-white'
          }`}
        >
          <svg viewBox="0 0 24 24" className={`h-7 w-7 DropShadow transition-all duration-300 ${isSelected ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <span className={`text-[10px] font-black uppercase tracking-widest text-white drop-shadow-md select-none ${selectedCount > 0 ? 'text-red-400' : ''}`}>
          {selectedCount > 0 ? selectedCount : 'Select'}
        </span>
      </div>

      {/* DOWNLOAD ACTION */}
      <div className="flex flex-col items-center gap-1.5">
        <button 
          type="button" 
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex h-[48px] w-[48px] items-center justify-center text-white/80 transition-all duration-300 hover:text-white active:scale-95 disabled:opacity-50"
        >
          {isDownloading ? (
             <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
               <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
               <path d="M12 2v4M12 18v4M2 12h4M18 12h4" className="opacity-75" />
             </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-7 w-7 DropShadow fill-none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </button>
        <span className="hidden md:block text-[10px] font-black uppercase tracking-widest text-white drop-shadow-md select-none">Download</span>
      </div>

      {/* SHARE ACTION */}
      <div className="flex flex-col items-center gap-1.5">
        <button 
          type="button" 
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="flex h-[48px] w-[48px] items-center justify-center text-white/80 transition-all duration-300 hover:text-white active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 DropShadow fill-none -mt-0.5 -ml-0.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
        <span className="hidden md:block text-[10px] font-black uppercase tracking-widest text-white drop-shadow-md select-none">Share</span>
      </div>

      {/* COLLECTION ACTION */}
      <div className="flex flex-col items-center gap-1.5">
        <button 
          type="button" 
          onClick={(e) => { e.stopPropagation(); onShowCollection(); }}
          className={`relative flex h-[48px] w-[48px] items-center justify-center transition-all duration-500 active:scale-95 ${
            activeCollectionFilter ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-white/80 hover:text-white'
          } ${triggerFilterHint ? 'animate-attention-bounce' : ''}`}
        >
          <svg viewBox="0 0 24 24" className={`h-7 w-7 DropShadow transition-transform duration-500 ${activeCollectionFilter ? 'scale-110' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 12 12 17 22 12" />
            <polyline points="2 17 12 22 22 17" />
          </svg>
          
          {/* Variant Count Badge */}
          {variant.siblingCount > 1 && (
            <div className={`absolute -right-2 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black shadow-lg ring-1 transition-all duration-500 ${
              activeCollectionFilter 
                ? 'bg-emerald-500 text-white ring-emerald-400/50' 
                : 'bg-white/90 text-black ring-black/5'
            }`}>
              {variant.siblingCount}
            </div>
          )}
        </button>
        <span className={`text-[10px] font-black uppercase tracking-widest drop-shadow-md select-none transition-colors duration-300 text-center w-20 truncate ${activeCollectionFilter ? 'text-emerald-400' : 'text-white'}`}>
          {activeCollectionFilter ? (variant.collectionName || 'Filtered') : 'Collection'}
        </span>
      </div>

      {/* MORE OPTIONS */}
      <div className="relative">
        <button 
          type="button" 
          onClick={(e) => { e.stopPropagation(); setShowOptions(v => !v); }}
          className={`flex h-[48px] w-[48px] items-center justify-center text-white/80 transition-all duration-300 hover:text-white active:scale-95 ${showOptions ? 'text-white' : ''}`}
        >
          <svg viewBox="0 0 24 24" className={`h-7 w-7 DropShadow fill-none transition-transform duration-300 ${showOptions ? 'scale-125' : ''}`} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>

        {showOptions && (
          <div className="absolute right-[50px] bottom-0 w-40 rounded-xl bg-white/95 py-2 shadow-xl backdrop-blur-xl dark:bg-zinc-900/95 border border-black/10 dark:border-white/10 overflow-hidden transform-origin-bottom-right animate-fade-in">
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOptions(false);
                  const url = window.prompt('Enter Media URL (Image or Video):');
                  if (url && onAddMedia) {
                    onAddMedia(variant.id, url);
                  }
                }}
                className="flex w-full items-center px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 font-bold"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                Add Media
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowOptions(false); onDelete?.(); }}
              className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Delete Media
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowOptions(false); }}
              className="flex w-full items-center px-4 py-2 text-sm text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/5"
            >
               <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Replace Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
