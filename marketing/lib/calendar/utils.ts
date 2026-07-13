export const isRtlText = (text: string) => {
  // Arabic + Persian blocks + Arabic presentation forms
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
};

export const dirForValue = (value: unknown): 'rtl' | 'ltr' => {
  if (typeof value !== 'string') return 'ltr';
  return isRtlText(value) ? 'rtl' : 'ltr';
};

export const alignClassForValue = (value: unknown) => 
  dirForValue(value) === 'rtl' ? 'text-right' : 'text-left';

export const normalizeContentLinkInput = (raw: string) => {
  const s = raw.trim();
  if (!s) return '';

  const permalinkAttr = /data-instgrm-permalink\s*=\s*"([^"]+)"/i.exec(s);
  const decodedAttr = permalinkAttr?.[1]?.replace(/&amp;/g, '&');
  if (decodedAttr && /^https?:\/\//i.test(decodedAttr)) return decodedAttr;

  const urlMatch = /(https?:\/\/www\.instagram\.com\/[^\s"']+)/i.exec(s);
  if (urlMatch?.[1]) return urlMatch[1].replace(/&amp;/g, '&');

  return s;
};

export const getInstagramEmbedUrl = (url: string) => {
  try {
    const u = new URL(url);
    if (!/^(www\.)?instagram\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const type = parts[0];
    const shortcode = parts[1];
    if (!shortcode) return null;
    if (!['p', 'reel', 'tv'].includes(type)) return null;
    return `https://www.instagram.com/${type}/${shortcode}/embed`;
  } catch {
    return null;
  }
};

export const normalizeDateForInput = (raw: string) => {
  const s = raw.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const weekdayFromIsoDate = (isoDate: string) => {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
};

export function extractUrls(v: unknown): string[] {
  if (typeof v === 'string') {
    const parts = v
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
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

const GOOGLE_FILE_ID = /^[a-zA-Z0-9_-]{10,}$/;

/** Extract Google Drive / lh3 file id from common URL shapes. */
export function getGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  const u = url.trim();

  const lh3 = u.match(/lh3\.googleusercontent\.com\/d\/([^/?#\s]+)/i);
  if (lh3?.[1]) {
    const id = (lh3[1].split('=')[0] ?? '').trim();
    if (GOOGLE_FILE_ID.test(id)) return id;
  }

  const dPath = u.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,})/);
  if (dPath?.[1]) return dPath[1];

  const idParam = u.match(/[?&](?:id|fileId|docid|fileid)=([a-zA-Z0-9_-]{10,})/i);
  if (idParam?.[1]) return idParam[1];

  return null;
}

/** Thumbnail width for lh3.googleusercontent.com embeds. */
export const DRIVE_IMAGE_WIDTH_THUMB = 512;
export const DRIVE_IMAGE_WIDTH_FULL = 1200;

function lh3DirectUrl(fileId: string, width: number): string {
  const id = fileId.split('=')[0]?.trim() ?? fileId;
  return `https://lh3.googleusercontent.com/d/${id}=w${width}`;
}

export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  const l = url.toLowerCase();
  const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
  return videoExts.some((ext) => l.includes(ext)) || l.includes('#video');
}

export function isImageUrl(url: string): boolean {
  if (!url) return false;
  const l = url.toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic'];

  if (l.includes('googleusercontent.com')) return !isVideoUrl(url);
  if (l.includes('drive.google.com') || l.includes('google.com/file/d/')) {
    return !isVideoUrl(url);
  }

  return imageExts.some((ext) => l.includes(ext));
}

/**
 * Normalizes Google Drive / lh3 URLs for <img src> — keeps =w / =s size params when present.
 */
export function getMediaPreviewUrl(url: string, width = DRIVE_IMAGE_WIDTH_THUMB): string {
  if (!url) return '';
  const u = url.trim();

  if (!u.includes('drive.google.com') && !u.includes('googleusercontent.com')) {
    return u;
  }

  // Already a sized lh3 URL — use as-is (e.g. …/d/ID=w1000)
  if (/lh3\.googleusercontent\.com\/d\/[^/?#\s]+=[ws]\d+/i.test(u)) {
    return u;
  }

  const driveId = getGoogleDriveFileId(u);
  if (driveId) {
    return lh3DirectUrl(driveId, width);
  }

  return u;
}

export function canPreviewMediaUrl(url: string): boolean {
  return isImageUrl(url) || Boolean(getGoogleDriveFileId(url)) || isVideoUrl(url);
}
