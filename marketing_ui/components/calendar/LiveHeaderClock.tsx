'use client';

import React, { useEffect, useMemo, useState } from 'react';

function formatLiveHeaderClock(now: Date) {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const date = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return { weekday, date, time };
}

export function LiveHeaderClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { weekday, date, time } = useMemo(() => formatLiveHeaderClock(now), [now]);

  return (
    <p className="mt-0.5 truncate text-sm leading-tight text-brand-dark-gray tabular-nums">
      <span className="font-medium text-brand-black">{weekday}</span>
      <span className="mx-1.5 text-brand-medium-gray" aria-hidden>
        ·
      </span>
      <span>{date}</span>
      <span className="mx-1.5 text-brand-medium-gray" aria-hidden>
        ·
      </span>
      <time dateTime={now.toISOString()}>{time}</time>
    </p>
  );
}
