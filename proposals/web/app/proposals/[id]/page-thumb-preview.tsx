'use client';

import { useEffect, useRef, useState } from 'react';

import { PROPOSAL_PAGE_HEIGHT, PROPOSAL_PAGE_WIDTH } from './page-preview';

type ProposalPageThumbPreviewProps = {
  proposalId: string;
  pageIndex: number;
  previewKey: number;
};

export function ProposalPageThumbPreview({
  proposalId,
  pageIndex,
  previewKey,
}: ProposalPageThumbPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.1);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setShouldLoad(true);
      },
      { rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      setScale(width / PROPOSAL_PAGE_WIDTH);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frameHeight = PROPOSAL_PAGE_HEIGHT * scale;
  const src = `/api/proposals/${proposalId}/render?page=${pageIndex}&embed=1&v=${previewKey}`;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-sm bg-[#2b2b2e] ring-1 ring-black/10"
      style={{ height: frameHeight }}
    >
      {shouldLoad ? (
        <iframe
          key={`${pageIndex}-${previewKey}`}
          src={src}
          title={`Slide ${pageIndex + 1} preview`}
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none absolute left-0 top-0 border-0 bg-white"
          style={{
            width: PROPOSAL_PAGE_WIDTH,
            height: PROPOSAL_PAGE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-brand-medium-gray/15" aria-hidden />
      )}
    </div>
  );
}
