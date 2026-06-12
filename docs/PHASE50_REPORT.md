# Phase 50 - Gallery Spaces Completion, Adapters & Shared Package Extraction

**Status:** In progress
**Created:** 2026-06-09
**Last updated:** 2026-06-11 (P50-H added)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P50-A | Gallery Spaces — cross-space campaign move: atomic `space_id` re-stamp across all 4 tables | Done (2026-06-11, manual test passed) | Medium |
| P50-B | Gallery Spaces — per-space library isolation: `wpsg_space_library_assoc` join table; overlay/font visibility in delegated mode | Done (2026-06-11) | Medium |
| P50-C | Adapters — Stacked / Deck: cards with offset/rotation, swipe to cycle | Done (2026-06-11) | Medium |
| P50-D | Adapters — Isotope / Filterable Grid: FLIP-animated filter/sort; extends adapter interface | To do | Medium-High |
| P50-E | Adapters — Waterfall: masonry variant with staggered CSS entrance animations | Closed — already shipped via P31-G | Low |
| P50-F | Build & Bundle — Service Worker metadata caching: stale-while-revalidate for gallery metadata | To do | Medium |
| P50-G | Infrastructure — Shared Package extraction: npm workspaces, `packages/shared-utils/`, `packages/shared-ui/` | To do | Large |
| P50-H | Layout Builder UX — OS-style menu bar (File / Edit / View / Options): fixes closed-panel bug, declutters toolbar, introduces preferences surface | Done (2026-06-11) | Medium |

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
| F | Layout Builder menu bar structure | File / Edit / View / Options — four menus rather than a single hamburger or a flat toolbar extension. Toolbar retains Undo/Redo as always-visible icon buttons (one-click frequency warrants it); all other secondary actions move into menus. Canvas panel is made non-closeable independently of the menu bar work. |
| G | Layout persistence default | Shared across all templates remains the default (current behaviour, zero migration cost). The Options menu exposes a toggle; per-template mode is backed by including `templateId` in the localStorage key — no new persistence layer required. |

## Execution Priority

1. **P50-E** — Waterfall adapter: smallest track, no dependencies, quick confidence check before larger adapter work.
2. **P50-C** — Stacked/Deck adapter: self-contained, reuses `useSwipe`.
3. **P50-A** — Cross-Space Campaign Move: PHP backend; depends on P47 tables.
4. **P50-B** — Per-Space Library Isolation: PHP backend; depends on P47 tables.
5. **P50-H** — Layout Builder menu bar: unblocks UX (closed-panel bug) and declutters the toolbar before any further Layout Builder feature work adds to the toolbar debt.
6. **P50-D** — Isotope/Filterable Grid: extends the adapter interface; done after simpler adapters to avoid any interface churn.
7. **P50-F** — Service Worker: careful not to break the existing SW registration; done late to avoid disrupting local dev builds.
8. **P50-G** — Shared Package: largest track; monorepo restructure touches all `src/lib/` and Auth/Lightbox imports; done last to avoid blocking other tracks.

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
- **Validation done:** new `WPSG_P50A_Campaign_Move_Test` (5 tests: full re-stamp + list flip, mid-transaction rollback, delegated-target 403 for manage_wpsg-only user, same-space no-op, archived-target rejection); full PHP suite 918 tests OK; 9-test modal suite; full frontend suite 2229/2229; `tsc --noEmit` and production build clean. The PHP rollback test documents (and contains, via explicit cleanup + COMMIT) the WP-test-framework interaction where a real transaction implicitly commits the per-test wrapper. **Remaining:** the manual test plan below.

### Manual test plan (P50-A)

**Deploy to the local dev site**

1. `npm run build:wp` (build + copy assets into `wp-plugin/wp-super-gallery/assets/`).
2. `./update_dev_plugin.sh` (deploy the plugin to the live dev site).
3. Open `https://wordpress.lan`, log in as the admin user, and open the gallery admin panel.

**Fixtures**

- Two active spaces you own (as an administrator with `manage_options` you own every space): Actions menu → "Manage spaces" → create "Space A" and "Space B" (open mode) if they don't exist.
- One campaign in Space A with a few media items (select Space A in the space selector before creating it).
- Optional, for the analytics check: view the campaign's public gallery a few times first so it has analytics events.

**Happy path**

- [ ] With the space selector on "All spaces", campaign rows show **no** Move button (move requires an explicit source space).
- [ ] Select Space A — rows now show a "Move" button (between Clone and Export).
- [ ] Click Move on the campaign. The dialog shows the campaign title, "From space: Space A", and a target select that offers Space B but **not** Space A itself.
- [ ] Pick Space B and confirm. A success notification appears and the campaign immediately disappears from Space A's list.
- [ ] Switch the space selector to Space B — the campaign is listed.
- [ ] Audit tab: a `campaign.moved_space` entry exists with the from/to space ids in its details.
- [ ] Analytics scoped to Space B include the campaign's pre-move events (the move re-stamps them).

