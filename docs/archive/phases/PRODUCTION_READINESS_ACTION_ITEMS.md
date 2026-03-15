# Production Readiness — Action Items

**Date:** 2026-03-03  
**Reference:** [PRODUCTION_READINESS_EVALUATION.md](PRODUCTION_READINESS_EVALUATION.md)  
**Format:** Prioritized tasks grouped into phases. Each item includes effort estimate, file targets, and acceptance criteria.

---

## Phase A — Release Blockers (Must Fix Before Any Public Release)

### A-1. Harden JWT Token Storage [CRITICAL]

**Problem:** JWT stored in `localStorage` is accessible to any XSS on the page.  
**Effort:** Medium–Large (2–4 days)

**Option 1 (Recommended): Drop JWT for same-origin, use WP nonce-only auth**
- Files: `WpJwtProvider.ts`, `apiClient.ts`, `AuthContext.tsx`, `class-wpsg-rest.php`
- The plugin already sends `X-WP-Nonce` from the shortcode-injected `restNonce` config. For same-origin usage (admin panel, embedded shortcode), WordPress cookie + nonce auth is sufficient and inherently safe from XSS token theft.
- Keep JWT only for documented cross-origin/headless use cases where cookie auth is impossible.
- Remove `localStorage` token storage entirely for the default flow.

**Option 2: In-memory tokens with httpOnly refresh cookie**
- Implement a server-side `/wp-super-gallery/v1/auth/refresh` endpoint
- Store access token in a JavaScript variable (not localStorage), with a 5-minute expiry
- Issue a `httpOnly`, `Secure`, `SameSite=Strict` refresh cookie on login
- On 401, silently refresh before retrying

**Acceptance:** No tokens readable from `localStorage` or `sessionStorage` in the default configuration.

---

### A-2. Set Default Rate Limit on Public Endpoints [CRITICAL]

**Problem:** `apply_filters('wpsg_rate_limit_public', 0)` means no rate limiting unless the site admin explicitly configures it.  
**Effort:** Small (1 hour)

**Files:** `class-wpsg-rest.php` ~L561
```php
// Change from:
$limit = intval(apply_filters('wpsg_rate_limit_public', 0));
// Change to:
$limit = intval(apply_filters('wpsg_rate_limit_public', 60));
```

Also set a per-IP window default of 60 seconds.

**Acceptance:** Out-of-the-box, public endpoints reject requests beyond 60/minute per IP with HTTP 429.

---

### A-3. Sanitize SVG Uploads or Block Them [HIGH]

**Problem:** SVG overlays can contain `<script>` tags and event handlers.  
**Effort:** Small–Medium (2–4 hours)

**Option 1 (Recommended): Block SVGs for overlays**
- File: `class-wpsg-overlay-library.php`
- Remove `image/svg+xml` from the allowed MIME list
- Reject SVGs with a clear error message

**Option 2: Sanitize SVGs**
- Add `enshrined/svg-sanitize` to `composer.json`
- Run uploaded SVGs through the sanitizer before saving
- File: `class-wpsg-overlay-library.php`, `handle_upload()` method

**Acceptance:** SVG files containing `<script>`, `onload`, `<foreignObject>`, or `javascript:` URIs are either rejected or stripped.

---

### A-4. Sanitize Import Payload Deeply [HIGH]

**Problem:** `import_campaign()` bypasses the deep sanitization in `apply_campaign_meta()`.  
**Effort:** Small (2–3 hours)

**File:** `class-wpsg-rest.php`, `import_campaign()` method

**Tasks:**
1. Route `$layout_template['slots']` through `WPSG_Layout_Templates::sanitize_slot()` for each slot
2. Validate `background` structure: type-check keys, `sanitize_text_field` on strings, validate colors/gradients
3. Route `graphicLayers` through the same slot sanitizer (they share the same structure)
4. Route `layoutBinding` through the existing deep-sanitization code from `apply_campaign_meta()`
5. Add unit tests covering import with malicious payloads

**Acceptance:** Import payloads with `<script>`, `javascript:` URIs, or CSS injection values in slots/layers are rejected or sanitized before storage.

---

### A-5. Fix CSS Injection in Layout Templates [HIGH]

**Problem:** `sanitize_text_field()` doesn't prevent CSS injection in `clipPath`, `objectPosition`, `borderColor`.  
**Effort:** Small (2–3 hours)

