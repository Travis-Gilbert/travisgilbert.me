import type { NextConfig } from 'next';

// RESEARCH_API_PROXY_URL: server-only var for the rewrite destination (not exposed to browser).
// Falls back to NEXT_PUBLIC_RESEARCH_API_URL for backward compat, then to Railway production.
const backendUrl =
  process.env.RESEARCH_API_PROXY_URL ||
  process.env.NEXT_PUBLIC_RESEARCH_API_URL ||
  'https://index-api-production-a5f7.up.railway.app';

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
  async rewrites() {
    return [
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
