/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for smaller Docker images (copies only required files)
  output: 'standalone',

  env: {
    NEXT_PUBLIC_BASE_PATH: '',
  },

  // Gzip / Brotli compression for all responses
  compress: true,

  // Allow next/image to optimise images served from Google Drive / lh3
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'drive.google.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 768, 1024, 1280, 1600],
    minimumCacheTTL: 3600, // 1 hour client-side image cache
  },

  async headers() {
    return [
      {
        source: '/api/products/assets',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
