# Future Tasks & Enhancements

This document tracks deferred and exploratory work remaining. Items promoted to active phase execution are moved into dedicated phase reports and removed from this backlog.

## 2026-05-19 Evaluation Matrix

Cross-checked against current code, current phase reports, and archived Phase 28 implementation work. Rows marked `Remove` are intentionally not repeated in the backlog sections below.

The broader second-pass cleanup also removed additional shipped Phase 28 backlog items outside the original estimate, including campaign templates and access audit export, reframed duplicate detection to the remaining near-duplicate work, and retired stale non-backlog entries such as secondary admin code-splitting and deferred review item `D-8`.

A later cleanup pass also removed detailed backlog entries queued into Phase 38 so this document remains a true long-tail and exploratory backlog.

| Estimated item | Current code status | Decision | Phase / note |
|----------------|---------------------|----------|--------------|
| Access Totals Summary UI | Shipped in P28-J: REST endpoint and admin query/UI are live | Remove | Historical trace: Phase 28 |
| Magic-Link Auto-Approval | Shipped in P28-I: single-use expiring approval links are live | Remove | Historical trace: Phase 28 |
| Media Sorting Controls | P28-M shipped order/title/created sorts; file-size and usage-count remain | Reframe | Promote residual work to Phase 34 |
| Hierarchical Campaign Categories | Shipped in P28-Q/P28-R: hierarchical taxonomy plus selector UI are live | Remove | Historical trace: Phase 28 |
| WAF Rules | Deployment hardening guidance only; not product-phase work | Reject | Keep as prune/reference material |
| Time-Limited Access Grants | Shipped in P28-B: expiry fields, admin UI, and cleanup path are live | Remove | Historical trace: Phase 28 |
| Campaign Analytics — Extended Scope | P28-H shipped per-media analytics, cross-campaign summary, and hook-based extensibility; live refresh remains | Reframe | Promote residual work to Phase 34 |
| Role-Based Access Levels | Not started; current auth/access model is still binary | Promote | New Phase 33 |
| Structured Logging & Metrics Integration | Monitoring and alerting exist; structured operator logs do not | Reframe | Promote logging work to Phase 32 |

---

## Current Ownership Snapshot

### Recently promoted and now phase-owned

| Item | Why it was promoted | Owning phase doc |
|------|---------------------|------------------|
| Per-campaign RBAC | Largest remaining access-control gap; current grant/auth model is still binary | [PHASE33_REPORT.md](PHASE33_REPORT.md) |
| Structured server-side logging | Monitoring exists, but operators still lack durable structured logs and an admin-visible sink | [PHASE32_REPORT.md](PHASE32_REPORT.md) |
| Analytics live refresh | Core analytics shipped; the remaining UX gap is stale data during long admin sessions | [PHASE34_REPORT.md](PHASE34_REPORT.md) |
| Advanced media sort follow-up | Core sorting shipped; file-size and usage-count ordering still have real admin value | [PHASE34_REPORT.md](PHASE34_REPORT.md) |
| Webhook support for campaign events | P39-IN1 shipped endpoint management, HMAC-signed delivery, retry queue, and WP-CLI commands | [PHASE39_REPORT.md](PHASE39_REPORT.md) |
| Object-cache guidance and health surface | P39-OC1 shipped Redis/APCu/Memcached docs, health endpoint, warm_settings(), and TTL policy constants | [PHASE39_REPORT.md](PHASE39_REPORT.md) |

These items are intentionally not repeated in the backlog sections below.

### Prune candidates (retained for reference; not actively pursued)

| Item | Why it is a prune candidate |
|------|-----------------------------|
| URL-based image input re-enable | Security-heavy convenience feature; upload-only already covers the core workflow |
| WAF Rules | Deployment-specific documentation, not a product phase track |
| Secondary admin code-splitting | The obvious lazy-load wins already shipped; do more only when profiling shows a real cost |
| Third-party OAuth providers | High maintenance and product ambiguity without a clear deployment demand signal |
| GraphQL API alternative | High maintenance cost with unclear near-term ROI |
| Progressive Web App support | Service-worker foundation already exists; revisit only if there is a concrete offline/mobile deployment requirement |

---

## Builder

### URL-Based Image Inputs (Mask, Overlay, Background)

**Context:** All URL-based image inputs (paste URL for mask, overlay library, background image) were disabled in Phase 20 and replaced with upload-only workflows. This simplifies the security surface (no external URL fetching, no CORS issues, no SSRF risk) and keeps all assets in the WP media library.

