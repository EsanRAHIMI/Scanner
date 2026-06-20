'use client';

import { useEffect, useRef, useState } from 'react';

/** Must match proposals/server PDF page dimensions (1440×810). */
export const PROPOSAL_PAGE_WIDTH = 1440;
export const PROPOSAL_PAGE_HEIGHT = 810;

type ProposalPagePreviewProps = {
  src: string;
  pageKey: string | number;
};

export function ProposalPagePreview({ src, pageKey }: ProposalPagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      const pad = 32;
      const availW = Math.max(0, width - pad);
      const availH = Math.max(0, height - pad);
      if (availW <= 0 || availH <= 0) return;

      const next = Math.min(
        availW / PROPOSAL_PAGE_WIDTH,
        availH / PROPOSAL_PAGE_HEIGHT,
      );
      setScale(next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [pageKey]);

  const frameW = PROPOSAL_PAGE_WIDTH * scale;
  const frameH = PROPOSAL_PAGE_HEIGHT * scale;

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden overscroll-none bg-[#2b2b2e]"
      aria-label="Page preview stage"
    >
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative shrink-0 overflow-hidden rounded-sm shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
          style={{ width: frameW, height: frameH }}
        >
          <iframe
            key={pageKey}
            src={src}
            title="Proposal page preview"
            className="absolute left-0 top-0 border-0 bg-white"
            style={{
              width: PROPOSAL_PAGE_WIDTH,
              height: PROPOSAL_PAGE_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
      </div>
    </div>
  );
}
