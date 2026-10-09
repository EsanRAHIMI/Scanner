'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ContentItem } from '../../lib/calendar/types';
import { 
  COLUMN_WIDTHS_STORAGE_KEY, 
  MAX_COL_PX,
  getColumnDefaultWidthPx,
  getColumnMinWidthPx,
} from '../../lib/calendar/constants';
import { CAMPAIGN_RAIL_WIDTH_PX } from '../../lib/calendar/campaigns/constants';
import type { MarketingCampaign } from '../../lib/calendar/campaigns/types';
import { isCampaignPlanningDraft } from '../../lib/calendar/campaigns/planning-drafts';
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
  hashtagUsageCounts?: ReadonlyMap<string, number>;
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
  hashtagUsageCounts,
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
  const editingAnchorRef = useRef<HTMLTableCellElement | null>(null);
  const isResizingRef = useRef(false);

  const clampColumnWidth = useCallback((col: string, width: number) => {
    return Math.min(MAX_COL_PX, Math.max(getColumnMinWidthPx(col), width));
  }, []);

  // Load widths
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        const clamped = Object.fromEntries(
          Object.entries(parsed).map(([col, w]) => [
            col,
            clampColumnWidth(col, typeof w === 'number' ? w : getColumnDefaultWidthPx(col)),
          ]),
        );
        setColumnWidths(clamped);
      }
    } catch {}
  }, [clampColumnWidth]);

  // Save widths
  useEffect(() => {
    if (Object.keys(columnWidths).length > 0) {
      localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    }
  }, [columnWidths]);

  const defaultColWidth = useCallback(
    (col: string) => getColumnDefaultWidthPx(col),
    [],
  );

  const tableWidthPx = useMemo(() => {
    const colsSum = allColumns.reduce(
      (sum, col) => sum + (columnWidths[col] ?? defaultColWidth(col)),
      0,
    );
    return CAMPAIGN_RAIL_WIDTH_PX + colsSum + 48;
  }, [allColumns, columnWidths, defaultColWidth]);

  const startResizeColumn = (e: React.PointerEvent, col: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[col] ?? defaultColWidth(col);
    const minW = getColumnMinWidthPx(col);
    isResizingRef.current = true;

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      setColumnWidths(prev => ({
        ...prev,
        [col]: Math.min(MAX_COL_PX, Math.max(minW, startWidth + delta)),
      }));
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
    <section className={`dash-panel flex min-h-0 flex-1 flex-col ${className}`}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-brand-light-gray px-4 py-2.5">
        <p className="text-sm font-semibold text-brand-black">Publish matrix</p>
        <p className="hidden text-xs text-brand-dark-gray sm:block">
          {items.length} {items.length === 1 ? 'row' : 'rows'} · click a cell to edit
        </p>
      </div>

      <div className="cc-scroll min-h-0 flex-1 overflow-auto">
        <table
          className="table-fixed border-collapse text-sm"
          style={{ width: `${tableWidthPx}px`, minWidth: '100%' }}
        >
          <colgroup>
            <col style={{ width: `${CAMPAIGN_RAIL_WIDTH_PX}px` }} />
            {allColumns.map(col => (
              <col key={col} style={{ width: `${columnWidths[col] ?? defaultColWidth(col)}px` }} />
            ))}
            <col style={{ width: '48px' }} />
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                className="sticky left-0 top-0 z-30 border-b border-r border-white/15 bg-brand-burgundy px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
                style={{ width: `${CAMPAIGN_RAIL_WIDTH_PX}px`, minWidth: `${CAMPAIGN_RAIL_WIDTH_PX}px` }}
              >
                Campaign
              </th>
              {allColumns.map(col => (
                <th
                  key={col}
                  className="sticky top-0 z-20 overflow-hidden border-b border-white/10 bg-brand-burgundy px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
                >
                  <span className="block truncate">{col}</span>
                  <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-white/70" onPointerDown={e => startResizeColumn(e, col)} />
                </th>
              ))}
              <th className="border-b border-white/10 bg-brand-burgundy" />
            </tr>
          </thead>
          <tbody>
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
              const isPlanningRow = isCampaignPlanningDraft(item);
              return (
              <tr 
                key={item.id} 
                className={`group border-b border-brand-light-gray/80 transition-colors ${
                  isPlanningRow
                    ? 'bg-amber-50 hover:bg-amber-100/70'
                    : rowIdx % 2 === 1
                      ? 'bg-[#f7f4f5] hover:bg-brand-burgundy/[0.05]'
                      : 'bg-white hover:bg-brand-burgundy/[0.04]'
                }`}
                onContextMenu={e => onContextMenu(e, item)}
              >
                <td
                  className={`sticky left-0 z-10 border-r border-brand-light-gray px-3 py-3 align-middle ${
                    isPlanningRow
                      ? 'bg-amber-50 group-hover:bg-amber-100/70'
                      : rowIdx % 2 === 1
                        ? 'bg-[#f7f4f5] group-hover:bg-[#f3e8ec]'
                        : 'bg-white group-hover:bg-[#f8eef2]'
                  }`}
                  style={{ width: `${CAMPAIGN_RAIL_WIDTH_PX}px`, minWidth: `${CAMPAIGN_RAIL_WIDTH_PX}px` }}
                >
                  <CampaignRowTag campaigns={rowCampaigns} />
                </td>
                {allColumns.map(col => {
                  const idColKey = `${item.id}-${col}`;
                  const isReadOnly =
                    col === 'Day of Week' || col === 'Product Image' || col === 'Social Views';
                  const isAssets = col === 'Assets';
                  const isDateField = col.toLowerCase().includes('date');
                  const isEditing = editingCell?.id === item.id && editingCell?.column === col;
                  const isUpdating = updatingCells.has(idColKey);
                  
                  const isSelectField = isCalendarSelectableField(col);
                  const isSelectEditing = isEditing && isSelectField;
                  const isDateEditing = isEditing && isDateField;
                  const isPopoverEditing = isSelectEditing || isDateEditing;
                  
                  return (
                    <td 
                      key={col}
                      ref={isPopoverEditing ? editingAnchorRef : undefined}
                      className={`relative max-w-0 align-top transition-all duration-200 ${
                        isPopoverEditing
                          ? 'z-30 overflow-visible bg-primary/5 ring-2 ring-inset ring-primary/35'
                          : 'overflow-hidden'
                      } ${isAssets ? 'cursor-pointer' : !isReadOnly ? 'cursor-text' : 'cursor-default'} ${isEditing && !isPopoverEditing ? 'p-0' : 'px-3 py-3'} ${isUpdating ? 'opacity-50' : ''}`}
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

                      {isSelectEditing ? (
                        <MultiSelect
                          anchorRef={editingAnchorRef}
                          value={cellDraftValue}
                          options={fieldOptions[col]}
                          mode={getCalendarFieldSelectMode(col)}
                          fieldLabel={col}
                          allowClearSelection={col === '# Hashtag'}
                          inputTokenMode={col === '# Hashtag' ? 'hashtag' : 'default'}
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
                      ) : isDateEditing ? (
                        <DatePicker
                          anchorRef={editingAnchorRef}
                          fieldLabel={col}
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
                      ) : isEditing ? (
                        <div className="relative h-full w-full min-h-[48px] z-20 bg-background/50 p-1.5 animate-in fade-in duration-200 ring-1 ring-primary/30 rounded-lg">
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
                        </div>

                      ) : (
                        <div className="min-h-[1.5rem] min-w-0 overflow-hidden leading-relaxed">
                          <CalendarCell
                            column={col}
                            value={item.fields[col]}
                            rowFields={item.fields}
                            hashtagUsageCounts={hashtagUsageCounts}
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
                 <td colSpan={allColumns.length + 2} className="border-t border-brand-light-gray bg-brand-light-gray/30 px-4 py-2.5 text-xs text-brand-dark-gray">
                   {items.length} {items.length === 1 ? 'row' : 'rows'} in view
                 </td>
               </tr>
             </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

