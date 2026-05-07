const CACHE_VERSION = 'wpsg-v3';
const RUNTIME_CACHE = `wpsg-runtime-${CACHE_VERSION}`;

// Vite-hashed asset filenames contain a content hash (e.g. index-DxTet_7o.js).
// These should NOT be SW-cached because the hash already busts browser cache,
// and SW cache-first would serve stale bundles after a deploy.
const HASHED_ASSET_RE = /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css)$/;

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

  // Never cache document navigations or HTML pages. A stale cached shell can
  // bootstrap an old entry module that lazy-loads chunk URLs removed by a new
  // deploy, which shows up as overlays or settings drawers that stop opening.
  const acceptHeader = request.headers.get('Accept') || '';
  if (request.mode === 'navigate' || acceptHeader.includes('text/html')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/wp-admin/') || url.pathname.startsWith('/wp-json/')) return;
  if (url.pathname.includes('/wp-login.php')) return;

  // Never cache Vite hashed assets — the content hash in the filename
  // already provides perfect cache busting. SW caching these causes
  // stale bundles after deploy.
  if (HASHED_ASSET_RE.test(url.pathname)) return;

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
      } catch {
        return cached ?? Response.error();
      }
    })(),
  );
});
