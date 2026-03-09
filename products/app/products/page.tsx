'use client';

import * as React from 'react';

import { ProductsView } from './products-view';

export default function ProductsPage() {
  const [logoLoaded, setLogoLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLogoLoaded(false);

    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setLogoLoaded(true);
    };
    img.onerror = () => {
      if (!cancelled) setLogoLoaded(false);
    };
    img.src = '/Logo1.png';

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Brand_symbol_1.svg"
          alt=""
          aria-hidden="true"
          className="absolute left-0 top-0 h-[122vh] w-auto -translate-x-[10vw] -translate-y-[10vh] select-none object-contain opacity-[0.07]"
        />
      </div>

      <ProductsView
        titleNode={
          <div className="flex h-10 min-w-0 max-w-[340px] items-center gap-3 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Logo1.png"
              alt="Lorenzo's products"
              className={
                (logoLoaded ? 'opacity-100 ' : 'opacity-0 ') +
                'h-9 w-auto max-w-full object-contain transition-opacity'
              }
            />
            {!logoLoaded ? <span className="text-2xl font-semibold">Lorenzo's products</span> : null}
          </div>
        }
        mobileTitleNode={
          <span className="flex h-10 min-w-0 max-w-[140px] flex-none items-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Logo1.png"
              alt="Lorenzo's products"
              className={
                (logoLoaded ? 'opacity-100 ' : 'opacity-0 ') +
                'h-8 w-auto max-w-full object-contain transition-opacity'
              }
            />
            {!logoLoaded ? <span className="truncate text-lg font-semibold">Lorenzo's products</span> : null}
          </span>
        }
        title="Lorenzo's products"
      />
    </div>
  );
}
