import './globals.css';
import type { Metadata } from 'next';
import type { Viewport } from 'next';
import { Inter } from 'next/font/google';

import { getDefaultScannerUrl, getPublicServiceUrl } from '@/lib/public-urls';

const inter = Inter({ subsets: ['latin'] });

const siteDescription =
  'Mobile-first live scanning with YOLO detection and bounding boxes on the camera feed.';

export const metadata: Metadata = {
  metadataBase: new URL(getPublicServiceUrl('hub')),
  title: {
    default: 'Chandelier Scanner',
    template: '%s | Chandelier Scanner',
  },
  description: siteDescription,
  applicationName: 'Chandelier Scanner',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: getDefaultScannerUrl(),
    siteName: 'Chandelier Scanner',
    title: 'Chandelier Scanner',
    description: siteDescription,
  },
  twitter: {
    card: 'summary',
    title: 'Chandelier Scanner',
    description: siteDescription,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
