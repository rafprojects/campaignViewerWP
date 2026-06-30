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

### LayoutBuilder — History Persistence Across Sessions

**Origin:** Phase 58 planning (2026-06-26). Surfaced while scoping the LayoutBuilder enhancements; future-task'd per user direction.

**Context:** The undo/redo stack (`useLayoutBuilderHistory`) is fresh on every edit session — reopening a template loses its history. Persisting it with the existing local draft would let users undo across sessions.

**What to implement:** Persist the history stack (or a bounded slice) alongside the localStorage draft and restore it on builder open, reconciling with the draft-restore/conflict path.

**Files:** `src/hooks/useLayoutBuilderState.ts` (history composition), the draft-restore hook.

**Effort:** Medium | **Impact:** Low-Medium — quality-of-life; not a headline capability.

---

### LayoutBuilder — Reusable "Symbol" / Linked-Component Slots

**Origin:** Phase 58 planning (2026-06-26). Surfaced while scoping the LayoutBuilder enhancements; future-task'd per user direction.

**Context:** Slots and groups are all independent — there is no Figma-style "component/symbol" concept where editing one instance updates every linked instance. Useful for repeated layout motifs (e.g. a captioned card reused across a template).

**What to implement:** A symbol definition + linked-instance model (shared source, per-instance position overrides), instance sync on edit, and persistence in the template schema. Significant editor + schema work.

**Files:** `src/hooks/useLayoutBuilderState.ts` (schema + sync), the Layers panel, the canvas render path.

**Effort:** High | **Impact:** Medium — power-user efficiency; large surface for a niche-but-loved feature.

---

### LayoutBuilder — Slot Constraints / Pinning (Anchor-to-Edge)

**Origin:** Phase 58 planning (2026-06-26). Surfaced while scoping the LayoutBuilder enhancements; future-task'd per user direction.

**Context:** Slots are positioned in percentages with no constraint model — they cannot be pinned to a canvas edge so they reflow predictably on resize. A constraints/pinning system is the deeper responsive model that complements the per-breakpoint overrides in [PHASE58_REPORT.md](PHASE58_REPORT.md) P58-B.

**What to implement:** Per-slot anchor constraints (pin to left/right/top/bottom/center, fixed vs. stretch), resolved at render and on canvas resize, persisted in the template schema.

**Files:** `src/hooks/useLayoutBuilderState.ts` (schema + resolution), `LayoutCanvas.tsx`, the LayoutBuilder render path.

**Effort:** High | **Impact:** Medium — robust responsive behavior beyond discrete breakpoints.

---

### LayoutBuilder — Align/Distribute Keyboard Shortcuts

**Origin:** Deferred from [PHASE58_REPORT.md](PHASE58_REPORT.md) P58-A (Editor UX Polish) during batch-1 execution (2026-06-26), per user direction — the binding scheme needs design before implementation. The rest of P58-A (clipboard, slot opacity, nudge steps) ships in batch 1.

**Context:** Align and distribute exist only as Layers-panel buttons (`src/components/Admin/LayoutBuilder/LayoutBuilderLayersPanel.tsx`); there are no keyboard equivalents (unlike Figma). The blocker is binding choice: nearly all single keys are taken (`N`/`H`/`V`/`F`/`?`/`[`/`]`, plus `Ctrl+Z`/`D`/`G`/`S`), and the obvious `Ctrl+Alt+Arrows` collides with OS shortcuts (Linux workspace switch, Intel-GPU screen rotation). Two candidate schemes surfaced in planning: an **"A-chord"** (press `A`, then a direction / `H` / `V`) which is conflict-free but two-step, or a single-press `Ctrl+Alt+…` combo which is faster but unreliable cross-OS.

**What to implement:**
- Decide the binding scheme (A-chord vs. single-press combo) and document it in `src/components/Admin/LayoutBuilder/BuilderKeyboardShortcutsModal.tsx`.
- Extract the group-aware alignment closure at `LayoutBuilderLayersPanel.tsx:110-168` into a reusable `src/hooks/useSlotAlignment.ts` (`useSlotAlignment(builder)`) so both the Layers panel and `useLayoutBuilderKeyboardHandlers.ts` call the same logic.
- Wire the chosen bindings in `src/hooks/useLayoutBuilderKeyboardHandlers.ts`, gated on `selectedSlotIds.size >= 2` and `!isPreview`.

**Acceptance:** align/distribute invokable from the keyboard, matching the Layers-panel buttons, with 2+ slots selected.