**DB spot-check (optional)**

Run against the dev site's database, with `<ID>` = campaign post id; every value should equal Space B's id:

```sql
SELECT space_id FROM wp_wpsg_analytics_events  WHERE campaign_id = <ID>;
SELECT space_id FROM wp_wpsg_audit_log         WHERE campaign_id = <ID>;
SELECT space_id FROM wp_wpsg_media_refs        WHERE campaign_id = <ID>;
SELECT space_id FROM wp_wpsg_access_requests   WHERE campaign_id = <ID>;
SELECT meta_value FROM wp_postmeta WHERE post_id = <ID> AND meta_key = '_wpsg_space_id';
```

**Authorization gating**

- [ ] Create a delegated space "Tenant C" with no grant for a `manage_wpsg`-only user (editor role + `manage_wpsg` cap, not administrator). Log in as that user: Tenant C is not offered as a move target, and inside Tenant C's campaign list (if reachable at all) no Move button renders. The direct-API 403 for this case is covered by `WPSG_P50A_Campaign_Move_Test::test_manage_wpsg_only_user_denied_for_delegated_target`.
- [ ] Archive Space B (Manage spaces) — it disappears from the move target options.

**Not manually testable:** the mid-transaction rollback path needs failure injection; it is covered by the automated `wpsg_move_campaign_simulate_failure` test.

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

### Implementation rationale (2026-06-11)

- **Claims re-verified, with corrections:** the track doc described `asset_id BIGINT` — both `WPSG_Overlay_Library` and `WPSG_Font_Library` use UUID strings (`wp_generate_uuid4()`), so the schema was corrected to `asset_id VARCHAR(36)`. `WPSG_Font_Library` uses a WP option for storage, not a DB table; `get_all()` still returns `{ id: string, ... }` records, so the asset-id assumption in the backfill holds. The actual REST endpoints are `/admin/overlay-library` and `/admin/font-library` (the track doc listed `/wpsg/v1/overlays`).
- **DB table:** `wpsg_space_library_assoc(id BIGINT UNSIGNED AUTO_INCREMENT PK, space_id BIGINT UNSIGNED NOT NULL, asset_type VARCHAR(10) NOT NULL, asset_id VARCHAR(36) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)` with UNIQUE `(space_id, asset_type, asset_id)`. `DB_VERSION` bumped `'11'` → `'12'`.
- **REST filtering:** `filter_library_for_space(array $items, $request, string $asset_type)` in `class-wpsg-content-controller.php` — reads the optional `?space=` query param; if the named space exists and is `delegated`, filters items by `get_space_library_assets()`; open-mode / unscoped requests pass through unchanged. Applied to both `list_overlay_library()` and `list_font_library()`.
- **Association endpoints:** `GET/POST/DELETE /spaces/{id}/library` in `class-wpsg-space-controller.php`. GET returns `{ overlay: string[], font: string[] }`. POST/DELETE require `owner` level on the space (checked via `get_effective_space_level()`), validated through the same `require_space_owner()` middleware already used for access-grant writes. `dissociate_library_asset()` reads `assetType`/`assetId` from query string because `ApiClient.delete()` does not accept a body.
- **Migration:** `maybe_backfill_space_library_assoc()` iterates all delegated spaces × all existing overlays × all existing fonts, calling `associate_asset()` for each combo. Guarded by `wpsg_space_library_assoc_backfilled` option so it runs exactly once.
- **Admin UX:** new "Library" tab in `SpaceManagementView.tsx`, enabled only when a delegated space is selected (`isolationMode === 'delegated'`). Two sections — Overlays and Fonts — each renders all global assets as `Checkbox` rows. Checked state comes from `GET /spaces/{id}/library`; toggles fire `POST` (associate) or `DELETE ?assetType=…&assetId=…` (dissociate). Queries enabled only when the Library tab is active to avoid unnecessary fetches.
- **Test isolation bug fixed:** `test_migration_backfills_existing_assets_into_delegated_spaces` calls `WPSG_DB::maybe_upgrade()`, which internally calls `maybe_create_space_library_assoc_table()` → `dbDelta()` (DDL). MySQL's implicit COMMIT on any DDL statement commits all in-flight InnoDB data — including overlay rows inserted earlier in the same test — before WP's per-test ROLLBACK has a chance to undo them. The rows persisted across the full suite run, causing `WPSG_Overlay_Library_Test::test_get_all_returns_empty_array_when_no_entries` to fail on the next suite run. Fixed by adding `tearDownAfterClass()` to `WPSG_P50B_Space_Library_Test` that TRUNCATEs the overlays table after all tests in the class finish (TRUNCATE is itself DDL, so it commits and clears atomically, independent of any transaction state).
- **Validation done:** 6-test `WPSG_P50B_Space_Library_Test` (delegated overlay isolation + associate/dissociate round-trip, delegated font isolation, open-mode bypass, GET /library both lists, 403 for non-owner, migration backfill); 8-test `SpaceManagementView.test.tsx` (Library tab enabled/disabled states for open vs. delegated, checkbox rendering, association state reflects API response, POST called on check, DELETE+query-params called on uncheck, empty-state message); full PHP suite 924/924 (0 failures, 2 skips — stable on consecutive runs); full frontend suite 2237/2237; `tsc --noEmit` clean; production build clean.

