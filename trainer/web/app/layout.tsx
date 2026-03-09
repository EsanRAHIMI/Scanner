import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { DamCacheProvider } from './dam-cache-provider';
import { ProductsCacheProvider } from './products-cache-provider';
import { TrainerNavbar } from './trainer-navbar';

export const metadata: Metadata = {
  title: 'Lorenzo Trainer',
  description: 'Admin dashboard for labeling and training',
};

function getScannerUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SCANNER_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return process.env.NODE_ENV === 'production' ? '/scanner' : 'http://localhost:3003/scanner';
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const scannerUrl = getScannerUrl();

  return (
    <html lang="en">
      <body className="h-dvh overflow-hidden bg-white text-black">
        <div className="mx-auto flex h-dvh w-full max-w-none flex-col gap-6 box-border px-5 py-6">
          <TrainerNavbar scannerUrl={scannerUrl} />
          <DamCacheProvider>
            <ProductsCacheProvider>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
            </ProductsCacheProvider>
          </DamCacheProvider>
        </div>
      </body>
    </html>
  );
}