**Effort:** Small-Medium | **Impact:** Low-Medium — power-user efficiency; the buttons already cover the capability.

---

### LayoutBuilder — Published Responsive Canvas Sizing (Breakpoint Render Model)

**Origin:** Deferred from [PHASE58_REPORT.md](PHASE58_REPORT.md) P58-B during implementation (2026-06-29), per user direction — needs an extensive manual-testing pass plus careful planning before committing to a model.

**Context:** P58-B ships per-breakpoint slot overrides + a builder boundary guide, and the published gallery now renders a non-desktop breakpoint as the **centered device-width band** of the design canvas, **scaled to fill** the container (`computeBreakpointBand` in `packages/shared-utils/src/breakpointViewport.ts`) — a "full-height vertical slice, scale-to-fill" model. It works, but on-page sizing is still imperfect: the layout is constrained left/right (the band is centered and the rest of the design canvas is hidden), and because tablet/mobile scale the band to the container, **slots get progressively smaller as the breakpoint narrows**. There is no per-breakpoint canvas aspect/height — mobile inherits the desktop canvas height as a tall, narrow slice. A better model would let the published layout size itself to the page more naturally across breakpoints.

**What to implement:** Define and validate a published responsive sizing model that avoids the "everything shrinks" effect and the rigid left/right constraint. Candidate directions: per-breakpoint canvas height/aspect on the template schema; container-relative sizing with min/max clamps; or integration with the **Slot Constraints / Pinning** entry above (the deeper responsive complement). Requires a broad manual-testing matrix (real devices + container widths × fixed-width vs fit-to-container templates × aspect ratios) and careful planning before code.

**Files:** `packages/shared-utils/src/breakpointViewport.ts`, `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`, the template `canvas*` / `breakpointOverrides` schema, `src/hooks/useLayoutBuilderState.ts`.

**Effort:** High | **Impact:** Medium-High — directly governs how published layouts look on real devices.

---

### LayoutBuilder — Faithful Preview (Breakpoint Render + Runtime Effects)

**Origin:** Deferred from [PHASE58_REPORT.md](PHASE58_REPORT.md) P58-B (2026-06-29), per user direction.

**Context:** Two preview gaps. **(1)** The builder's internal **Preview** mode (`LayoutCanvas` in `isPreview`, inside the device-frame) is a *separate* render path from the published `LayoutBuilderGallery`. After the P58-B publish-at-breakpoint fix the published/campaign render shows the centered band correctly, but the builder's Preview toggle does not necessarily match — it renders the design canvas inside the device frame rather than reusing the gallery's crop+scale band model. **(2)** Preview does not exercise the runtime effects the published gallery applies — per-slot glow, hover bounce/pop, entrance (scroll-reveal) animations, tilt — so the user cannot quickly validate a layout's interactive feel without actually publishing.

**What to implement:** (a) Align the builder Preview render with the published gallery's breakpoint model (centered band, scale-to-fill) so **Preview = published**; reusing `LayoutBuilderGallery` (or its crop+scale logic via `computeBreakpointBand`) in Preview mode is the cleanest path. (b) Render the runtime effects (glow, bounce/hover, entrance animations, tilt) in Preview the same way the gallery does (`buildTileStyles` / `buildBoxShadowStyles`, `buildSlotEntranceCss`, `TiltWrapper`) so effects are validatable in-builder.

**Files:** `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx`, `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx`, sharing with `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`, `src/utils/slotEntrance.ts`, and `src/components/Galleries/Adapters/_shared/tileHoverStyles.ts`.

**Effort:** Medium-High | **Impact:** Medium — faster design iteration and correctness confidence before publish.

---

### LayoutBuilder — Clickable / Linking CTA Text Layer

**Origin:** Deferred from [PHASE59_REPORT.md](PHASE59_REPORT.md) during P59 planning (2026-06-29), per user direction — Phase 59 ships single-style text layers with semantic roles (heading/subheading/paragraph/caption) rendered as real DOM text (Decision B: single-style text for v1); the linking/CTA variant was split off to keep v1 to pure, non-interactive text.

**Context:** Phase 59 text layers (`LayoutTextLayer` in `src/types/index.ts`; render path in `LayoutBuilderGallery.tsx`, P59-C) render as non-interactive semantic text — a heading or caption, not a link. A common layout need is a **call-to-action**: text that navigates somewhere when clicked (e.g. "Shop now"). That requires a link target on the layer plus interactive, accessible rendering — more than "style a string."

