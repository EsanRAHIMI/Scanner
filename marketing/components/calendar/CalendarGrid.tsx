'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ContentItem } from '../../lib/calendar/types';
import { 
  COLUMN_WIDTHS_STORAGE_KEY, 
  MIN_COL_PX, 
  MAX_COL_PX,
} from '../../lib/calendar/constants';
import { CAMPAIGN_RAIL_WIDTH_PX } from '../../lib/calendar/campaigns/constants';
import type { MarketingCampaign } from '../../lib/calendar/campaigns/types';
import { getCampaignsForContentItem } from '../../lib/calendar/campaigns/utils';
import {
  type CalendarFieldOptionsMap,
  type CalendarSelectableField,
  getCalendarFieldSelectMode,
  isCalendarSelectableField,
} from '../../lib/calendar/field-options';
import { CalendarCell } from './CalendarCell';
import { CampaignRowTag } from './CampaignRowTag';
import { DatePicker } from './DatePicker';
import { MultiSelect } from './MultiSelect';

interface CalendarGridProps {
  items: ContentItem[];
  campaigns?: MarketingCampaign[];
  allColumns: string[];
  onContextMenu: (e: React.MouseEvent, item: ContentItem) => void;
  onCommitCell: (id: string, column: string, value: string) => Promise<void>;
  fieldOptions: CalendarFieldOptionsMap;
  canManageFieldOptions?: boolean;
  onDeleteFieldOption?: (field: CalendarSelectableField, option: string) => Promise<unknown>;
  onRegisterFieldOption?: (field: CalendarSelectableField, option: string) => Promise<void>;
  onPickAssets: (item: ContentItem) => void;
  className?: string;
}

export function CalendarGrid({
  items,
  campaigns = [],
  allColumns,
  onContextMenu,
  onCommitCell,
  fieldOptions,
  canManageFieldOptions = false,
  onDeleteFieldOption,
  onRegisterFieldOption,
  onPickAssets,
  className = '',
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
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm ${className}`}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground">Calendar Matrix</p>
        <p className="hidden text-[11px] font-medium text-muted-foreground/60 sm:block">
          Resize columns · Click to edit
        </p>
      </div>

      <div className="cc-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto max-h-[var(--calendar-grid-max-h,calc(100dvh-360px))]">
        <table className="min-w-max w-max text-sm border-collapse table-fixed">
          <colgroup>
            <col style={{ width: `${CAMPAIGN_RAIL_WIDTH_PX}px` }} />
            {allColumns.map(col => (
              <col key={col} style={{ width: `${columnWidths[col] ?? defaultColWidth(col)}px` }} />
            ))}
            <col style={{ width: '48px' }} />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-background/90 backdrop-blur-md shadow-sm transition-colors">
            <tr>
              <th
                className="sticky left-0 z-30 border-b border-r border-border bg-background/95 px-2 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-md"
                style={{ width: `${CAMPAIGN_RAIL_WIDTH_PX}px`, minWidth: `${CAMPAIGN_RAIL_WIDTH_PX}px` }}
              >
                Campaign
              </th>
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
                <td colSpan={allColumns.length + 2} className="py-24 text-center">
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
            ) : items.map((item, rowIdx) => {
              const rowCampaigns = getCampaignsForContentItem(item, campaigns);
              return (
              <tr 
                key={item.id} 
                className={`group transition-colors hover:bg-muted/50 ${rowIdx % 2 === 1 ? 'bg-muted/10' : 'bg-transparent'}`}
                onContextMenu={e => onContextMenu(e, item)}
              >
                <td
                  className={`sticky left-0 z-10 border-r border-border/70 bg-background/90 px-2 py-2 align-top backdrop-blur-sm transition-colors group-hover:bg-muted/40 ${rowIdx % 2 === 1 ? 'bg-muted/20' : ''}`}
                  style={{ width: `${CAMPAIGN_RAIL_WIDTH_PX}px`, minWidth: `${CAMPAIGN_RAIL_WIDTH_PX}px` }}
                >
                  <CampaignRowTag campaigns={rowCampaigns} />
                </td>
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
                        <div className="relative h-full w-full min-h-[48px] z-20 bg-background/50 p-1.5 animate-in fade-in duration-200 ring-1 ring-primary/30 rounded-lg">
                          {isCalendarSelectableField(col) ? (
                            <MultiSelect
                              value={cellDraftValue}
                              options={fieldOptions[col]}
                              mode={getCalendarFieldSelectMode(col)}
                              allowDeleteOptions={canManageFieldOptions}
                              onDeleteOption={
                                onDeleteFieldOption
                                  ? (option) => onDeleteFieldOption(col, option)
                                  : undefined
                              }
                              onRegisterOption={
                                onRegisterFieldOption
                                  ? (option) => onRegisterFieldOption(col, option)
                                  : undefined
                              }
                              onCommit={(val) => {
                                if (val !== String(item.fields[col] ?? '')) {
                                  handleCommit(item.id, col, val);
                                }
                                setEditingCell(null);
                              }}
                              onClose={() => setEditingCell(null)}
                            />
                          ) : isDateField ? (
                            <DatePicker
                              value={cellDraftValue}
                              onChange={(val) => setCellDraftValue(val)}
                              onCommit={(val) => {
                                if (val !== String(item.fields[col] ?? '')) {
                                  handleCommit(item.id, col, val);
                                }
                                setEditingCell(null);
                              }}
                              onClose={() => setEditingCell(null)}
                            />
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
            );
            })}
          </tbody>
          {items.length > 0 && (
             <tfoot>
               <tr>
                 <td colSpan={allColumns.length + 2} className="px-5 py-4 border-t border-border text-[11px] text-muted-foreground/50 font-bold uppercase tracking-widest bg-muted/20">
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

