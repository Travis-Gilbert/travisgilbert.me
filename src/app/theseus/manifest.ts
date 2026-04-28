import type { MetadataRoute } from 'next';

/**
 * PWA manifest for the Theseus app, scoped to /theseus.
 *
 * Lives alongside (not replacing) the root manifests:
 *   - src/app/manifest.ts (CommonPlace, scope /commonplace via start_url)
 *   - public/manifest.json (Travis Gilbert site, scope /)
 *
 * Next.js serves this at /theseus/manifest.webmanifest because of the
 * file's location under app/theseus/.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Theseus',
    short_name: 'Theseus',
    description: 'Visual Intelligence Engine',
    start_url: '/theseus',
    scope: '/theseus',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0F1012',
    theme_color: '#0a2a20',
    icons: [
      {
        src: '/theseus-emblem.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
