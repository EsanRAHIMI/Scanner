import './globals.css';
import type { Metadata } from 'next';
import type { Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';

import { getDefaultScannerUrl, getPublicServiceUrl } from '@/lib/public-urls';

const inter = Inter({ subsets: ['latin'] });

// Global Lorenzo AI / navigation widget. Built ONLY from NEXT_PUBLIC_AGENT_URL
// (which may include a base path, e.g. https://agent.example.com/server).
// No hardcoded domain or localhost fallback: if unset, the widget is not injected.
const agentBaseUrl = (process.env.NEXT_PUBLIC_AGENT_URL || '').trim().replace(/\/+$/, '');
const agentWidgetSrc = agentBaseUrl ? `${agentBaseUrl}/widget.js` : null;

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
      <body className={inter.className}>
        {children}
        {agentWidgetSrc ? <Script src={agentWidgetSrc} strategy="afterInteractive" /> : null}
      </body>
    </html>
  );
}
