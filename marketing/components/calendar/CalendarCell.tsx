'use client';

import React from 'react';
import { 
  STATUS_COLORS,
} from '../../lib/calendar/constants';
import {
  isCalendarSelectableField,
  isMultiValueCalendarField,
} from '../../lib/calendar/field-options';
import { parseMultiValueField } from '../../lib/calendar/multi-value-field';
import { 
  dirForValue, 
  alignClassForValue, 
  extractUrls,
  isVideoUrl,
  getMediaPreviewUrl,
  canPreviewMediaUrl,
  DRIVE_IMAGE_WIDTH_THUMB,
} from '../../lib/calendar/utils';
import { InstagramMediaPreview } from './InstagramMediaPreview';

interface CalendarCellProps {
  column: string;
  value: any;
  onPickAssets?: () => void;
}

export const CalendarCell: React.FC<CalendarCellProps> = ({ column, value, onPickAssets }) => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground/30">—</span>;
  }

  const col = column.trim().toLowerCase();

  if (isCalendarSelectableField(column)) {
    if (col === 'status') {
      const displayValue = String(value) === 'Draft' ? 'Drafts' : String(value);
      const color = STATUS_COLORS[displayValue] || 'bg-muted text-muted-foreground';
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${color}`}>
          {displayValue}
        </span>
      );
    }

    const items = isMultiValueCalendarField(column)
      ? parseMultiValueField(value)
      : [String(value).trim()].filter(Boolean);

    if (items.length === 0) {
      return <span className="text-muted-foreground/30">—</span>;
    }

    const chipClass =
      col === 'target audience'
        ? 'border-primary/15 bg-primary/5 text-primary'
        : 'border-border/70 bg-muted/40 text-foreground';

    return (
      <div className="min-w-0 overflow-hidden py-0.5">
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <span
              key={item}
              className={`inline-flex max-w-full min-w-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight ${chipClass}`}
            >
              <span className="truncate">{item}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (col === 'content link') {
    const raw = String(value);
    return <InstagramMediaPreview url={raw} />;
  }

  if (col === 'product image') {
    const url = typeof value === 'string' ? value : (value as any)?.url;
    if (url) {
      const previewSrc = getMediaPreviewUrl(url, DRIVE_IMAGE_WIDTH_THUMB);
      return (
        <div className="flex h-full min-h-[80px] w-full items-center justify-center p-0.5">
          <img
            src={previewSrc}
            alt=""
            className="max-h-32 w-full object-contain rounded-md shadow-md ring-1 ring-border/50"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const el = e.currentTarget;
              if (el.src !== url) el.src = url;
            }}
          />
        </div>
      );
    }
    return <span className="text-muted-foreground/30">—</span>;
  }

  if (col === 'assets') {
    const urls = extractUrls(value);
    if (!urls.length) return <span className="text-muted-foreground/30">—</span>;

    const preview = urls.slice(0, 3);
    const more = urls.length - preview.length;

    return (
      <div className="flex items-center gap-2" onClick={(e) => { e.stopPropagation(); onPickAssets?.(); }}>
        <div className="flex items-center -space-x-2">
          {preview.map((u) => (
            <div key={u} className="h-9 w-9 overflow-hidden rounded-lg border border-border bg-background shadow-sm relative group">
              {canPreviewMediaUrl(u) ? (
                <>
                  <img
                    src={getMediaPreviewUrl(u, DRIVE_IMAGE_WIDTH_THUMB)}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.src !== u) el.src = u;
                    }}
                  />
                  {isVideoUrl(u) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground/50">
                  {isVideoUrl(u) ? 'VIDEO' : 'FILE'}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground/70">{urls.length} asset{urls.length === 1 ? '' : 's'}</div>
          <div className="flex items-center gap-2">
            <a
              className="text-[11px] text-primary hover:underline font-medium"
              href={urls[0]}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Open
            </a>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await navigator.clipboard.writeText(urls.join('\n'));
                } catch {}
              }}
            >
              Copy
            </button>
          </div>
        </div>

        {more > 0 ? (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            +{more}
          </span>
        ) : null}
      </div>
    );
  }

  if (col === 'publish date') {
      return <span className="text-sm font-bold tabular-nums text-foreground/80">{String(value)}</span>;
  }

  const text = String(value);
  return <span className={`text-sm tracking-tight ${alignClassForValue(text)}`} dir={dirForValue(text)}>{text}</span>;
};
