'use client';

import React, { useEffect, useMemo, useState } from 'react';

import {
  getInstagramEmbedCropStyle,
  getInstagramMediaFrameClasses,
  getInstagramMediaFrameStyle,
  isInstagramVideoType,
  parseInstagramUrl,
  type InstagramPreviewResponse,
} from '../../lib/calendar/instagram';

interface InstagramMediaPreviewProps {
  url: string;
}

function PlayBadge({ large = false }: { large?: boolean }) {
  return (
    <span
      className={
        'flex items-center justify-center rounded-full bg-black/60 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-sm transition-transform group-hover:scale-105 ' +
        (large ? 'h-12 w-12' : 'h-11 w-11')
      }
    >
      <svg className="ml-0.5 h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden>
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

function OpenOnInstagramLink({ permalink }: { permalink: string }) {
  return (
    <a
      href={permalink}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground/80 transition-colors hover:text-primary"
      onClick={(e) => e.stopPropagation()}
    >
      <span>Open on Instagram</span>
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

function MediaFrame({
  type,
  permalink,
  showPlayOverlay,
  playbackActive,
  onActivatePlayback,
  children,
}: {
  type: InstagramPreviewResponse['type'];
  permalink: string;
  showPlayOverlay: boolean;
  playbackActive: boolean;
  onActivatePlayback: () => void;
  children: React.ReactNode;
}) {
  const sizeClasses = getInstagramMediaFrameClasses(type);
  const frameStyle = getInstagramMediaFrameStyle(type);

  return (
    <div className="flex flex-col gap-1.5 py-0.5" onClick={(e) => e.stopPropagation()}>
      <div
        style={frameStyle}
        className={`group relative overflow-hidden rounded-xl bg-neutral-950 ring-1 ring-border/50 transition-all ${sizeClasses} ${
          playbackActive ? 'ring-primary/35 shadow-md shadow-primary/10' : 'hover:ring-border'
        }`}
      >
        {children}

        {showPlayOverlay ? (
          <button
            type="button"
            aria-label="Play video in cell"
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/15 transition-colors hover:bg-black/25"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onActivatePlayback();
            }}
          >
            <PlayBadge large />
          </button>
        ) : null}
      </div>
      <OpenOnInstagramLink permalink={permalink} />
    </div>
  );
}

function CroppedEmbedPreview({
  embedUrl,
  permalink,
  type,
  showPlayOverlay,
  iframeInteractive,
  playbackActive,
  onActivatePlayback,
}: {
  embedUrl: string;
  permalink: string;
  type: InstagramPreviewResponse['type'];
  showPlayOverlay: boolean;
  iframeInteractive: boolean;
  playbackActive: boolean;
  onActivatePlayback: () => void;
}) {
  const iframeStyle = getInstagramEmbedCropStyle(type);

  return (
    <MediaFrame
      type={type}
      permalink={permalink}
      showPlayOverlay={showPlayOverlay}
      playbackActive={playbackActive}
      onActivatePlayback={onActivatePlayback}
    >
      <iframe
        src={embedUrl}
        title="Instagram media preview"
        className={`absolute border-0 ${iframeInteractive ? 'z-10 pointer-events-auto' : 'pointer-events-none'}`}
        style={iframeStyle}
        scrolling="no"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      />
    </MediaFrame>
  );
}

export function InstagramMediaPreview({ url }: InstagramMediaPreviewProps) {
  const parsed = useMemo(() => parseInstagramUrl(url), [url]);
  const [preview, setPreview] = useState<InstagramPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [forceEmbedPlayback, setForceEmbedPlayback] = useState(false);

  useEffect(() => {
    setPlaybackActive(false);
    setForceEmbedPlayback(false);
  }, [url]);

  useEffect(() => {
    if (!parsed) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch(`/api/instagram/preview?url=${encodeURIComponent(parsed.permalink)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('preview failed');
        const data = (await res.json()) as InstagramPreviewResponse;
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) {
          setPreview({
            mode: 'embed',
            permalink: parsed.permalink,
            type: parsed.type,
            embedUrl: parsed.embedUrl,
            isVideo: isInstagramVideoType(parsed.type),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parsed]);

  const effectivePreview = useMemo(() => {
    if (!preview) return null;
    if (isInstagramVideoType(preview.type) && preview.mode === 'thumbnail') {
      return { ...preview, mode: 'embed' as const };
    }
    return preview;
  }, [preview]);

  const handleActivatePlayback = () => {
    setPlaybackActive(true);
    if (effectivePreview?.mode === 'thumbnail' && effectivePreview.isVideo) {
      setForceEmbedPlayback(true);
    }
  };

  if (!parsed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block truncate text-sm font-medium text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
  }

  if (loading) {
    return (
      <div
        style={getInstagramMediaFrameStyle(parsed.type)}
        className={`animate-pulse rounded-xl bg-muted/60 ring-1 ring-border/40 ${getInstagramMediaFrameClasses(parsed.type)}`}
      />
    );
  }

  const type = effectivePreview?.type ?? parsed.type;
  const permalink = effectivePreview?.permalink ?? parsed.permalink;
  const embedUrl = effectivePreview?.embedUrl ?? parsed.embedUrl;
  const isReelOrTv = isInstagramVideoType(type);

  // Reel/IGTV: همان رفتار قبلی — iframe تعاملی، بدون overlay پلی
  // پست عکس: embed مثل ریل، بدون overlay
  // پست ویدیو (/p/): فقط بعد از کلیک overlay، پلی فعال می‌شود
  const isFeedVideoPost = type === 'p' && Boolean(effectivePreview?.isVideo);
  const iframeInteractive = isReelOrTv || playbackActive || forceEmbedPlayback;
  const showPlayOverlay = isFeedVideoPost && !playbackActive && !forceEmbedPlayback;

  const useEmbed =
    forceEmbedPlayback ||
    effectivePreview?.mode === 'embed' ||
    isReelOrTv ||
    type === 'p';

  if (!useEmbed) {
    return null;
  }

  return (
    <CroppedEmbedPreview
      embedUrl={embedUrl}
      permalink={permalink}
      type={type}
      showPlayOverlay={showPlayOverlay}
      iframeInteractive={iframeInteractive}
      playbackActive={playbackActive || isReelOrTv}
      onActivatePlayback={handleActivatePlayback}
    />
  );
}
