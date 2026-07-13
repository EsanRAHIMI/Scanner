'use client';

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

const POPOVER_WIDTH_PX = 288;
const VIEWPORT_MARGIN_PX = 8;
const DEFAULT_MAX_HEIGHT_PX = 320;
const MIN_POPOVER_HEIGHT_PX = 160;

export interface FloatingPopoverOptions {
  width?: number;
  preferredHeight?: number;
  maxHeight?: number;
}

/** Pin popover top to cell top; extend downward with scroll when space is limited. */
export function useFloatingPopoverPosition(
  anchorRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  options?: FloatingPopoverOptions,
): CSSProperties {
  const width = options?.width ?? POPOVER_WIDTH_PX;
  const maxHeightCap = options?.maxHeight ?? DEFAULT_MAX_HEIGHT_PX;

  const [style, setStyle] = useState<CSSProperties>({
    position: 'fixed',
    visibility: 'hidden',
    zIndex: 9999,
    width,
  });

  useLayoutEffect(() => {
    if (!enabled) return;

    const compute = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      // Top edge of popover = top edge of cell (floating overlay on the row).
      let top = rect.top;
      let left = rect.left;

      if (left + width > viewportW - VIEWPORT_MARGIN_PX) {
        left = viewportW - width - VIEWPORT_MARGIN_PX;
      }
      left = Math.max(VIEWPORT_MARGIN_PX, left);

      if (top < VIEWPORT_MARGIN_PX) {
        top = VIEWPORT_MARGIN_PX;
      }

      const availableBelow = viewportH - top - VIEWPORT_MARGIN_PX;
      const maxHeight = Math.min(
        maxHeightCap,
        Math.max(MIN_POPOVER_HEIGHT_PX, availableBelow),
      );

      setStyle({
        position: 'fixed',
        top,
        left,
        width,
        maxHeight,
        zIndex: 9999,
        visibility: 'visible',
      });
    };

    compute();
    const raf = window.requestAnimationFrame(compute);

    const resizeObserver = new ResizeObserver(compute);
    if (popoverRef.current) resizeObserver.observe(popoverRef.current);

    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [anchorRef, popoverRef, enabled, width, maxHeightCap]);

  return style;
}
