import React, { useState } from 'react';
import { FeedVariant } from './types';

interface FeedCaptionProps {
  variant: FeedVariant;
  canEdit?: boolean;
  onUpdateVariant?: (id: string, fields: Record<string, any>) => Promise<void>;
}

export function FeedCaption({ variant, canEdit, onUpdateVariant }: FeedCaptionProps) {
  const [expanded, setExpanded] = useState(false);
  const codeNumber = (variant.codeNumber || variant.num || variant.code || '').trim();

  const handleEdit = async (fieldName: string, currentValue: string, airtableFieldName: string) => {
    if (!canEdit || !onUpdateVariant) return;
    const newValue = window.prompt(`Edit ${fieldName}:`, currentValue);
    if (newValue !== null && newValue !== currentValue) {
      await onUpdateVariant(variant.id, { [airtableFieldName]: newValue });
    }
  };

  const InfoTag = ({ icon, label, value, onClick }: { icon: React.ReactNode, label?: string, value: string, onClick?: () => void }) => (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) {
          onClick();
        }
      }}
      className={`flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-md border border-white/5 shadow-sm transition-all ${onClick ? 'cursor-edit hover:bg-white/20 active:scale-95' : ''}`}
    >
      <span className="text-[12px] opacity-90">{icon}</span>
      {label && <span className="text-[9px] font-bold uppercase tracking-tight text-white/50">{label}:</span>}
      <span className="text-[10px] font-semibold text-white/95 truncate max-w-[80px]">{value}</span>
      {onClick && <span className="text-[8px] opacity-40 ml-0.5">✎</span>}
    </div>
  );

  return (
    <div 
      className="absolute bottom-0 left-0 right-16 z-40 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      onPointerDown={(e) => {
        // Prevent event from bubbling to the vertical snap scroller
        e.stopPropagation();
      }}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 -z-10 transition-opacity duration-300 ${
          expanded ? 'opacity-100' : 'opacity-75'
        }`}
      >
        <div
          className={`w-full bg-gradient-to-t ${
            expanded
              ? 'h-44 from-black/85 via-black/45 to-transparent'
              : 'h-32 from-black/70 via-black/28 to-transparent'
          }`}
        />
      </div>

      <div
        className={`relative transition-all duration-300 ease-out ${
          expanded ? 'max-h-[78vh] pt-7' : 'max-h-[148px] pt-7'
        }`}
        onClick={() => setExpanded((v) => !v)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className={`absolute left-1/2 top-0 z-10 -translate-x-1/2 flex h-6 w-6 items-center justify-center text-white/80 transition-all duration-300 hover:text-white ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        <div className={`${expanded ? 'space-y-4' : 'space-y-3'}`}>
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 text-[10px] font-black text-white shadow-lg ring-1 ring-white/20">
                  {variant.collectionName.slice(0, 2).toUpperCase() || 'P'}
                </div>
                <div className="min-w-0">
                  <h2
                    className={`line-clamp-2 text-[15px] font-extrabold leading-tight text-white drop-shadow-sm ${canEdit ? 'cursor-edit hover:text-emerald-300 transition-colors' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canEdit) {
                        handleEdit('Collection Name', variant.collectionName, 'Colecction Name');
                      }
                    }}
                  >
                    {variant.collectionName || 'Unknown Collection'}
                  </h2>
                  <div className="mt-1 text-[11px] font-medium text-white/65 line-clamp-1">
                    {variant.dimension || variant.material || variant.category || ''}
                  </div>
                </div>
              </div>
              {variant.price && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canEdit) {
                      handleEdit('Price', variant.price || '', 'Price');
                    }
                  }}
                  className={`mt-0.5 flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-black text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] uppercase ${canEdit ? 'cursor-edit hover:bg-emerald-400' : ''}`}
                >
                  <span>{variant.price}</span>
                  <img
                    src="/fonts/Dirham%20Currency%20Symbol%20-%20Black.svg"
                    alt="AED"
                    className="h-[9px] w-auto brightness-0 invert"
                  />
                </div>
              )}
            </div>

            <div
              className="grid grid-cols-[auto_1fr] items-center gap-2.5 rounded-xl bg-black/35 px-3 py-2 ring-1 ring-white/15"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Code Number</span>
              <div className="min-w-0 text-right">
                <span className="truncate font-mono text-[16px] font-black tracking-[0.06em] text-white">
                  {codeNumber || '—'}
                </span>
              </div>
            </div>
          </div>

          <div className={`flex flex-wrap gap-2 transition-all duration-300 ${expanded ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
            {variant.dimension && (
              <InfoTag
                icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="10" rx="2" /><path d="M7 12h10" /><path d="m14 15 3-3-3-3" /><path d="m10 9-3 3 3 3" /></svg>}
                value={variant.dimension}
                onClick={canEdit ? () => handleEdit('Dimension', variant.dimension, 'DIMENSION (mm)') : undefined}
              />
            )}
            {variant.material && (
              <InfoTag
                icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3h18v18H3z" /><path d="M12 3v18" /><path d="M3 12h18" /></svg>}
                value={variant.material}
                onClick={canEdit ? () => handleEdit('Material', variant.material, 'Material') : undefined}
              />
            )}
            {variant.color && (
              <InfoTag
                icon={<svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m4.93 19.07 1.41-1.41" /><path d="m17.66 6.34 1.41-1.41" /></svg>}
                value={variant.color}
                onClick={canEdit ? () => handleEdit('Color', variant.color, 'Color') : undefined}
              />
            )}
          </div>

          <div className={`transition-all duration-300 ${expanded ? 'opacity-100 max-h-[65vh] overflow-auto pb-3' : 'opacity-0 h-0 overflow-hidden'}`}>
            <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 rounded-2xl bg-black/25 p-4 ring-1 ring-white/10 backdrop-blur-[2px]">
              {[
                { label: 'Category', value: variant.category, airtable: 'Category', icon: '🏷️' },
                { label: 'Space', value: variant.space, airtable: 'Space', icon: '🏠' },
                { label: 'Color', value: variant.color, airtable: 'Color', icon: '🎨' },
                { label: 'Material', value: variant.material, airtable: 'Material', icon: '🏗️' },
                { label: 'Dimension', value: variant.dimension, airtable: 'DIMENSION (mm)', icon: '📏' },
                { label: 'Code Number', value: codeNumber, airtable: 'CODE NUMBER', icon: '🔢' }
              ].filter(f => f.value).map((field, i) => (
                <div
                  key={i}
                  className={`flex flex-col gap-1 transition-all ${canEdit ? 'cursor-edit hover:bg-white/5 rounded-lg p-1 -m-1' : ''}`}
                  onClick={(e) => {
                    if (canEdit) {
                      e.stopPropagation();
                      handleEdit(field.label, field.value, field.airtable);
                    }
                  }}
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-[10px] grayscale opacity-70">{field.icon}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40 whitespace-nowrap">
                      {field.label} {canEdit && '✎'}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-white/92 truncate pl-5">
                    {field.value}
                  </span>
                </div>
              ))}

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-[10px] grayscale opacity-70">💎</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40 whitespace-nowrap">Main Variant</span>
                </div>
                <span className="text-[11px] font-bold text-white/90 truncate pl-5">
                  {variant.isMain ? 'Yes' : 'No'}
                </span>
              </div>

              {variant.note && (
                <div
                  className={`col-span-2 mt-2 rounded-xl bg-white/5 p-3 border border-white/5 transition-all ${canEdit ? 'cursor-edit hover:bg-white/10' : ''}`}
                  onClick={(e) => {
                    if (canEdit) {
                      e.stopPropagation();
                      handleEdit('Note', variant.note, 'Note');
                    }
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] opacity-70">📝</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Collector Note {canEdit && '✎'}</span>
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
    </div>
  );
}
