# Future Tasks & Enhancements

This document tracks deferred and exploratory work remaining. Items promoted to active phase execution are moved into dedicated phase reports and removed from this backlog.

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

**Status:** Unblocked. P30-K (alignment spike) and P30-G (nested group hierarchy / coordinate model) are both complete as of Phase 30. The alignment naming/icon conventions, reference-frame toggle design, and group bounding-box coordinate model are all resolved. This item can be promoted in a future phase without dependency gates.

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

### Campaign Binary Export — Stream Large Media Sets

**Files:** `class-wpsg-export-engine.php`

P39-CM1 ships background ZIP generation via `WPSG_Export_Engine` with a 100 MB size limit. For larger campaigns, add chunked/streamed media fetching (write directly to the ZIP via `curl CURLOPT_FILE` rather than buffering each media body in memory) and a configurable size ceiling in settings. Most campaigns fall within the current 100 MB limit today.

**Dependencies:** `WPSG_Export_Engine` (shipped P39-CM1). `ext-zip` required.

**Effort:** Medium (4-6 hours) | **Impact:** Low — only relevant for campaigns exceeding the current 100 MB size ceiling

---

## Access Control

Phase-owned follow-on in this area: per-campaign RBAC now lives in [PHASE33_REPORT.md](PHASE33_REPORT.md). The remaining backlog items here are all prerequisites or components of the standalone cross-origin deployment scenario.

### CORS Origin Allow-List & Admin UI

**Files:** `wp-super-gallery.php`, `class-wpsg-settings.php`

Add a CORS allowed-origins admin setting and enforce it on REST API responses, rejecting wildcard (`*`) when credentials are used. Only affects cross-origin REST API usage; standard same-origin WordPress shortcode deployments are unaffected (WP core already reflects the request origin unconditionally for those).

**P39-CO1 deferral note (2026-06-01):** P39-CO1 attempted to promote this to a first-party settings-backed surface. Work was rolled back because CORS restriction provides no meaningful value for the primary use case — the plugin is embedded via WordPress shortcode and runs same-origin. This track becomes relevant only when WPSG is deployed as a standalone SPA on a different origin, which requires preparatory work (auth model, build changes, deployment docs) that is not yet in scope. Prerequisite for the JWT work below.

**Effort:** Medium (4-6 hours) | **Impact:** Low — meaningful only for standalone SPA deployments

---

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

### JWT Token Refresh (Frontend)

**Files:** `src/services/apiClient.ts`, `src/hooks/useAuth.ts`

Transparent silent refresh of the in-memory JWT access token before expiry via a `useTokenRefresh` hook that posts to `/wpsg/v1/token/refresh`. **Blocked on the JWT In-Memory Token Auth work above** (requires the in-memory token architecture and the `/token/refresh` PHP endpoint to exist first). Standard nonce-auth deployments are unaffected.

**Effort:** Medium | **Impact:** Low — only relevant for standalone SPA JWT deployments

---

## Infrastructure & Performance

Phase-owned follow-on in this area: structured server-side logging now lives in [PHASE32_REPORT.md](PHASE32_REPORT.md). Object-cache guidance shipped in P39-OC1 — see [PHASE39_REPORT.md](PHASE39_REPORT.md) and [object-cache-setup.md](object-cache-setup.md).

### Thumbnail Cache Index — Single wp_options Row Scalability

**Files:** `class-wpsg-thumbnail-cache.php`

Move the thumbnail cache index from a single `wp_options` row to per-hash entries or a custom table. The cache is self-healing (regenerated on miss), so migration risk is low; the concern is `wp_options` autoload bloat as the index grows on larger sites.

**Effort:** Medium (4-6 hours) | **Impact:** Low

---

### `get_campaigns_for_attachment_id()` N+1 Meta Reads

**Files:** `class-wpsg-db.php`

`get_campaigns_for_attachment_id()` (used to enrich duplicate/near-duplicate 409 responses) fetches every campaign ID from `wp_posts`, then calls `get_post_meta()` once per campaign to scan its `media_items` array in PHP. On sites with many campaigns this is O(campaigns) in both queries and memory. The path only fires when an uploaded file matches an existing attachment's MD5 or pHash, so real-world cost is negligible today, but the pattern should be replaced once a dedicated WP-attachment-ID → campaign mapping is available (e.g. extending the `wpsg_media_refs` table). A LIKE-based query against the serialized `media_items` postmeta is not a safe alternative due to PHP serialization format fragility.

**Effort:** Small-Medium (2-4 hours once mapping table exists) | **Impact:** Low (rare code path)

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

*Updated: June 3, 2026 (P41-FT1) — Updated "Alignment Variants" (Builder section): P30-K (alignment spike) and P30-G (nested group hierarchy) are both complete as of Phase 30; removed the blocking-dependency language and marked the item as unblocked.*

*Updated: June 3, 2026 (P41-OL1/UN1/RD15) — D-2 (Overlay Library DB migration), D-5 (Pre-uninstall confirmation gate), and RD-15 (SlotPropertiesPanel IIFE extraction) marked complete; D-7 targeted for Phase 42.*

*Updated: June 3, 2026 (P42/P43 planning) — RD-2 targeted for Phase 43; line-count corrected from ~1822 to ~736 (heavy section components already extracted to `src/components/Settings/`); LOE revised to Medium (3-5 hours).*

*Updated: June 4, 2026 (P43/P44 planning) — D-7, RD-2, RD-9, RD-21 graduated to phase plans (PHASE42_REPORT.md, PHASE43_REPORT.md); Phase 44 audit plan created (PHASE44_REPORT.md).*

*Updated: June 4, 2026 (reorg) — Dissolved "Deferred Review Tasks" section; D-1, D-13, D-14, D-15, RD-17 moved to domain sections (Access Control, Infrastructure & Performance, Campaign Management); completed entries (D-2, D-5, RD-15) and already-addressed entries (D-10, D-17, RD-4) dropped.*
