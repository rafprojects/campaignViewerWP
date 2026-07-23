const CACHE_VERSION = 'wpsg-v3';
const RUNTIME_CACHE = `wpsg-runtime-${CACHE_VERSION}`;

// Stale-while-revalidate cache for public gallery metadata.
// Versioned independently from RUNTIME_CACHE: bump META_CACHE to clear stale
// metadata for all users on a breaking API change.
const META_CACHE = 'wpsg-meta-v1';

// Revalidate in background only when the cached entry is older than this.
// Serves stale data immediately regardless; TTL just throttles server hits.
const META_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Global cap on metadata cache entries before the oldest are evicted. This is a
// flat 50-entry count (not a per-space byte budget) — each JSON response is well
// under 100 kB, so 50 entries stays comfortably small.
const META_MAX_ENTRIES = 50;

// [P71-D] Stale-while-revalidate cache for uploaded media (/wp-content/uploads/).
// The default runtime branch below is cache-first-forever, so a WP-media image
// edited or regenerated under the SAME URL (media editor, thumbnail-regeneration
// plugins) is served stale indefinitely to a returning visitor with a warm
// cache. Uploads get their own SWR cache instead: served immediately from cache,
// revalidated in the background once the entry ages past UPLOADS_TTL_MS. Kept
// separate from META_CACHE (different TTL/size profile) and from RUNTIME_CACHE
// (which stays cache-first for fonts / immutable static assets).
const UPLOADS_CACHE = 'wpsg-uploads-swr-v1';
const UPLOADS_PATH_RE = /\/wp-content\/uploads\//;
// Images change rarely and are bandwidth-heavy, so revalidate at most hourly
// (vs the metadata cache's 5 min) — long enough to avoid re-downloading a
// gallery's worth of unchanged images on every revisit, short enough that an
// edit is not served stale "indefinitely" (the exact property this fixes).
const UPLOADS_TTL_MS = 60 * 60 * 1000; // 1 hour
const UPLOADS_MAX_ENTRIES = 100;

// Matches the two public gallery metadata endpoints (pathname only):
//   /wp-json/wp-super-gallery/v1/campaigns              (campaign list)
//   /wp-json/wp-super-gallery/v1/campaigns/{id}/media   (per-campaign media list)
// Does NOT match /wp-json/wp-super-gallery/v1/admin/* or any other route.
//
// NOTE: this tests url.pathname (query string excluded), so the admin campaign
// list — same pathname plus ?include_archived=… — also matches. The auth-header
// bypass in the fetch handler keeps those (and every authenticated/mutation
// flow) network-first per Key Decision D; only anonymous public reads get SWR.
const META_ENDPOINT_RE = /\/wp-json\/wp-super-gallery\/v1\/campaigns(\/\d+\/media)?$/;

// Vite-hashed asset filenames contain a content hash (e.g. index-DxTet_7o.js).
// These should NOT be SW-cached because the hash already busts browser cache,
// and SW cache-first would serve stale bundles after a deploy.
const HASHED_ASSET_RE = /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css)$/;

// P52-D: versioned shell cache for navigation responses (HTML pages).
// __WPSG_BUILD_HASH__ is replaced with a hash of the Vite manifest by the
// wpsg-sw-hash-inject Vite plugin on every production build. A new hash means
// a new SW file → the browser detects the update → activate deletes the old
// shell cache (any wpsg-* name not matching the current set is swept).
const BUILD_HASH = '__WPSG_BUILD_HASH__';
const SHELL_CACHE = `wpsg-shell-${BUILD_HASH}`;

