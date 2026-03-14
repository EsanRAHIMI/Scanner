'use client';

import * as React from 'react';

import { ProductsView } from './products-view';

export default function ProductsPage() {
  const [logo1Loaded, setLogo1Loaded] = React.useState(false);
  const [logo2Loaded, setLogo2Loaded] = React.useState(false);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  React.useEffect(() => {
    let cancelled = false;

    setLogo1Loaded(false);
    setLogo2Loaded(false);

    const img1 = new window.Image();
    img1.onload = () => {
      if (!cancelled) setLogo1Loaded(true);
    };
    img1.onerror = () => {
      if (!cancelled) setLogo1Loaded(false);
    };
    img1.src = `${basePath}/Logo1.png`;

    const img2 = new window.Image();
    img2.onload = () => {
      if (!cancelled) setLogo2Loaded(true);
    };
    img2.onerror = () => {
      if (!cancelled) setLogo2Loaded(false);
    };
    img2.src = `${basePath}/Logo2.png`;

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${basePath}/Brand_symbol_1.svg`}
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
              src={`${basePath}/Logo1.png`}
              alt="Lorenzo's products"
              className={
                (logo1Loaded ? 'opacity-100 ' : 'opacity-0 ') +
                'h-9 w-auto max-w-full object-contain transition-opacity dark:hidden'
              }
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${basePath}/Logo2.png`}
              alt="Lorenzo's products"
              className={
                (logo2Loaded ? 'opacity-100 ' : 'opacity-0 ') +
                'hidden h-9 w-auto max-w-full object-contain transition-opacity dark:block'
              }
            />
            {!(logo1Loaded || logo2Loaded) ? <span className="text-2xl font-semibold">Lorenzo's products</span> : null}
          </div>
        }
        mobileTitleNode={
          <span className="flex h-10 min-w-0 max-w-[140px] flex-none items-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${basePath}/Logo1.png`}
              alt="Lorenzo's products"
              className={
                (logo1Loaded ? 'opacity-100 ' : 'opacity-0 ') +
                'h-8 w-auto max-w-full object-contain transition-opacity dark:hidden'
              }
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${basePath}/Logo2.png`}
              alt="Lorenzo's products"
              className={
                (logo2Loaded ? 'opacity-100 ' : 'opacity-0 ') +
                'hidden h-8 w-auto max-w-full object-contain transition-opacity dark:block'
              }
            />
            {!(logo1Loaded || logo2Loaded) ? <span className="truncate text-lg font-semibold">Lorenzo's products</span> : null}
          </span>
        }
        title="Lorenzo's products"
      />
    </div>
  );
}
