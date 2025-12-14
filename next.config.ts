import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // Включаем standalone режим для Docker
  output: 'standalone',
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
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
