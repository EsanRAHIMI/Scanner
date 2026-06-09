import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

import { withBasePath } from '@/lib/pwa';

import { PwaRegister } from './pwa-register';
import { ProductsCacheProvider } from './products-cache-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Lorenzo products catalog and inventory',
  applicationName: 'Lorenzo Products',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Products',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: `${basePath}/favicon.ico`,
    apple: withBasePath('/icons/apple-touch-icon.png'),
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}",
          }}
        />
      </head>
      <body className="h-dvh overflow-hidden bg-brand-light-gray font-sans text-brand-black antialiased dark:bg-black dark:text-white">
        <PwaRegister />
        <ProductsCacheProvider>
          <div className="mx-auto flex h-dvh w-full max-w-none flex-col gap-4 box-border px-5 py-6">
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </div>
        </ProductsCacheProvider>
      </body>
    </html>
  );
}