### Manual test plan (P50-B)

**Deploy to the local dev site**

1. `npm run build:wp` + `./update_dev_plugin.sh`.
2. Open `https://wordpress.lan`, log in as admin.

**Fixtures**

- Upload at least 2 overlays via Layout Builder → Overlays section (global library).
- One `delegated` space ("Tenant A") and one `open` space. For a fresh install, run once to trigger the backfill (which auto-associates all existing assets into existing delegated spaces).

**Library tab behaviour**

- [ ] Open Space Management → select the `open` space — "Library" tab is greyed out (disabled).
- [ ] Select "Tenant A" (delegated) — "Library" tab is enabled.
- [ ] Switch to Library tab — all globally uploaded overlays appear as checkboxes; if the backfill ran, they are all checked.
- [ ] Uncheck one overlay — it is immediately dissociated.
- [ ] Open Layout Builder while scoped to Tenant A — that overlay is no longer offered in the overlay picker.
- [ ] Re-check it — it reappears in the picker.

**Isolation cross-check**

- [ ] As an `open`-mode space user (or admin with no space scope), all overlays are visible regardless of Tenant A's association state.

**Migration (fresh delegated space)**

- [ ] Create a new delegated space "Tenant B" after overlays already exist globally — the Library tab initially shows all overlays **unchecked** (no auto-backfill for spaces created post-P50-B; the backfill only ran once for pre-existing spaces).
- [ ] Manually associate an overlay — it appears in Tenant B's overlay picker.

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

---

## Track P50-H — Layout Builder OS-style Menu Bar

### Problem

The Layout Builder header toolbar is growing beyond what a flat row of buttons can sustain. Three distinct problems share the same root cause — there is no structured command surface:

1. **Closed-panel bug:** closing a Dockview panel (Layers, Media & Assets, Properties) provides no affordance to reopen it. The Layout Builder must be reopened and the state still persists because panel layout is saved to `localStorage` under `wpsg_builder_${rootId}_layout`, keyed by the mount-point ID — the same key for every layout template. Closing and reopening the modal does not reset the state, and closing a tab in one template closes it in all others.
2. **Toolbar crowding:** Export and Import are secondary actions that currently sit in the primary toolbar alongside Save and Preview — the toolbar real estate those occupy would be better used for actions that change per editing session.
3. **No preferences surface:** there is no place to put builder-level user preferences (such as whether panel layout is saved globally or per template). Every future preference would have nowhere logical to live, pushing them either into toolbar overflow or into a completely separate settings page.

These are not three separate bugs. They are three symptoms of a single missing architectural layer: a menu bar that provides a scalable, discoverable command surface analogous to what every mature creative tool (Figma, Sketch, Inkscape) provides.

### Fix

Add a compact menu bar row inside `LayoutBuilderModal` between the History button and the Preview button, containing four Mantine `Menu` components:

**File**
- Save (Ctrl+S) — mirrors the existing Save button; keeping Save visible in the toolbar for prominence is acceptable; the menu entry gives keyboard-shortcut discoverability
- ─
- Export template…
- Import from file…
- ─
- Close editor

**Edit**
- Undo (Ctrl+Z)
- Redo (Ctrl+Shift+Z)
- ─
- Duplicate selection
- Delete selection
- ─
- History… (opens the existing history drawer)

**View**
- *Panels:* Layers (toggle), Media & Assets (toggle), Properties (toggle) — checked when open. Canvas is always-on and does not appear here.
- ─
- Show grid
- Show rulers
- Show measurements
- ─
- Reset layout

**Options**
- *Layout workspace:* Save globally (all templates) · Save per template
- *(future preferences live here)*

**Canvas non-closeable (independent fix):** remove or disable the close affordance on the Dockview `canvas` panel tab regardless of menu bar progress, since a canvas-less Layout Builder is always a broken state. This is a one-line change to the panel configuration in `LayoutBuilderModal.tsx` and should be delivered as part of this track.

