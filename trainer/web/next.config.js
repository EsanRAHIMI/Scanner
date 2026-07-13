/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: 'http://127.0.0.1:8010/:path*',
        },
      ],
    };
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
