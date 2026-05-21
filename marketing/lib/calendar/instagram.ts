import { normalizeContentLinkInput } from './utils';

export type InstagramPostType = 'p' | 'reel' | 'tv';

/** Canonical Instagram media dimensions used for cell layout. */
export const INSTAGRAM_MEDIA_DIMENSIONS = {
  reel: { width: 1080, height: 1920, aspect: '9 / 16' as const },
  tv: { width: 1080, height: 1920, aspect: '9 / 16' as const },
  p: { width: 1080, height: 1350, aspect: '4 / 5' as const },
} as const;

export interface ParsedInstagramUrl {
  permalink: string;
  type: InstagramPostType;
  shortcode: string;
  embedUrl: string;
}

export type InstagramPreviewMode = 'thumbnail' | 'embed';

export interface InstagramPreviewResponse {
  mode: InstagramPreviewMode;
  permalink: string;
  type: InstagramPostType;
  embedUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  isVideo?: boolean;
}

export function parseInstagramUrl(raw: string): ParsedInstagramUrl | null {
  const normalized = normalizeContentLinkInput(raw);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, '');
    if (host !== 'instagram.com') return null;

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    const type = parts[0] as InstagramPostType;
    const shortcode = parts[1];
    if (!shortcode || !['p', 'reel', 'tv'].includes(type)) return null;

    const permalink = `https://www.instagram.com/${type}/${shortcode}/`;
    return {
      permalink,
      type,
      shortcode,
      embedUrl: `${permalink}embed`,
    };
  } catch {
    return null;
  }
}

export function isInstagramVideoType(type: InstagramPostType): boolean {
  return type === 'reel' || type === 'tv';
}

export function getInstagramMediaSpec(type: InstagramPostType) {
  if (type === 'reel') return INSTAGRAM_MEDIA_DIMENSIONS.reel;
  if (type === 'tv') return INSTAGRAM_MEDIA_DIMENSIONS.tv;
  return INSTAGRAM_MEDIA_DIMENSIONS.p;
}

export function getInstagramMediaAspectRatio(type: InstagramPostType): string {
  return getInstagramMediaSpec(type).aspect;
}

/** Fixed preview width — decoupled from narrow table column (`w-full`). */
export const INSTAGRAM_FRAME_WIDTH_PX = 326;

const EMBED_CROP_BASE_WIDTH_PX = 326;

const EMBED_CROP_PROFILES = {
  reel: { width: 326, height: 680, top: -54 },
  post: { width: 326, height: 520, top: -54 },
} as const;

/** Tailwind classes for the media frame shell (aspect ratio comes from inline style). */
export function getInstagramMediaFrameClasses(type: InstagramPostType): string {
  const align = isInstagramVideoType(type) ? 'mx-auto' : '';
  return [align, 'shrink-0'].filter(Boolean).join(' ');
}

export function getInstagramMediaFrameStyle(type: InstagramPostType): {
  width: string;
  aspectRatio: string;
} {
  const spec = getInstagramMediaSpec(type);
  return {
    width: `${INSTAGRAM_FRAME_WIDTH_PX}px`,
    aspectRatio: spec.aspect,
  };
}

/**
 * Positions the Instagram /embed iframe so only the media block is visible
 * inside a container with canonical aspect ratio (4:5 post, 9:16 reel).
 * Scales with {@link INSTAGRAM_FRAME_WIDTH_PX} so the crop stays aligned.
 */
export function getInstagramEmbedCropStyle(type: InstagramPostType): {
  width: string;
  height: string;
  top: string;
  left: string;
  transform: string;
} {
  const base = isInstagramVideoType(type) ? EMBED_CROP_PROFILES.reel : EMBED_CROP_PROFILES.post;
  const scale = INSTAGRAM_FRAME_WIDTH_PX / EMBED_CROP_BASE_WIDTH_PX;

  return {
    width: `${Math.round(base.width * scale)}px`,
    height: `${Math.round(base.height * scale)}px`,
    top: `${Math.round(base.top * scale)}px`,
    left: '50%',
    transform: 'translateX(-50%)',
  };
}
