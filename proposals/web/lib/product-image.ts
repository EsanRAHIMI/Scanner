/**
 * Display-only image URL helpers for the Proposals UI.
 *
 * These MIRROR the logic the Products service already uses
 * (`products/app/products/lib/product-utils.tsx`) so the same product image
 * that renders in Products also renders in the proposal picker, proposal items,
 * preview, and PDF.
 *
 * IMPORTANT: these are READ/DISPLAY-ONLY transforms. The converted URL is never
 * written back to the database — only used as an <img> src at render time.
 */

const LEGACY_APP_DOMAIN_RE = /ehsanrahimi\.com/gi;
const CURRENT_APP_DOMAIN = 'lorenzohome.ae';

/** Stored product media may still reference the previous deployment domain. */
export function rewriteLegacyAppDomain(url: string): string {
  const u = url.trim();
  if (!u || !LEGACY_APP_DOMAIN_RE.test(u)) return u;
  return u.replace(LEGACY_APP_DOMAIN_RE, CURRENT_APP_DOMAIN);
}

/** Default lh3 width used for proposal previews/cards. */
export const PROPOSAL_IMAGE_WIDTH = 1200;

function lh3DirectUrl(fileId: string, width: number): string {
  const id = fileId.split('=')[0] ?? fileId;
  return `https://lh3.googleusercontent.com/d/${id}=w${width}`;
}

/**
 * Converts a Google Drive link into a high-performance lh3 direct link.
 * Handles /d/ paths, ?id= query params, and existing lh3 URLs.
 * Non-Drive URLs are returned unchanged (after legacy-domain rewrite).
 */
export function driveDirectLink(
  url: string | null | undefined,
  width: number = PROPOSAL_IMAGE_WIDTH,
): string {
  if (!url) return '';
  const u = rewriteLegacyAppDomain(url);

  const isPotentialUrl = u.startsWith('http') || u.startsWith('//') || u.startsWith('/');
  if (!isPotentialUrl) return '';

  if (
    !u.includes('drive.google.com') &&
    !u.includes('google.com/file/d/') &&
    !u.includes('googleusercontent.com')
  ) {
    return u;
  }

  const lh3Match = u.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) {
    return lh3DirectUrl(lh3Match[1], width);
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

  if (id) return lh3DirectUrl(id, width);
  return u;
}