**What was removed:**
- `SlotPropertiesPanel`: "Paste mask URL…" TextInput for adding masks, editable URL field for existing masks.
- `LayoutBuilderMediaPanel`/`AssetUploader`: URL TextInput for graphic layer library and background image sections.
- `LayoutBuilderModal`: `handleAddUrlToLibrary()` callback that POSTed external URLs to the overlay-library endpoint.
- `BuilderDockContext`: `handleAddUrlToLibrary` from the shared context interface.

**To re-enable (if needed):**
- `AssetUploader.onUrlSubmit` is already optional — simply pass the callback to re-show the URL TextInput.
- For masks, restore the TextInput in `SlotPropertiesPanel` mask section and the URL editing field.
- Add server-side URL validation and proxying: fetch the remote image via PHP, validate its content type and size, store it in the WP uploads directory, and return the local URL. This avoids CORS and SSRF issues.
- Consider a URL allowlist or domain whitelist for additional security.

**Effort:** Medium | **Impact:** Low — upload-only covers the primary use case; URL import is a convenience feature for advanced users.

---

### Alignment Variants — Distribute-by-Gap & Group-Entity Alignment

**Context:** P29-G-C shipped 8 alignment/distribution operations. Two gaps were identified immediately after delivery:

1. **Distribute-by-gap.** The current "distribute horizontally/vertically" functions equalize slot *centers*, which can produce overlap when slots have mixed sizes. The expected behavior in professional tools (Figma's "space evenly", Canva's "tidy up") is to equalize the *gaps between slot edges*, never producing overlap regardless of size differences. This is a distinct operation that should be offered alongside the existing center-distribute.

2. **Group-as-entity alignment.** When a persisted group and another slot are both selected and an alignment operation runs, the group's members are currently treated as individual slots rather than as a single bounding box. The expected behavior is that the group's union bounding box is the alignment unit and all member positions move together by the same delta.

**Why deferred:** Both gaps require the Phase 30 alignment spike (P30-K) to be completed first. P30-K defines the full alignment operation set and answers whether these are the right solutions, what the naming/icon conventions are, and whether a reference-frame toggle (align to selection vs. canvas vs. anchor slot) should also be added. Implementing these without the spike risks building the wrong API or icon language.

Additionally, group-as-entity alignment requires P30-G's group coordinate model, which establishes how a group's bounding box is computed and how member positions are updated as a unit.

**Dependency:** P30-K (alignment spike) must be completed; P30-G must ship for group-entity alignment.

**Effort:** Low-Medium (once spike and P30-G are done) | **Impact:** Medium

---

## Campaign Management

### Audit Log Binary Export

**Context:** P39-CM1 shipped `WPSG_Export_Engine`, a reusable background job manager for building ZIP archives with a `manifest.json` + media folder. The engine is not campaign-specific: any caller that builds a manifest + media list can use it. The audit log is the next natural candidate. Operators currently download the audit log only as CSV; a binary ZIP that includes the CSV plus any referenced campaign media snapshots would make it useful for offline analysis, archival, and regulatory compliance handoffs.

**What it would take:**
- A manifest builder for audit data (JSON index of log entries, associated campaign IDs and titles, date range).
- An optional media snapshot pass: for each campaign referenced in the log window, include its cover image and media thumbnails in the `media/` folder.
- A new REST route (`POST /admin/audit-log/export/binary`) that calls `WPSG_Export_Engine::create_job('audit', $manifest, $media_items)`.
- A frontend trigger in the audit log admin view (alongside the existing CSV export).

**Dependencies:** `WPSG_Export_Engine` (shipped P39-CM1). `ext-zip` required (same constraint as campaign binary export).

**Effort:** Small-Medium | **Impact:** Low-Medium — primarily useful for compliance-heavy deployments

---

### Media Library Binary Export

**Context:** P39-CM1 shipped `WPSG_Export_Engine`. A media library export type would let operators download all or selected WP media attachments as a portable ZIP with a `manifest.json` index. Useful for migrating assets between WordPress instances or archiving a gallery's media before a site migration.

**What it would take:**
- A manifest builder that queries WP attachments (filtered by campaign, date, MIME type, or a selection) and produces a media reference list.
- `WPSG_Export_Engine::create_job('media_library', $manifest, $media_items)` does the rest.
- A new REST route and a frontend trigger in the media admin surface.
- Import: extend `POST /campaigns/import/binary` or add a separate `POST /media/import/binary` that sideloads the ZIP contents into the WP media library.

