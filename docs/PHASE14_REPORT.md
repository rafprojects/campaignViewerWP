# Phase 14 — Security Hardening, Admin Features & Infrastructure

**Status:** ✅ Complete  
**Version:** v0.12.0  
**Created:** February 22, 2026  
**Last updated:** February 22, 2026

---

## Overview

Phase 14 addresses all Critical and High findings from the pre-Phase 14 codebase review, adds admin UI settings opportunities, and promotes several infrastructure features from the backlog. Seven tracks are organized by domain:

1. **P14-A — Security & Correctness Hardening** ✅ COMPLETE
2. **P14-B — React DRY + Admin UI Settings** ✅ COMPLETE
3. **P14-C — External Thumbnail Cache** ✅ COMPLETE
4. **P14-D — oEmbed Monitoring & Rate Limiting** ✅ COMPLETE
5. **P14-E — Admin Health & Metrics Dashboard** ✅ COMPLETE
6. **P14-F — Image Optimization on Upload** ✅ COMPLETE
7. **P14-G — Media & Campaign Tagging** ✅ COMPLETE

### Sources

- **Codebase Review:** `docs/PRE_PHASE14_CODEBASE_REVIEW.md` (53 findings)
- **Backlog:** `docs/FUTURE_TASKS.md` (7 promoted items)

### Pre-Addressed Items

Two findings from the codebase review were already fixed during PR review before Phase 14 began:

| Finding | Fix | Commit |
|---------|-----|--------|
| A-3: SQL `esc_like` in cron handler | `$wpdb->esc_like()` added, both `_transient_` + `_transient_timeout_` cleared | `6901f12` |
| B-3: `publishAt`/`unpublishAt` date validation | `strtotime()` validation + `gmdate('Y-m-d H:i:s')` normalization on write | `6901f12` |

---

## Track P14-A — Security & Correctness Hardening  ✅ COMPLETE

### Problem

The codebase review identified 3 remaining Critical bugs and 6 remaining High-severity security/correctness issues across the PHP plugin and React frontend.

### Deliverables

#### Critical Fixes

- [x] **A-1:** Delete dead code (Odysee handler remnant) inside `can_view_campaign()` guard block  
  **File:** `class-wpsg-rest.php` L573–578 — Deleted lines 575–577

- [x] **A-2:** Fix undefined `WPSG_CPT::POST_TYPE` constant — PHP Fatal Error on `rescan_all_media_types()`  
  **File:** `class-wpsg-cpt.php` — Added `const POST_TYPE = 'wpsg_campaign';`, refactored all internal references to use `self::POST_TYPE`

- [x] **A-4:** Fix `campaignsRows` useMemo stale closure — archive/restore states never update visually  
  **File:** `AdminPanel.tsx` — Added all captured identifiers to dependency array, wrapped `handleEdit` in `useCallback`

#### High-Severity Fixes

- [x] **B-1:** Remove internal endpoint URLs from public oEmbed error response (`attempts` array)  
  **File:** `class-wpsg-rest.php` — Removed `attempts` from fallback response object

- [x] **B-2:** Add allowlist validation for `status` and `visibility` meta values  
  **File:** `class-wpsg-rest.php` — Added `in_array()` validation with 400 error on invalid values; callers check return and roll back on create

- [x] **B-4:** Move CORS `Allow-Methods` / `Allow-Headers` inside origin allowlist check  
  **File:** `wp-super-gallery.php` — Headers now only emitted when origin matches

- [x] **B-5:** Gate `simulateEmailFailure` testing backdoor behind `WP_DEBUG`  
  **File:** `class-wpsg-rest.php` — `defined('WP_DEBUG') && WP_DEBUG` guard added

- [x] **B-6:** Sanitize `$_SERVER['REQUEST_URI']` in embed handler  
  **File:** `class-wpsg-embed.php` — Added `sanitize_text_field(wp_unslash(...))`

- [x] **B-7:** Validate DDL identifiers in `ensure_index()` to prevent latent SQL injection  
  **File:** `class-wpsg-db.php` — Added regex validation for `$index_name` and `$columns_sql`

**Effort:** Medium  
**Impact:** Critical — security and correctness

---

## Track P14-B — React DRY + Admin UI Settings  ✅ COMPLETE

### Problem

The settings-to-defaults mapping is copy-pasted across 3 files (80+ fields × 3 = 240+ lines of redundant mapping). Additionally, several UX-relevant values are hardcoded with no admin control.

### Deliverables

#### Settings DRY (B-8)

- [x] Created `mergeSettingsWithDefaults()` utility in `src/utils/mergeSettingsWithDefaults.ts`
- [x] Replaced all 3 duplicate mapping sites (`App.tsx` ×2, `SettingsPanel.tsx`) — ~240 lines removed
- [x] PHP side: `to_js()`/`from_js()` helpers, deleted 586 lines of triplicated mapping

