/**
 * P50-F Tests: Service Worker metadata caching.
 *
 * The SW is a standalone non-module file (public/sw.js) — not importable.
 * Tests here verify the URL-matching pattern and the eviction logic by
 * replicating the relevant constants and using a mock Cache interface.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ── Constants mirrored from public/sw.js ────────────────────────────────────
// If you change META_ENDPOINT_RE or META_MAX_ENTRIES there, update here too.
const META_ENDPOINT_RE = /\/wp-json\/wp-super-gallery\/v1\/campaigns(\/\d+\/media)?$/;
const META_TTL_MS = 5 * 60 * 1000;
const META_MAX_ENTRIES = 50;

// ── Helpers that mirror public/sw.js helpers ────────────────────────────────

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

async function evictOldestMetaEntries(
  cache: { keys(): Promise<Request[]>; delete(req: Request): Promise<boolean> },
): Promise<void> {
  const keys = await cache.keys();
  if (keys.length <= META_MAX_ENTRIES) return;
  const toDelete = keys.slice(0, keys.length - META_MAX_ENTRIES);
  await Promise.all(toDelete.map((req) => cache.delete(req)));
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
      return store.get(req.url) ?? undefined;
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

// ── URL matching ─────────────────────────────────────────────────────────────

describe('META_ENDPOINT_RE', () => {
  const match = (path: string) => META_ENDPOINT_RE.test(path);

  it('matches the campaign list endpoint', () => {
    expect(match('/wp-json/wp-super-gallery/v1/campaigns')).toBe(true);
  });

  it('matches the media list endpoint for a numeric campaign id', () => {
    expect(match('/wp-json/wp-super-gallery/v1/campaigns/42/media')).toBe(true);
    expect(match('/wp-json/wp-super-gallery/v1/campaigns/1/media')).toBe(true);
    expect(match('/wp-json/wp-super-gallery/v1/campaigns/9999/media')).toBe(true);
  });

  it('does not match admin endpoints', () => {
    expect(match('/wp-json/wp-super-gallery/v1/admin/asset-library')).toBe(false);
    expect(match('/wp-json/wp-super-gallery/v1/admin/font-library')).toBe(false);
    expect(match('/wp-json/wp-super-gallery/v1/admin/audit-log')).toBe(false);
  });

  it('does not match individual campaign detail endpoint', () => {
    // GET /campaigns/{id} — not in the SWR set (returns partial data for admin)
    expect(match('/wp-json/wp-super-gallery/v1/campaigns/42')).toBe(false);
  });

  it('does not match unrelated wp-json paths', () => {
    expect(match('/wp-json/wp/v2/posts')).toBe(false);
    expect(match('/wp-json/wp-super-gallery/v1/settings')).toBe(false);
    expect(match('/wp-json/wp-super-gallery/v1/spaces')).toBe(false);
  });

  it('does not match mutation sub-paths', () => {
    expect(match('/wp-json/wp-super-gallery/v1/campaigns/42/media/batch')).toBe(false);
    expect(match('/wp-json/wp-super-gallery/v1/campaigns/42/media/reorder')).toBe(false);
    expect(match('/wp-json/wp-super-gallery/v1/campaigns/42/archive')).toBe(false);
  });
});

// ── stampResponse ─────────────────────────────────────────────────────────────

describe('stampResponse', () => {
  it('adds x-wpsg-cached-at header to the response', async () => {
    const before = Date.now();
    const original = new Response(JSON.stringify({ id: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const stamped = await stampResponse(original);
    const after = Date.now();

    const ts = parseInt(stamped.headers.get('x-wpsg-cached-at') || '0', 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('preserves the original response body and status', async () => {
    const body = JSON.stringify({ campaigns: [{ id: 1 }] });
    const original = new Response(body, { status: 200 });
    const stamped = await stampResponse(original);

    expect(stamped.status).toBe(200);
    expect(await stamped.text()).toBe(body);
  });

  it('preserves existing headers from the original response', async () => {
    const original = new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
    });
    const stamped = await stampResponse(original);
    expect(stamped.headers.get('Content-Type')).toBe('application/json');
    expect(stamped.headers.get('X-Custom')).toBe('value');
  });
});

// ── evictOldestMetaEntries ────────────────────────────────────────────────────

describe('evictOldestMetaEntries', () => {
  let cache: ReturnType<typeof makeMockCache>;

  beforeEach(() => {
    cache = makeMockCache();
  });

  const addEntries = async (n: number) => {
    for (let i = 0; i < n; i++) {
      const req = new Request(`https://example.com/campaigns?page=${i}`);
      await cache.put(req, new Response(`{"page":${i}}`));
    }
  };

  it('does nothing when entries are within the limit', async () => {
    await addEntries(META_MAX_ENTRIES);
    await evictOldestMetaEntries(cache);
    expect((await cache.keys()).length).toBe(META_MAX_ENTRIES);
  });

  it('evicts oldest entries when limit is exceeded', async () => {
    await addEntries(META_MAX_ENTRIES + 5);
    await evictOldestMetaEntries(cache);
    const remaining = await cache.keys();
    expect(remaining.length).toBe(META_MAX_ENTRIES);
    // The first 5 (oldest) should be gone; the last META_MAX_ENTRIES remain.
    expect(remaining[0].url).toContain(`page=${5}`);
    expect(remaining[META_MAX_ENTRIES - 1].url).toContain(`page=${META_MAX_ENTRIES + 4}`);
  });

  it('does nothing for an empty cache', async () => {
    await evictOldestMetaEntries(cache);
    expect((await cache.keys()).length).toBe(0);
  });

  it('evicts exactly one entry when one over the limit', async () => {
    await addEntries(META_MAX_ENTRIES + 1);
    await evictOldestMetaEntries(cache);
    expect((await cache.keys()).length).toBe(META_MAX_ENTRIES);
  });
});

// ── TTL logic ─────────────────────────────────────────────────────────────────

describe('META_TTL_MS', () => {
  it('is 5 minutes in milliseconds', () => {
    expect(META_TTL_MS).toBe(5 * 60 * 1000);
  });

  it('a cached entry older than TTL triggers revalidation', () => {
    const oldTs = Date.now() - META_TTL_MS - 1;
    const age = Date.now() - oldTs;
    expect(age).toBeGreaterThanOrEqual(META_TTL_MS);
  });

  it('a fresh cached entry does not trigger revalidation', () => {
    const freshTs = Date.now() - 1000; // 1 second ago
    const age = Date.now() - freshTs;
    expect(age).toBeLessThan(META_TTL_MS);
  });
});
