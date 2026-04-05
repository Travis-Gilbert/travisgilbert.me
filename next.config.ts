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
  turbopack: {
    resolveAlias: {
      // Stub out @mediapipe packages that @tensorflow-models imports at the
      // ESM module level. We use runtime: 'tfjs' (not 'mediapipe'), so these
      // are never called. Without the alias the build fails on missing modules.
      '@mediapipe/selfie_segmentation': { browser: './src/lib/stubs/empty.ts' },
      '@mediapipe/face_mesh': { browser: './src/lib/stubs/empty.ts' },
    },
  },
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
