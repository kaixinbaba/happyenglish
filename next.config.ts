import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-46f834f249cf497c913e7fd87429cdc1.r2.dev',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
