/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    return [
      {
        source: '/api/detect',
        destination: 'http://127.0.0.1:8000/detect',
      },
    ];
  },
};

module.exports = nextConfig;
