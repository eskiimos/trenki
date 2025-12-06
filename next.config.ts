import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
