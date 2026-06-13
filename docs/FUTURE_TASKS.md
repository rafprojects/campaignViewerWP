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

## Campaign Management

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

## Settings & Admin UI

### Settings Panel Open/Close Animation Variants

**Origin:** P48-J follow-on (SpaceSwitcher / multi-space auth bar polish, 2026-06-10).

**Context:** The Settings panel Drawer currently uses a hardcoded `slide-left` transition (200 ms). Admins may want to match their site's motion style or disable animation entirely for accessibility/performance reasons.

**What to implement:**
- Add a `settingsPanelAnimation` field to `GalleryBehaviorSettings` (enum: `slide-left` | `fade` | `scale` | `none`; default `slide-left`).
- Expose it in the Settings panel's Appearance accordion (or a dedicated Motion/Animation sub-section).
- Pass the resolved value to the `transitionProps` of the `Drawer` in `SettingsPanel.tsx` (currently hardcoded at line 564).
- Map `none` to `{ duration: 0 }` so the Drawer opens instantly without a jarring flash.

**Files:** `src/components/Admin/SettingsPanel.tsx`, `src/types/settingsSchemas.ts`, relevant settings tab component.

**Dependencies:** None — self-contained settings field addition.

**Effort:** Small (1–2 hours) | **Impact:** Low — polish/accessibility; slide-left default is acceptable for most sites.

---

### SettingsPanel Space Badge — Exact Color Parity with SpaceSwitcher/AdminPanel in Dark Mode

**Origin:** P48-I follow-on (unified space badge color, 2026-06-10).

**Context:** The SpaceSwitcher (AuthBar) and AdminPanel space badges use Mantine's `variant="light"` directly — they render inside the shadow DOM where `cssVariablesSelector=":host"` makes Mantine CSS variables available, so color adapts correctly in both light and dark themes.

The SettingsPanel Drawer renders via `withinPortal={true}` to `document.body`, outside the shadow DOM. Mantine CSS variables (`--mantine-color-{color}-light`, etc.) are not inherited by portal elements. The workaround (`useMantineTheme` + `useComputedColorScheme` with hardcoded shade indices) produces a close but not identical shade in dark mode because Mantine's `variant="light"` uses alpha-blended colors, not solid palette shades.

**What to implement (two viable approaches):**

1. **Portal target inside shadow DOM** — Pass `portalProps={{ target: shadowHostElement }}` to the Drawer so it renders as a child of the shadow host (inside shadow DOM). Obtain the element via `useRootId()` + `document.getElementById`. CSS variables become available; remove the `useMantineTheme`/`useComputedColorScheme` workaround entirely.

2. **CSS variable bridge** — At the `MantineProvider` level, also emit a subset of color CSS variables to `:root` (in addition to `:host`). This makes them globally available to portals. Requires a custom `cssVariablesResolver` override and must be done carefully to avoid polluting the host page's `:root`.

**Files:** `src/components/Admin/SettingsPanel.tsx`, possibly `src/main.tsx` (for approach 2).

**Dependencies:** Approach 1 requires a stable reference to the shadow host element from within `SettingsPanel`. Approach 2 affects the entire Mantine CSS variable strategy.

**Effort:** Small–Medium (1–3 hours) | **Impact:** Low — cosmetic; the badge is already correctly colored, just a slightly different shade in dark mode.

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

## Build & Bundle

### Service Worker — Offline Support (App Shell Pattern)

**Origin:** P50-F follow-on (2026-06-12). Identified during manual testing — going offline and reloading produces `ERR_INTERNET_DISCONNECTED` because the HTML page shell is not cached.

**Context:** P50-F's SW intentionally skips navigation/HTML caching (the `request.mode === 'navigate'` bail in `public/sw.js`) to avoid a known failure mode: a stale cached shell that references Vite chunk URLs removed by a newer deploy causes broken lazy-loaded drawers and modals until the user manually clears site data. The metadata SWR cache (`wpsg-meta-v1`) is intact when offline, but it has no page to serve into.

**What to implement:**
- A **versioned app-shell cache** for the gallery entry-point HTML, tied to the deployed bundle (e.g. a version hash injected into the SW source at build time, or `workbox-window` + `injectManifest`).
- **Deploy-time cache busting:** the shell HTML must be invalidated on every deploy so the new shell imports the correct Vite chunk URLs. Without this, caching the shell causes the exact stale-chunk failures that the current bail prevents.
- **Offline fallback** — if the shell is absent or too stale, serve a minimal branded offline fallback page rather than Chrome's error screen.

