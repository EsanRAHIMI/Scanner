'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  parseISO,
  isValid
} from 'date-fns';

interface DatePickerProps {
  value: string; // ISO format yyyy-MM-dd
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  onClose: () => void;
}

export function DatePicker({ value, onChange, onCommit, onClose }: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const initialDate = useMemo(() => {
    const d = parseISO(value);
    return isValid(d) ? d : new Date();
  }, [value]);

  const [currentMonth, setCurrentMonth] = useState(initialDate);

  const selectedDate = useMemo(() => {
    const d = parseISO(value);
    return isValid(d) ? d : null;
  }, [value]);

  // Handle Click Outside
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose]);

  // Handle Global Keys (ESC / Enter)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') {
        // If we have a selection or just want to commit draft
        onCommit(value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onCommit, value]);

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between px-2 py-3 border-b border-border mb-2 bg-muted/30">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setCurrentMonth(subMonths(currentMonth, 1)); }}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="text-sm font-bold text-foreground">
          {format(currentMonth, 'MMMM yyyy')}
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setCurrentMonth(addMonths(currentMonth, 1)); }}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 mb-1">
        {days.map(day => (
          <div key={day} className="text-[10px] uppercase font-bold text-muted-foreground/50 text-center tracking-widest py-1">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const clonedDay = day;
        const isSelected = selectedDate ? isSameDay(clonedDay, selectedDate) : false;
        const isCurrentMonth = isSameMonth(clonedDay, monthStart);
        const isToday = isSameDay(clonedDay, new Date());

        days.push(
          <button
            key={clonedDay.toString()}
            type="button"
            className={`
              relative h-9 w-full flex items-center justify-center text-xs rounded-lg transition-all
              ${!isCurrentMonth ? 'text-muted-foreground/20' : 'text-foreground hover:bg-muted'}
              ${isSelected ? 'bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 scale-105 z-10' : ''}
              ${isToday && !isSelected ? 'text-primary ring-1 ring-primary/30 ring-inset' : ''}
            `}
            onClick={(e) => {
              e.stopPropagation();
              const formatted = format(clonedDay, 'yyyy-MM-dd');
              onCommit(formatted);
            }}
          >
            <span>{format(clonedDay, 'd')}</span>
            {isToday && !isSelected && (
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
            )}
          </button>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-0.5">
          {days}
        </div>
      );
      days = [];
    }
    return <div className="p-2 pt-0">{rows}</div>;
  };

  return (
    <div 
      ref={rootRef}
      className="absolute top-full left-0 mt-2 z-[100] w-72 rounded-2xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {renderHeader()}
      {renderDays()}
      {renderCells()}
      
      <div className="p-3 border-t border-border flex items-center justify-between bg-muted/10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const today = format(new Date(), 'yyyy-MM-dd');
            onCommit(today);
          }}
          className="text-[11px] font-bold text-primary hover:underline px-2 py-1"
        >
          Today
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-[11px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
