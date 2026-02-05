const CACHE_VERSION = 'wpsg-v1';
const RUNTIME_CACHE = `wpsg-runtime-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(RUNTIME_CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('wpsg-') && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/wp-admin/') || url.pathname.startsWith('/wp-json/')) return;
  if (url.pathname.includes('/wp-login.php')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        const cacheControl = response.headers.get('Cache-Control') || '';
        const contentLength = Number(response.headers.get('Content-Length') || '0');
        if (
          response &&
          response.status === 200 &&
          !cacheControl.includes('no-store') &&
          contentLength <= 5 * 1024 * 1024
        ) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        return cached ?? Response.error();
      }
    })(),
  );
});
