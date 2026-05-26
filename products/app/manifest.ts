import type { MetadataRoute } from 'next';

import { getPwaBasePath, withBasePath } from '@/lib/pwa';

export default function manifest(): MetadataRoute.Manifest {
  const base = getPwaBasePath();
  const startUrl = base ? `${base}/` : '/';

  return {
    id: startUrl,
    name: "Lorenzo Products",
    short_name: 'Products',
    description: 'Lorenzo products catalog and inventory',
    start_url: startUrl,
    scope: base ? `${base}/` : '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#000000',
    theme_color: '#000000',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: withBasePath('/icons/icon-192.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: withBasePath('/icons/icon-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: withBasePath('/icons/icon-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
