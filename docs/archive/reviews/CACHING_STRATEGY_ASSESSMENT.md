# Caching Strategy Assessment (Pros/Cons/Security)

This document covers the proposed Phase 8 caching tasks, with their purpose, tradeoffs, and security considerations.

---

## 1) WordPress Transients API (Campaign Data)

### Purpose
Cache expensive campaign queries to reduce DB load and improve response times.

### Pros
- Built‑in WP API
- Easy to invalidate by key
- Compatible with object cache backends (Redis/Memcached)

### Cons
- Requires careful invalidation
- TTL does not guarantee exact eviction time
- Can mask underlying performance issues

### Security Assessment
**Risk level:** Low
- Cache storage is server‑side.
- Must avoid caching user‑specific or permission‑sensitive responses without a per‑user key.

### Notes
- Use versioned keys and invalidate on campaign updates.

---

## 2) Browser Cache Headers for Static Assets

### Purpose
Allow browsers to cache versioned assets for long periods.

### Pros
- Significant performance gains
- Reduces bandwidth
- Stable for immutable build assets

### Cons
- Requires immutable file naming (hashing)
- Misconfigured headers can cause stale UI

### Security Assessment
**Risk level:** Low
- Static assets are public by design.
- Ensure assets are versioned and non‑sensitive.

---

## 3) oEmbed Response Caching (TTL)

### Purpose
Avoid repeated external API calls for preview metadata.

### Pros
- Faster media listing
- Lower latency and fewer third‑party requests
- Reduced rate‑limit risk

### Cons
- Stale thumbnails/titles until TTL expires
- Requires storage and invalidation strategy

### Security Assessment
**Risk level:** Medium
- Must sanitize cached HTML/text to avoid XSS.
- Cache by URL and strip unsafe markup.

---

## 4) ETag Support for Media Resources

### Purpose
Enable conditional requests (304 Not Modified) for media endpoints.

### Pros
- Saves bandwidth
- Reduces server response time
- Compatible with browser caches

### Cons
- Requires consistent ETag generation
- Extra logic in responses

### Security Assessment
**Risk level:** Low
- Ensure ETag values are not derived from sensitive data.

---

## 5) Cache Invalidation on Campaign Updates

### Purpose
Ensure stale data is purged when content changes.

### Pros
- Prevents stale UI
- Ensures real‑time accuracy

### Cons
- Easy to miss an update path
- Requires discipline across endpoints

### Security Assessment
**Risk level:** Low
- Stale data may expose outdated permissions if mis‑scoped.
- Use per‑user or per‑visibility keys.

---

## 6) Redis/Memcached (Optional)

### Purpose
High‑traffic deployments benefit from an object cache backend.

### Pros
- Massive performance improvements for cache hits
- Centralized cache store

### Cons
- Additional infrastructure and ops
- Requires monitoring and eviction policies

### Security Assessment
**Risk level:** Medium
- Secure cache access and avoid exposing cache ports.
- Enforce auth or network isolation.

---

## Summary

Caching provides large performance wins but introduces correctness and security risks if invalidation and scoping are not precise. The safest path is:

1. Start with static asset caching + Transients for public data.
2. Add cache invalidation hooks on update/delete.
3. Add oEmbed caching with aggressive sanitization.
4. Consider ETags and object cache backend for scale.

---

## Verification Checklist

Use the steps below to validate caching behavior across layers.

### A) Browser asset cache
1. Open DevTools → Network.
2. Reload once to populate cache.
3. Reload again and verify static assets return **(from disk cache)** or **(from memory cache)**.
	- Chromium/Brave: right‑click the Network header and enable the **Size** column. Cached assets show **(from disk cache)** or **(from memory cache)** in **Size**.
	- Firefox: cached assets show **cached** in **Transferred** and/or **Size**.
4. Confirm `Cache-Control: public, max-age=31536000, immutable` on plugin assets.

### B) Transients (campaign list + permissions)
1. Request `/wp-json/wp-super-gallery/v1/campaigns` twice with the same parameters.
2. Confirm the second response is faster and server logs show reduced DB activity.
3. Update a campaign (create/update/archive) and repeat the request.
4. Confirm the cache is invalidated and fresh data is returned.

### C) oEmbed caching
1. Call `/wp-json/wp-super-gallery/v1/oembed?url=...` with a valid URL.
2. Call it again and verify the response is fast and consistent.
3. Optionally inspect `wp_options` for the transient key `wpsg_oembed_*`.

### D) ETag validation
1. Call `/wp-json/wp-super-gallery/v1/campaigns/{id}/media` or `/media/library` and note the `ETag` response header.
2. Repeat the request with `If-None-Match` set to the same ETag.
	- If your client doesn’t add `If-None-Match`, you’ll always receive **200**.
3. Confirm the response returns **304 Not Modified** when the ETag matches.

### E) Cache TTL / expiry
1. In WP Admin → WPSG Settings, set **Cache Duration** to a short value (e.g., 10–30 seconds).
2. Request `/wp-json/wp-super-gallery/v1/campaigns` twice to warm the cache.
3. Wait for TTL to pass.
4. Update a campaign (title/visibility) and call the endpoint again.
5. Confirm the response reflects the change (new data after TTL expiry).

### F) Regression checks
- Access isolation:
	1. Log in as User A, request `/campaigns`.
	2. Log in as User B, request `/campaigns`.
	3. Verify each user only sees permitted campaigns.
- Anonymous visibility:
	1. Log out and request `/campaigns`.
	2. Verify only public campaigns are returned.
- Invalidation:
	1. Create/update/archive a campaign.
	2. Re‑request `/campaigns` and confirm the change is visible.
