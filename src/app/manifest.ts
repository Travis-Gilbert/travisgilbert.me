import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CommonPlace',
    short_name: 'CommonPlace',
    description: 'Warm archival knowledge workbench for capture, timeline, and networks.',
    start_url: '/commonplace',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F2EDE5',
    theme_color: '#B45A2D',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
