'use client';

import React from 'react';
import { createPortal } from 'react-dom';

export type EditingInfo = {
  id: string;
  value: string;
  originalValue?: string;
  column?: string;
  index?: number | null;
  mode?: 'replace' | 'append' | 'prepend';
  rect?: { top: number; left: number; width: number; height: number };
};

export const SPACE_OPTIONS = ['Corner', 'Corridor', 'Entrance', 'Staircase', 'Living Room', 'Dining Room', 'Bedroom', 'Kitchen', 'Commercial', 'Bathroom'];
export const CATEGORY_OPTIONS = ['Chandeliers', 'Pendant', 'Cascade Light', 'Floor Lamps', 'Long Chandeliers', 'Ring Chandeliers', 'Wall Light', 'Table Lamps', 'Accessories', 'Sofa & Seating', 'Table', 'Wall Decoration'];
export const COLOR_OPTIONS = ['Transparent', 'Chrome', 'White', 'Black', 'Bronze', 'Blue', 'Gold', 'Pink'];
export const MATERIAL_OPTIONS = ['Stone', 'Fabric', 'Metal', 'Glass', 'Wood'];

export const FieldEditDropdown = ({ 
  editingInfo, 
  onSave, 
  onCancel, 
  isSaving 
}: { 
  editingInfo: EditingInfo; 
  onSave: (val: string) => void; 
  onCancel: () => void; 
  isSaving: boolean;
}) => {
  const [localValue, setLocalValue] = React.useState(editingInfo.value || '');
  const currentSet = React.useMemo(() => new Set(localValue.split(',').map((s: string) => s.trim()).filter(Boolean)), [localValue]);
  
  // Handle Keyboard (Enter to Save, Esc to Cancel)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSave(localValue);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localValue, onSave, onCancel]);

  const colName = (editingInfo.column || '').trim().toLowerCase();
  const options = colName === 'space' ? SPACE_OPTIONS : 
                 colName === 'color' ? COLOR_OPTIONS : 
                 colName === 'material' ? MATERIAL_OPTIONS : CATEGORY_OPTIONS;

  if (!editingInfo.rect) return null;
  const { top, left, width, height } = editingInfo.rect;
  const POPUP_W = 240;
  
  // Calculate position
  const spaceBelow = window.innerHeight - (top + height);
  const spaceRight = window.innerWidth - left;
  const popupLeft = spaceRight >= POPUP_W ? left : Math.max(8, left + width - POPUP_W);
  const popupTop = spaceBelow >= 400 ? top + height + 4 : Math.max(8, top - 320 - 4);

  return createPortal(
    <>
      {/* Backdrop - Click outside saves */}
      <div 
        className="fixed inset-0 z-[998] bg-transparent" 
        onClick={() => onSave(localValue)} 
      />
      <div
        className="fixed z-[999] flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/95"
        style={{ top: popupTop, left: popupLeft, width: POPUP_W }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="scrollbar-minimal overflow-y-auto p-1.5" style={{ maxHeight: 320 }}>
          <div className="grid grid-cols-1 gap-0.5">
            {options.map(opt => {
              const sel = currentSet.has(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const next = new Set(currentSet);
                    if (sel) next.delete(opt); else next.add(opt);
                    setLocalValue(Array.from(next).join(', '));
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[11px] font-semibold transition-all ${
                    sel 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-black/70 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-white/70 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-400'
                  }`}
                >
                  <div className={`flex h-4 w-4 flex-none items-center justify-center rounded border-2 transition-all ${
                    sel ? 'border-white/50 bg-white/20' : 'border-black/10 dark:border-white/15'
                  }`}>
                    {sel && <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="4"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
        {isSaving && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] dark:bg-black/50">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}
      </div>
    </>,
    document.body
  );
};

export const FieldEditTextarea = ({ 
  editingInfo, 
  onSave, 
  onCancel,
  isSaving
}: { 
  editingInfo: EditingInfo; 
  onSave: (val: string) => void; 
  onCancel: () => void;
  isSaving: boolean;
}) => {
  const [localValue, setLocalValue] = React.useState(editingInfo.value || '');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  if (!editingInfo.rect) return null;
  const { top, left, width, height } = editingInfo.rect;
  
  return createPortal(
    <>
      <div className="fixed inset-0 z-[998] bg-transparent" onClick={() => onSave(localValue)} />
      <div
        className="fixed z-[999] flex flex-col overflow-hidden rounded-xl border border-emerald-500/50 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:bg-zinc-900"
        style={{ 
          top: Math.max(10, top - 20), 
          left: Math.max(10, left - 10), 
          width: Math.min(window.innerWidth - 20, Math.max(width + 40, 320)), 
          height: Math.min(window.innerHeight - 20, Math.max(height + 120, 180)) 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/5 bg-black/[0.02] px-3 py-2 dark:border-white/5 dark:bg-white/[0.02]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
            Editing {editingInfo.column}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-black/30 dark:text-white/30">Enter to save • Esc to cancel</span>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="scrollbar-minimal h-full w-full resize-none border-none bg-transparent p-3 text-[12px] font-medium leading-relaxed outline-none dark:text-white"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSave(localValue);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="One value per line..."
        />
        {isSaving && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] dark:bg-black/50">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}
      </div>
    </>,
    document.body
  );
};