**Dependencies:** `WPSG_Export_Engine` (shipped P39-CM1). `ext-zip` required.

**Effort:** Small-Medium | **Impact:** Medium — useful for any multi-instance migration scenario

---

## Access Control

Phase-owned follow-on in this area: per-campaign RBAC now lives in [PHASE33_REPORT.md](PHASE33_REPORT.md). The remaining backlog item here is standalone cross-origin JWT auth.

### JWT In-Memory Token Auth (Standalone SPA)

**Context:** Phase 20 (P20-K) defaulted the plugin to nonce-only authentication and commented out the JWT localStorage flow to eliminate the XSS → token-theft vector. However, if WPSG is ever deployed as a **standalone SPA on a different origin** (i.e. not embedded via shortcode), WP nonces are unavailable because they require a same-origin page load. In that scenario, JWT auth is required.

The current JWT code stores tokens in `localStorage`, which is accessible to any script on the page. The secure alternative is:

1. **In-memory access token** — stored in a module-scoped variable (not `localStorage`). Survives only for the tab's lifetime.
2. **httpOnly refresh cookie** — issued by a new `/wpsg/v1/token/refresh` endpoint with `SameSite=Strict; Secure; HttpOnly`. The browser sends it automatically; JS cannot read it.
3. **Silent refresh** — on app boot and before access-token expiry, `POST /wpsg/v1/token/refresh` returns a fresh short-lived access token.

**What it would take:**
- New PHP endpoint: `POST /wpsg/v1/token/refresh` — validates the httpOnly cookie, issues a new JWT with a 15-minute TTL.
- Modify `WpJwtProvider.tsx` (currently commented out): replace `localStorage.setItem/getItem` with a module-scoped `let accessToken: string | null`.
- Add a `useTokenRefresh` hook that calls the refresh endpoint 1 minute before expiry and on window `focus` events.
- `apiClient.ts`: attach `Authorization: Bearer <in-memory-token>` only when the env-var opt-in `WPSG_ENABLE_JWT=1` is set.
- Server-side: set the refresh cookie on `POST /wpsg/v1/token` (login) and clear it on `DELETE /wpsg/v1/token` (logout).
- CORS configuration for the cross-origin case (`Access-Control-Allow-Credentials: true`, explicit origin).

**Open questions:**
- Q1: Should refresh-token rotation be implemented (invalidate old refresh cookie on each use)? This limits replay but adds a revocation table.
- Q2: What is the refresh-cookie TTL? 7 days (convenience) vs. 24 hours (security) — should it be admin-configurable?
- Q3: Is a `/wpsg/v1/token/revoke-all` endpoint needed for the "log out everywhere" use case?

**Prerequisites:** P20-K must be complete (nonce-only default + JWT code commented out with env-var gate). D-1 (CORS allow-list) must ship first to define the accepted cross-origin policy.

**P39-AU1 deferral note (2026-06-01):** P39-AU1 was gated on P39-CO1. Both tracks were deferred together — the CORS restriction work itself was rolled back because the primary deployment model (embedded WordPress shortcode) is same-origin and does not need cross-origin auth. The standalone SPA path requires the app to be prepared for that deployment model first (routing, build config, deployment documentation, CORS policy). Revisit when there is a concrete standalone SPA deployment requirement.

**Effort:** High (2–4 days) | **Impact:** High for cross-origin standalone SPA deployments; Low for standard WordPress shortcode usage

---

## Infrastructure & Performance

Phase-owned follow-on in this area: structured server-side logging now lives in [PHASE32_REPORT.md](PHASE32_REPORT.md). Object-cache guidance shipped in P39-OC1 — see [PHASE39_REPORT.md](PHASE39_REPORT.md) and [object-cache-setup.md](object-cache-setup.md).

---

## Developer Experience

### Contributor Tooling & Documentation

**Context:** The codebase has grown significantly but lacks tooling expected by external contributors. These sub-tasks are independent and can be done in any order.

**Storybook for component development:**
- Install `@storybook/react-vite`. Write stories for `AssetUploader`, `GraphicLayerPropertiesPanel`, `LayoutCanvas` (with mock slots), and all six gallery adapters.
- Gallery adapter stories double as visual regression test snapshots.
- Open question: Storybook adds ~200 MB to `node_modules` as a dev dependency — acceptable? (Yes, dev-only.)

**Effort:** Medium per sub-task | **Impact:** Medium — primarily affects project health and contributor on-ramp

---

