# Phase 14 — Security Hardening, Admin Features & Infrastructure

**Status:** 🔧 In Progress  
**Version:** v0.12.0  
**Created:** February 22, 2026  
**Last updated:** February 22, 2026

---

## Overview

Phase 14 addresses all Critical and High findings from the pre-Phase 14 codebase review, adds admin UI settings opportunities, and promotes several infrastructure features from the backlog. Seven tracks are organized by domain:

1. **P14-A — Security & Correctness Hardening** ⬜ NOT STARTED
2. **P14-B — React DRY + Admin UI Settings** ⬜ NOT STARTED
3. **P14-C — External Thumbnail Cache** ⬜ NOT STARTED
4. **P14-D — oEmbed Monitoring & Rate Limiting** ⬜ NOT STARTED
5. **P14-E — Admin Health & Metrics Dashboard** ⬜ NOT STARTED
6. **P14-F — Image Optimization on Upload** ⬜ NOT STARTED
7. **P14-G — Media & Campaign Tagging** ⬜ NOT STARTED

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

## Track P14-A — Security & Correctness Hardening  🔧 IN PROGRESS

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

- [ ] **B-1:** Remove internal endpoint URLs from public oEmbed error response (`attempts` array)  
  **File:** `class-wpsg-rest.php` L1886–1893  
  **Fix:** Remove `attempts` from response, or gate behind `current_user_can('manage_options')`

- [ ] **B-2:** Add allowlist validation for `status` and `visibility` meta values  
  **File:** `class-wpsg-rest.php` L3140–3145  
  **Fix:** `in_array($status, ['draft','active','archived'], true)` — reject unknown values

- [ ] **B-4:** Move CORS `Allow-Methods` / `Allow-Headers` inside origin allowlist check  
  **File:** `wp-super-gallery.php` L135–136  
  **Fix:** Emit only when origin matches allowed list

- [ ] **B-5:** Gate `simulateEmailFailure` testing backdoor behind `WP_DEBUG`  
  **File:** `class-wpsg-rest.php` L2002–2003  
  **Fix:** `if (defined('WP_DEBUG') && WP_DEBUG)` guard, or remove entirely

- [ ] **B-6:** Sanitize `$_SERVER['REQUEST_URI']` in embed handler  
  **File:** `class-wpsg-embed.php` L51  
  **Fix:** `sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI']))`

- [ ] **B-7:** Validate DDL identifiers in `ensure_index()` to prevent latent SQL injection  
  **File:** `class-wpsg-db.php` L49  
  **Fix:** Regex validation `[a-zA-Z0-9_]+` for `$index_name` and `$columns_sql`

**Effort:** Medium  
**Impact:** Critical — security and correctness

---

## Track P14-B — React DRY + Admin UI Settings  ⬜ NOT STARTED

### Problem

The settings-to-defaults mapping is copy-pasted across 3 files (80+ fields × 3 = 240+ lines of redundant mapping). Additionally, several UX-relevant values are hardcoded with no admin control.

### Deliverables

#### Settings DRY (B-8)

- [ ] Create `mergeSettingsWithDefaults(partial: Partial<SettingsResponse>): GalleryBehaviorSettings` utility
- [ ] Replace all 3 duplicate mapping sites (`App.tsx` ×2, `SettingsPanel.tsx`) with the utility
- [ ] Add unit tests for `mergeSettingsWithDefaults`

#### Admin UI Settings (E-1 through E-5)

- [ ] **E-1:** Add `galleryTitle` and `gallerySubtitle` string settings with TextInput controls  
  **Currently hardcoded in:** `CardGallery.tsx` L200–201

- [ ] **E-2:** Add `loadMoreBatchSize` numeric setting (currently hardcoded `LOAD_MORE_SIZE = 12`)  
  **Currently hardcoded in:** `CardGallery.tsx` L52

- [ ] **E-3:** Add `cardLockedOpacity` numeric setting (currently hardcoded `0.75`)  
  **Currently hardcoded in:** `CampaignCard.tsx` L48

- [ ] **E-4:** Add `uploadMaxFileSize` setting (currently hardcoded `50 MB`)  
  **Currently hardcoded in:** `App.tsx`, `MediaTab.tsx`  
  **Note:** Should align with WordPress `upload_max_filesize` — consider server-reported default

- [ ] **E-5:** Add `campaignAboutHeading` string setting (currently hardcoded `"About this Campaign"`)  
  **Currently hardcoded in:** `CampaignViewer.tsx` L183  
  **Note:** Important for white-label deployments

**Full stack per setting:** PHP REST defaults/persistence → React `SettingsResponse` type → `SettingsPanel` control → consuming component

**Effort:** Medium  
**Impact:** Medium — improves DRY compliance and admin flexibility

---

