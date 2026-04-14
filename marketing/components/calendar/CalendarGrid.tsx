'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ContentItem } from '../../lib/calendar/types';
import { 
  COLUMN_WIDTHS_STORAGE_KEY, 
  MIN_COL_PX, 
  MAX_COL_PX,
} from '../../lib/calendar/constants';
import { CalendarCell } from './CalendarCell';

interface CalendarGridProps {
  items: ContentItem[];
  allColumns: string[];
  onContextMenu: (e: React.MouseEvent, item: ContentItem) => void;
  onCommitCell: (id: string, column: string, value: string) => Promise<void>;
  statusOptions: string[];
  onPickAssets: (item: ContentItem) => void;
}

export function CalendarGrid({
  items,
  allColumns,
  onContextMenu,
  onCommitCell,
  statusOptions,
  onPickAssets,
}: CalendarGridProps) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [editingCell, setEditingCell] = useState<{ id: string; column: string } | null>(null);
  const [cellDraftValue, setCellDraftValue] = useState<string>('');
  const [updatingCells, setUpdatingCells] = useState<Set<string>>(new Set());
  const inlineTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isResizingRef = useRef(false);

  // Load widths
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
      if (raw) {
        setColumnWidths(JSON.parse(raw));
      }
    } catch {}
  }, []);

  // Save widths
  useEffect(() => {
    if (Object.keys(columnWidths).length > 0) {
      localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    }
  }, [columnWidths]);

  const defaultColWidth = useCallback((col: string) => {
    const estimated = col.length * 8 + 40;
    return Math.min(MAX_COL_PX, Math.max(MIN_COL_PX, estimated));
  }, []);

  const startResizeColumn = (e: React.PointerEvent, col: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[col] ?? defaultColWidth(col);
    isResizingRef.current = true;

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      setColumnWidths(prev => ({ ...prev, [col]: Math.min(MAX_COL_PX, Math.max(MIN_COL_PX, startWidth + delta)) }));
    };
    const onUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleCommit = async (id: string, column: string, value: string) => {
    const key = `${id}-${column}`;
    setUpdatingCells(prev => new Set(prev).add(key));
    try {
      await onCommitCell(id, column, value);
    } finally {
      setUpdatingCells(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm">
      <div className="border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">Calendar Matrix</p>
          <p className="text-[11px] text-muted-foreground/60 font-medium">Resize columns from header edges • Click cell to edit</p>
        </div>
      </div>

      <div className="cc-scroll overflow-x-auto overflow-y-auto max-h-[calc(100dvh-360px)]">
        <table className="min-w-max w-max text-sm border-collapse table-fixed">
          <colgroup>
            {allColumns.map(col => (
              <col key={col} style={{ width: `${columnWidths[col] ?? defaultColWidth(col)}px` }} />
            ))}
            <col style={{ width: '48px' }} />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-background/90 backdrop-blur-md shadow-sm transition-colors">
            <tr>
              {allColumns.map(col => (
                <th key={col} className="relative border-b border-border px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {col}
                  <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors" onPointerDown={e => startResizeColumn(e, col)} />
                </th>
              ))}
              <th className="border-b border-border" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/40">
            {items.length === 0 ? (
              <tr>
                <td colSpan={allColumns.length + 1} className="py-24 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                      <svg className="h-8 w-8 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div className="text-sm font-semibold text-muted-foreground">No items found</div>
                    <div className="text-xs text-muted-foreground/60">Try adjusting your search or status filter</div>
                  </div>
                </td>
              </tr>
            ) : items.map((item, rowIdx) => (
              <tr 
                key={item.id} 
                className={`group transition-colors hover:bg-muted/50 ${rowIdx % 2 === 1 ? 'bg-muted/10' : 'bg-transparent'}`}
                onContextMenu={e => onContextMenu(e, item)}
              >
                {allColumns.map(col => {
                  const idColKey = `${item.id}-${col}`;
                  const isReadOnly = col === 'Day of Week' || col === 'Product Image';
                  const isAssets = col === 'Assets';
                  const isDateField = col.toLowerCase().includes('date');
                  const isEditing = editingCell?.id === item.id && editingCell?.column === col;
                  const isUpdating = updatingCells.has(idColKey);
                  
                  return (
                    <td 
                      key={col} 
                      className={`relative align-top transition-all duration-200 ${isAssets ? 'cursor-pointer' : !isReadOnly ? 'cursor-text' : 'cursor-default'} ${isEditing ? 'p-0 shadow-inner' : 'px-4 py-3'} group-hover:bg-transparent ${isUpdating ? 'opacity-50 grayscale-[0.5]' : ''}`}
                      onClick={(e) => {
                        if (isReadOnly || isUpdating) return;
                        if (isAssets) {
                          onPickAssets(item);
                          return;
                        }
                        setEditingCell({ id: item.id, column: col });
                        setCellDraftValue(String(item.fields[col] ?? ''));
                      }}
                    >
                      {isUpdating && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      )}

                      {isEditing ? (
                        <div className="w-full h-full min-h-[3rem] animate-in fade-in duration-200">
                          {col === 'Status' ? (
                            <div className="p-1.5 focus-within:z-50 relative">
                              <div className="flex flex-col gap-0.5 bg-popover/95 backdrop-blur-2xl border border-border rounded-xl shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-200 ring-4 ring-primary/5">
                                {statusOptions.map((opt) => (
                                  <button
                                    key={opt}
                                    className={`w-full px-3 py-2 text-left text-xs font-semibold rounded-lg transition-all ${opt === cellDraftValue ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
                                    onClick={() => {
                                      handleCommit(item.id, col, opt);
                                      setEditingCell(null);
                                    }}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : isDateField ? (
                             <div className="p-2">
                               <input
                                 autoFocus
                                 type="date"
                                 className="w-full h-10 bg-background px-3 text-sm rounded-lg border border-input focus:ring-2 focus:ring-primary outline-none transition-all font-medium"
                                 value={cellDraftValue}
                                onChange={e => setCellDraftValue(e.target.value)}
                                onBlur={() => {
                                  if (cellDraftValue !== String(item.fields[col] ?? '')) {
                                    handleCommit(item.id, col, cellDraftValue);
                                  }
                                  setEditingCell(null);
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    handleCommit(item.id, col, cellDraftValue);
                                    setEditingCell(null);
                                  }
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              />
                            </div>
                          ) : (
                             <textarea
                               autoFocus
                               ref={inlineTextareaRef}
                               className="w-full h-full min-h-[4.5rem] bg-popover/90 px-4 py-3 text-sm outline-none border-0 ring-2 ring-primary/50 backdrop-blur-md resize-none transition-all block leading-relaxed shadow-xl rounded-md"
                              value={cellDraftValue}
                              onChange={e => setCellDraftValue(e.target.value)}
                              onBlur={() => {
                                if (cellDraftValue !== String(item.fields[col] ?? '')) {
                                  handleCommit(item.id, col, cellDraftValue);
                                }
                                setEditingCell(null);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleCommit(item.id, col, cellDraftValue);
                                  setEditingCell(null);
                                }
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                            />
                          )}
                        </div>

                      ) : (
                        <div className="min-h-[1.5rem] leading-relaxed">
                          <CalendarCell 
                            column={col} 
                            value={item.fields[col]} 
                            onPickAssets={() => onPickAssets(item)} 
                          />
                        </div>
                      )}
                    </td>
                  );
                })}

                 <td className="px-2 py-3 text-center opacity-0 transition-opacity group-hover:opacity-100">
                   <button 
                     onClick={(e) => onContextMenu(e as any, item)} 
                     className="rounded p-1.5 text-muted-foreground/60 transition-all hover:bg-muted"
                     title="Actions"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
             <tfoot>
               <tr>
                 <td colSpan={allColumns.length + 1} className="px-5 py-4 border-t border-border text-[11px] text-muted-foreground/50 font-bold uppercase tracking-widest bg-muted/20">
                   <div className="flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                     Displaying {items.length} dynamic row{items.length === 1 ? '' : 's'}
                   </div>
                 </td>
               </tr>
             </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

