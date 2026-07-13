'use client';

import React from 'react';
import { ContentItem } from '../../lib/calendar/types';
import { normalizeContentLinkInput } from '../../lib/calendar/utils';

interface EditorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  item: ContentItem | null;
  fields: Record<string, string>;
  onFieldChange: (col: string, val: string) => void;
  onSave: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isSaving: boolean;
  orderedColumns: string[];
}

export function EditorSidebar({
  isOpen,
  onClose,
  item,
  fields,
  onFieldChange,
  onSave,
  onDelete,
  isSaving,
  orderedColumns,
}: EditorSidebarProps) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] transition-all" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-card shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex h-16 items-center justify-between px-6 border-b border-border">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">Details</div>
            <div className="truncate text-base font-bold tracking-tight text-foreground">{fields['Title'] || 'Untitled Content'}</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onDelete(item.id)}
              className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
            >
              Delete
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void onSave()}
              className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:opacity-90 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="grid grid-cols-1 gap-6">
            {orderedColumns.map((col) => {
              const isLong = ['Caption Idea', 'CTA', '# Hashtag'].includes(col);
              const value = fields[col] ?? '';
              
              return (
                <div key={col} className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 ml-1">
                    {col}
                  </label>
                  {isLong ? (
                    <textarea
                      className="w-full min-h-[100px] rounded-xl border border-input bg-muted/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-y placeholder:text-muted-foreground/40 text-foreground"
                      value={value}
                      onChange={(e) => onFieldChange(col, e.target.value)}
                    />
                  ) : (
                    <input
                      type={col.toLowerCase().includes('date') ? 'date' : 'text'}
                      className="w-full rounded-xl border border-input bg-muted/30 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground"
                      value={value}
                      onChange={(e) => onFieldChange(col, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
