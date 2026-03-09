'use client';

import * as React from 'react';

import { ProductsView } from './products-view';

export default function ProductsPage() {
  const [logoLoaded, setLogoLoaded] = React.useState(false);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

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
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${basePath}/Logo1.png`}
              alt="Lorenzo's products"
              className={(logoLoaded ? '' : 'hidden ') + 'h-9 w-auto max-w-[260px] object-contain'}
              onLoad={() => setLogoLoaded(true)}
              onError={() => setLogoLoaded(false)}
            />
            {!logoLoaded ? <span className="text-2xl font-semibold">Lorenzo's products</span> : null}
          </div>
        }
        mobileTitleNode={
          <div className="flex h-10 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${basePath}/Logo1.png`}
              alt="Lorenzo's products"
              className={(logoLoaded ? '' : 'hidden ') + 'h-8 w-auto max-w-[160px] object-contain'}
              onLoad={() => setLogoLoaded(true)}
              onError={() => setLogoLoaded(false)}
            />
            {!logoLoaded ? <span className="truncate text-lg font-semibold">Lorenzo's products</span> : null}
          </div>
        }
        title="Lorenzo's products"
      />
    </div>
  );
}
