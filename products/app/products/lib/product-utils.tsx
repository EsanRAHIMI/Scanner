import * as React from 'react';

/**
 * Checks if a URL points to a video file.
 */
export function isVideoUrl(url: string): boolean {
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
export function isImageUrl(url: string): boolean {
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
 * Converts a Google Drive link into a high-performance direct link.
 */
export function getDriveDirectLink(url: string): string {
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
 * Formats a price value with AED currency.
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
 * Returns Tailwind classes for tag colors based on field value.
 */
export const getTagColorStyles = (color: string) => {
  const c = color.toLowerCase().trim();
  switch (c) {
    case 'transparent':
      return 'border-zinc-200 bg-zinc-50/50 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60';
    case 'chrome':
      return 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';
    case 'white':
      return 'border-zinc-200 bg-white text-zinc-800 dark:border-zinc-300 dark:bg-zinc-100 dark:text-zinc-900';
    case 'black':
      return 'border-zinc-800 bg-zinc-900 text-white dark:border-zinc-700 dark:bg-black dark:text-zinc-400';
    case 'bronze':
      return 'border-[#964B00]/20 bg-[#964B00]/10 text-[#964B00] dark:border-[#CD7F32]/20 dark:bg-[#CD7F32]/10 dark:text-[#CD7F32]';
    case 'blue':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/20 dark:bg-blue-900/30 dark:text-blue-300';
    case 'gold':
      return 'border-amber-300/50 bg-amber-50 text-amber-700 dark:border-amber-800/20 dark:bg-amber-900/30 dark:text-amber-300';
    case 'pink':
      return 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800/20 dark:bg-pink-900/30 dark:text-pink-300';
    default:
      return 'border-sky-500/20 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-900/25 dark:text-sky-300';
  }
};

/**
 * Returns Tailwind classes for tag materials based on field value.
 */
export const getTagMaterialStyles = (material: string) => {
  const m = material.toLowerCase().trim();
  switch (m) {
    case 'stone':
      return 'border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-300';
    case 'fabric':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/20 dark:bg-indigo-900/30 dark:text-indigo-300';
    case 'metal':
      return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';
    case 'glass':
      return 'border-cyan-200/50 bg-cyan-50/50 text-cyan-700 dark:border-cyan-800/20 dark:bg-cyan-900/30 dark:text-cyan-300';
    case 'wood':
      return 'border-orange-200 bg-orange-50 text-orange-900/80 dark:border-orange-800/20 dark:bg-orange-900/30 dark:text-orange-300';
    default:
      return 'border-amber-500/20 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-900/25 dark:text-amber-300';
  }
};

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
