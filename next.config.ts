import type { NextConfig } from 'next';

// INDEX_API_PROXY_URL: server-only var for the rewrite destination (not exposed to browser).
// Falls back to local Index API in development, then Railway production.
const explicitBackendUrl =
  process.env.INDEX_API_PROXY_URL ||
  process.env.NEXT_PUBLIC_INDEX_API_URL ||
  process.env.NEXT_PUBLIC_RESEARCH_API_URL;

const backendUrl =
  explicitBackendUrl ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000'
    : 'https://index-api-production-a5f7.up.railway.app');

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
  async rewrites() {
    return [
      {
        source: '/api/v2/theseus/:path*',
        destination: `${backendUrl}/api/v2/theseus/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/investigations',
        destination: '/essays',
        permanent: true,
      },
      {
        source: '/investigations/:slug',
        destination: '/essays/:slug',
        permanent: true,
      },
      {
        source: '/working-ideas',
        destination: '/field-notes',
        permanent: true,
      },
      {
        source: '/working-ideas/:slug',
        destination: '/field-notes/:slug',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