**File:** `class-wpsg-layout-templates.php` ~L283–287

**Tasks:**
1. `clipPath`: Allow only `polygon(...)`, `circle(...)`, `ellipse(...)`, `inset(...)`, `path(...)`, `none`. Reject anything else.
2. `borderColor`: Validate against hex (`#RGB`, `#RRGGBB`, `#RRGGBBAA`), `rgb()`, `rgba()`, `hsl()`, `hsla()`, named CSS colors, `transparent`, `currentColor`. Reject anything containing `;`, `url(`, `expression(`, `javascript:`.
3. `objectPosition`: Allow only patterns like `center`, `top left`, `50% 50%`, etc. Reject anything containing `;`, `url(`, etc.
4. Create a shared `wpsg_sanitize_css_value($value, $allowed_pattern)` helper.

**Acceptance:** CSS values containing `url()`, `expression()`, `javascript:`, or `;` are rejected.

---

### A-6. Add `sanitize_callback` to All `register_post_meta` Calls [HIGH]

**Problem:** Native WP REST API writes bypass plugin sanitization.  
**Effort:** Small (1–2 hours)

**File:** `class-wpsg-cpt.php` ~L81–125

**Tasks:** For each `register_post_meta` call, add a `sanitize_callback`:
- `media_items`: Validate array structure, `esc_url_raw()` on URLs, `sanitize_text_field()` on strings
- `tags`: `array_map('sanitize_text_field', ...)`
- `cover_image`: `esc_url_raw()`
- `visibility`: Whitelist `['public', 'private']`
- `status`: Whitelist `['draft', 'active', 'archived']`
- `publish_at` / `unpublish_at`: Validate datetime format

Alternatively, set `show_in_rest => false` for fields that should only be writable through custom endpoints and set `auth_callback` on sensitive fields.

**Acceptance:** Writing arbitrary values to campaign meta via `POST /wp/v2/wpsg_campaign/{id}` is either rejected or sanitized.

---

### A-7. Create `uninstall.php` [HIGH]

**Problem:** Plugin leaves all data behind when uninstalled.  
**Effort:** Small–Medium (2–3 hours)

**File:** Create `wp-plugin/wp-super-gallery/uninstall.php`

**Tasks:** Clean up:
1. Custom post types: `wpsg_campaign`, `wpsg_layout_template` — delete all posts and their meta
2. Taxonomies: `wpsg_company` — delete all terms
3. Options: `wpsg_settings`, `wpsg_db_version`, `wpsg_overlay_library`, `wpsg_thumbnail_cache_index`, `wpsg_oembed_provider_failures`, `wpsg_needs_setup`, all transients matching `wpsg_*`
4. Custom tables: `{$prefix}wpsg_analytics_events`
5. Roles/capabilities: Remove `wpsg_admin` role, remove `manage_wpsg` cap from `administrator`
6. Cron hooks: `wpsg_archive_cleanup`, `wpsg_schedule_auto_archive`, `wpsg_thumbnail_cache_cleanup`
7. Uploaded files: `wp-content/uploads/wpsg-thumbnails/` directory
8. Guard with `if (!defined('WP_UNINSTALL_PLUGIN')) exit;`

**Acceptance:** After uninstall, no WPSG-related options, posts, tables, files, or cron hooks remain.

---

### A-8. Add LICENSE File [HIGH]

**Problem:** Blocks WordPress.org plugin directory submission and is legally ambiguous.  
**Effort:** Trivial (15 minutes)

**File:** Create `wp-plugin/wp-super-gallery/LICENSE`

WordPress.org requires GPLv2 or later. Add the standard GPLv2 license text. Also add `License: GPLv2 or later` and `License URI: https://www.gnu.org/licenses/gpl-2.0.html` to the plugin header in `wp-super-gallery.php`.

---

### A-9. Create Modern CI Pipeline [HIGH]

**Problem:** Frontend has zero CI coverage; PHP CI targets wrong PHP versions.  
**Effort:** Medium (3–5 hours)

**Tasks:**
1. Create `.github/workflows/ci.yml` (or update `.circleci/config.yml`) with:

**Frontend jobs:**
- `npm ci` → `eslint .` → `tsc --noEmit` → `vitest run --coverage` → `vite build`
- Playwright E2E against the dev server
- Run on every push/PR

