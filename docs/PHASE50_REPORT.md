# Phase 50 - Gallery Spaces Completion, Adapters & Shared Package Extraction

**Status:** In progress
**Created:** 2026-06-09
**Last updated:** 2026-06-11

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P50-A | Gallery Spaces — cross-space campaign move: atomic `space_id` re-stamp across all 4 tables | Done (2026-06-11) | Medium |
| P50-B | Gallery Spaces — per-space library isolation: `wpsg_space_library_assoc` join table; overlay/font visibility in delegated mode | To do | Medium |
| P50-C | Adapters — Stacked / Deck: cards with offset/rotation, swipe to cycle | Done (2026-06-11) | Medium |
| P50-D | Adapters — Isotope / Filterable Grid: FLIP-animated filter/sort; extends adapter interface | To do | Medium-High |
| P50-E | Adapters — Waterfall: masonry variant with staggered CSS entrance animations | Closed — already shipped via P31-G | Low |
| P50-F | Build & Bundle — Service Worker metadata caching: stale-while-revalidate for gallery metadata | To do | Medium |
| P50-G | Infrastructure — Shared Package extraction: npm workspaces, `packages/shared-utils/`, `packages/shared-ui/` | To do | Large |

---

## Rationale

1. Cross-Space Campaign Move and Per-Space Library Isolation are the last Phase 47 follow-ons; completing them closes the Gallery Spaces feature set and removes two long-standing asterisks from the P47 deliverable.
2. The three adapters (Stacked/Deck, Isotope/Filterable Grid, Waterfall) clear the bulk of the Phase 22 deferred adapter backlog; only Timeline and Grid with Variable Aspect-Ratio Tiles remain after Phase 50.
3. Service Worker metadata caching unblocks offline/mobile use cases that have been gated since Phase 49 surfaced the open questions — scope, cache budget, and SW coexistence are all resolved here.
4. The shared-package extraction is the highest-leverage infrastructure item remaining: `src/lib/` utilities and the decoupled Auth/Lightbox components have been ready since Phase 46; the only remaining step is the monorepo scaffolding. Deferring further adds copy-paste maintenance cost on each new project.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Move endpoint shape | `POST /campaigns/{id}/move` (dedicated endpoint) rather than a `PUT /campaigns/{id}` patch — the transaction semantics and dual-space authorization are distinct enough to warrant a separate route. |
| B | Library isolation scope | Per-space overlay/font visibility only in `delegated` isolation mode; `open`-mode spaces see all global assets, consistent with Phase 47 Key Decision I. |
| C | Adapter interface extension (Isotope) | Add optional `filterKey?: string` and `sortKey?: string` to `GalleryAdapterProps` behind a discriminated union so non-filterable adapters are unaffected and no breaking change is introduced. |
| D | SW metadata caching scope | Stale-while-revalidate for gallery public metadata only (campaign list, media items); admin SPA routes and all mutation endpoints remain network-first. Cache budget: 5 MB per space, LRU eviction. |
| E | Monorepo tooling | npm workspaces (already present in the project) — no new tool required. `packages/shared-utils/` for `src/lib/` utilities; `packages/shared-ui/` for Auth and Lightbox components. |

## Execution Priority

1. **P50-E** — Waterfall adapter: smallest track, no dependencies, quick confidence check before larger adapter work.
2. **P50-C** — Stacked/Deck adapter: self-contained, reuses `useSwipe`.
3. **P50-A** — Cross-Space Campaign Move: PHP backend; depends on P47 tables.
4. **P50-B** — Per-Space Library Isolation: PHP backend; depends on P47 tables.
5. **P50-D** — Isotope/Filterable Grid: extends the adapter interface; done after simpler adapters to avoid any interface churn.
6. **P50-F** — Service Worker: careful not to break the existing SW registration; done late to avoid disrupting local dev builds.
7. **P50-G** — Shared Package: largest track; monorepo restructure touches all `src/lib/` and Auth/Lightbox imports; done last to avoid blocking other tracks.

---

## Track P50-A — Cross-Space Campaign Move

### Problem

Phase 47 v1 assigns campaigns to a space at creation time only; there is no post-hoc move operation. Moving a campaign requires atomically re-stamping `space_id` across all four campaign-scoped custom tables (`wpsg_analytics_events`, `wpsg_audit_log`, `wpsg_media_refs`, `wpsg_access_requests`) plus the campaign's `_wpsg_space_id` post meta. A partial move — where some tables are updated and others are not — would corrupt isolation guarantees.

