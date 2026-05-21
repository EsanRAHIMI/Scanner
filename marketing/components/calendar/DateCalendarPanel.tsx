'use client';

import React, { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  isValid,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';

import { MARKETING_DATE_FORMAT, todayIsoDate } from '../../lib/calendar/date-utils';

interface DateCalendarPanelProps {
  value: string;
  onSelect: (isoDate: string) => void;
  onClose?: () => void;
  showFooter?: boolean;
  className?: string;
}

export function DateCalendarPanel({
  value,
  onSelect,
  onClose,
  showFooter = true,
  className = '',
}: DateCalendarPanelProps) {
  const initialDate = useMemo(() => {
    const d = parseISO(value);
    return isValid(d) ? d : new Date();
  }, [value]);

  const [currentMonth, setCurrentMonth] = useState(initialDate);

  const selectedDate = useMemo(() => {
    const d = parseISO(value);
    return isValid(d) ? d : null;
  }, [value]);

  const renderHeader = () => (
    <div className="mb-2 flex items-center justify-between border-b border-border bg-muted/30 px-2 py-3">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setCurrentMonth(subMonths(currentMonth, 1));
        }}
        className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-muted"
        aria-label="Previous month"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="text-sm font-bold text-foreground">{format(currentMonth, 'MMMM yyyy')}</div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setCurrentMonth(addMonths(currentMonth, 1));
        }}
        className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-muted"
        aria-label="Next month"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="mb-1 grid grid-cols-7">
        {days.map((day) => (
          <div
            key={day}
            className="py-1 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50"
          >
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
              relative flex h-9 w-full items-center justify-center rounded-lg text-xs transition-all
              ${!isCurrentMonth ? 'text-muted-foreground/20' : 'text-foreground hover:bg-muted'}
              ${isSelected ? 'z-10 scale-105 bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20' : ''}
              ${isToday && !isSelected ? 'text-primary ring-1 ring-inset ring-primary/30' : ''}
            `}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(format(clonedDay, MARKETING_DATE_FORMAT));
            }}
          >
            <span>{format(clonedDay, 'd')}</span>
            {isToday && !isSelected && (
              <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </button>,
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-0.5">
          {days}
        </div>,
      );
      days = [];
    }

    return <div className="p-2 pt-0">{rows}</div>;
  };

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      {renderHeader()}
      {renderDays()}
      {renderCells()}

      {showFooter && (
        <div className="flex items-center justify-between border-t border-border bg-muted/10 p-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(todayIsoDate());
            }}
            className="px-2 py-1 text-[11px] font-bold text-primary hover:underline"
          >
            Today
          </button>
          {onClose && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
