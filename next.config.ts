import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'kinescope.io', port: '', pathname: '/**' },
      { protocol: 'https', hostname: '**.kinescope.io', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'kinescopecdn.net', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', port: '', pathname: '/**' },
      // Наше S3 (reg.ru): публичные превью и обложки шортсов, в т.ч. кадры,
      // которые делает воркер обработки видео. Без этого /_next/image отвечает
      // 400 «url parameter is not allowed» и превью в каталоге битые.
      // Хост статический: S3_ENDPOINT на этапе сборки образа недоступен.
      { protocol: 'https', hostname: 's3.regru.cloud', port: '', pathname: '/**' },
    ],
  },
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
