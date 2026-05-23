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
            aria-label="Load Instagram preview"
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

function ThumbnailPreview({
  thumbnailUrl,
  type,
  permalink,
  showPlayOverlay,
  playbackActive,
  onActivatePlayback,
}: {
  thumbnailUrl: string;
  type: InstagramPreviewResponse['type'];
  permalink: string;
  showPlayOverlay: boolean;
  playbackActive: boolean;
  onActivatePlayback: () => void;
}) {
  return (
    <MediaFrame
      type={type}
      permalink={permalink}
      showPlayOverlay={showPlayOverlay}
      playbackActive={playbackActive}
      onActivatePlayback={onActivatePlayback}
    >
      <img
        src={thumbnailUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </MediaFrame>
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
        key={embedUrl}
        src={embedUrl}
        title="Instagram media preview"
        className={`absolute border-0 ${iframeInteractive ? 'z-10 pointer-events-auto' : 'pointer-events-none'}`}
        style={iframeStyle}
        scrolling="no"
        loading="lazy"
        referrerPolicy="no-referrer"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      />
    </MediaFrame>
  );
}

function EmbedFallbackPrompt({
  type,
  permalink,
  onLoadEmbed,
}: {
  type: InstagramPreviewResponse['type'];
  permalink: string;
  onLoadEmbed: () => void;
}) {
  const frameStyle = getInstagramMediaFrameStyle(type);
  const sizeClasses = getInstagramMediaFrameClasses(type);

  return (
    <div className="flex flex-col gap-1.5 py-0.5" onClick={(e) => e.stopPropagation()}>
      <div
        style={frameStyle}
        className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-muted/40 ring-1 ring-border/50 ${sizeClasses}`}
      >
        <button
          type="button"
          className="rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-[10px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLoadEmbed();
          }}
        >
          Load preview
        </button>
      </div>
      <OpenOnInstagramLink permalink={permalink} />
    </div>
  );
}

export function InstagramMediaPreview({ url }: InstagramMediaPreviewProps) {
  const parsed = useMemo(() => parseInstagramUrl(url), [url]);
  const [preview, setPreview] = useState<InstagramPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [embedActive, setEmbedActive] = useState(false);

  useEffect(() => {
    setEmbedActive(false);
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
            mode: 'thumbnail',
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

  const handleActivatePlayback = () => {
    setEmbedActive(true);
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

  const type = preview?.type ?? parsed.type;
  const permalink = preview?.permalink ?? parsed.permalink;
  const embedUrl = preview?.embedUrl ?? parsed.embedUrl;
  const thumbnailUrl = preview?.thumbnailUrl?.trim() || null;
  const isReelOrTv = isInstagramVideoType(type);
  const isFeedVideoPost = type === 'p' && Boolean(preview?.isVideo);
  const isVideo = isReelOrTv || isFeedVideoPost;
  const iframeInteractive = embedActive && (isReelOrTv || isVideo);
  const showPlayOverlay = !embedActive && isVideo && Boolean(thumbnailUrl);

  if (embedActive) {
    return (
      <CroppedEmbedPreview
        embedUrl={embedUrl}
        permalink={permalink}
        type={type}
        showPlayOverlay={false}
        iframeInteractive={iframeInteractive || isReelOrTv}
        playbackActive
        onActivatePlayback={handleActivatePlayback}
      />
    );
  }

  if (thumbnailUrl) {
    return (
      <ThumbnailPreview
        thumbnailUrl={thumbnailUrl}
        type={type}
        permalink={permalink}
        showPlayOverlay={showPlayOverlay}
        playbackActive={false}
        onActivatePlayback={handleActivatePlayback}
      />
    );
  }

  return (
    <EmbedFallbackPrompt
      type={type}
      permalink={permalink}
      onLoadEmbed={handleActivatePlayback}
    />
  );
}
