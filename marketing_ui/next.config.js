/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  env: {
    NEXT_PUBLIC_BASE_PATH: '',
  },
};

module.exports = nextConfig;