**Open questions:**
- Q1: How is the deploy version communicated to the SW? Options: (a) inject a version hash into the SW script at build time; (b) a `/__wpsg_version` PHP endpoint returning a build hash; (c) `workbox-window` + `injectManifest`.
- Q2: Does the SW need to handle multiple WordPress page URLs (any page embedding the WPSG shortcode), or only the site root?
- Q3: Should the offline fallback be a static HTML string embedded in the SW, or a separately cached `offline.html` asset?

**Prerequisites:** P50-F (SW metadata caching) must be complete (shipped).

**Effort:** Medium (4–8 hours) | **Impact:** Medium — meaningful for mobile gallery viewers on intermittent connections.

---

## Deferred Gallery Adapters

> **Origin:** Phase 8 brainstorm (P22). These gallery adapter concepts were identified as valuable additions but deferred from the active Phase 8 scope. They follow the existing `GalleryAdapterProps` contract and register via `registerAdapter` like all current adapters.

### Timeline Adapter
Chronological layout with items on alternating sides of a vertical center line. Date/caption labels at each node. Good for event-based or campaign-chronology galleries.
LOE: Medium | Impact: Low-Medium

### Grid with Variable Aspect-Ratio Tiles Adapter
Auto-assigns tile sizes (1×1, 2×1, 1×2, 2×2) based on media metadata (aspect ratio, resolution). Creates a densely packed, visually varied grid without manual configuration. Similar to Google Photos or Flickr's justified grid but with explicit CSS Grid tracks.
LOE: Medium-High | Impact: Medium

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

*Updated: June 7, 2026 (P47 planning) — Added "Gallery Spaces" section with four Phase 47 follow-on candidates: Cross-Space Campaign Move, Per-Instance Full-Bleed CSS Scoping, Per-Space Library Isolation (Overlays/Fonts), and Space-Scoped Rate-Limit Buckets.*

*Updated: June 7, 2026 (P46-D/E) — Auth components and Lightbox are now genuinely decoupled from all WPSG-internal imports. `safeLocalStorage`, `useSwipe`, and `scrollLock` moved from `@/utils/`/`@/hooks/` to `src/lib/`. `AuthBarFloating` Campaign type replaced with local generic `AuthBarCampaignItem`. The monorepo infrastructure step (npm workspaces, `packages/shared-utils/`, `packages/shared-ui/`) remains the open follow-on before actual npm package publication.*

*Updated: June 9, 2026 (P48 planning) — Promoted to Phase 48: "Accumulative Multi-File Selection with Per-File Preview" (P48-A), "Alignment Variants" (P48-B), "Per-Instance Full-Bleed CSS Scoping" (P48-C), "Space-Scoped Rate-Limit Buckets" (P48-D), "Audit Log Binary Export" (P48-E), "Media Library Binary Export" (P48-F), "Coverflow / 3D Adapter" (P48-G), "Mosaic / Pinterest Adapter" (P48-H). Retired as already shipped: "Spotlight / Hero Adapter" (`spotlight/SpotlightGallery.tsx`) and "Vertical Scroll Snap Adapter" (`scroll-snap/ScrollSnapGallery.tsx`) — both fully registered in `adapterRegistry.ts`.*

*Updated: June 9, 2026 (P49 planning) — Promoted to Phase 49: "Contributor Tooling & Documentation / Storybook" (P49-E), "Thumbnail Cache Index Scalability" (P49-F), "`get_campaigns_for_attachment_id()` N+1 Meta Reads" (P49-G). Developer Experience and Infrastructure & Performance sections removed as all entries are now promoted. Four new tracks promoted directly from planning suggestions (not previously in this doc): a11y audit (P49-A), bundle/perf audit (P49-B), i18n groundwork (P49-C), automated visual regression (P49-D).*

*Updated: June 9, 2026 (P50 planning) — Promoted to Phase 50: "Full Audit and Extraction to Shared Package" (P50-G), "Cross-Space Campaign Move" (P50-A), "Per-Space Library Isolation" (P50-B), "Service Worker Metadata Caching Enhancements" (P50-F), "Stacked / Deck Adapter" (P50-C), "Waterfall Adapter" (P50-E), "Isotope / Filterable Grid Adapter" (P50-D). Removed now-empty sections: Reusable Component / Utility Library, Gallery Spaces, Build & Bundle.*

*Updated: June 12, 2026 (P50-F follow-on) — Re-added Build & Bundle section with "Service Worker — Offline Support (App Shell Pattern)": deferred from P50-F after manual testing confirmed offline mode is unsupported by design (SW intentionally skips navigation/HTML caching to avoid stale-chunk failures after deploys). Full offline support requires a versioned app-shell cache with deploy-time busting.*