## Build & Bundle

### Service Worker Metadata Caching Enhancements

**Context:** WPSG already registers a production service worker and caches same-origin runtime assets while intentionally excluding admin routes, HTML navigations, and Vite-hashed bundles. The remaining offline work is metadata caching, not basic Service Worker bootstrapping.

**Scope if revived:**
- Add stale-while-revalidate handling for read-only gallery metadata with a bounded TTL.
- Keep admin SPA and mutation endpoints network-first.
- Define cache-budget and eviction rules for thumbnail-heavy galleries before broadening offline scope.

**Open questions:**
- Q1: Does the product requirement include full lightbox/video playback offline, or only the gallery grid and metadata shell?
- Q2: If the host site already installs a Service Worker, what scope/isolation guarantees are required for coexistence?
- Q3: What cache budget is acceptable for thumbnail-heavy galleries?

**Effort:** Medium | **Impact:** Low for most deployments, High for explicitly offline/mobile deployments

---

## Integration

### Third-Party OAuth Providers

**Context:** Authentication supports WP native + JWT. Google and GitHub OAuth would reduce friction for organizations whose members already have Google Workspace or GitHub accounts.

**Open questions:**
- Q1: Should OAuth be implemented directly in the plugin or via a WP OAuth hook (e.g. integrating with an existing OAuth plugin)? Direct implementation adds maintenance burden.
- Q2: The OAuth redirect lands on the WP host, not the embedding page — is a popup-window OAuth flow the right model when the gallery is embedded as a Web Component on a non-WP page?
- Q3: Which providers are highest priority? (Survey/feedback required before committing scope.)

**Effort:** High | **Impact:** Medium — valuable for SSO deployments, complex to implement correctly

---


### GraphQL API Alternative

**Context:** The REST API is adequate for the admin SPA but is verbose for external integrations that need only specific fields. A GraphQL endpoint allows consumers to request exactly the data they need.

**Open questions:**
- Q1: Is there sufficient external-integrator demand for a GraphQL API? This is a significant investment with unclear ROI unless there is a concrete use case.
- Q2: Build on `WPGraphQL` (broad adoption, reduces code) or a custom GraphQL endpoint (more control, adds a third-party dependency)?
- Q3: Would a GraphQL API make the REST API redundant, or would both coexist? Coexistence adds documentation and maintenance burden.

**Effort:** High | **Impact:** Low for current users, potentially High for ecosystem adoption

---

## Deferred Review Tasks

Items below were triaged from the PHP and React implementation review deferred task lists.
Easy/ASAP items were handled separately — see ASAP_TASKS.md and the implementation notes in the source review docs.

Follow-up audit on 2026-05-19 found no additional phase-worthy tracks here beyond the work already promoted into Phases 32-34. The remaining deferred items are retained as long-tail reference material only: they are either DX-only cleanups, blocked by missing product demand or dependencies, or tied to scale/deployment scenarios that are not yet active enough to justify promotion.

### Already Addressed (Removed from Active Deferred Review)

| Item | Current code status | Decision |
|------|---------------------|----------|
| D-10 | `get_accessible_campaign_ids()` already uses cached accessible-ID lookups with versioned invalidation | Remove from active deferred list |
| D-17 | Default CSP already ships via `wpsg_add_security_headers()` | Remove from active deferred list |
| RD-4 | `useLayoutBuilderState` already uses `templateRef` to avoid callback-cascade issues in autosave persistence | Remove from active deferred list |

### PHP — Long-Tail Only (from archived PHP_IMPLEMENTATION_REVIEW.txt)

**D-1: CORS Origin Allow-List & Admin UI**
Files: `wp-super-gallery.php`, `class-wpsg-settings.php`
Add CORS allowed-origins setting and reject wildcard with credentials. Only affects cross-origin REST API usage. Filter workaround exists.

**P39-CO1 deferral note (2026-06-01):** P39-CO1 attempted to promote this to a first-party settings-backed surface. Work was rolled back after implementation because CORS restriction provides no meaningful value for the primary use case — the plugin is embedded via WordPress shortcode and runs same-origin. WP core's `rest_send_cors_headers()` already reflects any origin unconditionally; overriding it adds complexity without user benefit in standard deployments. This track becomes relevant only if WPSG is deployed as a standalone SPA on a different origin, which requires preparatory work (auth model, build changes, deployment docs) that is not yet in scope. Prerequisite for P39-AU1.

LOE: Medium (4-6 hours) | Impact: Low — standard WP shortcode deployments unaffected; meaningful only for standalone SPA deployments

