import * as React from 'react';

export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const l = url.toLowerCase();
  const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkw', '.flv', '.wmv', '.m4v'];
  return (
    videoExts.some(ext => l.includes(ext)) || 
    l.includes('youtube.com') || 
    l.includes('youtu.be') || 
    l.includes('vimeo.com') || 
    l.includes('#video') ||
    (l.includes('drive.google.com') && l.includes('video'))
  );
}

export function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const l = url.toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic'];
  if (l.includes('lh3.googleusercontent.com/d/')) return true;
  return imageExts.some(ext => l.includes(ext));
}

export function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return '';
}

export function extractUrls(v: unknown): string[] {
  if (typeof v === 'string') {
    const parts = v.split(/[\s,\n]+/).map((s) => s.trim()).filter(Boolean);
    return parts.filter((s) => /^https?:\/\//i.test(s));
  }
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (typeof item === 'string') {
        const s = item.trim();
        if (/^https?:\/\//i.test(s)) out.push(s);
      } else if (item && typeof item === 'object') {
        const maybe = (item as Record<string, unknown>).url;
        if (typeof maybe === 'string') {
          const s = maybe.trim();
          if (/^https?:\/\//i.test(s)) out.push(s);
        }
      }
    }
    return out;
  }
  if (v && typeof v === 'object') {
     const maybe = (v as Record<string, unknown>).url;
     if (typeof maybe === 'string') {
       const s = maybe.trim();
       if (/^https?:\/\//i.test(s)) return [s];
     }
  }
  return [];
}

export function getDriveDirectLink(url: string | null | undefined): string {
  if (!url) return '';
  if (url.includes('drive.google.com/file/d/')) {
    const parts = url.split('/d/');
    if (parts.length > 1) {
      const id = parts[1].split('/')[0];
      return `https://lh3.googleusercontent.com/d/${id}`;
    }
  }
  return url;
}

export function highlightMatches(text: string, search: string): React.ReactNode {
  if (!search.trim()) return text;
  const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i} className="bg-emerald-500/30 text-emerald-950 dark:text-emerald-50 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function formatPrice(val: unknown): string | null {
  const s = formatScalar(val);
  if (!s) return null;
  const num = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return s;
  return num.toLocaleString();
}
