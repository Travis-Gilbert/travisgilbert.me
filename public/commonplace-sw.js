const CACHE_NAME = 'commonplace-v1';
const OFFLINE_URL = '/commonplace';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        '/commonplace',
        '/commonplace/icon-192.png',
        '/commonplace/icon-512.png',
        '/commonplace/manifest.webmanifest',
      ]).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name.startsWith('commonplace-'))
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) return;

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.match(/\.(js|css|woff2|png|svg|ico|jpg|jpeg|webp|json|webmanifest)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) =>
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

  if (event.request.mode === 'navigate' && url.pathname.startsWith('/commonplace')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy).catch(() => {});
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
  }
});