### Fix

- **New REST endpoint:** `POST /wpsg/v1/campaigns/{id}/move` with body `{ "target_space_id": int }`.
- **Authorization:** the request must be authorized as `owner` on both the source space (current `_wpsg_space_id`) and the target space. `manage_options` super-admins bypass the dual-space check.
- **Transaction:** wrap all five `UPDATE … SET space_id = %d WHERE campaign_id = %d` statements (four custom tables + `_wpsg_space_id` post meta update) in a `$wpdb->query('START TRANSACTION')` block. On any failure, `ROLLBACK` and return a 500 with the failing table name.
- **Cache:** call `bump_cache_version()` after a successful commit so stale space-filtered query results are invalidated.
- **Frontend:** "Move to space" action in the Campaigns tab (owner-only), gated by the user's space grants. Confirmation dialog lists: campaign name, source space, target space, and a note that all analytics, audit, media refs, and access requests move with it.

**Dependencies:** P47-A (space_id columns), P47-B (space permission layer), P47-C (space CRUD REST).

**Files:** new `class-wpsg-rest-campaigns-move.php` (or added to existing campaign REST controller), `class-wpsg-db.php` (transaction helper), `class-wpsg-rest-base.php` (authorization reuse), Campaigns tab React component.

### Acceptance criteria

- A campaign moved from Space A to Space B has `space_id = B` in all four custom tables and in `_wpsg_space_id` post meta.
- Space A no longer lists the campaign; Space B lists it immediately after the move.
- A simulated mid-transaction failure leaves the campaign unchanged (rollback confirmed).
- A `manage_wpsg`-only user (not owner of target space) receives 403.
- Moving a campaign that is already in the target space is a no-op (200, no DB writes).

### Validation

- PHP: transaction test with a mock failure injected after the second table update; confirm rollback.
- Manual: move a campaign between two spaces; verify it appears only in the target space's Campaigns tab; verify analytics are present under the target space.

### Implementation rationale (2026-06-11)

