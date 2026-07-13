'use client';

import * as React from 'react';

const NARROW_MQ = '(max-width: 639px)';

/** True when viewport matches Tailwind `max-sm` (mobile list layout). */
export function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_MQ).matches,
  );

  React.useEffect(() => {
    const mq = window.matchMedia(NARROW_MQ);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return narrow;
}
