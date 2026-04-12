import React, { useState } from 'react';
import { FeedVariant } from './types';

interface FeedCaptionProps {
  variant: FeedVariant;
}

export function FeedCaption({ variant }: FeedCaptionProps) {
  const [expanded, setExpanded] = useState(false);

  const InfoTag = ({ icon, label, value }: { icon: React.ReactNode, label?: string, value: string }) => (
    <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-md border border-white/5 shadow-sm">
      <span className="text-[12px] opacity-90">{icon}</span>
      {label && <span className="text-[9px] font-bold uppercase tracking-tight text-white/50">{label}:</span>}
      <span className="text-[10px] font-semibold text-white/95 truncate max-w-[80px]">{value}</span>
    </div>
  );

  return (
    <div 
      className="absolute bottom-0 left-0 right-16 z-40 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      onPointerDown={(e) => {
        // Prevent event from bubbling to the vertical snap scroller
        e.stopPropagation();
      }}
    >
      <div 
        className={`relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] rounded-[24px] border border-white/15 bg-zinc-950/40 backdrop-blur-3xl shadow-2xl ${
          expanded ? 'max-h-[75vh] p-5 pt-6' : 'max-h-[110px] p-4 cursor-pointer hover:bg-zinc-950/50'
        }`}
        onClick={() => !expanded && setExpanded(true)}
      >
        {/* Toggle Button */}
        <button 
          type="button" 
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className={`absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-all duration-300 z-10 ${expanded ? 'rotate-180' : ''}`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>

        {/* Header Section */}
        <div className="flex items-start gap-3 mb-4 pr-8">
          {/* Collection Avatar */}
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-[12px] font-black text-white shadow-lg ring-1 ring-white/20">
            {variant.collectionName.slice(0, 2).toUpperCase() || 'P'}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[15px] font-extrabold text-white tracking-tight leading-none drop-shadow-sm">
                {variant.collectionName || 'Unknown Collection'} 
              </h2>
              {variant.price && (
                <div className="flex items-center gap-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-black text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] uppercase">
                  <span>{variant.price}</span>
                  <img 
                    src="/fonts/Dirham%20Currency%20Symbol%20-%20Black.svg" 
                    alt="AED" 
                    className="h-[9px] w-auto brightness-0 invert" 
                  />
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-black text-white/50 tracking-widest uppercase">
                {variant.codeNumber || variant.code || 'NO-CODE'}
              </span>
              <span className="h-2.5 w-px bg-white/20" />
              <span className="text-[10px] font-bold text-emerald-400/90 uppercase">
                Variant {variant.variant || '01'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Specs (Compact Mode) */}
        <div className={`flex flex-wrap gap-2 transition-all duration-300 ${expanded ? 'mb-6 opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
          {variant.dimension && (
            <InfoTag 
              icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="10" rx="2" /><path d="M7 12h10" /><path d="m14 15 3-3-3-3" /><path d="m10 9-3 3 3 3" /></svg>} 
              value={variant.dimension}
            />
          )}
          {variant.material && (
            <InfoTag 
              icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3h18v18H3z" /><path d="M12 3v18" /><path d="M3 12h18" /></svg>} 
              value={variant.material}
            />
          )}
          {variant.color && (
            <InfoTag 
              icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m4.93 19.07 1.41-1.41" /><path d="m17.66 6.34 1.41-1.41" /></svg>} 
              value={variant.color}
            />
          )}
        </div>

        {/* Expanded Metadata Sheet */}
        <div className={`transition-all duration-500 ${expanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 h-0 overflow-hidden'}`}>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent mb-5" />
          
          <div className="grid grid-cols-2 gap-y-4 gap-x-6">
            {[
              { label: 'Category', value: variant.category, icon: '🏷️' },
              { label: 'Space', value: variant.space, icon: '🏠' },
              { label: 'Color', value: variant.color, icon: '🎨' },
              { label: 'Material', value: variant.material, icon: '🏗️' },
              { label: 'Dimension', value: variant.dimension, icon: '📏' },
              { label: 'Code Num', value: variant.codeNumber, icon: '🔢' },
              { label: 'Main Variant', value: variant.isMain ? 'Yes' : 'No', icon: '💎' }
            ].filter(f => f.value).map((field, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-[10px] grayscale opacity-70">{field.icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40 whitespace-nowrap">{field.label}</span>
                </div>
                <span className="text-[11px] font-bold text-white/90 truncate pl-5">
                  {field.value}
                </span>
              </div>
            ))}
            
            {variant.note && (
              <div className="col-span-2 mt-2 rounded-xl bg-white/5 p-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[10px] opacity-70">📝</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Collector Note</span>
                </div>
                <p className="text-[11px] font-medium leading-relaxed text-white/80 italic pl-5">
                  "{variant.note}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
