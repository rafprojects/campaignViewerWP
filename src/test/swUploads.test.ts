/**
 * [P71-D] Tests: Service Worker stale-while-revalidate for uploaded media.
 *
 * The SW is a standalone non-module file (public/sw.js) — not importable — so,
 * exactly like swMeta.test.ts, these tests REPLICATE the relevant constants and
 * handler logic and exercise them against a mock Cache / fetch / event.
 *
 * If you change UPLOADS_PATH_RE, UPLOADS_TTL_MS, UPLOADS_MAX_ENTRIES,
 * isCacheableUpload, evictOldestUploadEntries, or handleUploadsRequest in
 * public/sw.js, mirror the change here too.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Constants mirrored from public/sw.js ────────────────────────────────────
const UPLOADS_PATH_RE = /\/wp-content\/uploads\//;
const UPLOADS_TTL_MS = 60 * 60 * 1000; // 1 hour
const UPLOADS_MAX_ENTRIES = 100;

// ── Helpers mirrored from public/sw.js ──────────────────────────────────────

async function stampResponse(response: Response): Promise<Response> {
  const body = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  headers.set('x-wpsg-cached-at', Date.now().toString());
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isCacheableUpload(response: Response | undefined): boolean {
  if (!response || response.status !== 200) return false;
  const cacheControl = response.headers.get('Cache-Control') || '';
  if (cacheControl.includes('no-store')) return false;
  const contentLength = Number(response.headers.get('Content-Length') || '0');
  if (contentLength > 5 * 1024 * 1024) return false;
  return true;
}

type MockCache = {
  keys(): Promise<Request[]>;
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
  delete(req: Request): Promise<boolean>;
};

async function evictOldestUploadEntries(cache: MockCache): Promise<void> {
  const keys = await cache.keys();
  if (keys.length <= UPLOADS_MAX_ENTRIES) return;
  const toDelete = keys.slice(0, keys.length - UPLOADS_MAX_ENTRIES);
  await Promise.all(toDelete.map((req) => cache.delete(req)));
}

type MockEvent = { waitUntil: (p: Promise<unknown>) => void };

// Mirrors handleUploadsRequest in public/sw.js, with `caches.open` and `fetch`
// injected so the test can control them.
async function handleUploadsRequest(
  event: MockEvent,
  request: Request,
  cache: MockCache,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const cached = await cache.match(request);

  const revalidate = async () => {
    try {
      const fresh = await fetchImpl(request.clone());
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

  try {
    const fresh = await fetchImpl(request);
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

// ── Mock Cache ───────────────────────────────────────────────────────────────

function makeMockCache() {
  const store = new Map<string, Response>();
  const order: Request[] = [];

  return {
    store,
    order,
    async keys() {
      return [...order];
    },
    async match(req: Request) {
      // Real Cache returns a fresh clone each call so the body is re-readable;
      // mirror that so a stale-serve + later assertion don't fight over one body.
      const hit = store.get(req.url);
      return hit ? hit.clone() : undefined;
    },
    async put(req: Request, res: Response) {
      if (!store.has(req.url)) order.push(req);
      store.set(req.url, res);
    },
    async delete(req: Request) {
      const existed = store.has(req.url);
      store.delete(req.url);
      const idx = order.findIndex((r) => r.url === req.url);
      if (idx !== -1) order.splice(idx, 1);
      return existed;
    },
  };
}

function makeMockEvent() {
  const waits: Promise<unknown>[] = [];
  return {
    waitUntil: (p: Promise<unknown>) => {
      waits.push(p);
    },
    settle: () => Promise.all(waits),
  };
}

// ── UPLOADS_PATH_RE ────────────────────────────────────────────────────────

describe('UPLOADS_PATH_RE', () => {
  const match = (path: string) => UPLOADS_PATH_RE.test(path);

  it('matches uploaded media paths', () => {
    expect(match('/wp-content/uploads/2026/01/photo.jpg')).toBe(true);
    expect(match('/wp-content/uploads/gallery/thumb-150x150.png')).toBe(true);
  });

  it('matches uploads under a subdirectory install', () => {
    expect(match('/blog/wp-content/uploads/2026/01/photo.jpg')).toBe(true);
  });

  it('does not match non-upload static assets or API routes', () => {
    expect(match('/wp-content/themes/x/style.css')).toBe(false);
    expect(match('/wp-content/plugins/wp-super-gallery/font.woff2')).toBe(false);
    expect(match('/fonts/roboto.woff2')).toBe(false);
    expect(match('/wp-json/wp-super-gallery/v1/campaigns')).toBe(false);
  });
});

// ── isCacheableUpload ──────────────────────────────────────────────────────

describe('isCacheableUpload', () => {
  it('caches a plain 200 response', () => {
    expect(isCacheableUpload(new Response('img', { status: 200 }))).toBe(true);
  });

  it('treats an absent Content-Length as cacheable (parses to 0)', () => {
    const res = new Response('img', { status: 200 });
    expect(res.headers.get('Content-Length')).toBeNull();
    expect(isCacheableUpload(res)).toBe(true);
  });

  it('rejects non-200 responses', () => {
    expect(isCacheableUpload(new Response('nope', { status: 404 }))).toBe(false);
    expect(isCacheableUpload(new Response('', { status: 500 }))).toBe(false);
  });

  it('respects no-store', () => {
    const res = new Response('img', {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
    expect(isCacheableUpload(res)).toBe(false);
  });

  it('skips responses larger than 5 MB', () => {
    const res = new Response('img', {
      status: 200,
      headers: { 'Content-Length': String(6 * 1024 * 1024) },
    });
    expect(isCacheableUpload(res)).toBe(false);
  });

  it('rejects an undefined response', () => {
    expect(isCacheableUpload(undefined)).toBe(false);
  });
});

// ── handleUploadsRequest — the SWR flow ────────────────────────────────────

describe('handleUploadsRequest', () => {
  let cache: ReturnType<typeof makeMockCache>;
  const url = 'https://example.test/wp-content/uploads/2026/01/photo.jpg';

  beforeEach(() => {
    cache = makeMockCache();
  });

  const seed = async (body: string, ageMs: number) => {
    const stamped = await stampResponse(new Response(body, { status: 200 }));
    // Override the just-written timestamp to simulate a given age.
    const headers = new Headers(stamped.headers);
    headers.set('x-wpsg-cached-at', String(Date.now() - ageMs));
    const buf = await stamped.arrayBuffer();
    await cache.put(new Request(url), new Response(buf, { status: 200, headers }));
  };

  it('serves a fresh cached asset without revalidating', async () => {
    await seed('OLD', 1000); // 1s old, well under the 1h TTL
    const fetchImpl = vi.fn();
    const event = makeMockEvent();

    const res = await handleUploadsRequest(event, new Request(url), cache, fetchImpl as unknown as typeof fetch);

    expect(await res.text()).toBe('OLD');
    await event.settle();
    expect(fetchImpl).not.toHaveBeenCalled(); // fresh → no background fetch
  });

  it('serves the stale asset immediately, then revalidates so a later request sees the update [P71-D]', async () => {
    await seed('OLD', UPLOADS_TTL_MS + 1000); // stale (older than the TTL)
    const fetchImpl = vi.fn(async () => new Response('NEW', { status: 200 }));
    const event = makeMockEvent();

    // First request returns the stale content immediately.
    const first = await handleUploadsRequest(event, new Request(url), cache, fetchImpl as unknown as typeof fetch);
    expect(await first.text()).toBe('OLD');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // background revalidation started

    // Let the background revalidation finish writing the fresh response.
    await event.settle();

    // A subsequent request now serves the updated content — the exact property
    // the pre-fix cache-first-forever branch failed (it never refreshed).
    const event2 = makeMockEvent();
    const second = await handleUploadsRequest(event2, new Request(url), cache, fetchImpl as unknown as typeof fetch);
    expect(await second.text()).toBe('NEW');
  });

  it('fetches synchronously and caches on a cache miss', async () => {
    const fetchImpl = vi.fn(async () => new Response('FRESH', { status: 200 }));
    const event = makeMockEvent();

    const res = await handleUploadsRequest(event, new Request(url), cache, fetchImpl as unknown as typeof fetch);

    expect(await res.text()).toBe('FRESH');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Now cached (stamped) for next time.
    const cached = cache.store.get(url);
    expect(cached?.headers.get('x-wpsg-cached-at')).toBeTruthy();
  });

  it('does not cache a non-200 miss response', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 404 }));
    const event = makeMockEvent();

    const res = await handleUploadsRequest(event, new Request(url), cache, fetchImpl as unknown as typeof fetch);

    expect(res.status).toBe(404);
    expect(cache.store.has(url)).toBe(false);
  });
});

// ── evictOldestUploadEntries ────────────────────────────────────────────────

describe('evictOldestUploadEntries', () => {
  let cache: ReturnType<typeof makeMockCache>;

  beforeEach(() => {
    cache = makeMockCache();
  });

  const addEntries = async (n: number) => {
    for (let i = 0; i < n; i++) {
      await cache.put(
        new Request(`https://example.test/wp-content/uploads/img-${i}.jpg`),
        new Response(`img-${i}`),
      );
    }
  };

  it('does nothing when within the limit', async () => {
    await addEntries(UPLOADS_MAX_ENTRIES);
    await evictOldestUploadEntries(cache);
    expect((await cache.keys()).length).toBe(UPLOADS_MAX_ENTRIES);
  });

  it('evicts the oldest entries when the limit is exceeded', async () => {
    await addEntries(UPLOADS_MAX_ENTRIES + 3);
    await evictOldestUploadEntries(cache);
    const remaining = await cache.keys();
    expect(remaining.length).toBe(UPLOADS_MAX_ENTRIES);
    expect(remaining[0].url).toContain('img-3'); // first 3 (oldest) evicted
  });
});