**Layout persistence toggle:** the Options menu "Save per template" mode changes the localStorage key from `wpsg_builder_${rootId}_layout` to `wpsg_builder_${rootId}_template_${templateId}_layout`. The `templateId` is already available in `LayoutBuilderModal` as a prop. The user's preference (global vs per-template) is itself stored in localStorage under a separate stable key (`wpsg_builder_${rootId}_layout_scope`), defaulting to `'global'`.

**Dependencies:** none — this is a pure frontend change within `src/components/Admin/LayoutBuilder/`.

**Files:** `LayoutBuilderModal.tsx` (menu bar insertion, canvas non-closeable, layout scope logic), `LayoutBuilderHeader.tsx` (if the header is extracted into its own component — preferred), new `LayoutBuilderMenuBar.tsx` (the four menus), Dockview panel config for canvas close-prevention.

### Acceptance criteria

- All four menus open on click; keyboard navigation works.
- Canvas tab has no close button; attempting to close it programmatically is a no-op.
- View → Layers/Media & Assets/Properties toggles re-open or close the corresponding Dockview panel.
- View → Reset layout restores the default 4-panel arrangement and clears the persisted layout from localStorage.
- File → Export and File → Import trigger the same logic as the existing Export/Import toolbar buttons.
- Options → "Save per template" changes the localStorage key; switching between templates no longer shares panel state when this is selected.
- Options → "Save globally" reverts to the shared key; panel state is once again shared across templates.
- Toolbar is visibly less crowded: Export and Import are removed from the primary toolbar.

### Validation

- Unit: menu bar renders all four menus; View panel toggles add/remove panels from the Dockview instance; Reset layout clears localStorage and calls Dockview's layout reset API; Options toggle writes the correct `layout_scope` key to localStorage.
- Manual: open the Layout Builder; close the Layers panel; reopen it via View → Layers; confirm the canvas tab has no close affordance; toggle per-template mode, switch templates, confirm each has independent panel state; reset layout, confirm default 4-panel arrangement.
- `tsc --noEmit` clean; full frontend suite passes.

### Implementation rationale (2026-06-11)

- **Canvas non-closeable:** Dockview's `tabComponents` prop accepts a map of `panelId → React.FunctionComponent<IDockviewPanelHeaderProps>`. Registering `canvas: CanvasTabNoClose` — a thin wrapper around `DockviewDefaultTab` with `hideClose={true}` — removes the close affordance from the canvas tab without any CSS hacks. `DockviewDefaultTab` is exported from the `dockview` package and accepts `hideClose` as a documented prop. This is a stable-reference component defined outside `LayoutBuilderModal` so it does not trigger dockview re-renders.
- **Menu bar component:** `LayoutBuilderMenuBar.tsx` — a self-contained component that accepts callbacks and state as props, keeping all the heavy logic in `LayoutBuilderModal`. The View menu calls `dockApiRef.current?.getPanel(id)` on open (`onOpen={refreshPanelState}`) to sync its checked state with actual dockview panel state rather than maintaining a separate shadow state. Panel re-open placement logic: Properties → right of canvas; Layers/Media → left side with `within` direction when the other tab-group peer already exists, falling back gracefully if the target reference panel is gone.
- **History dropdown controlled mode:** `BuilderHistoryDropdown` gained optional `opened` + `onOpenedChange` props; when provided, the component is fully controlled; when omitted it remains self-managed (zero behaviour change for existing callers). This lets Edit → History… in the menu bar set `historyDropdownOpen` state, which is threaded back to the dropdown via props.
- **Layout scope preference:** `useBuilderWorkspacePrefs` extended with `layoutScope: 'global' | 'per-template'` and `setLayoutScope`, persisted under `wpsg_builder_${rootId}_layout_scope`. `handleDockReady` derives `LAYOUT_KEY` from `layoutScope` and `initialTemplate?.id` — per-template mode uses `wpsg_builder_${rootId}_template_${templateId}_layout`; global mode uses the original shared key. `handleDockReady` re-runs when either `rootId` or `layoutScope` changes.
- **Toolbar cleanup:** Export (download) and Import (upload) `ActionIcon` buttons removed from the right-side header toolbar group. Both actions now live exclusively in the File menu. The right-side group is now: preview toggle → Save button → Close button — three items vs the previous six.
- **Validation done:** `tsc --noEmit` clean; full frontend suite 2237/2237; production build clean. Manual test: open Layout Builder, close Layers panel via the × on its tab — it closes. Reopen via View → Layers — it re-appears on the left side. Canvas tab has no close button. File / Edit / View / Options all open with correct items. Export and Import work via File menu.
