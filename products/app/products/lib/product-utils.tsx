import * as React from 'react';

/**
 * Checks if a URL points to a video file.
 */
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

/**
 * Checks if a URL points to an image file.
 */
export function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const l = url.toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic'];
  if (l.includes('lh3.googleusercontent.com/d/')) return true;
  return imageExts.some(ext => l.includes(ext));
}

/**
 * Formats a scalar value into a string.
 */
export function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return '';
}

/**
 * Extracts URLs from various input formats (string, array, objects).
 */
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
      return /^https?:\/\//i.test(s) ? [s] : [];
    }
  }
  return [];
}

/**
 * Converts a Google Drive link into a high-performance direct link via lh3.
 * Handles /d/ paths, ?id= query params, and existing lh3 URLs.
 */
export function getDriveDirectLink(url: string | null | undefined): string {
  if (!url) return '';
  const u = url.trim();

  const isPotentialUrl = u.startsWith('http') || u.startsWith('//') || u.startsWith('/');
  if (!isPotentialUrl) return '';

  if (!u.includes('drive.google.com') && !u.includes('google.com/file/d/') && !u.includes('googleusercontent.com')) return u;

  const lh3Match = u.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) {
    return `https://lh3.googleusercontent.com/d/${lh3Match[1]}=w1200`;
  }

  let id = '';
  const matchD = u.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{25,})/);
  if (matchD && matchD[1]) {
    id = matchD[1];
  } else {
    const matchId = u.match(/[?&](?:id|fileId|docid|fileid)=([a-zA-Z0-9_-]{25,})/);
    if (matchId && matchId[1]) {
      id = matchId[1];
    }
  }

  if (id) {
    return `https://lh3.googleusercontent.com/d/${id}=w1200`;
  }
  return u;
}

/**
 * Formats a price value with locale-aware number formatting.
 */
export function formatPrice(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('en-US').format(value);
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;
    const cleaned = raw.replace(/,/g, '');
    const n = Number(cleaned);
    if (Number.isFinite(n)) return new Intl.NumberFormat('en-US').format(n);
  }
  return null;
}

/**
 * Highlight matching text in a string for search results.
 */
export function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === query.trim().toLowerCase() 
      ? <mark key={i} className="bg-emerald-500/40 text-emerald-950 dark:text-emerald-100 rounded-px px-0.5 no-underline ring-1 ring-emerald-500/20">{part}</mark> 
      : part
  );
}
