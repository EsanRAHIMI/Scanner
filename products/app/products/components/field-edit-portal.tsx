'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { getTagColorStyles, getTagMaterialStyles } from '../lib/constants';
import type { EditingUrlState } from '../types/shared-types';

interface FieldEditPortalProps {
  editingUrl: EditingUrlState | null;
  setEditingUrl: (val: EditingUrlState | null) => void;
  onSave: () => void;
  onCancel: () => void;
  uniqueSpaces: string[];
  uniqueColors: string[];
  uniqueMaterials: string[];
  uniqueCategories: string[];
}

export function FieldEditPortal({
  editingUrl,
  setEditingUrl,
  onSave,
  onCancel,
  uniqueSpaces,
  uniqueColors,
  uniqueMaterials,
  uniqueCategories
}: FieldEditPortalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !editingUrl?.rect) return null;

  const colName = (editingUrl.column || '').trim().toLowerCase();
  const isSpace = colName === 'space';
  const isCategory = colName === 'category';
  const isColor = colName === 'color';
  const isMaterial = colName === 'material';
  
  if (!isSpace && !isCategory && !isColor && !isMaterial) return null;

  const { top, left, width, height } = editingUrl.rect;
  const POPUP_W = 260;
  const POPUP_H = isSpace || isCategory ? 430 : 260;
  const spaceBelow = window.innerHeight - (top + height);
  const spaceRight = window.innerWidth - left;
  const popupLeft = spaceRight >= POPUP_W ? left : Math.max(8, left + width - POPUP_W);
  const popupTop = spaceBelow >= POPUP_H ? top + height + 4 : Math.max(8, top - POPUP_H - 4);

  const currentSet = new Set((editingUrl.value || '').split(',').map(s => s.trim()).filter(Boolean));
  const baseOptions = isSpace ? uniqueSpaces : isColor ? uniqueColors : isMaterial ? uniqueMaterials : uniqueCategories;
  const optionKeys = new Set(baseOptions.map(opt => opt.toLowerCase()));
  const options = [
    ...baseOptions,
    ...Array.from(currentSet).filter(opt => !optionKeys.has(opt.toLowerCase())),
  ];

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[998]"
        onClick={onSave}
        onKeyDown={(e) => { 
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
          else if (e.key === 'Enter') { e.preventDefault(); onSave(); }
        }}
        tabIndex={-1}
      />
      <div
        ref={(el) => { if (el) el.focus(); }}
        className="fixed z-[999] flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900 outline-none"
        style={{ top: popupTop, left: popupLeft, width: POPUP_W }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        tabIndex={0}
        onKeyDown={(e) => { 
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
          else if (e.key === 'Enter') { e.preventDefault(); onSave(); }
        }}
      >
        <div className="scrollbar-minimal overflow-y-auto p-2" style={{ maxHeight: 320 }}>
          <div className="grid grid-cols-1 gap-1.5">
            {options.map(opt => {
              const sel = currentSet.has(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const next = new Set(currentSet);
                    if (sel) next.delete(opt); else next.add(opt);
                    setEditingUrl({ ...editingUrl, value: Array.from(next).join(', ') });
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium transition-all ${
                    sel
                      ? isColor 
                        ? `${getTagColorStyles(opt)} shadow-sm border` 
                        : isMaterial
                          ? `${getTagMaterialStyles(opt)} shadow-sm border`
                          : 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-black/[0.03] text-black/75 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-white/5 dark:text-white/75 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300'
                  }`}
                >
                  <span className={`flex h-4 w-4 flex-none items-center justify-center transition-all rounded border-2 ${
                    sel ? 'border-white/60 bg-white/25' : 'border-black/20 dark:border-white/25'
                  }`}>
                    {sel && <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