**D-2: Migrate Overlay Library from wp_options to Custom Table**
Files: `class-wpsg-overlay-library.php`, `class-wpsg-db.php`, `uninstall.php`
Move overlay entries out of single serialized wp_options row. Problem at scale (hundreds of overlays). Corrupted update_option could lose entire library.
LOE: Large (8-12 hours) | Impact: Low-Medium

**D-5: Pre-Uninstall Export and Confirmation Gate**
Files: `uninstall.php`, `class-wpsg-settings.php`
Add one-click "Export All" and timed confirmation before uninstall data purge. Default preserves data — low risk, severe consequences when disabled.
LOE: Medium (4-6 hours) | Impact: Low

**D-7: Decompose Monolithic REST Class into Domain Controllers**
Files: `class-wpsg-rest.php` → 8+ new files
Split the still-monolithic `WPSG_REST` class. Current test coverage is strong; this remains a DX/maintainability refactor rather than a user-facing gap.
LOE: X-Large (16-24 hours) | Impact: Low (DX only)

**D-13: Thumbnail Cache Index — Single wp_options Row Scalability**
Files: `class-wpsg-thumbnail-cache.php`
Move thumbnail cache index to per-hash entries or custom table. Cache is self-healing (regenerated on miss).
LOE: Medium (4-6 hours) | Impact: Low

**D-14: Campaign Binary Export — Stream Large Media Sets**
Files: `class-wpsg-export-engine.php`
P39-CM1 ships background ZIP generation via `WPSG_Export_Engine` with a 100 MB size limit. For larger campaigns, add chunked/streamed media fetching (write directly to the ZIP via curl CURLOPT_FILE rather than buffering each media body in memory) and a configurable size ceiling in settings. Most campaigns fall within the current 100 MB limit today.
LOE: Medium (4-6 hours) | Impact: Low

**D-15: `get_campaigns_for_attachment_id()` N+1 Meta Reads**
Files: `class-wpsg-db.php`
`get_campaigns_for_attachment_id()` (used to enrich duplicate/near-duplicate 409 responses) fetches every campaign ID from `wp_posts`, then calls `get_post_meta()` once per campaign to load and scan its `media_items` array in PHP. On sites with many campaigns this is O(campaigns) in both queries and memory. The path only fires when an uploaded file matches an existing attachment's MD5 or pHash, so real-world cost is negligible today, but the pattern should be replaced once a dedicated WP-attachment-ID → campaign mapping is available (e.g. extending the `wpsg_media_refs` table or adding an `attachment_id` column). A LIKE-based query against the serialized `media_items` postmeta is not a safe alternative due to PHP serialization format fragility.
LOE: Small-Medium (2-4 hours once mapping table exists) | Impact: Low (rare code path)

### React — Long-Tail Only (from archived REACT_IMPLEMENTATION_REVIEW.txt)

**RD-2: SettingsPanel Tab-Level Code Splitting**
Files: `src/components/Admin/SettingsPanel.tsx` (~1822 lines)
Split into tab-level sub-components with React.memo. Admin-only, negligible perf impact.
LOE: High (6-8 hours) | Impact: Low

**RD-9: LayoutBuilderGallery Inline Style → CSS Injection**
Files: `src/gallery-adapters/layout-builder/LayoutBuilderGallery.tsx`
Replace inline `<style>` with useInsertionEffect/adoptedStyleSheets. Works correctly inside Shadow DOM today.
LOE: Low (1-2 hours) | Impact: Low

**RD-15: SlotPropertiesPanel IIFE Extraction**
Files: `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx`
Extract IIFEs into named sub-components. Readability improvement.
LOE: Low (1-2 hours) | Impact: Low

**RD-17: JWT Token Refresh**
Files: `src/services/apiClient.ts`, `src/hooks/useAuth.ts`
Transparent JWT token refresh before expiry. **Blocked on RD-1**. Most deployments use nonce auth.
LOE: Medium (blocked on RD-1) | Impact: Low

**RD-21: Standardize Error Handling Patterns**
Files: Multiple hooks
Standardize error handling across admin hooks. Inconsistent DX, no user impact.
LOE: Medium (3-4 hours) | Impact: Low

---

## Deferred Gallery Adapters

> **Origin:** Phase 8 brainstorm (P22). These gallery adapter concepts were identified as valuable additions but deferred from the active Phase 8 scope. They follow the existing `GalleryAdapterProps` contract and register via `registerAdapter` like all current adapters.