**PHP jobs:**
- Replace PHP 5.6–7.4 matrix with PHP 8.0, 8.1, 8.2, 8.3
- Fix PHPUnit version to match composer.json (`^9.0`)
- Run on every push/PR

2. Add Playwright retries (`retries: 2`) and multi-browser config (Chromium + Firefox)
3. Upload coverage reports as artifacts

**Acceptance:** PRs cannot merge with failing tests, type errors, or lint errors.

---

## Phase B — Should Fix Before Release (Security Hardening & Reliability)

### B-1. Whitelist Props in `parseProps()` [MEDIUM]

**File:** `src/main.tsx` ~L46–53  
**Effort:** Trivial (15 minutes)

```typescript
const ALLOWED_PROPS = new Set(['campaign', 'company']);
// In parseProps():
const raw = JSON.parse(attr);
return Object.fromEntries(
  Object.entries(raw).filter(([k]) => ALLOWED_PROPS.has(k))
);
```

---

### B-2. Fix DNS Rebinding in oEmbed SSRF Protection [MEDIUM]

**File:** `class-wpsg-rest.php` ~L2814–2845  
**Effort:** Medium (3–4 hours)

Use cURL's `CURLOPT_RESOLVE` to pin the resolved IP for the HTTP request, or implement a custom response-phase IP check. If using `wp_remote_get`, add a `pre_http_request` filter that validates the resolved IP.

---

### B-3. Remove Nonce Bypass Filter [MEDIUM]

**File:** `class-wpsg-rest.php` ~L606  
**Effort:** Trivial

Remove `apply_filters('wpsg_require_rest_nonce', true)` or restrict to `WP_DEBUG === true` only.

---

### B-4. Stop Exposing Password Reset URL in API Response [MEDIUM]

**File:** `class-wpsg-rest.php` ~L3083–3090  
**Effort:** Trivial

Return `{ created: true, emailSent: false, message: 'User created. Email delivery failed — please reset password manually.' }` instead of including the reset URL.

---

### B-5. Delete Physical Files on Overlay Removal [MEDIUM]

**File:** `class-wpsg-overlay-library.php` ~L76–83  
**Effort:** Small (30 minutes)

Add `wp_delete_file($entry['local_path'])` or equivalent in the `remove()` method.

---

### B-6. Add Sentry PII Scrubbing [MEDIUM]

**File (JS):** `src/services/monitoring/sentry.ts`  
**File (PHP):** `class-wpsg-sentry.php`  
**Effort:** Small (1–2 hours)

- JS: Add `beforeSend` that strips `Authorization` headers from breadcrumbs
- PHP: Fix `captureMessage` signature — use `Sentry\withScope()` to attach extra context
- PHP: Add `beforeSend` that redacts IP addresses and email addresses

---

### B-7. Set Default Content Security Policy [MEDIUM]

**File:** `wp-super-gallery.php` `wpsg_add_security_headers()`  
**Effort:** Medium (2–3 hours)

Ship a sane default CSP:
```
script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; frame-src https://www.youtube.com https://player.vimeo.com ...
```

Allow customization via the existing `wpsg_csp_header` filter.

---

### B-8. Implement `ErrorBoundary` → Sentry Integration [MEDIUM]

**File:** `src/components/ErrorBoundary.tsx`  
**Effort:** Small (30 minutes)

Add `Sentry.captureException(error)` in `componentDidCatch`. Show a generic message to users in production; include the Sentry event ID for support reference.

---

### B-9. Add Request Timeout to `apiClient` [MEDIUM]

**File:** `src/services/apiClient.ts`  
**Effort:** Small (30 minutes)

Add an `AbortController` with a configurable timeout (default 30s) to all `fetch` calls.

---

### B-10. Whitelist `status`/`visibility` Filter Values [LOW]

**File:** `class-wpsg-rest.php` ~L665–675  
**Effort:** Trivial

```php
$allowed_statuses = ['draft', 'active', 'archived'];
if (!empty($status) && !in_array($status, $allowed_statuses, true)) {
    return new WP_REST_Response(['message' => 'Invalid status filter'], 400);
}
```

---

### B-11. Consistently `encodeURIComponent` Dynamic URL Segments [LOW]

**File:** `src/services/apiClient.ts`  
**Effort:** Small (1 hour)

Audit all methods that interpolate `id` or `templateId` into URL paths. Add `encodeURIComponent()` to each.