**What to implement:**
- Add an optional `href` (+ link behavior, e.g. same-tab/new-tab) to `LayoutTextLayer`; absent = plain text, so existing text layers stay back-compatible.
- Render a CTA layer as a real anchor (`<a>` / `role="link"`) with correct keyboard focus + Enter/Space activation and an accessible name — reuse the slot click/keydown a11y pattern already in `LayoutBuilderGallery.tsx` (`role`/`tabIndex`/key handling).
- Add a URL field + link controls to `TextPropertiesPanel.tsx` (the P59-B panel), and decide Pro-gating placement (text layers are flagged as a natural Pro feature in P59 Decision D / [PHASE61_REPORT.md](PHASE61_REPORT.md)).
- Sanitize the URL on save and on render.

**Files:** `src/types/index.ts` (`LayoutTextLayer`), `src/components/Admin/LayoutBuilder/TextPropertiesPanel.tsx`, `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`.

**Depends on:** the Phase 59 text-layer schema + render path (P59-A landed 2026-06-30; P59-B/P59-C pending).

**Effort:** Small-Medium | **Impact:** Medium — unlocks CTA/banner layouts (a primary reason to put text on a gallery) without an external image editor.

---

## Code Quality & Refactoring

*No tasks here yet.*

---

## Internationalization

### Full Admin-Panel i18n Migration

**Origin:** Phase 54 (P54-B harvests **user-facing** strings only; admin deferred here).

**Context:** ~300 raw JSX literals remain; `i18next/no-literal-string` is `'off'` globally (`eslint.config.js:82`). After the user-facing harvest in P54-B, complete the admin-panel strings and flip the lint rule to `'error'` **globally** so regressions are caught everywhere. **Gates the public WP.org / premium paths** (see [MONETIZATION_OPTIONS.md](MONETIZATION_OPTIONS.md) §5).

**Status (2026-06-26):** `.pot` generation + confirming user-facing coverage is scheduled in [PHASE60_REPORT.md](PHASE60_REPORT.md) P60-B (the Freemius-premium floor). This entry — the **full** admin harvest (~300 literals) + flipping the lint rule to `'error'` — remains deferred as the **WP.org public-listing gate**.

**Effort:** Medium-High | **Impact:** Low for English-only deployments; High/required for public distribution.

---

## Accessibility

### Full WCAG AA Audit

**Origin:** Phase 54 (P54-C establishes a critical/serious axe baseline on the front-end only).

**Context:** Beyond P54-C's front-end critical/serious baseline, a full WCAG AA pass across the admin panel and all flows (contrast, focus management, ARIA landmarks, Shadow-DOM screen-reader exposure). **Gates the public WP.org path.**

**Status (2026-06-26):** [PHASE60_REPORT.md](PHASE60_REPORT.md) P60-D extends the critical/serious axe baseline to the **main admin flows** (the Freemius-premium tier). The **full** WCAG AA pass below remains deferred as the **WP.org public-listing gate**.

**Effort:** High | **Impact:** Low for private/internal; High/required for public distribution.

---

## Monetization & Distribution

*No tasks here yet.*

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

### Granular Custom-Role Permission Engine (GitHub-style)

**Files:** `includes/class-wpsg-permissions.php` (introduced in P52-A), role/cap setup in `wp-super-gallery.php`, a new admin UI + storage.

