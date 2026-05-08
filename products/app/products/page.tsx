'use client';

import * as React from 'react';

import { ProductsView } from './products-view';

export default function ProductsPage() {
  const [logo1Loaded, setLogo1Loaded] = React.useState(false);
  const [logo2Loaded, setLogo2Loaded] = React.useState(false);
  const [logoSignBlackLoaded, setLogoSignBlackLoaded] = React.useState(false);
  const [logoSignWhiteLoaded, setLogoSignWhiteLoaded] = React.useState(false);
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

    const imgLogoSignBlack = new window.Image();
    imgLogoSignBlack.onload = () => { if (!cancelled) setLogoSignBlackLoaded(true); };
    imgLogoSignBlack.src = `${basePath}/Logo Sign Black.png`;

    const imgLogoSignWhite = new window.Image();
    imgLogoSignWhite.onload = () => { if (!cancelled) setLogoSignWhiteLoaded(true); };
    imgLogoSignWhite.src = `${basePath}/Logo Sign White.png`;

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative flex flex-1 w-full min-h-0 flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${basePath}/Brand_symbol_1.svg`}
          alt=""
          aria-hidden="true"
          className="absolute left-0 top-0 h-[122vh] w-auto -translate-x-[10vw] -translate-y-[10vh] select-none object-contain opacity-[0.07]"
        />
      </div>

      <React.Suspense fallback={null}>
        <ProductsView
          titleNode={
            <div className="relative h-10 w-[340px] flex-none overflow-hidden">
              <div
                className={
                  'absolute inset-0 flex items-center transition-opacity duration-200 ' +
                  (logo1Loaded || logo2Loaded ? 'opacity-0' : 'opacity-100')
                }
              >
                <span className="truncate text-[22px] font-semibold tracking-[0.08em] text-black/75 dark:text-white/70">
                  LORENZO
                </span>
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${basePath}/Logo1.png`}
                alt="Lorenzo products"
                className={
                  'absolute inset-y-0 left-0 h-9 w-auto max-w-full object-contain transition-opacity duration-300 dark:hidden ' +
                  (logo1Loaded ? 'opacity-100' : 'opacity-0')
                }
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${basePath}/Logo2.png`}
                alt="Lorenzo products"
                className={
                  'absolute inset-y-0 left-0 hidden h-9 w-auto max-w-full object-contain transition-opacity duration-300 dark:block ' +
                  (logo2Loaded ? 'opacity-100' : 'opacity-0')
                }
              />
            </div>
          }
          mobileTitleNode={
            <span className="relative flex h-10 w-[140px] flex-none items-center overflow-hidden">
              <span
                className={
                  'absolute inset-0 flex items-center transition-opacity duration-200 ' +
                  (logoSignBlackLoaded || logoSignWhiteLoaded ? 'opacity-0' : 'opacity-100')
                }
              >
                <span className="truncate text-sm font-semibold tracking-[0.14em] text-black/75 dark:text-white/70">
                  LORENZO
                </span>
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${basePath}/Logo Sign Black.png`}
                alt="Lorenzo products"
                className={
                  'absolute inset-y-0 left-0 h-7 w-auto max-w-full object-contain transition-opacity duration-300 dark:hidden ' +
                  (logoSignBlackLoaded ? 'opacity-100' : 'opacity-0')
                }
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${basePath}/Logo Sign White.png`}
                alt="Lorenzo products"
                className={
                  'absolute inset-y-0 left-0 hidden h-7 w-auto max-w-full object-contain transition-opacity duration-300 dark:block ' +
                  (logoSignWhiteLoaded ? 'opacity-100' : 'opacity-0')
                }
              />
            </span>
          }
          title="Lorenzo's products"
        />
      </React.Suspense>
    </div>
  );
}
