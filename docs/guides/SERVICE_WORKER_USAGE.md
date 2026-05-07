# Service Worker Usage & Assessment

This document explains the purpose, benefits, tradeoffs, and security considerations for the service worker added in Phase 8.

---

## Purpose

The service worker provides **offline support** and **asset caching** by caching same‑origin GET requests. It improves:

- Repeat visit performance
- Resilience for transient network errors
- Perceived speed (cache hits for static assets)

---

## Current Implementation

File: [public/sw.js](../public/sw.js)

Behavior summary:
- **Install:** initializes runtime cache and activates immediately.
- **Activate:** clears older WPSG caches.
- **Fetch:** cache‑first strategy for same‑origin GET requests.

Registration happens in [src/main.tsx](../src/main.tsx) in production builds.

---

## Pros

- **Faster repeat visits** via cache hits
- **Resilient UI** when network is flaky
- **Simple runtime cache** without extra build tooling
- **Scoped to same origin** only

---

## Cons / Tradeoffs

- **Stale assets possible** until cache invalidation
- **Debug complexity** (browser caches and SW lifecycle)
- **Potential for cache bloat** if unbounded requests are cached
- **More state to manage** across updates

---

## Security Assessment

**Scope & risk level:** Low to Medium

Key points:
- SW only intercepts **same‑origin** GET requests.
- No caching of cross‑origin resources.
- No caching of POST/PUT/DELETE requests.
- If a cached asset is compromised (e.g., server breach), it persists until cache clear or SW update.

Mitigations:
- Keep assets versioned and use `CACHE_VERSION` bump on releases.
- Clear caches on activate (already implemented).
- Limit caching for API responses if added later (prefer stale‑while‑revalidate for JSON).

---

## Operational Guidance

- **Release updates:** bump `CACHE_VERSION` when large asset changes are deployed.
- **Debugging:** in DevTools → Application → Service Workers → "Unregister" or "Update".
- **Local dev:** SW is disabled in dev builds.

---

## Future Enhancements (Optional)

- Pre‑cache critical shell assets for instant offline load.
- Add stale‑while‑revalidate for API GET responses.
- Add cache size limits (LRU eviction) to prevent growth.

---

## Summary

Service workers improve performance and resilience but require cache lifecycle discipline. The current implementation is minimal, safe by default, and can be extended if needed.
