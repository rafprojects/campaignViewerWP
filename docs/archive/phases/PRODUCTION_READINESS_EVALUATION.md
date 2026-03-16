# Production Readiness Evaluation — WP Super Gallery v0.17.0

**Date:** 2026-03-03  
**Scope:** Full-stack evaluation covering the WordPress PHP plugin and the React SPA  
**Verdict:** **Not yet production-ready.** Several HIGH-severity security issues and infrastructure gaps must be resolved before public release.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Security Audit](#2-security-audit)
   - [2.1 PHP / WordPress Backend](#21-php--wordpress-backend)
   - [2.2 React SPA Frontend](#22-react-spa-frontend)
   - [2.3 Authentication & Session Management](#23-authentication--session-management)
   - [2.4 Cross-Cutting Security Concerns](#24-cross-cutting-security-concerns)
3. [Performance & Efficiency](#3-performance--efficiency)
   - [3.1 Server-Side (PHP)](#31-server-side-php)
   - [3.2 Client-Side (React)](#32-client-side-react)
   - [3.3 Caching Strategy](#33-caching-strategy)
4. [Architecture & Code Quality](#4-architecture--code-quality)
5. [Test Coverage & CI/CD](#5-test-coverage--cicd)
6. [Plugin Directory & Distribution Readiness](#6-plugin-directory--distribution-readiness)
7. [Feature Implementation Review](#7-feature-implementation-review)
8. [Risk Matrix](#8-risk-matrix)

---

## 1. Executive Summary

WP Super Gallery (v0.17.0, Phase 19) is a feature-rich WordPress plugin combining a PHP REST backend with a React SPA rendered inside Shadow DOM. The project demonstrates strong engineering discipline — strict TypeScript, SWR-based data fetching, comprehensive settings management, and thoughtful security measures including rate limiting, SSRF protection, and CORS controls.

**However, the following blockers prevent a production release:**

| # | Category | Issue | Severity |
|---|----------|-------|----------|
| 1 | Security | JWT tokens stored in `localStorage` — accessible to any XSS | **CRITICAL** |
| 2 | Security | SVG uploads allow stored XSS — no sanitization | **HIGH** |
| 3 | Security | `import_campaign()` writes nested JSON to DB unsanitized | **HIGH** |
| 4 | Security | CSS injection via `clipPath`, `objectPosition`, `borderColor` in layout templates | **HIGH** |
| 5 | Security | No `sanitize_callback` on `register_post_meta` — native WP REST writes bypass plugin sanitization | **HIGH** |
| 6 | Infrastructure | No frontend CI pipeline — 68+ test files never run in CI | **HIGH** |
| 7 | Infrastructure | CircleCI tests PHP 5.6–7.4 but project targets PHP 8.3 | **HIGH** |
| 8 | Distribution | No `uninstall.php` — plugin leaves data behind on removal | **HIGH** |
| 9 | Distribution | No LICENSE file — blocks plugin directory submission | **HIGH** |

Additionally, 12 MEDIUM-severity and 15+ LOW-severity issues were identified. Full details follow.

---

## 2. Security Audit

### 2.1 PHP / WordPress Backend

#### CRITICAL: Rate Limiting Defaults to Disabled

**File:** `class-wpsg-rest.php` ~L561  
**Issue:** `rate_limit_public()` calls `apply_filters('wpsg_rate_limit_public', 0)`. When the limit is `0`, rate limiting is completely bypassed (`$limit <= 0 → return true`). This means endpoints like `/analytics/event`, `/campaigns`, `/oembed`, `/settings` (GET), and `/access-requests` (POST) are **fully open to abuse** out-of-the-box.

**Impact:** An attacker can:
- Flood the analytics table with garbage data
- Enumerate all public campaigns without throttling
- Spam access requests to trigger admin notification fatigue
- Abuse the oEmbed proxy as an SSRF relay

**Fix:** Set a sensible default (e.g., `60` requests/minute) instead of `0`.

---

#### HIGH: Unsanitized Nested JSON in `import_campaign()`

**File:** `class-wpsg-rest.php` ~L1170–1189  
**Issue:** The import path stores `slots`, `background`, `graphicLayers`, and `layoutBinding` directly from untrusted JSON into `post_meta` without any sanitization:
```php
update_post_meta($tmpl_id, 'slots', $layout_template['slots'] ?? []);
update_post_meta($tmpl_id, 'background', $layout_template['background'] ?? []);
update_post_meta($tmpl_id, 'graphic_layers', $layout_template['graphicLayers'] ?? []);
```

Compare with `apply_campaign_meta()` (~L3663–3689) which deeply validates `layoutBinding` with type checks, `sanitize_text_field`, `intval`, and `floatval`. The import path bypasses all of that.

**Impact:** Stored XSS via malicious CSS values, or data corruption via unexpected types.

**Fix:** Route imported layout data through the same deep-sanitization pipeline as `apply_campaign_meta()` and `WPSG_Layout_Templates::sanitize_slot()`.

---

#### HIGH: SVG Upload Allows Stored XSS

**File:** `class-wpsg-overlay-library.php` ~L101–105  
**Issue:** SVG files are accepted as overlay uploads. WordPress's `wp_handle_upload()` does **not** sanitize SVG content — inline `<script>`, `onload` attributes, and `<foreignObject>` tags pass through unmodified. No SVG sanitization library is used.

**Impact:** An admin uploads a malicious SVG (or is social-engineered into doing so). Any user viewing a campaign with that overlay executes arbitrary JavaScript.

**Fix:** Integrate `enshrined/svg-sanitize` (used by WordPress.com) or reject SVG uploads entirely and require raster formats for overlays.

---

#### HIGH: CSS Injection in Layout Templates

**File:** `class-wpsg-layout-templates.php` ~L283–287  
**Issue:** `clipPath`, `objectPosition`, and `borderColor` values are sanitized with `sanitize_text_field()`, which strips HTML tags but does **not** validate CSS values. An attacker with admin access can inject arbitrary CSS:
```
clipPath: url("data:image/svg+xml,...<script>...</script>...")
borderColor: red; background-image: url(//evil.com/beacon)
```

**Impact:** CSS-based data exfiltration, UI redressing, or triggering external resource loads.

**Fix:** Implement a CSS value allowlist — only permit known `clip-path` functions (`polygon`, `circle`, `ellipse`, `inset`, `path`) and validate color values against a hex/rgb/named-color pattern.

---

#### HIGH: Missing `sanitize_callback` on `register_post_meta`

**File:** `class-wpsg-cpt.php` ~L81–125  
**Issue:** All 8 `register_post_meta()` calls specify `show_in_rest => true` with schema types but no `sanitize_callback`. Because the CPT has `show_in_rest => true`, the native WordPress REST API (`/wp/v2/wpsg_campaign`) accepts writes to these meta fields from any user with `edit_posts` capability — bypassing the plugin's custom endpoint sanitization.

**Impact:** An Editor-role user can write arbitrary URLs to `media_items`, `cover_image`, or malicious values to `tags` via the native WP REST API.

**Fix:** Add `sanitize_callback` to each `register_post_meta` call, or set `show_in_rest => false` for fields that should only be writable through the plugin's custom endpoints.

---

#### MEDIUM: DNS Rebinding in oEmbed SSRF Protection

**File:** `class-wpsg-rest.php` ~L2814–2845  
**Issue:** DNS resolution for SSRF checks occurs before the actual HTTP request. An attacker controlling DNS can return a public IP on the first lookup (passes the check) and a private IP on the second lookup (when `wp_remote_get` runs).

**Fix:** Pin the resolved IP for the HTTP request using cURL's `CURLOPT_RESOLVE`, or re-validate the IP in the response phase.

---

#### MEDIUM: Nonce Verification Can Be Globally Disabled

**File:** `class-wpsg-rest.php` ~L606  
`apply_filters('wpsg_require_rest_nonce', true)` — any plugin can disable CSRF protection for all admin REST endpoints.

**Fix:** Remove this filter or restrict it to development environments only.

---

#### MEDIUM: `create_user()` Exposes Password Reset URL

**File:** `class-wpsg-rest.php` ~L3083–3090  
When email delivery fails, the password reset URL (including reset key) is returned in the JSON response. If response logging is enabled, this single-use credential leaks.

**Fix:** Return only a boolean indicating whether the user was created plus a generic message about the email failure. Never include the reset key in API responses.

---

#### MEDIUM: Overlay `remove()` Does Not Delete Files

**File:** `class-wpsg-overlay-library.php` ~L76–83  
Removing an overlay entry from the library does not delete the physical file from disk. Orphaned files remain accessible via their URL if guessed.

**Fix:** Delete the physical file in `remove()`, or implement a cleanup routine.

---

#### LOW: `list_campaigns()` Allows Arbitrary Filter Values

**File:** `class-wpsg-rest.php` ~L665–675  
`status` and `visibility` in meta_query accept any `sanitize_text_field()`'d string rather than being validated against the known enum values (`draft`, `active`, `archived` and `public`, `private`).

**Fix:** Whitelist-validate before building the meta_query.

---

### 2.2 React SPA Frontend

#### HIGH: No Prop Whitelisting in `parseProps()`

**File:** `src/main.tsx` ~L46–53  
`data-wpsg-props` is parsed from the DOM attribute via `JSON.parse()` and spread directly as React props. If an attacker can inject or modify the HTML attribute (e.g., via a reflected XSS elsewhere in the WordPress page), they can inject arbitrary top-level props into the `<App>` component.

**Fix:** Define an explicit allowlist of expected keys (`campaign`, `company`) and filter parsed props.

---

#### MEDIUM: `dangerouslySetInnerHTML` Usage

**File:** `src/components/Admin/MediaAddModal.tsx` (oEmbed HTML preview)  
The oEmbed HTML response is sanitized with DOMPurify before rendering — this is correct. However, DOMPurify's default configuration still allows `<iframe>` tags (required for oEmbed). Ensure the DOMPurify config explicitly restricts allowed tags/attributes if the preview doesn't need full iframe support.

---

#### LOW: Error Messages Expose Internal Details

**Files:** `App.tsx` ~L132, `ErrorBoundary.tsx` ~L48  
Server error messages and exception messages are rendered directly in the UI. If the API returns verbose error details (file paths, stack traces), they're visible to end users.

**Fix:** Show generic messages in production; log details to Sentry.

---

#### LOW: `console.info` in Production

**File:** `src/services/monitoring/webVitals.ts` ~L39  
`console.info('[WPSG][Vitals]', ...)` runs unconditionally in production.

**Fix:** Gate behind `import.meta.env.DEV`.

---

### 2.3 Authentication & Session Management

#### CRITICAL: JWT Stored in `localStorage`

**File:** `src/services/auth/WpJwtProvider.ts` ~L52  
The JWT access token is stored in `localStorage.setItem('wpsg_access_token', token)`. Shadow DOM with `mode: 'open'` does NOT provide a security boundary — any script on the page can read `localStorage`.

**Impact:** A single XSS vulnerability anywhere on the WordPress page (from any plugin, theme, or injected ad) gives an attacker the JWT token and full API access as the victim user.

**Comparison to best practice:** WordPress core uses `httpOnly` cookie-based authentication for exactly this reason. The WP REST API nonce system (which this plugin also supports) is inherently safer because it requires cookie access that JavaScript cannot read.

**Fix options (ordered by security benefit):**
1. **Best:** Migrate to `httpOnly` cookie-based auth. Use the WP nonce (`X-WP-Nonce`) as the sole auth mechanism for same-origin requests. Drop JWT for the admin panel entirely.
2. **Good:** Keep JWT but store tokens in-memory only (not `localStorage`). Implement a server-side refresh endpoint that issues short-lived tokens (5-min expiry) with a `httpOnly` refresh cookie.
3. **Minimum:** Keep the current setup but enforce a strict Content Security Policy that limits `script-src` to known origins, reducing XSS surface.

---

#### MEDIUM: Client-Side Role/Permissions Tampering

**File:** `src/services/auth/WpJwtProvider.ts` ~L58–62, L128–135  
User role and permissions are cached in `localStorage`. An attacker can edit `wpsg_user` to set `role: 'admin'` and `wpsg_permissions` to include `manage_wpsg`. While the server correctly rejects unauthorized requests, the **admin UI becomes fully visible**, revealing feature names, endpoint URLs, and admin-only settings structure.

**Fix:** Never cache role/permissions in `localStorage`. Fetch from the server on each session init.

---

#### MEDIUM: No Token Refresh Mechanism

**File:** `src/services/auth/WpJwtProvider.ts`  
Once a JWT expires, the user is silently logged out with no refresh flow. For long admin sessions, this causes data loss if an unsaved form is open.

**Fix:** Implement a refresh token endpoint or, better, migrate to cookie-based auth where sessions are managed server-side.

---

### 2.4 Cross-Cutting Security Concerns

| Concern | Status | Notes |
|---------|--------|-------|
| `ABSPATH` check in all PHP files | ✅ Pass | Every PHP file starts with the guard |
| Input sanitization on writes | ✅ Mostly pass | `create_campaign`, `update_campaign`, `create_media` all use `sanitize_text_field`, `wp_kses_post`, `esc_url_raw` correctly. **Exception:** import path (see §2.1) |
| SQL injection protection | ✅ Pass | All raw queries use `$wpdb->prepare()` or `$wpdb->insert()` with format specifiers |
| Capability checks on admin endpoints | ✅ Pass | All admin routes require `manage_wpsg` via `permission_callback` |
| CORS configuration | ✅ Pass | Strict allowlist via `wpsg_cors_allowed_origins` filter, `Vary: Origin` header set |
| Security headers | ✅ Pass | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` all set |
| Content Security Policy | ⚠️ Partial | CSP header is supported via filter but defaults to empty string (disabled). Ship with a default CSP. |
| File upload validation | ✅ Pass (media), ⚠️ Fail (overlays) | `upload_media()` has thorough MIME/size/content checks. `upload_overlay()` delegates entirely to overlay library without visible validation. |
| XSS on output (PHP) | ✅ Pass | All REST responses use `WP_REST_Response` (JSON-encoded). Shortcode output uses `esc_attr()`, `wp_json_encode()`. |
| XSS on output (React) | ✅ Mostly pass | React's JSX escaping handles most cases. `dangerouslySetInnerHTML` is DOMPurify-gated in 1 location. |
| Sentry PII scrubbing | ❌ Fail | No `beforeSend` hook in either PHP or JS Sentry init. JWT tokens may leak to Sentry via breadcrumbs. |

---

## 3. Performance & Efficiency

### 3.1 Server-Side (PHP)

| Area | Assessment | Details |
|------|------------|---------|
| Campaign list caching | ✅ Good | Transient-based caching with configurable TTL, cache invalidation on mutations |
| Slow-request logging | ✅ Good | `log_slow_rest()` tracks response times |
| DB indexes | ✅ Good | Composite indexes on `postmeta(post_id, meta_key)` and `termmeta(term_id, meta_key)` |
| Analytics table design | ✅ Good | Dedicated table with composite index on `(campaign_id, occurred_at)` |
| **Layout template storage model** | ⚠️ Concern | All templates stored in a single `wp_options` row (up to 512 KB). `get_all()` loads every template for any single-template read. `check_size_limit()` serializes all templates on every write. O(N) on reads and writes. |
| **Media usage tracking** | ⚠️ Concern | `get_media_usage()` and `get_media_usage_summary()` both load ALL campaigns (`posts_per_page => -1`) and iterate all media items in PHP. On a site with 1000+ campaigns × 50+ media each, this is a full table scan + PHP loop of ~50K items per request. |
| **Campaign cache invalidation** | ⚠️ Concern | `clear_accessible_campaigns_cache()` runs 4× `DELETE FROM wp_options WHERE option_name LIKE '%wpsg_...'` queries. `LIKE` with wildcards on `wp_options` does a full table scan on every campaign mutation. |
| **Alert emails on hot path** | ⚠️ Concern | `wp_mail()` is called synchronously inside the REST response lifecycle when the error threshold fires. SMTP latency directly adds to HTTP response time. |

### 3.2 Client-Side (React)

| Area | Assessment | Details |
|------|------------|---------|
| Code splitting | ✅ Good | Admin panel lazy-loaded via `React.lazy()`, vendor chunks split (React, Mantine, Icons, Dockview) |
| SWR caching | ✅ Good | Deduplication interval, `isValidating` guards, ETag support |
| Shadow DOM CSS | ⚠️ Concern | All CSS (Mantine core + 6 style modules) inlined into JS as a string literal. Each shadow root gets its own `<style>` tag with the full ~100KB+ CSS. Multiple shortcode instances multiply this cost. |
| Dockview bundle | ⚠️ Concern | Dockview is in a separate chunk but **not** lazy-loaded — it loads on first admin view even if the Layout Builder is never opened. |
| **No request cancellation** | ⚠️ Minor | No `AbortController` usage. Navigation during long requests can cause stale state updates. |
| **Multiple React roots** | ⚠️ Concern | Each `.wp-super-gallery` element creates an independent React tree, SWR cache, auth provider, and Mantine provider. Pages with multiple shortcodes pay the full initialization cost N times. |

### 3.3 Caching Strategy

| Layer | Implementation | Assessment |
|-------|---------------|------------|
| PHP transients | Per-query campaign caching, configurable TTL (default 1h) | ✅ Solid |
| ETag support | MD5-based ETags on campaign list responses | ✅ Good |
| Thumbnail caching | Local proxy cache with configurable TTL, cron cleanup | ✅ Good |
| oEmbed caching | 6h success cache, 5-min failure cache | ✅ Good |
| Static asset caching | `Cache-Control: public, max-age=31536000, immutable` for build assets | ✅ Excellent |
| Browser caching | No `Cache-Control` headers on REST API responses beyond ETag | ⚠️ Could add `max-age` for public campaign data |

---

## 4. Architecture & Code Quality

| Area | Assessment |
|------|------------|
| **TypeScript strictness** | ✅ `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` |
| **PHP coding standards** | ✅ PHPCS configured in CI (WordPress standards) |
| **Component decomposition** | ✅ App.tsx reduced from 808→346 lines; AdminPanel from 1168→390 lines (P18-J) |
| **Separation of concerns** | ✅ Clean layering: contexts → hooks → components; services isolated |
| **Error boundaries** | ✅ Present at root level with graceful fallback UI |
| **A11y** | ⚠️ No `eslint-plugin-jsx-a11y` configured. Error messages auto-dismiss after 4s (may be too fast for screen readers) |
| **Internationalization** | ❌ No `__()` / `_e()` usage in PHP. No `react-intl` or equivalent in frontend. All strings are hardcoded English. |
| **Custom Post Type capabilities** | ⚠️ Uses default `post` capability type. An Editor role can manage campaigns via the native WP admin. |
| **PHP Sentry integration** | ❌ Incorrect `captureMessage` signature — third argument is silently ignored. Context/extra data never reaches Sentry. |
| **JS Sentry integration** | ⚠️ Initialized but never explicitly called. No `captureException` in ErrorBoundary. |

---

## 5. Test Coverage & CI/CD

### Test Inventory

| Suite | Files | Tests | Framework |
|-------|-------|-------|-----------|
| Frontend unit | 68 | ~300+ | Vitest + Testing Library |
| PHP unit | 12 | 117 (303 assertions) | PHPUnit 9 + WP test harness |
| E2E | 4 | ~25 scenarios | Playwright (mocked API only) |

### Coverage Thresholds vs Actual

| Metric | Threshold | Last Reported | Status |
|--------|-----------|---------------|--------|
| Lines | 75% | ~76.4% | ⚠️ Tight margin |
| Functions | 65% | 79.91% | ✅ Healthy |
| Branches | 72% | ~65.1% (P18) | ❌ Likely below threshold |
| Statements | 75% | ~79.8% | ✅ OK |

### Critical Gaps

1. **No frontend CI pipeline.** The 68+ test files and E2E specs are only enforced via local pre-commit hooks (`husky`). Any contributor who uses `--no-verify` bypasses all gates.

2. **CircleCI is severely outdated.** Tests PHP 5.6–7.4 with PHPUnit 5.7, but the project targets PHP 8.3 with PHPUnit 9. The CI images are deprecated.

3. **~25 components lack tests**, including `LayoutBuilderModal` (the layout builder orchestrator) and `CampaignsTab` (bulk action logic).

4. **E2E tests are mock-only** — no live-WordPress integration tests. Only Chromium is tested (no Firefox/Safari).

5. **No live-server E2E tests** — the mocked E2E tests validate UI behavior but cannot catch server-side regressions, CORS issues, or auth flow problems.

---

## 6. Plugin Directory & Distribution Readiness

| Requirement | Status | Notes |
|-------------|--------|-------|
| `uninstall.php` | ❌ Missing | Plugin registers options, post types, taxonomies, custom DB tables, transients, uploaded files, and cron hooks — none are cleaned up on uninstall |
| LICENSE file | ❌ Missing | Required for WordPress.org submission |
| `readme.txt` (WP format) | ❌ Missing | Required for plugin directory listing |
| Tested up to WP version | ❌ Not declared | Must be in plugin header or `readme.txt` |
| Minimum WP version | ❌ Not declared | |
| Composer `require-dev` separation | ❌ Mixed | PHPUnit and polyfills are in `require`, not `require-dev` |
| PHP autoloader | ⚠️ Manual | Uses manual `require_once` — functional but fragile |
| Version consistency | ⚠️ Check | Plugin header, `WPSG_VERSION` constant, and `package.json` all say `0.17.0` — ✅ consistent |
| i18n / l10n | ❌ None | No text domain, no `.pot` file, no `__()` calls |
| Multisite compatibility | ⚠️ Untested | No `is_multisite()` guards, but CI does test `WP_MULTISITE=1` |
| REST API prefix | ✅ Good | Uses dedicated namespace `wp-super-gallery/v1` |
| Admin menu integration | ✅ Good | Settings page registered via `WPSG_Settings::init()` |

---

## 7. Feature Implementation Review

### Features That Would Benefit from Alternative Approaches

#### Layout Template Storage → CPT Migration

**Current:** All templates stored in a single `wp_options` row as a serialized array.  
**Problem:** O(N) reads ands writes, concurrency issues, 512 KB size limit.  
**Better:** Store each template as a `wpsg_layout_template` Custom Post Type entry (the CPT is already registered!) with meta for slots, background, and graphic layers. This gives you WP_Query filtering, individual caching, and no serialization bottleneck.

#### Media Usage Tracking → Meta Index

**Current:** Full-table scan of all campaigns + PHP iteration to find media references.  
**Better:** Maintain a reverse index in a custom table (`wpsg_media_refs`) with columns `(media_id, campaign_id)`, updated on campaign save. Queries become simple JOINs.

#### Campaign Cache Invalidation → Targeted Deletion

**Current:** `DELETE FROM wp_options WHERE option_name LIKE '%wpsg_campaigns_%'` (4 LIKE queries per mutation).  
**Better:** Use a single cache-version counter in a transient. Increment the counter on mutation; include the counter value in cache keys. Stale keys expire naturally via TTL. Zero DELETE queries needed.

#### Alert Emails → Async Dispatch

**Current:** `wp_mail()` called synchronously inside the REST response lifecycle.  
**Better:** Queue alerts to a transient or custom table, dispatch via a 1-minute cron job.

#### Multi-Shortcode → Shared React Root

**Current:** Each `.wp-super-gallery` element gets its own React tree.  
**Better:** Mount a single React root that manages all gallery instances via a shared context. Each shortcode element becomes a portal target. This shares SWR cache, auth state, and reduces initialization overhead.

---

## 8. Risk Matrix

### Summary by Severity

| Severity | Count | Blocks Release? |
|----------|-------|----------------|
| CRITICAL | 2 | **Yes** |
| HIGH | 7 | **Yes** |
| MEDIUM | 12 | Recommended before release |
| LOW | 15+ | Can follow in post-release patches |
| INFO | 5+ | Nice-to-have improvements |

### Critical + High Items (Release Blockers)

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| S-1 | CRITICAL | Auth | JWT in `localStorage` — XSS = full account takeover |
| S-2 | CRITICAL | Rate Limit | Public endpoints have no rate limit by default |
| S-3 | HIGH | Security | SVG overlay uploads allow stored XSS |
| S-4 | HIGH | Security | `import_campaign()` stores unsanitized nested JSON |
| S-5 | HIGH | Security | CSS injection in layout template `clipPath`/`borderColor`/`objectPosition` |
| S-6 | HIGH | Security | `register_post_meta` has no `sanitize_callback` — native WP REST bypass |
| I-1 | HIGH | CI/CD | No frontend CI pipeline |
| I-2 | HIGH | CI/CD | PHP CI tests wrong versions (5.6–7.4 vs target 8.3) |
| D-1 | HIGH | Distribution | No `uninstall.php` |
| D-2 | HIGH | Distribution | No LICENSE file |

---

*See [PRODUCTION_READINESS_ACTION_ITEMS.md](PRODUCTION_READINESS_ACTION_ITEMS.md) for prioritized, actionable remediation steps.*
