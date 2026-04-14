'use client';

import React from 'react';
import { 
  STATUS_COLORS,
} from '../../lib/calendar/constants';
import { 
  dirForValue, 
  alignClassForValue, 
  getInstagramEmbedUrl,
  extractUrls,
  isImageUrl,
  isVideoUrl
} from '../../lib/calendar/utils';

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

  if (col === 'status') {
    const displayValue = String(value) === 'Draft' ? 'Drafts' : String(value);
    const color = STATUS_COLORS[displayValue] || 'bg-muted text-muted-foreground';
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${color}`}>
        {displayValue}
      </span>
    );
  }

  if (col === 'content link') {
    const raw = String(value);
    const embed = getInstagramEmbedUrl(raw);
    if (embed) {
      return (
        <div className="space-y-2">
          <iframe 
            src={embed} 
            className="w-full aspect-square rounded-lg border border-border bg-background" 
            loading="lazy" 
          />
          <a href={raw} target="_blank" className="text-[10px] text-primary hover:underline truncate block font-medium">{raw}</a>
        </div>
      );
    }
    return <a href={raw} target="_blank" className="text-primary hover:underline truncate block font-medium">{raw}</a>;
  }

  if (col === 'product image') {
    const url = typeof value === 'string' ? value : (value as any)?.url;
    if (url) return <img src={url} alt="" className="h-10 w-10 object-cover rounded-lg shadow-sm ring-1 ring-border" />;
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
            <div key={u} className="h-9 w-9 overflow-hidden rounded-lg border border-border bg-background shadow-sm">
              {isImageUrl(u) ? (
                <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
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