## Track P14-C — External Thumbnail Cache  ⬜ NOT STARTED

### Problem

External media thumbnails (oEmbed/video) are fetched directly from third-party services on every page load. This creates reliability issues (if external service is down) and performance concerns (no local caching).

### Deliverables

- [ ] Server-side thumbnail fetch and storage on campaign save/media add
- [ ] Serve cached local variants via WordPress media library or custom directory
- [ ] Add refresh/expiry strategy (configurable TTL, manual refresh in admin)
- [ ] Fallback to direct external URL if cache miss or fetch failure
- [ ] Optional CDN support via WordPress `wp_get_attachment_url` filter chain
- [ ] Admin UI: cache status indicator per media item, bulk refresh action

**Effort:** Medium  
**Impact:** Medium — reliability and performance for external media

---

## Track P14-D — oEmbed Monitoring & Rate Limiting  ⬜ NOT STARTED

### Problem

oEmbed proxy failures are counted (`wpsg_oembed_failure_count`) but not surfaced to admins. No rate limiting exists for public proxy usage, risking abuse.

### Deliverables

#### Failure Monitoring

- [ ] Track per-provider failure counts and timestamps
- [ ] Add admin dashboard widget showing failure trend (last 24h / 7d / 30d)
- [ ] Alert threshold: surface warning banner when sustained failure rate exceeds configurable limit
- [ ] Include last error message per provider for debugging

#### Rate Limiting

- [ ] Add configurable rate limit for public oEmbed proxy endpoint (requests per IP per minute)
- [ ] Use WordPress transients for lightweight rate tracking (no external deps)
- [ ] Return `429 Too Many Requests` with `Retry-After` header on limit breach
- [ ] Surface rate limit status/configuration in admin settings
- [ ] Exempt authenticated admins from rate limits

**Effort:** Medium  
**Impact:** Medium — operational visibility and abuse prevention

---

## Track P14-E — Admin Health & Metrics Dashboard  ⬜ NOT STARTED

### Problem

Admins have no visibility into system health, API performance, or operational metrics. Diagnosing issues requires server log access.

### Deliverables

#### Health Dashboard

- [ ] REST API error rate and latency snapshots (last 24h)
- [ ] Media storage usage summary (file count, total size, by type)
- [ ] Cache hit/miss rates (transient cache, thumbnail cache)
- [ ] oEmbed provider status (up/degraded/down per provider)
- [ ] Links to relevant WordPress diagnostics (Site Health, error logs)
- [ ] Auto-refresh with configurable interval

#### Metrics & Alerting

- [ ] Integrate monitoring hooks with dashboard summaries
- [ ] Configurable alert thresholds (error rate, response time, storage)
- [ ] Email notification option for critical alerts
- [ ] Support external monitoring integration (webhook/JSON export)

**Effort:** Medium–High  
**Impact:** Medium — operational visibility and proactive monitoring

---

## Track P14-F — Image Optimization on Upload  ⬜ NOT STARTED

### Problem

Uploaded images are stored at original resolution and file size. Large images slow down gallery rendering and increase storage costs.

### Deliverables

- [ ] Auto-generate optimized variants on upload (thumbnail, medium, large)
- [ ] Configurable max dimensions and quality settings in admin
- [ ] WebP conversion option (with fallback for unsupported browsers)
- [ ] Preserve original file as archive, serve optimized version by default
- [ ] Integration with WordPress image sizes system (`add_image_size()`)
- [ ] Progress feedback during optimization (for large batch uploads)
- [ ] Respect WordPress `upload_max_filesize` and server memory limits

**Effort:** Medium  
**Impact:** Medium — performance and storage efficiency

---

## Track P14-G — Media & Campaign Tagging  ⬜ NOT STARTED

### Problem

Media items and campaigns have no tagging/categorization beyond the company taxonomy. Admins cannot filter, search, or organize content by custom labels.

### Deliverables

#### Media Tagging

- [ ] Add `wpsg_media_tag` taxonomy (non-hierarchical) for media items
- [ ] Tag CRUD in admin media tab (add/remove/autocomplete)
- [ ] Filter media list by tags
- [ ] Bulk tag assignment in media management
- [ ] Tag display on media items in gallery (optional, setting-controlled)

#### Campaign Tagging

- [ ] Add `wpsg_campaign_tag` taxonomy (non-hierarchical) for campaigns
- [ ] Tag CRUD in campaign edit modal
- [ ] Filter campaign list by tags in admin
- [ ] Tag-based filtering in public gallery view (optional)
- [ ] REST API support for tag-based queries

**Design decision:** Evaluate whether media tags and campaign tags should share a single taxonomy or remain separate. Separate taxonomies provide cleaner semantics; shared taxonomy reduces admin overhead. Recommend separate unless there's a clear cross-domain use case.

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
