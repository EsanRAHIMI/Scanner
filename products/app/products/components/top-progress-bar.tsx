'use client';

import * as React from 'react';

export function TopProgressBar({ loading }: { loading: boolean }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setVisible(true), 200);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(t);
    }
  }, [loading]);

  if (!visible) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-[2000] h-0.5 overflow-hidden bg-emerald-500/10">
      <div
        className={`h-full bg-emerald-500 transition-all duration-500 ease-out ${
          loading ? 'w-[70%] animate-pulse' : 'w-full opacity-0'
        }`}
      />
    </div>
  );
}
