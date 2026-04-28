// Service worker scoped to /theseus.
// Strategy mirrors public/studio-sw.js (which is the working PWA in
// this repo): CacheFirst for static assets, NetworkFirst with offline
// fallback for navigation requests, NetworkOnly for API calls.
//
// Scope is /theseus, registered from src/components/theseus/TheseusServiceWorker.tsx.

const CACHE_NAME = 'theseus-v1';
const OFFLINE_URL = '/theseus';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        '/theseus',
        '/icon-192.png',
        '/icon-512.png',
        '/theseus-emblem.svg',
      ]).catch(() => {
        // Best-effort precache. If any URL 404s during install,
        // don't block activation — the SW still helps with everything else.
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name.startsWith('theseus-'))
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests. Cross-origin (Modal, Railway,
  // Google Fonts) passes through to the network unchanged.
  if (url.origin !== self.location.origin) return;

  // API calls: NetworkOnly. Theseus is graph-state heavy; stale data
  // would be misleading.
  if (url.pathname.startsWith('/api/')) {
    return; // default network fetch
  }

  // Next.js static assets and fonts: CacheFirst.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.match(/\.(js|css|woff2|png|svg|ico|jpg|jpeg|webp)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then(
          (cached) =>
            cached ||
            fetch(event.request).then((response) => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
        )
      )
    );
    return;
  }

  // Page navigations under /theseus: NetworkFirst with offline fallback.
  if (event.request.mode === 'navigate' && url.pathname.startsWith('/theseus')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the latest /theseus shell for offline fallback.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy).catch(() => {});
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cached) => cached || caches.match(OFFLINE_URL)
          )
        )
    );
    return;
  }

  // Everything else: default to network.
});