**Context:** P52-A establishes the authorization foundation as a centralized `WPSG_Permissions` action→requirement map — every protected action declares its required tier (`manage_options` / `manage_wpsg` / per-space grant level) and scope in one place, with the named tiers (viewer / editor / owner / wpsg_editor / admin) acting as fixed **presets** over that map. This future task is the optional **builder layer** on top of that foundation: let site admins compose **custom roles** from atomic capabilities (à la GitHub's Read/Triage/Write/Maintain/Admin presets plus Enterprise custom repository roles), with optional **per-space role overrides**.

**What it would take:**
- Promote the implicit atomic actions in the `WPSG_Permissions` map to first-class, individually grantable capabilities.
- A storage schema for custom role definitions (composition of base preset + added/removed atomic caps), and optional per-space scoping of those definitions.
- An admin UI to create/edit custom roles and assign them, plus a migration path from the fixed presets.
- Permission resolution that layers custom roles over the preset map without breaking the existing tier checks or the P52-A regression matrix.

**Rationale for deferral:** A full custom-role engine is a self-contained system (storage + UI + migration + resolution) whose cost is the management surface, not the enforcement. With only a handful of actor archetypes today, it is premature (YAGNI). The P52-A centralized map deliberately makes this work **additive rather than a rewrite** — revisit only if a concrete multi-tenant or custom-role requirement emerges. Deferred from [PHASE52_REPORT.md](PHASE52_REPORT.md) Track P52-A (decided 2026-06-15).

**Effort:** High (multi-track / likely its own phase) | **Impact:** Low today; High if a multi-tenant custom-role need appears.

---

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

*No tasks here yet.*

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

*Updated: June 17, 2026 (P54 planning) — Added the Phase 54 production-readiness review follow-ons (deferred from [PHASE54_REPORT.md](PHASE54_REPORT.md), which is tight must-fix only): four LayoutBuilder enhancements (Editor UX Polish, Responsive/Per-Breakpoint Editing, Text/Caption Layers, Design-Tool Affordances) under Builder, ordered by user priority; "Gallery — Admin-Control Additions"; a new Code Quality & Refactoring section (adapter data extraction / registration-seam / field-map unification; large-file decomposition); Internationalization (full admin i18n migration — P54-B does user-facing only); Accessibility (full WCAG AA — P54-C does the front-end critical/serious baseline); and Monetization & Distribution (licensing/update infra), cross-linked to the new [MONETIZATION_OPTIONS.md](MONETIZATION_OPTIONS.md).*

*Updated: June 23, 2026 (P55/P56/P57 planning) — Promoted the entire **Code Quality & Refactoring** section (adapter data-extraction / registration-seam / field-map unification + large-file decomposition) to [PHASE55_REPORT.md](PHASE55_REPORT.md); **Gallery — Admin-Control Additions** (all four pieces, incl. listing-mode exposure) to [PHASE56_REPORT.md](PHASE56_REPORT.md); and the two **Settings & Admin UI** items plus the LayoutBuilder **Design-Tool Affordances** (swatches/eyedropper, persistent guides, rotation handles) and the layer-search slice of **Editor UX Polish** to [PHASE57_REPORT.md](PHASE57_REPORT.md). Emptied sections (Code Quality & Refactoring, Settings & Admin UI) keep their headers with a "No tasks here yet" placeholder. Trimmed "Editor UX Polish" to its remaining deferred clipboard + alignment-shortcut pieces.*

*Updated: June 26, 2026 (P58–P61 planning) — Promoted LayoutBuilder **Editor UX Polish** → [PHASE58_REPORT.md](PHASE58_REPORT.md) P58-A, **Responsive / Per-Breakpoint Editing** → P58-B, and **Text / Caption Layers** → [PHASE59_REPORT.md](PHASE59_REPORT.md). Added four net-new LayoutBuilder tracks directly from planning (Starter Template Library, Marquee Multi-Select, Slot Entrance Animations, Auto-Grid Generator — P58-C/D/E/F). Added three new Builder backlog entries in their place (History Persistence, Reusable Symbol/Linked Slots, Slot Constraints/Pinning). Scoped the `.pot`/user-facing i18n slice and the admin-flow a11y slice into [PHASE60_REPORT.md](PHASE60_REPORT.md) P60-B/P60-D while keeping the **full** admin i18n migration and **full** WCAG AA audit deferred as the WP.org public-listing gate. Promoted **Licensing + Update Infrastructure** → [PHASE61_REPORT.md](PHASE61_REPORT.md) (Freemius premium target chosen); the free WP.org "lite" tier stays deferred.*

*Updated: June 26, 2026 (P58-A batch-1 execution) — Added Builder entry "LayoutBuilder — Align/Distribute Keyboard Shortcuts", deferred from [PHASE58_REPORT.md](PHASE58_REPORT.md) P58-A during implementation (binding scheme needs design); the remaining P58-A pieces — clipboard, slot opacity, nudge steps — ship in batch 1.*

*Updated: June 29, 2026 (P58-B execution) — Added two Builder entries deferred from [PHASE58_REPORT.md](PHASE58_REPORT.md) P58-B: "Published Responsive Canvas Sizing (Breakpoint Render Model)" (the on-page sizing / progressive-shrink problem needs a manual-testing pass + careful planning) and "Faithful Preview (Breakpoint Render + Runtime Effects)" (align the builder Preview path with the published render and surface glow/bounce/entrance/tilt effects in Preview).*

*Updated: June 30, 2026 (P59-A execution) — Added Builder entry "LayoutBuilder — Clickable / Linking CTA Text Layer", deferred from [PHASE59_REPORT.md](PHASE59_REPORT.md) per user direction — Phase 59 ships single-style, non-interactive text layers; the linking/CTA variant (href + accessible anchor rendering + URL control) is split off as a follow-on.*
