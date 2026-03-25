// Service worker for Studio PWA
// Strategy:
//   Static assets: CacheFirst
//   Page routes: NetworkFirst with offline fallback
//   Studio API (GET): StaleWhileRevalidate
//   ML endpoints (POST): NetworkOnly (requires live inference)

const CACHE_NAME = 'studio-v1';
const OFFLINE_URL = '/studio/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/studio', '/studio/offline'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ML endpoints: NetworkOnly (not cacheable)
  if (url.pathname.startsWith('/editor/api/ml/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Studio API GET requests: StaleWhileRevalidate
  if (url.pathname.startsWith('/editor/api/') && event.request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetched = fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || fetched;
        })
      )
    );
    return;
  }

  // Static assets: CacheFirst
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.match(/\.(js|css|woff2|png|svg|ico)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then(
          (cached) => cached || fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
        )
      )
    );
    return;
  }

  // Page routes: NetworkFirst
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then(
          (cached) => cached || caches.match(OFFLINE_URL)
        )
      )
    );
    return;
  }

  // Default: network
  event.respondWith(fetch(event.request));
});
