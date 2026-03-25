import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Studio',
    short_name: 'Studio',
    description:
      'Intelligence-augmented writing. Your research engine, always with you.',
    start_url: '/studio',
    scope: '/studio',
    display: 'standalone',
    background_color: '#13110F',
    theme_color: '#B45A2D',
    categories: ['productivity', 'utilities', 'education'],
    icons: [
      {
        src: '/studio-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/studio-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
