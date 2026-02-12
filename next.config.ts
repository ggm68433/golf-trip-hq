import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // Required for static export to work with images
  },
};

export default nextConfig;