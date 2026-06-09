import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

import { DamCacheProvider } from './dam-cache-provider';
import { ProductsCacheProvider } from './products-cache-provider';
import { AuthGate } from './auth-gate';
import { TrainerNavbar } from './trainer-navbar';
import { getScannerUrl } from '@/lib/env';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Lorenzo Trainer',
  description: 'Admin dashboard for labeling and training',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const scannerUrl = getScannerUrl();

  return (
    <html lang="en" className={inter.variable}>
      <body className="h-dvh overflow-hidden bg-brand-light-gray font-sans text-brand-black antialiased">
        <AuthGate>
          <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
            <TrainerNavbar scannerUrl={scannerUrl} />
            <main className="app-main">
              <DamCacheProvider>
                <ProductsCacheProvider>
                  <div className="app-main-inner">{children}</div>
                </ProductsCacheProvider>
              </DamCacheProvider>
            </main>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}
