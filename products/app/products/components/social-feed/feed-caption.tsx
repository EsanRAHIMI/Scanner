import React, { useState } from 'react';
import { FeedVariant } from './types';

interface FeedCaptionProps {
  variant: FeedVariant;
}

export function FeedCaption({ variant }: FeedCaptionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div 
      className="absolute bottom-0 left-0 right-16 z-40 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] drop-shadow-lg"
      onPointerDown={(e) => {
        // Prevent event from bubbling to the vertical snap scroller
        e.stopPropagation();
      }}
    >
      <div 
        className={`relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] rounded-2xl border border-white/20 bg-black/40 backdrop-blur-xl supports-[backdrop-filter]:bg-black/30 ${
          expanded ? 'max-h-[60vh] p-4' : 'max-h-[85px] p-3 cursor-pointer hover:bg-black/50'
        }`}
        onClick={() => !expanded && setExpanded(true)}
      >
        {expanded && (
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        )}

        {/* Username Row Equivalent */}
        <div className="flex items-center gap-2 mb-1.5 pr-8">
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gradient-to-tr from-emerald-400 to-emerald-600 text-[10px] font-bold text-white shadow-inner">
            {variant.collectionName.slice(0, 2).toUpperCase() || 'P'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="truncate text-[13px] font-bold text-white/95 leading-tight drop-shadow-md">
              {variant.collectionName || 'Unknown Collection'} 
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-white/80 leading-none mt-0.5">
              <span>{variant.code || 'N/A'}</span>
              <span className="h-1 w-1 rounded-full bg-white/40" />
              <span className="text-emerald-300">Var {variant.variant || 'N/A'}</span>
            </div>
          </div>
          {variant.price && (
            <div className="flex-none rounded-lg bg-emerald-500/20 px-2 py-1 border border-emerald-500/30 text-[12px] font-bold text-emerald-100">
              {variant.price}
            </div>
          )}
        </div>

        {/* Short Text */}
        <div className={`text-[12px] font-normal text-white/90 leading-relaxed ${expanded ? 'mb-4' : 'line-clamp-1'}`}>
          {variant.dimension && `Dims: ${variant.dimension} `}
          {variant.material && `• ${variant.material} `}
          {variant.color && `• ${variant.color} `}
          {!expanded && (variant.note || variant.category) && (
            <span className="font-bold cursor-pointer opacity-80 hover:opacity-100"> ...more</span>
          )}
        </div>

        {/* Expanded Metadata Grid */}
        <div className={`transition-opacity duration-300 ${expanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
          <div className="h-px w-full bg-white/10 my-3" />
          
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            {variant.category && (
              <div className="flex flex-col gap-0.5 leading-tight">
                <span className="text-white/50 uppercase tracking-wide font-semibold text-[9px]">Category</span>
                <span className="text-white font-medium">{variant.category}</span>
              </div>
            )}
            {variant.space && (
              <div className="flex flex-col gap-0.5 leading-tight">
                <span className="text-white/50 uppercase tracking-wide font-semibold text-[9px]">Space</span>
                <span className="text-white font-medium">{variant.space}</span>
              </div>
            )}
            {variant.color && (
              <div className="flex flex-col gap-0.5 leading-tight">
                <span className="text-white/50 uppercase tracking-wide font-semibold text-[9px]">Color</span>
                <span className="text-white font-medium">{variant.color}</span>
              </div>
            )}
            {variant.material && (
              <div className="flex flex-col gap-0.5 leading-tight">
                <span className="text-white/50 uppercase tracking-wide font-semibold text-[9px]">Material</span>
                <span className="text-white font-medium">{variant.material}</span>
              </div>
            )}
            {variant.dimension && (
              <div className="flex flex-col gap-0.5 leading-tight">
                <span className="text-white/50 uppercase tracking-wide font-semibold text-[9px]">Dimension (mm)</span>
                <span className="text-white font-medium">{variant.dimension}</span>
              </div>
            )}
            {variant.codeNumber && (
              <div className="flex flex-col gap-0.5 leading-tight">
                <span className="text-white/50 uppercase tracking-wide font-semibold text-[9px]">Code Number</span>
                <span className="text-white font-medium">{variant.codeNumber}</span>
              </div>
            )}
            {variant.l000 && (
              <div className="flex flex-col gap-0.5 leading-tight">
                <span className="text-white/50 uppercase tracking-wide font-semibold text-[9px]">L000</span>
                <span className="text-white font-medium">{variant.l000}</span>
              </div>
            )}
            {variant.num && (
              <div className="flex flex-col gap-0.5 leading-tight">
                <span className="text-white/50 uppercase tracking-wide font-semibold text-[9px]">Num</span>
                <span className="text-white font-medium">{variant.num}</span>
              </div>
            )}
            <div className="flex flex-col gap-0.5 leading-tight">
              <span className="text-white/50 uppercase tracking-wide font-semibold text-[9px]">Main Variant</span>
              <span className="text-white font-medium">{variant.isMain ? 'Yes' : 'No'}</span>
            </div>
            
            {variant.note && (
              <div className="flex flex-col gap-0.5 leading-tight col-span-2 mt-1 bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-white/50 uppercase tracking-wide font-semibold text-[9px]">Note</span>
                <span className="text-white/90 italic">{variant.note}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