#### Admin UI Settings (E-1 through E-5)

- [x] **E-1–E-5 & 65+ more:** All hardcoded values surfaced as configurable settings behind `advancedSettingsEnabled` toggle. ~70 new fields added across PHP defaults, TS types, SettingsResponse, and SettingsPanel Advanced tab UI.

**Full stack per setting:** PHP REST defaults/persistence → React `SettingsResponse` type → `SettingsPanel` control → consuming component

**Effort:** Medium  
**Impact:** Medium — improves DRY compliance and admin flexibility

---

## Track P14-C — External Thumbnail Cache  ✅ COMPLETE

### Problem

External media thumbnails (oEmbed/video) are fetched directly from third-party services on every page load. This creates reliability issues (if external service is down) and performance concerns (no local caching).

### Deliverables

- [x] `WPSG_Thumbnail_Cache` class: download/cache/cleanup/refresh to `wp-content/uploads/wpsg-thumbnails/`
- [x] Hooked `wpsg_oembed_success` for automatic caching; daily cron cleanup
- [x] REST endpoints: `GET /admin/thumbnail-cache` (stats), `DELETE` (clear), `POST .../refresh`
- [x] Configurable `thumbnail_cache_ttl` setting (default 86400 s)

**Effort:** Medium  
**Impact:** Medium — reliability and performance for external media

---

## Track P14-D — oEmbed Monitoring & Rate Limiting  ✅ COMPLETE

### Problem

oEmbed proxy failures are counted (`wpsg_oembed_failure_count`) but not surfaced to admins. No rate limiting exists for public proxy usage, risking abuse.

### Deliverables

- [x] `WPSG_Rate_Limiter`: per-IP transient-based rate limiting (30 req/60 s, admins exempt), 429 + Retry-After
- [x] `WPSG_Monitoring` extended: per-provider oEmbed failure tracking with recent timestamps
- [x] `get_health_data()` aggregation: REST request/error counts, oEmbed failures, campaign stats, storage, PHP/WP info
- [x] REST endpoints: `GET /admin/health`, `GET|DELETE /admin/oembed-failures`

**Effort:** Medium  
**Impact:** Medium — operational visibility and abuse prevention

---

## Track P14-E — Admin Health & Metrics Dashboard  ✅ COMPLETE

### Problem

Admins have no visibility into system health, API performance, or operational metrics. Diagnosing issues requires server log access.

### Deliverables

- [x] Health data served via `GET /admin/health` — aggregated from `WPSG_Monitoring::get_health_data()`
- [x] Includes REST error rate, oEmbed failures by provider, campaign counts by status, storage stats, thumbnail cache stats, PHP/WP versions
- [x] Further frontend dashboard widget deferred to future phase

**Effort:** Medium–High  
**Impact:** Medium — operational visibility and proactive monitoring

---

## Track P14-F — Image Optimization on Upload  ✅ COMPLETE

### Problem

Uploaded images are stored at original resolution and file size. Large images slow down gallery rendering and increase storage costs.

### Deliverables

- [x] `WPSG_Image_Optimizer` class: hooks `wp_handle_upload`, auto-resize/compress via GD
- [x] Settings: `optimize_on_upload`, `optimize_max_width`, `optimize_max_height`, `optimize_quality`, `optimize_webp_enabled`
- [x] Controls surfaced in Advanced Settings tab under Upload / Media section

**Effort:** Medium  
**Impact:** Medium — performance and storage efficiency

---

## Track P14-G — Media & Campaign Tagging  ✅ COMPLETE

### Problem

Media items and campaigns have no tagging/categorization beyond the company taxonomy. Admins cannot filter, search, or organize content by custom labels.

### Deliverables

- [x] `wpsg_campaign_tag` and `wpsg_media_tag` non-hierarchical taxonomies registered in `WPSG_CPT`
- [x] REST endpoints: `GET /tags/campaign`, `GET /tags/media` (admin only)
- [x] Decided: separate taxonomies for cleaner semantics

**Effort:** Medium  
**Impact:** Medium — organization and discoverability

---

## Execution Priority

| Priority | Track | Rationale |
|----------|-------|-----------|
| 1 | P14-A — Security Hardening | Criticals must be fixed immediately |
| 2 | P14-B — React DRY + Settings | Unblocks clean settings work for all tracks |
| 3 | P14-D — oEmbed Monitoring | Addresses existing race condition (C-7) alongside |
| 4 | P14-C — External Thumbnail Cache | Reliability improvement |
| 5 | P14-G — Media & Campaign Tagging | New feature, medium complexity |
| 6 | P14-F — Image Optimization | New feature, integration with WP media |
| 7 | P14-E — Admin Health Dashboard | Largest scope, best done after other infra |

---

## Version Plan

- **v0.12.0** — Phase 14 complete
- Bump after all tracks are verified and tests pass

---

*Document created: February 22, 2026*
