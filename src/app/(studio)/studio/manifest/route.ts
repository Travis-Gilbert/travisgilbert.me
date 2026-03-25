import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    name: 'Studio',
    short_name: 'Studio',
    description: 'Publishing workbench. Write, manage, and track content.',
    start_url: '/studio',
    scope: '/studio',
    display: 'standalone',
    orientation: 'any',
    background_color: '#13110F',
    theme_color: '#B45A2D',
    icons: [
      {
        src: '/studio/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/studio/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/studio/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'apple touch icon',
      },
    ],
    categories: ['productivity', 'utilities'],
  };

  return NextResponse.json(manifest, {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