### Mosaic / Pinterest Adapter
Irregular tile sizes (large hero + small surrounding grid) based on aspect ratios or media importance. Similar to Google Photos' auto-layout algorithm. Tiles are assigned sizes dynamically (e.g., 2×2, 1×1, 2×1) to maximize area coverage while respecting aspect ratios.
LOE: Medium-High | Impact: Medium

### Coverflow / 3D Adapter
CSS 3D perspective carousel where side items are rotated and scaled down. Classic Apple-style cover flow effect. Uses `transform: perspective() rotateY()` and z-index layering. Navigation via click, keyboard, or drag.
LOE: Medium | Impact: Medium

### Spotlight / Hero Adapter
Large featured item (hero) with a row/grid of smaller thumbnails below or beside it. Clicking a thumbnail promotes it to the hero position with a crossfade transition. Good for campaign highlights.
LOE: Low-Medium | Impact: Medium

### Stacked / Deck Adapter
Cards stacked on top of each other with slight offset/rotation. Swipe or click to move the top card to the back (Tinder-like). Touch-optimized for mobile previews.
LOE: Medium | Impact: Low-Medium

### Waterfall Adapter
Vertical masonry variant where items drop in sequence with staggered CSS animation (`@keyframes` with incremental `animation-delay`). Content-driven heights. Essentially masonry with entrance animations.
LOE: Low (masonry variant) | Impact: Low

### Timeline Adapter
Chronological layout with items on alternating sides of a vertical center line. Date/caption labels at each node. Good for event-based or campaign-chronology galleries.
LOE: Medium | Impact: Low-Medium

### Isotope / Filterable Grid Adapter
Grid layout with animated filtering, sorting, and category transitions. Items shuffle positions with smooth FLIP animations when filter criteria change. Requires extending the adapter interface to accept filter/sort props.
LOE: Medium-High | Impact: Medium

### Grid with Variable Aspect-Ratio Tiles Adapter
Auto-assigns tile sizes (1×1, 2×1, 1×2, 2×2) based on media metadata (aspect ratio, resolution). Creates a densely packed, visually varied grid without manual configuration. Similar to Google Photos or Flickr's justified grid but with explicit CSS Grid tracks.
LOE: Medium-High | Impact: Medium

### Vertical Scroll Snap Adapter
Mobile-first full-screen vertical carousel using CSS `scroll-snap-type: y mandatory`. Each media item occupies the full viewport height. Swiping vertically snaps to the next item. Ideal for story-style or Instagram-reel-like campaign presentations.
LOE: Medium | Impact: Medium

---

## Evaluation Criteria

When promoting future tasks to an active phase:

1. **User impact** — How many users does this affect, and how much does it improve their workflow?
2. **Implementation effort** — What is the realistic development time, including tests and documentation?
3. **Maintenance burden** — Does this add surface area that will need ongoing upkeep?
4. **Alignment with core mission** — Does this serve the gallery-management use case, or is it scope creep?
5. **Open questions resolved** — A task should not be promoted until its key design questions have answers.
6. **Dependencies satisfied** — Note which other features must ship first.

---

*Document created: February 1, 2026*
*Last updated: June 1, 2026 — Reconciled against current code and Phase 28 completions; removed shipped backlog items in two passes, moved promoted work fully into Phases 32–34, audited the remaining deferred review list, retired stale deferred entries (D-10, D-17, RD-4), removed entries queued into Phase 38, and kept the rest as long-tail reference material. Added D-15 (`get_campaigns_for_attachment_id` N+1 meta reads) from P38 PR review. Updated D-1 and JWT entries with P39-CO1/P39-AU1 deferral rationale after both tracks were rolled back — CORS restriction is unnecessary for the primary same-origin embedded WP use case.*

*Updated: June 3, 2026 (P39-CL1) — Removed "Webhook Support for Campaign Events" (shipped P39-IN1) and "Redis/Memcached Object Cache" (shipped P39-OC1); retired D-12 (rate-limiter object-cache docs, now covered by P39-OC1); added P39-IN1 and P39-OC1 to the ownership snapshot; updated Infrastructure & Performance section intro.*

*Updated: June 3, 2026 (P40-QA1) — Reconciled audit-domain backlog against Phase 40 outcome. "Audit Log Binary Export" (Campaign Management section) remains correctly deferred — `WPSG_Export_Engine` exists but the compliance use case is not yet active enough to justify promotion. No other audit-domain items require movement or promotion.*
