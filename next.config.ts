import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'kinescope.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.kinescope.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'kinescopecdn.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