// Minimal branded offline fallback served when the network is down and no
// cached shell is available (first offline load, or post-deploy before revisit).
const OFFLINE_HTML = `<!DOCTYPE html><html lang="en"><head>\
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\
<title>Gallery — Offline</title>\
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa}div{text-align:center;max-width:400px;padding:2rem}h1{font-size:1.5rem;color:#212529;margin:0 0 .5rem}p{color:#6c757d;margin:0}</style>\
</head><body><div><h1>You’re offline</h1>\
<p>Check your connection and reload to view the gallery.</p>\
</div></body></html>`;

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
          .filter(
            (key) =>
              key.startsWith('wpsg-') &&
              key !== RUNTIME_CACHE &&
              key !== META_CACHE &&
              key !== SHELL_CACHE &&
              key !== UPLOADS_CACHE,
          )
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
  if (url.pathname.includes('/wp-login.php')) return;

  // wp-admin navigations pass through to the network — admins should see the
  // real error if they go offline, not a gallery offline fallback.
  if (url.pathname.startsWith('/wp-admin/')) return;

  const acceptHeader = request.headers.get('Accept') || '';

  // P52-D: Navigation / HTML requests — network-first with shell cache + offline fallback.
  // Previously these returned early (no caching). Now we intercept them to provide
  // an offline-capable app shell.
  if (request.mode === 'navigate' || acceptHeader.includes('text/html')) {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // ── Stale-while-revalidate for public gallery metadata ─────────────────────
  // Must be checked BEFORE the /wp-json/ bail below.
  // Authenticated requests (admin SPA — cookie nonce or JWT bearer) must stay
  // network-first so post-mutation refetches (create/archive/move) never read a
  // stale cached list. Only anonymous public reads fall through to SWR.
  const isAuthenticated =
    request.headers.has('X-WP-Nonce') || request.headers.has('Authorization');
  if (!isAuthenticated && META_ENDPOINT_RE.test(url.pathname)) {
    event.respondWith(handleMetaRequest(event, request));
    return;
  }

  // Admin SPA routes and all remaining /wp-json/ endpoints remain network-only.
  // Mutations are excluded by the request.method !== 'GET' guard above.
  if (url.pathname.startsWith('/wp-json/')) return;

  // Never cache Vite hashed assets — the content hash in the filename
  // already provides perfect cache busting. SW caching these causes
  // stale bundles after deploy.
  if (HASHED_ASSET_RE.test(url.pathname)) return;

  // [P71-D] Uploaded media uses stale-while-revalidate (see UPLOADS_CACHE) so an
  // image edited/regenerated under the same URL is eventually refreshed for
  // returning visitors, rather than served cache-first indefinitely. Everything
  // else (fonts, favicon, other static assets) keeps the cache-first branch below.
  if (UPLOADS_PATH_RE.test(url.pathname)) {
    event.respondWith(handleUploadsRequest(event, request));
    return;
  }

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

/**
 * Network-first handler for navigation (HTML) requests.
 *
 * - Online: fetch from network; on 2xx cache the response for offline use.
 * - Offline/error: serve the cached shell for this exact URL if available,
 *   otherwise serve the inline OFFLINE_HTML fallback.
 *
 * The shell cache name encodes the build hash so a new deploy automatically
 * invalidates it (activate sweeps any wpsg-* name not in the current set).
 */
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      // Fire-and-forget: don't block the response on the cache write.
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(OFFLINE_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/**
 * Stale-while-revalidate handler for the two public metadata endpoints.
 *
 * - Cache hit: respond immediately with stale data; trigger a background
 *   revalidation if the entry is older than META_TTL_MS.
 * - Cache miss: fetch synchronously, cache the result, respond.
 *
 * Timestamps are stored as a custom `x-wpsg-cached-at` header on each cached
 * Response so they survive SW restarts without needing IndexedDB.
 */
async function handleMetaRequest(event, request) {
  const cache = await caches.open(META_CACHE);
  const cached = await cache.match(request);

  const revalidate = async () => {
    try {
      const fresh = await fetch(request.clone());
      if (fresh && fresh.status === 200) {
        const stamped = await stampResponse(fresh);
        await cache.put(request, stamped);
        await evictOldestMetaEntries(cache);
      }
    } catch {
      // Network failure — keep serving stale until connectivity returns.
    }
  };

  if (cached) {
    // Serve stale immediately. Only revalidate in the background when the
    // entry has aged past META_TTL_MS (throttles server hits on hot pages).
    const cachedAt = parseInt(cached.headers.get('x-wpsg-cached-at') || '0', 10);
    const age = Date.now() - cachedAt;
    if (age >= META_TTL_MS) {
      event.waitUntil(revalidate());
    }
    return cached;
  }

  // Cache miss — fetch synchronously so the first load is not degraded.
  try {
    const fresh = await fetch(request.clone());
    if (fresh && fresh.status === 200) {
      const stamped = await stampResponse(fresh.clone());
      await cache.put(request, stamped);
      await evictOldestMetaEntries(cache);
    }
    return fresh;
  } catch {
    return Response.error();
  }
}

/**
 * [P71-D] Stale-while-revalidate handler for /wp-content/uploads/ media.
 *
 * - Cache hit: respond immediately with the cached (possibly stale) asset;
 *   trigger a background revalidation only when the entry is older than
 *   UPLOADS_TTL_MS (throttles image re-downloads on hot pages).
 * - Cache miss: fetch synchronously, cache if eligible, respond.
 *
 * Mirrors handleMetaRequest (same `x-wpsg-cached-at` timestamp mechanism) but
 * uses UPLOADS_CACHE and preserves the original runtime branch's caching guards
 * (200 only, honour `no-store`, skip responses over 5 MB) since uploads are
 * arbitrary binary rather than the trusted small JSON the metadata cache holds.
 */
async function handleUploadsRequest(event, request) {
  const cache = await caches.open(UPLOADS_CACHE);
  const cached = await cache.match(request);

  const revalidate = async () => {
    try {
      const fresh = await fetch(request.clone());
      if (isCacheableUpload(fresh)) {
        const stamped = await stampResponse(fresh);
        await cache.put(request, stamped);
        await evictOldestUploadEntries(cache);
      }
    } catch {
      // Network failure — keep serving stale until connectivity returns.
    }
  };

  if (cached) {
    const cachedAt = parseInt(cached.headers.get('x-wpsg-cached-at') || '0', 10);
    const age = Date.now() - cachedAt;
    if (age >= UPLOADS_TTL_MS) {
      event.waitUntil(revalidate());
    }
    return cached;
  }

  // Cache miss — fetch synchronously so the first load is not degraded.
  try {
    const fresh = await fetch(request);
    if (isCacheableUpload(fresh)) {
      const stamped = await stampResponse(fresh.clone());
      await cache.put(request, stamped);
      await evictOldestUploadEntries(cache);
    }
    return fresh;
  } catch {
    return cached ?? Response.error();
  }
}

/**
 * [P71-D] Caching eligibility for an uploads response — mirrors the guards the
 * original cache-first RUNTIME_CACHE branch applied: cache only 200s, never
 * `no-store`, and skip anything over 5 MB (an absent Content-Length parses as 0
 * and is treated as cacheable, matching the pre-existing behaviour).
 */
function isCacheableUpload(response) {
  if (!response || response.status !== 200) return false;
  const cacheControl = response.headers.get('Cache-Control') || '';
  if (cacheControl.includes('no-store')) return false;
  const contentLength = Number(response.headers.get('Content-Length') || '0');
  if (contentLength > 5 * 1024 * 1024) return false;
  return true;
}

/**
 * [P71-D] FIFO eviction for the uploads cache, mirroring evictOldestMetaEntries
 * but capped at UPLOADS_MAX_ENTRIES. (The pre-fix RUNTIME_CACHE branch had no
 * count cap at all, so this is a strict improvement, not a new limitation.)
 */
async function evictOldestUploadEntries(cache) {
  const keys = await cache.keys();
  if (keys.length <= UPLOADS_MAX_ENTRIES) return;
  const toDelete = keys.slice(0, keys.length - UPLOADS_MAX_ENTRIES);
  await Promise.all(toDelete.map((req) => cache.delete(req)));
}

/**
 * Clones a Response and adds an `x-wpsg-cached-at` timestamp header.
 * Reading the body via arrayBuffer is necessary to reconstruct the Response
 * with modified headers (Headers are immutable on live Response objects).
 */
async function stampResponse(response) {
  const body = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  headers.set('x-wpsg-cached-at', Date.now().toString());
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Evicts the oldest cache entries when META_MAX_ENTRIES is exceeded.
 * Cache.keys() returns entries in insertion order (oldest first) in all major
 * browsers, so this is plain FIFO eviction by first-insertion — re-fetching an
 * existing key does not move it to the tail, so it is not LRU.
 */
async function evictOldestMetaEntries(cache) {
  const keys = await cache.keys();
  if (keys.length <= META_MAX_ENTRIES) return;
  const toDelete = keys.slice(0, keys.length - META_MAX_ENTRIES);
  await Promise.all(toDelete.map((req) => cache.delete(req)));
}
