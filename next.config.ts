import path from 'node:path';
import type { NextConfig } from 'next';

// Explicit Turbopack workspace root. Without this, Turbopack walks up
// the filesystem looking for the nearest lockfile and picks the wrong
// directory whenever a stray ~/package-lock.json exists, which mis-roots
// the module graph and causes the PostCSS subprocess to deadlock when
// compiling global.css. path.resolve('.') is process.cwd(), which is
// always the project directory when next dev/build is invoked via
// npm scripts.
const projectRoot = path.resolve('.');

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
    root: projectRoot,
    resolveAlias: {
      // Stub out @mediapipe packages that @tensorflow-models imports at the
      // ESM module level. We use runtime: 'tfjs' (not 'mediapipe'), so these
      // are never called. Applies to both browser and SSR bundles.
      '@mediapipe/selfie_segmentation': './src/lib/stubs/empty.ts',
      '@mediapipe/face_mesh': './src/lib/stubs/empty.ts',
      // Cosmograph's shipped bundle uses `@/cosmograph/*` as a self-alias
      // that collides with our `@/*` -> `./src/*` convention. Map it back
      // to the package root so the bundle's style-module import resolves.
      // See `node_modules/@cosmograph/cosmograph/cosmograph/managers/
      // licensing-manager.js` for the origin.
      '@/cosmograph/style.module.css': './node_modules/@cosmograph/cosmograph/cosmograph/style.module.css',
      '@luma.gl/shadertools': './node_modules/@luma.gl/shadertools/dist/index.js',
    },
  },
  // Cosmograph (and its luma.gl/cosmos.gl internals) ship browser-only
  // WebGL code; rebundling it through Next's server compile resolves the
  // internal `@/cosmograph` alias in addition to avoiding SSR-only APIs
  // reaching the browser bundle with stale module boundaries.
  transpilePackages: [
    '@cosmograph/react',
    '@cosmograph/cosmograph',
  ],
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
