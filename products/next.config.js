/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/products',
  env: {
    NEXT_PUBLIC_BASE_PATH: '/products',
  },
};

module.exports = nextConfig;
