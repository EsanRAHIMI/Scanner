'use client';

import * as React from 'react';

/** How many rows ahead of the leading visible row may start loading media. */
export const MEDIA_LOAD_LOOKAHEAD = 3;

type MediaLoadContextValue = {
  leadRowIndex: number;
  registerVisibleRow: (rowIndex: number) => void;
  shouldLoadRow: (rowIndex: number) => boolean;
};

const MediaLoadContext = React.createContext<MediaLoadContextValue | null>(null);

export function MediaLoadProvider({
  children,
  scrollRootRef,
}: {
  children: React.ReactNode;
  scrollRootRef: React.RefObject<HTMLElement | null>;
}) {
  const [leadRowIndex, setLeadRowIndex] = React.useState(0);

  const registerVisibleRow = React.useCallback((rowIndex: number) => {
    if (!Number.isFinite(rowIndex) || rowIndex < 0) return;
    setLeadRowIndex((prev) => (rowIndex > prev ? rowIndex : prev));
  }, []);

  const shouldLoadRow = React.useCallback(
    (rowIndex: number) => {
      if (!Number.isFinite(rowIndex) || rowIndex < 0) return false;
      return rowIndex <= leadRowIndex + MEDIA_LOAD_LOOKAHEAD;
    },
    [leadRowIndex],
  );

  React.useEffect(() => {
    setLeadRowIndex(0);
  }, [scrollRootRef]);

  const value = React.useMemo(
    () => ({ leadRowIndex, registerVisibleRow, shouldLoadRow }),
    [leadRowIndex, registerVisibleRow, shouldLoadRow],
  );

  return <MediaLoadContext.Provider value={value}>{children}</MediaLoadContext.Provider>;
}

export function useMediaLoad() {
  const ctx = React.useContext(MediaLoadContext);
  if (!ctx) {
    return {
      leadRowIndex: 0,
      registerVisibleRow: () => {},
      shouldLoadRow: () => true,
    };
  }
  return ctx;
}

/** Attach to a row/card root — reports visibility to advance the media load window. */
export function useMediaRowAnchor(rowIndex: number) {
  const { registerVisibleRow } = useMediaLoad();
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) registerVisibleRow(rowIndex);
        }
      },
      { root: null, rootMargin: '160px 0px', threshold: 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rowIndex, registerVisibleRow]);

  return ref;
}

export function useMediaLoadGate(rowIndex: number | undefined): boolean {
  const { shouldLoadRow } = useMediaLoad();
  if (rowIndex === undefined) return true;
  return shouldLoadRow(rowIndex);
}

/** Gallery grid cell wrapper — reports row visibility for prefetch window. */
export function GalleryMediaAnchor({
  rowIndex,
  children,
  className,
}: {
  rowIndex: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useMediaRowAnchor(rowIndex);
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      data-media-row-index={rowIndex}
      className={className}
    >
      {children}
    </div>
  );
}