---

### B-12. Gate `console.info` Behind DEV Check [LOW]

**File:** `src/services/monitoring/webVitals.ts` ~L39  
**Effort:** Trivial

```typescript
if (import.meta.env.DEV) console.info('[WPSG][Vitals]', metric);
```

---

## Phase C — Performance Optimizations

### C-1. Migrate Layout Templates to CPT Storage [MEDIUM]

**Problem:** Single-row storage in `wp_options` with O(N) reads/writes.  
**Effort:** Large (1–2 days)

The `wpsg_layout_template` CPT already exists. Store each template as a CPT post with slots/background/layers as individual post-meta entries. This eliminates serialization overhead, enables per-template caching, and removes the 512 KB limit.

---

### C-2. Implement Media Usage Reverse Index [MEDIUM]

**Problem:** Full-table scan to find media references.  
**Effort:** Medium (4–6 hours)

Create a `wpsg_media_refs` table with `(media_id, campaign_id)`.  Populate on campaign save/update. Replace the iterative PHP scan with a simple `SELECT campaign_id FROM wpsg_media_refs WHERE media_id = %s`.

---

### C-3. Replace LIKE-based Cache Invalidation [LOW]

**Problem:** 4× `DELETE ... WHERE option_name LIKE '%wpsg_%'` per mutation.  
**Effort:** Small (1–2 hours)

Use a cache-version counter:
```php
$version = intval(get_option('wpsg_cache_version', 1));
// In cache key: include $version
// On mutation: update_option('wpsg_cache_version', $version + 1);
```
Stale keys expire via TTL. No DELETE queries needed.

---

### C-4. Lazy-Load Dockview [LOW]

**Problem:** Dockview bundle loads for all admin users even if they never open the Layout Builder.  
**Effort:** Small (1–2 hours)

Move `LayoutBuilderModal` and its dockview dependency behind `React.lazy()`. The Vite manual chunk for dockview is already separate — just need the dynamic import trigger.

---

### C-5. Async Alert Email Dispatch [LOW]

**Problem:** `wp_mail()` on the hot path.  
**Effort:** Small (1–2 hours)

Queue alerts to a transient or custom table. Dispatch via a 1-minute cron job.

---

### C-6. Shared React Root for Multi-Shortcode [LOW]

**Problem:** Each shortcode creates an independent React tree.  
**Effort:** Medium (3–5 hours)

Mount a single root that discovers all `.wp-super-gallery` elements and renders each as a portal with shared SWR cache and auth.

---

## Phase D — Plugin Directory Preparation

### D-1. Create `readme.txt` (WordPress format) [MEDIUM]

Standard WP plugin directory format with description, installation, FAQ, changelog, screenshots section.

---

### D-2. Add i18n Support [MEDIUM-LARGE]

**PHP:** Wrap all user-facing strings in `__('...', 'wp-super-gallery')`. Generate `.pot` file with `wp i18n make-pot`.  
**JS:** Implement a translation layer (WP's `@wordpress/i18n` or a lightweight alternative).

---

### D-3. Separate Composer Dev Dependencies [TRIVIAL]

Move `phpunit/phpunit` and `yoast/phpunit-polyfills` from `require` to `require-dev`.

---

### D-4. Add Plugin Header Fields [TRIVIAL]

Add to `wp-super-gallery.php`:
```php
 * Tested up to: 6.7
 * Requires at least: 6.0
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wp-super-gallery
 * Domain Path: /languages
```

---

### D-5. Implement Custom Capability Type for CPT [SMALL]

**File:** `class-wpsg-cpt.php`  
Set `capability_type => 'wpsg_campaign'` and map capabilities to prevent Editor-role users from managing campaigns through the native WP admin.

---

## Priority Summary

| Phase | Items | Effort | Blocks Release? |
|-------|-------|--------|----------------|
| **A** | 9 items | ~3–4 dev-days | **Yes** |
| **B** | 12 items | ~2–3 dev-days | Strongly recommended |
| **C** | 6 items | ~3–5 dev-days | No (performance) |
| **D** | 5 items | ~2–3 dev-days | Yes for WP.org submission |

Recommended order: **A → B → D → C**

---

*This document complements [PRODUCTION_READINESS_EVALUATION.md](PRODUCTION_READINESS_EVALUATION.md). Each action item references findings from that evaluation.*
