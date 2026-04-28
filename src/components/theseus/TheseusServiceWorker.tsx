'use client';

import { useEffect } from 'react';

/**
 * Registers the Theseus service worker, scoped to /theseus.
 *
 * Mirrors the inline registration snippet in src/app/(studio)/layout.tsx,
 * extracted here as a component so it stays out of the layout's render
 * tree. The SW file is public/theseus-sw.js.
 */
export default function TheseusServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Only register when the user is actually on /theseus, so the SW
    // isn't installed for visitors who only browse the main site.
    if (!window.location.pathname.startsWith('/theseus')) return;

    navigator.serviceWorker
      .register('/theseus-sw.js', { scope: '/theseus' })
      .catch(() => {
        // Registration failures are non-fatal. The app continues to
        // work as a normal web app; only PWA install / offline are
        // affected.
      });
  }, []);

  return null;
}
