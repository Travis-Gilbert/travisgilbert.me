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

const actMlcModelUrl = 'https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC';
const actMlcModelLibUrl =
  'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/gemma-2-2b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm';

// Desktop (Tauri) packaged build: produce a static export. Gated by env so the
// web/Vercel build is unaffected (it stays a server build with rewrites + route
// handlers). In desktop mode the app talks to the local engine directly, so the
// server-only rewrites/redirects/headers are dropped. NOTE: a full static export
// also requires the API route handlers (src/app/api/*) to be excluded — see
// scripts/desktop-export.mjs (the `build:desktop` script).
const isDesktopExport = process.env.DESKTOP_EXPORT === '1';

const nextConfig: NextConfig = {
  output: isDesktopExport ? 'export' : undefined,
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
      '@luma.gl/shadertools': './node_modules/@luma.gl/shadertools/dist/index.js',
    },
  },
  async rewrites() {
    if (isDesktopExport) return [];
    return [
      {
        source: '/act/gemma-2-2b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm',
        destination: actMlcModelLibUrl,
      },
      {
        source: '/act/resolve/:path*',
        destination: `${actMlcModelUrl}/resolve/:path*`,
      },
      {
        source: '/api/resolve-cache/:path*',
        destination: 'https://huggingface.co/api/resolve-cache/:path*',
      },
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
  async headers() {
    if (isDesktopExport) return [];
    return [
      {
        source: '/act/resolve/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
        ],
      },
      {
        source: '/act/gemma-2-2b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
        ],
      },
    ];
  },
  async redirects() {
    if (isDesktopExport) return [];
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
        source: '/anti-conspiracy-theorem',
        destination: '/act',
        permanent: false,
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