- **Claims re-verified, with corrections:** the REST namespace is `wp-super-gallery/v1` (the doc's `wpsg/v1` does not exist); the endpoint went into the existing `rest/class-wpsg-campaign-controller.php` rather than a new file, following the archive/restore/duplicate precedent; `bump_cache_version()` lives in `class-wpsg-rest-base.php`, not `class-wpsg-db.php`. All four custom tables have both `campaign_id` and `space_id` columns as claimed.
- **Discovered P47 debt:** the `space_id` columns added by the P47 v11 migration are *never written on insert* — every row in all four tables sat at the `0` default, even though the analytics controller already filters on `space_id`. This track fixed the audit path (`WPSG_DB::insert_audit_entry` now stamps new rows with the campaign's current space, with an optional `space_id` override), because the move's own `campaign.moved_space` audit entry must land in the target space. Insert-time stamping for analytics events, media refs, and access requests remains open P47 debt — a natural companion slice for P50-B.
- **Transaction:** `WPSG_DB::move_campaign_to_space()` wraps the four table UPDATEs plus a direct-SQL `_wpsg_space_id` postmeta write in one transaction; postmeta is written with raw SQL (not `update_post_meta`) so it participates in the transaction without mutating the object cache pre-COMMIT, and the meta cache is flushed on every exit path. On failure it rolls back and returns the failing table name, surfaced in the 500 response. A filter (`wpsg_move_campaign_simulate_failure`) provides the test seam for the mid-transaction rollback test.
- **Authorization:** `require_campaign_space_move` (rest-base) requires `owner` via `get_effective_space_level` on both the campaign's source space (falling back to the default space for pre-backfill campaigns) and the target. The `manage_options` bypass and the "manage_wpsg-only user gets 403 on delegated targets" criterion both fall out of P47-B's existing level resolution — no special-casing needed.
- **Frontend:** `format_space` now exposes `effectiveLevel` (safe: the spaces-list transient is already keyed per user), which gates the row-level "Move" button — shown only when a specific owned space is selected and at least one other active owned space exists. `CampaignMoveSpaceModal` mirrors the duplicate modal: owner-only target Select (source and archived spaces excluded) plus a note that analytics, audit history, media refs, and access requests move with the campaign.
- **Validation done:** new `WPSG_P50A_Campaign_Move_Test` (5 tests: full re-stamp + list flip, mid-transaction rollback, delegated-target 403 for manage_wpsg-only user, same-space no-op, archived-target rejection); full PHP suite 918 tests OK; 9-test modal suite; full frontend suite 2229/2229; `tsc --noEmit` and production build clean. The PHP rollback test documents (and contains, via explicit cleanup + COMMIT) the WP-test-framework interaction where a real transaction implicitly commits the per-test wrapper. **Remaining:** the manual two-space move pass on a live WordPress site.

---

## Track P50-B — Per-Space Library Isolation (Overlays / Fonts)

### Problem

Phase 47 ships overlays and fonts as a global shared library — all spaces see the same assets. For fully delegated tenants (`isolation_mode = 'delegated'`), tenant A should not see tenant B's custom overlays or uploaded fonts.

### Fix

- **New table:** `wpsg_space_library_assoc(id, space_id BIGINT, asset_type ENUM('overlay','font'), asset_id BIGINT, created_at DATETIME)`. An overlay or font is visible to a space only if an association row exists. `open`-mode spaces bypass the association table and see all global assets.
- **DB helpers:** `get_space_library_assets(space_id, asset_type)`, `associate_asset(space_id, type, asset_id)`, `dissociate_asset(space_id, type, asset_id)`.
- **REST filtering:** overlay list endpoint (`GET /wpsg/v1/overlays`) and font list endpoint — when the request is scoped to a `delegated` space, filter results through `get_space_library_assets()`.
- **Admin UX:** "Shared assets" section in the `SpaceManagementView` modal (owner-only). Two sub-lists (Overlays, Fonts) showing all global assets with checkboxes to associate/dissociate. Changes fire `associate_asset` / `dissociate_asset` REST calls.
- **Migration:** on upgrade, insert association rows for all existing assets into all existing `delegated` spaces so no delegated space loses access to pre-existing assets.

**Dependencies:** P47-A, P47-B, P47-G (shared-vs-per-space decision finalized).

**Files:** `class-wpsg-db.php` (new table + helpers), overlay REST controller, font REST controller, `SpaceManagementView.tsx`.

### Acceptance criteria

- A delegated space with no association rows sees an empty overlay/font list.
- Associating an overlay with a delegated space makes it appear in that space's overlay picker.
- An `open`-mode space sees all overlays/fonts regardless of association rows.
- The migration associates all pre-existing assets with all pre-existing delegated spaces (no regression).

### Validation

- PHP: create a delegated space; assert overlay list is empty; associate one overlay; assert list has one entry.
- Manual: log in as a space-grantee of a delegated space; open the overlay library; confirm only associated overlays are visible.

---

## Track P50-C — Stacked / Deck Adapter

### Problem

No card-stack adapter exists in the registry. This layout is well-suited for campaign highlight presentations and mobile-first "story" browsing (one item at a time with a satisfying swipe gesture).

### Fix

- New `StackedDeckAdapter` implementing `GalleryAdapterProps`.
- **Layout:** render N items in a `position: relative` container; the top card is fully visible and centered; cards beneath it peek with incrementally increasing `translateX` (±4 px per depth level) and `rotate` (±1.5 deg per level) transforms. Z-index descends with depth.
- **Interaction:** swipe left/right via `useSwipe` from `src/lib/useSwipe.ts` — dismisses the top card to the back of the stack with a CSS fly-out transition. Click on the top card opens the lightbox; click on a peeking card brings it to the front.
- **Keyboard:** `ArrowLeft` / `ArrowRight` cycle the stack; `Enter` / `Space` open the lightbox.
- **Register:** `registerAdapter('stacked', StackedDeckAdapter)`.

**Files:** New `src/components/Galleries/Adapters/stacked/StackedDeckAdapter.tsx`, `adapterRegistry.ts`.

### Acceptance criteria

- Top card is fully visible; ≥ 2 cards peek behind it at correct offsets.
- Swiping left sends the top card to the back; the next card becomes top with a smooth transition.
- Clicking a peeking card promotes it to the top without opening the lightbox.
- Keyboard navigation cycles the stack; Enter opens the lightbox on the current top card.

### Validation

- Manual: open a gallery in stacked mode; swipe and click; confirm all interactions; test on a mobile viewport.

### Implementation rationale (2026-06-11)

- **Claims re-verified before building:** `useSwipe` exists at `src/lib/useSwipe.ts` with the `onSwipeLeft`/`onSwipeRight` API the track assumes; no stack-style adapter exists in the registry. `CoverflowAdapter` (P48-G) was used as the structural template (`useCarousel` + `useLightbox` + `LazyImage` + `_shared/runtimeCommon` helpers, lazy registry entry).
- **Implementation:** `StackedDeckAdapter` (id `stacked`). Top card is `media[currentIndex]`; each card's depth is `(idx − currentIndex) mod N`. Peek transforms follow the spec exactly — alternating sign per depth level, ±4 px translateX and ±1.5° rotate per level — with z-index descending by depth. Cards deeper than 4 stay mounted but hidden so transforms transition smoothly when the stack rotates. Dismissal (swipe in either direction, or ArrowRight) flies the top card out (`translateX(±130%)`, 320 ms, elevated z-index) before it settles at the back; ArrowLeft cycles backward; Enter/Space on the stage opens the lightbox; click semantics per spec (top → lightbox, peeking → promote). Transitions are class-based (`wpsg-stacked-card`) with a `prefers-reduced-motion` override.
- **Registration:** capabilities `carousel-layout`/`lightbox`/`keyboard-nav`/`touch-swipe`, settingGroups `['media-frame']` (no new setting keys, so no PHP field-map changes), `paginationOwnership: 'adapter'`, lazy-loaded (own Vite chunk confirmed in the build output).
- **Deviation from the track's file list — PHP allowlist:** the doc omitted that `WPSG_CPT::VALID_ADAPTERS` allowlists `adapterId` values in the settings sanitizer; without an entry, a saved `stacked` adapterId is silently dropped. Re-evaluation also surfaced a **live P48 bug**: `coverflow` and `pinterest` were registered in the TS registry but never added to `VALID_ADAPTERS`, so neither could actually be persisted in gallery configs. Backfilled both alongside `stacked` (in `class-wpsg-cpt.php` and the sanitizer's no-CPT fallback list) and added a TS↔PHP adapter-id parity test to `adapterSettingsParity.test.ts` so a future adapter cannot repeat this.
- **Known nit (out of scope, recorded for a future slice):** `CoverflowAdapter`'s hover CSS targets `[data-wpsg="…"][data-wpsg-role="…"]` attributes, but `getWpsgDebugProps` emits `data-wpsg-component`/`data-wpsg-slot` and only in debug mode — so Coverflow's zoom-on-hover affordance never activates in production. The stacked adapter uses stable class names instead.
- **Validation done:** 12-test colocated suite using the real `useCarousel`/`useSwipe` (deck order, peek offsets, fly-out + settle, promotion, keyboard nav, lightbox, empty/single/video states); registry coverage block; added to the shared adapter smoke suite; `tsc --noEmit` clean; full frontend suite 2220/2220 green; `php -l` clean on both edited PHP files; production build passes. **Remaining:** the manual WordPress/mobile-viewport pass listed above.

---

## Track P50-D — Isotope / Filterable Grid Adapter

### Problem

No adapter supports animated filter/sort transitions. Filtering by media type or sort by date requires a full re-render with no animation today.

### Fix

- New `IsotopeAdapter` implementing `GalleryAdapterProps`.
- **Interface extension:** add `filterKey?: keyof GalleryMediaItem` and `sortKey?: keyof GalleryMediaItem` as optional props to `GalleryAdapterProps` behind a discriminated union — adapters that do not declare `supportsFilter: true` are unaffected.
- **Layout:** CSS Grid with uniform columns; items filtered client-side against `filterKey` value; sorted by `sortKey`.
- **FLIP animation:** before applying the new filter/sort, snapshot all item `getBoundingClientRect()` positions; after layout update, animate each item from its old to new position using `transform: translate(dx, dy)` + `opacity` with `requestAnimationFrame`.
- **Filter controls:** a row of `Chip` buttons (Mantine) above the grid; one chip per unique `filterKey` value in the current item set, plus an "All" chip. Sort control is a `Select` (Mantine).
- **Register:** `registerAdapter('isotope', IsotopeAdapter)`.

**Files:** New `src/components/Galleries/Adapters/isotope/IsotopeAdapter.tsx`, `src/components/Galleries/Adapters/GalleryAdapter.ts` (optional props + `supportsFilter` discriminant), `adapterRegistry.ts`.

### Acceptance criteria

- Clicking a filter chip hides non-matching items and animates remaining items into their new positions.
- Changing the sort order animates all visible items to their new positions.
- "All" chip shows all items.
- Non-filterable adapters are unaffected by the interface change (TypeScript compiles cleanly).

### Validation

- Manual: render a gallery with mixed MIME types; filter by image; filter by video; sort by date ascending/descending; confirm FLIP animations play.
- TypeScript: `tsc --noEmit` passes with no errors on the extended interface.

---

## Track P50-E — Waterfall Adapter

### Problem

No masonry-with-entrance-animation adapter exists. The existing `MasonryGallery` uses static layout with no entrance animation; a Waterfall variant adds visual polish for campaign highlight moments.

### Fix

- New `WaterfallAdapter` re-using the column-packing layout algorithm from `MasonryGallery.tsx`.
- Add staggered `@keyframes` entrance animation per item: `opacity: 0 → 1`, `transform: translateY(20px) → translateY(0)` with `animation-delay: calc(var(--item-index) * 60ms)`. Set `--item-index` as a CSS custom property on each item element.
- Items that enter the viewport for the first time (on initial render or on scroll) trigger the animation; items already rendered do not re-animate on filter/sort changes.
- **Register:** `registerAdapter('waterfall', WaterfallAdapter)`.

**Files:** New `src/components/Galleries/Adapters/waterfall/WaterfallAdapter.tsx`, `adapterRegistry.ts`.

### Acceptance criteria

- Gallery renders in a masonry column layout identical to `MasonryGallery` (same packing algorithm).
- On initial load, each item animates in with a staggered delay; items at larger index values appear later.
- Items do not re-animate on subsequent renders (e.g. window resize, prop updates) once visible.

### Validation

- Manual: render a gallery in waterfall mode; confirm staggered fade-in; resize window; confirm no re-animation.

### Re-evaluation & closure (2026-06-11)

The track's premise is stale: **P31-G already shipped this feature** as a Masonry adapter setting rather than a separate adapter. `masonryEntranceAnimation: 'none' | 'waterfall'` plus `masonryEntranceStagger` (default 60 ms) live in the masonry setting group, implemented in `MasonryGallery.tsx` with per-tile `animation-delay: index × stagger`, an `opacity 0→1` / `translateY → 0` keyframe, and a `prefers-reduced-motion` guard. That covers every acceptance criterion here: identical packing (it *is* MasonryGallery), staggered first-render entrance by index, and no re-animation on subsequent renders (the CSS animation runs once per mounted tile).

**Decision:** no separate `waterfall` adapter id. A standalone adapter would duplicate MasonryGallery behind a second registry entry whose only difference is defaulting an existing setting on — adding registry noise, an extra settings-parity surface, and a redundant entry in every adapter selector. Track closed as already satisfied; the Phase 22 deferred-adapter backlog accounting in this doc's Rationale §2 should count Waterfall as previously delivered.

---

## Track P50-F — Service Worker Metadata Caching

### Problem

The existing service worker caches static assets (JS, CSS, images) but makes a fresh network request for every gallery metadata load. Offline use of the public gallery (grid + metadata shell) is impossible; slow connections show a blank grid until the API responds.

**Phase 49 open questions resolved:**
- Q1: Scope = gallery grid + metadata shell only (not full lightbox/video playback offline).
- Q2: Coexistence = versioned cache name (`wpsg-meta-v1`); the WPSG SW registers under a dedicated scope that does not conflict with a host site's SW.
- Q3: Cache budget = 5 MB per space; LRU eviction when exceeded.

### Fix

- Add a stale-while-revalidate handler in the service worker for the two gallery metadata endpoints:
  - `GET /wpsg/v1/campaigns` (campaign list)
  - `GET /wpsg/v1/campaigns/{id}/media` (media item list)
- Cache storage name: `wpsg-meta-v1`. Cache expiry: 5 minutes TTL on top of stale-while-revalidate (background refresh fetches fresh data within that window).
- Admin SPA routes (`/wp-admin/`, `admin-ajax.php`) and all non-GET requests remain network-first with no caching.
- SW scope: registered under the plugin's public asset path only — does not claim the root scope.
- On SW update: call `skipWaiting()` + `clients.claim()` to activate immediately without requiring a page reload.

**Files:** `src/sw.ts` (or the existing service worker entry file), `vite.config.ts` (Workbox or manual SW config), plugin PHP file (SW registration path).

### Acceptance criteria

- Load a gallery while online; go offline; reload — gallery grid renders with stale metadata, not a blank state.
- Background revalidation fires when the network is restored; data refreshes without a full reload.
- Admin SPA does not serve cached responses offline (shows a network-error state as expected).
- Opening the plugin on a site that already has a service worker does not conflict with the host SW.

### Validation

- Manual: Chrome DevTools → Application → Service Workers; confirm `wpsg-meta-v1` cache is populated. Toggle offline; reload; confirm gallery renders. Toggle online; wait 5 seconds; confirm cache entry is refreshed.

---

## Track P50-G — Shared Package Extraction (Monorepo)

### Problem

Five utility modules in `src/lib/` and five Auth/Lightbox components have been fully decoupled from all WPSG-specific imports since Phase 46 — confirmed by P46-D/E. They are prime candidates for extraction to shared npm packages, but they remain inside the application tree. Every new project reusing these files requires manual copying, diverging over time.

**Files ready for extraction (confirmed no WPSG deps):**
- `src/lib/sanitizeCss.ts`, `cssUnits.ts`, `safeLocalStorage.ts`, `useSwipe.ts`, `scrollLock.ts`
- `src/components/Auth/LoginForm.tsx`, `AuthBarFloating.tsx`, `AuthBarMinimal.tsx`
- `src/components/Galleries/Shared/Lightbox.tsx`, `KeyboardHintOverlay.tsx`

### Fix

1. **Root `package.json`:** add `"workspaces": ["packages/*"]` (npm workspaces — already supported by the current Node/npm version).

2. **`packages/shared-utils/`:**
   - `package.json`: `name: "@wp-super-gallery/shared-utils"`, `version: "1.0.0"`, `main: "src/index.ts"`, `peerDependencies: { react: ">=18" }`.
   - `tsconfig.json`: extends root; `rootDir: "src"`, `declarationDir: "dist"`.
   - `src/index.ts`: re-exports from the five utility files.
   - Move the five `src/lib/` files into `packages/shared-utils/src/`.

3. **`packages/shared-ui/`:**
   - `package.json`: `name: "@wp-super-gallery/shared-ui"`, peer deps on React + `@mantine/core`.
   - `tsconfig.json`: extends root.
   - `src/index.ts`: re-exports Auth and Lightbox components.
   - Move Auth components and Lightbox/KeyboardHintOverlay into `packages/shared-ui/src/`.

4. **Import updates:** update all intra-repo imports:
   - `@/lib/…` → `@wp-super-gallery/shared-utils`
   - `@/components/Auth/…` → `@wp-super-gallery/shared-ui` (for the moved files only)
   - `@/components/Galleries/Shared/Lightbox` → `@wp-super-gallery/shared-ui`
   - Configure `tsconfig.json` `paths` or rely on npm workspace resolution.

5. **Delete** the original `src/lib/` directory and the moved component files from `src/components/`.

6. **CI:** add `npm run build` (tsc) in each package to the CI matrix; fail the pipeline if either package fails to compile.

**Files:** root `package.json`, `tsconfig.json`, `packages/shared-utils/` (new), `packages/shared-ui/` (new), all files with `@/lib/` imports (grep to find), `src/components/Auth/` (moved files removed), `src/components/Galleries/Shared/` (Lightbox moved).

### Acceptance criteria

- `npm install` from root resolves all workspace deps with no errors.
- `npm run build` passes in both packages with no type errors.
- `npm test` passes in the main app with updated import paths.
- No remaining `@/lib/` imports reference the deleted `src/lib/` directory.
- The main app bundle size is unchanged (workspace packages are still bundled by Vite — no runtime regression).

### Validation

- `tsc --noEmit` in root, `packages/shared-utils/`, and `packages/shared-ui/` all pass.
- `npm test` full suite passes.
- `grep -r "from '@/lib/"` returns no results in `src/`.
