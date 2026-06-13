# Phase 50 - Gallery Spaces Completion, Adapters, Shared Package Extraction & Layout Builder enhancements

**Status:** In progress
**Created:** 2026-06-09
**Last updated:** 2026-06-12 (P50-F implemented: SW stale-while-revalidate for gallery metadata endpoints)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P50-A | Gallery Spaces — cross-space campaign move: atomic `space_id` re-stamp across all 4 tables | ✅ Done (2026-06-11, manual test passed) | Medium |
| P50-B | Gallery Spaces — per-space library isolation: `wpsg_space_library_assoc` join table; overlay/font visibility in delegated mode | ✅ Done (2026-06-12, manual test passed — verified via the P50-K space-scoped builder) | Medium |
| P50-C | Adapters — Stacked / Deck: cards with offset/rotation, swipe to cycle | ✅ Done (2026-06-11) | Medium |
| P50-D | Adapters — Isotope / Filterable Grid: FLIP-animated filter/sort; extends adapter interface | ✅ Done (2026-06-11, manual test pending) | Medium-High |
| P50-E | Adapters — Waterfall: masonry variant with staggered CSS entrance animations | ✅ Closed — already shipped via P31-G | Low |
| P50-F | Build & Bundle — Service Worker metadata caching: stale-while-revalidate for gallery metadata | ✅ Done (2026-06-12) | Medium |
| P50-G | Infrastructure — Shared Package extraction: npm workspaces, `packages/shared-utils/`, `packages/shared-ui/` | ✅ Done (2026-06-12) | Large |
| P50-H | Layout Builder UX — OS-style menu bar (File / Edit / View / Options): fixes closed-panel bug, declutters toolbar, introduces preferences surface | ✅ Done (2026-06-11) | Medium |
| P50-I | Layout Builder Media — General Asset Library + unified upload: re-surface the overlay library as the general/decorative asset bucket; file-type & transparency indicators; `is_universal` flag (overlay visible to all spaces); "Add to" upload modal wired into the builder and Campaigns | ✅ Done (2026-06-12, manual test passed) | Medium |
| P50-J | Layout Builder Media — Asset-layer parity & polish: bring a curated subset of slot properties to graphic layers (shape/clip-path/mask, border, shadow, blend, filters, rotation/flip); fonts universal parity | ✅ Done (2026-06-12) | Medium-High |
| P50-K | Asset Library terminology sweep + per-space visual library, tags & builder scoping: rename `overlay`→`asset` end-to-end (table/REST/class/TS, no aliases); replace the Space-Library checkbox lists with a visual grid (search + tag filter + bulk select); image-asset tags; WP-admin checkbox bleed fix; scope the builder's asset library by active space (closes the P50-B gap) | ✅ Done (2026-06-12, manual test passed) | Medium-High |

---

## Rationale

1. Cross-Space Campaign Move and Per-Space Library Isolation are the last Phase 47 follow-ons; completing them closes the Gallery Spaces feature set and removes two long-standing asterisks from the P47 deliverable.
2. The three adapters (Stacked/Deck, Isotope/Filterable Grid, Waterfall) clear the bulk of the Phase 22 deferred adapter backlog; only Timeline and Grid with Variable Aspect-Ratio Tiles remain after Phase 50.
3. Service Worker metadata caching unblocks offline/mobile use cases that have been gated since Phase 49 surfaced the open questions — scope, cache budget, and SW coexistence are all resolved here.
4. The shared-package extraction is the highest-leverage infrastructure item remaining: `src/lib/` utilities and the decoupled Auth/Lightbox components have been ready since Phase 46; the only remaining step is the monorepo scaffolding. Deferring further adds copy-paste maintenance cost on each new project.
5. Layout Builder had some broken functionality and a bunch of UX issues which made certain things non-intuitive.  It also had no way to upload media even though it supported overlays and had a global library already created for this.  

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
| H | General media = the overlay library | Rather than build a parallel "general media" store, reuse the existing `wpsg_overlays` table as the general/decorative asset bucket. It is already global, campaign-agnostic, placed on the canvas as free layers, and per-space isolated by P50-B. Campaign media stays hard-bound to campaigns (`media_items` post meta; `wpsg_media_refs` requires `campaign_id`) and is *not* eligible to be "general". |
| I | Universal asset visibility | A new `is_universal` flag on overlays makes an asset visible to **all** spaces site-wide, bypassing the P50-B per-space association filter. Defaults to off (space-specific). Scoped to overlays/images in P50-I; fonts (WP-option storage) get the same treatment in P50-J. |
| J | Slot media stays campaign-scoped | Layout slots continue to accept only the selected campaign's media (preserves single-campaign focus, avoids cross-campaign leakage in multi-tenant spaces). The "decorative / general" need is met by the asset library (free-floating canvas layers), not by broadening slot media. |
| K | "Overlay" library → "asset" (clean rename, no aliases) | The reusable visual-asset library was named "overlay" everywhere, but an overlay is one *use* of an asset (a layer placed on the canvas), not the asset itself. Renamed the library/source `overlay`→`asset` end-to-end **including the DB table (`wpsg_overlays`→`wpsg_assets` via one-time `RENAME TABLE`) and REST route (`/admin/asset-library`)**, with **no back-compat aliases** — in a co-deployed repo with full test coverage, aliases would only leave confusing legacy names. The *placed canvas layer* keeps "overlay" (`LayoutGraphicLayer`, `template.overlays`, `addOverlay`), as do unrelated uses (`OverlayArrows`, `SlotOverlayEffect`). Legacy carve-outs kept (commented): the physical upload subdir `wpsg-overlays` and the internal `overlay_id` PK column. |
| L | Per-space library UX = visual grid, not checkboxes | The Space-Management Library tab's flat checkbox lists don't scale and were ambiguous. Replaced with a visual, WordPress-media-style inline grid (thumbnails + search + tag filter + bulk select) reusing the builder's asset-grid primitives; **image-asset tags** (overlays only this round; fonts later) provide scalable filtering. Open-mode spaces show an explanatory Alert (was a silent disabled tab). |

## Execution Priority

1. **P50-E** — Waterfall adapter: smallest track, no dependencies, quick confidence check before larger adapter work.
2. **P50-C** — Stacked/Deck adapter: self-contained, reuses `useSwipe`.
3. **P50-A** — Cross-Space Campaign Move: PHP backend; depends on P47 tables.
4. **P50-B** — Per-Space Library Isolation: PHP backend; depends on P47 tables.
5. **P50-H** — Layout Builder menu bar: unblocks UX (closed-panel bug) and declutters the toolbar before any further Layout Builder feature work adds to the toolbar debt.
6. **P50-I** — General Asset Library + unified upload: unblocks P50-B manual testing (overlay discoverability) and delivers the media-handling MVP; reuses existing overlay backend + `MediaAddModal`.
7. **P50-J** — Asset-layer parity & polish: builds on P50-I; bring slot-grade properties to graphic layers and finish fonts/universal parity.
8. **P50-D** — Isotope/Filterable Grid: extends the adapter interface; done after simpler adapters to avoid any interface churn.
9. **P50-F** — Service Worker: careful not to break the existing SW registration; done late to avoid disrupting local dev builds.
10. **P50-G** — Shared Package: largest track; monorepo restructure touches all `src/lib/` and Auth/Lightbox imports; done last to avoid blocking other tracks.

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

**Concepts (read first)**

- A **space** is an isolated area of the site — think of it as a tenant or a sub-site. Every campaign lives in exactly one space.
- A space has an **isolation mode**, chosen by the "Delegated isolation mode" switch when you create it:
  - **Open** (switch off) — any WordPress admin can access it, and it can use **every** asset in the global overlay/font library. No per-space restriction.
  - **Delegated** (switch on) — locked down: only users you explicitly grant access can enter, and it can only use the overlays/fonts you explicitly **associate** with it. This is the mode P50-B governs.
- The **global library** is the single, site-wide set of overlays/fonts (the "Asset Library" in the Layout Builder, stored in `wpsg_overlays`). P50-B does not split it up — it just decides, per delegated space, which of those global assets that space is *allowed* to use.
- You choose those allowed assets in **Space Management → Library tab** (checkbox per asset). That tab is only enabled for delegated spaces (open spaces see everything, so there's nothing to pick).
- **Where the filter actually applies:** the per-space allow-list is enforced on the library *list* endpoints when a request is scoped to a space (`GET …/admin/asset-library?space=<id>` and the font equivalent). As of **P50-K** the admin Layout Builder *does* pass the active space, so a delegated space's Asset Library shows only its associated + universal assets (the earlier "Known gap" is now closed — see the note below). You can still verify the filter directly against the endpoint.

**Deploy to the local dev site**

1. `npm run build:wp` + `./update_dev_plugin.sh`.
2. Open `https://wordpress.lan`, log in as admin (`admin@example.com` / `admin!`).

**Fixtures**

- Upload at least 2 overlays to the global library: open any layout template in the **Layout Builder → Media & Assets** tab → **Add media** → leave "Add to" on **General library (all campaigns)** → upload two images. They now appear in the **Asset Library** section.
- Create two spaces via **Admin → Manage spaces** → the **"Create new space"** form at the bottom (fill name/slug, then **Create space**):
  - "Tenant A" — turn the **Delegated isolation mode** switch **on** (and add yourself as owner, per the in-form warning).
  - "Open Space" — leave the switch **off**.
- On an already-populated install, the one-time backfill auto-associates every pre-existing overlay/font with every pre-existing delegated space, so a delegated space created *before* this build starts with everything allowed.

**Library tab — association management (UI-observable)**

- [ ] Open **Manage spaces** → select **Open Space** → the **Library** tab is disabled (greyed out), because open spaces aren't restricted.
- [ ] Select **Tenant A** (delegated) → the **Library** tab is enabled.
- [ ] Open the **Library** tab → both global overlays are listed as checkboxes (all checked if the backfill ran; see Migration note for a fresh space).
- [ ] Uncheck one overlay → it is dissociated immediately (no save button). Reload the view → it stays unchecked (persisted).
- [ ] Re-check it → it is associated again and persists on reload.

**Verify the filter directly (endpoint-level)**

The admin builder won't show the difference (it's unscoped), so confirm the filter via the REST API. With Tenant A's id = `<A>` and one overlay dissociated:

- [ ] In the browser devtools console (while logged in as admin), run:
  `fetch('/wp-json/wp-super-gallery/v1/admin/asset-library?space=<A>', { headers: { 'X-WP-Nonce': wpApiSettings?.nonce ?? '' } }).then(r => r.json()).then(console.log)`
  → the dissociated overlay is **absent**; the associated one is present. (If `wpApiSettings` is undefined on this screen, grab the nonce from any other authenticated request, or use the universal-flag check below instead.)
- [ ] Call the same endpoint **without** `?space=` → the full library returns (unscoped requests bypass the filter).

**Open-mode bypass**

- [ ] Call `…/admin/asset-library?space=<Open Space id>` → the full library returns even though it's scoped, because open spaces aren't filtered.

**Universal flag (P50-I) interaction**

- [ ] In the Layout Builder Asset Library, toggle the globe icon on the dissociated overlay to make it **universal**, then re-run the `?space=<A>` fetch → it now appears for Tenant A **without** an association row (universal bypasses the per-space filter). Toggle it back off → it disappears again.

**Migration (fresh delegated space)**

- [ ] Create a new delegated space "Tenant B" *after* overlays already exist globally → its Library tab starts with all overlays **unchecked** (the one-time backfill only ran for spaces that existed at upgrade; new spaces start empty by design).
- [ ] Check one overlay → `…/admin/asset-library?space=<B>` now returns exactly that overlay.

**Known gap — CLOSED by P50-K (2026-06-11):** previously no admin UI surface passed `?space=` to the asset *list* endpoint, so a delegated space's restriction wasn't reflected inside the Layout Builder's Asset Library picker. P50-K threads the active admin space (`AdminPanel.selectedSpaceId` → `LayoutTemplateList` → `LayoutBuilderModal` → `useAssetLibrary(apiClient, opened, spaceId)`), so the builder now shows only the space's associated + universal assets when a delegated space is active. (Fonts in the builder remain a parallel follow-up.) Note the endpoint is now `/admin/asset-library` after the P50-K rename.

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

### Implementation rationale (2026-06-11)

- **Interface extension claim re-evaluated:** The track doc proposed adding `filterKey`/`sortKey` props to `GalleryAdapterProps` behind a discriminated union. On review this is unnecessary — every other adapter manages its own interaction state internally (`useCarousel`, `useSwipe`, etc.) and the host never needs to know an adapter's filter field. The only TypeScript change is adding `'isotope'` to `GalleryAdapterId`. Filter values derive from `[...new Set(media.map(m => m.type))]`; sort uses `dateUploaded` (falling back to `order`), both always-present fields on `MediaItem`. The `tags` field already reserved for "future filterable-gallery work" on `MediaItem` is a natural next step but out of scope here.
- **Filter chips:** Rendered via Mantine `Chip.Group` + `Chip`; only appear when the media set contains more than one type (`filterValues.length > 1`). With a uniform-type gallery (all images, the smoke-test case), no chips render and the first button in the DOM is a tile — the shared smoke suite's "clicking first button opens lightbox" assertion passes without special-casing.
- **Sort controls:** Mantine `Select` with three options (`default`, `asc` by date/order, `desc`). Always shown regardless of media types.
- **FLIP animation:** Item positions are snapshotted via `getBoundingClientRect()` in the filter/sort change handlers (before `setState`), stored in `prevRectsRef`. After each render `useLayoutEffect` computes deltas, applies inverse transforms with `transition: none`, then clears them in a `requestAnimationFrame` so a CSS `transition` carries the movement. `dx === 0 && dy === 0` guard skips animation in jsdom (all rects are zero) — no crash, no false positive.
- **PHP allowlist:** Added `'isotope'` to both `WPSG_CPT::VALID_ADAPTERS` (`class-wpsg-cpt.php`) and the no-CPT fallback list in `class-wpsg-settings-sanitizer.php`, following the P50-C pattern. The existing `adapterSettingsParity.test.ts` guard confirmed the roundtrip immediately.
- **Validation done:** `adapterSettingsParity` (6/6); 14-test colocated suite (`IsotopeAdapter.test.tsx`); full smoke suite 150/150 (IsotopeAdapter added to the ADAPTERS array); full frontend suite 2273/2273; `tsc --noEmit` clean; production build clean (`IsotopeAdapter-BaxdTbHp.js` 5.57 kB gzip 2.47 kB); `php -l` clean on both PHP files. **Remaining:** the manual test plan below.

### Manual test plan (P50-D)

**Deploy to the local dev site**

1. `npm run build:wp` + `./update_dev_plugin.sh`.
2. Open `https://wordpress.lan`, log in as admin, open the gallery admin panel.

**Setup**

- Select an existing campaign with at least 3 images and 1 video (or add a video).
- In Gallery Settings → Layout, choose "Filterable Grid (Isotope)" as the adapter.

**Filter chips (mixed-type media)**

- [ ] Filter chips "All", "Images", "Videos" appear above the grid.
- [ ] Clicking "Images" hides the video tile; remaining tiles rearrange with a smooth FLIP animation.
- [ ] Clicking "Videos" shows only video tiles.
- [ ] Clicking "All" restores all tiles with another smooth transition.

**Sort controls**

- [ ] The sort Select shows "Default order" initially.
- [ ] Selecting "Newest first" reorders tiles (upload date descending); tiles animate to new positions.
- [ ] Selecting "Oldest first" reverses the order again.

**Uniform-type media (all images)**

- [ ] Gallery with only images shows NO filter chips — only the sort Select renders above the grid.

**Lightbox**

- [ ] Clicking any tile opens the lightbox on that item; prev/next arrows work; Esc closes.

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

- Load a gallery while online; subsequent online loads serve the metadata API responses instantly from the SW cache (stale-while-revalidate), without a network roundtrip to the WP REST API.
- Background revalidation fires automatically when a cached entry is older than 5 minutes; the gallery updates without a full reload.
- Admin SPA does not serve cached responses offline (shows a network-error state as expected).
- Opening the plugin on a site that already has a service worker does not conflict with the host SW.

### Validation

- Manual: Chrome DevTools → Application → Service Workers; confirm `wpsg-meta-v1` cache is populated after visiting a gallery. Throttle to Slow 3G in DevTools → Network; reload — metadata calls return instantly from cache (not from the network). Restore to online; wait 5+ seconds; confirm the `x-wpsg-cached-at` timestamp on the cached entry advances (background revalidation fired).

### Implementation rationale (2026-06-12)

- **Claims re-verified before building.** The existing SW (`public/sw.js`) already had `skipWaiting()` and `clients.claim()`, and its `activate` handler already cleaned up stale `wpsg-*` caches. The `/wp-json/` bail at line 40 of the original confirmed that all REST API responses were unconditionally excluded — no metadata was ever cached. The two target endpoints confirmed as public (`rate_limit_public` permission callback, no auth required): `GET /wp-super-gallery/v1/campaigns` and `GET /wp-super-gallery/v1/campaigns/{id}/media` (campaign media list).
- **SWR implementation.** A new `handleMetaRequest` function intercepts requests matching `META_ENDPOINT_RE` (`/wp-json/wp-super-gallery/v1/campaigns` and `/wp-json/wp-super-gallery/v1/campaigns/\d+/media`, no admin sub-paths). Behavior: cache hit → respond with stale immediately + kick background revalidation via `event.waitUntil`; cache miss → fetch synchronously, cache, respond. The SWR branch is inserted BEFORE the `/wp-json/` bail so the bail still catches all other REST routes (admin APIs, mutation endpoints, other plugins).
- **TTL (5 min) as revalidation throttle.** Rather than expiring cache entries, TTL controls whether the background revalidation fires on a cache hit. A `x-wpsg-cached-at` timestamp header is stored on each cached `Response` (via `stampResponse`, which reads `arrayBuffer()` and reconstructs the `Response` with an augmented `Headers` — necessary because live `Headers` objects are immutable). On cache hit, `age >= META_TTL_MS` triggers the background fetch; fresh entries (< 5 min old) return stale data with no extra network request. This throttles server hits on pages that are rapidly reloaded (e.g. a visitor pressing refresh on the gallery) without degrading the offline experience.
- **Cache budget via entry count.** True LRU with byte-accurate tracking would require IndexedDB. Instead, `META_MAX_ENTRIES = 50` entries is the practical budget: at worst case ~100 kB per JSON response, this stays well under the 5 MB target even before any eviction. `evictOldestMetaEntries` reads `cache.keys()` (insertion-ordered in all major browsers) and removes the `length - META_MAX_ENTRIES` oldest entries whenever a new entry is written.
- **Cache lifetime across SW updates.** The activate handler previously deleted all `wpsg-*` caches except `RUNTIME_CACHE`. `META_CACHE` is now also preserved (`key !== META_CACHE` added to the filter). To bust the metadata cache intentionally (e.g. on a breaking API schema change), bump `META_CACHE` from `wpsg-meta-v1` to `wpsg-meta-v2` — the activate handler will then delete `wpsg-meta-v1` automatically and preserve the new name.
- **Admin routes and mutations unaffected.** Non-GET requests are rejected before the new branch. Admin SPA routes (`/wp-admin/`) and all other `/wp-json/` paths (including `/wp-json/wp-super-gallery/v1/admin/*`) remain network-only — the `META_ENDPOINT_RE` regex is precise and does not match admin sub-paths.
- **SW registration fix (2026-06-12).** Manual testing surfaced a 404 on the SW registration URL: with `base: './'` in Vite, `import.meta.env.BASE_URL` resolves to `'./'` in the built bundle, so `register('./sw.js')` resolves relative to the current page URL — never `/wp-content/plugins/.../assets/sw.js`. Fixed by adding a PHP `init` hook (`WPSG_Embed::maybe_serve_service_worker`, priority 1) that intercepts requests for `home_url('/sw.js')` and serves the plugin's `assets/sw.js` with `Content-Type: application/javascript`, `Service-Worker-Allowed: /` (grants root scope without the script being at root), and `Cache-Control: no-cache, no-store`. The canonical URL is injected into `window.__WPSG_CONFIG__.swUrl`; `main.tsx` now registers from that URL with `{ scope: '/' }`, falling back to the BASE_URL relative path for non-WP contexts. No rewrite rules, no root file writes — the PHP endpoint is the authoritative path, handles subdirectory installs correctly via `wp_parse_url(home_url('/sw.js'), PHP_URL_PATH)`.
- **Validation done.** 16-test `src/test/swMeta.test.ts`: URL regex (campaigns list, media list, admin endpoints excluded, mutation sub-paths excluded); `stampResponse` (timestamp header added, body and status preserved, existing headers preserved); `evictOldestMetaEntries` (within limit no-op, oldest evicted correctly, empty cache no-op, exactly-one-over-limit); TTL boundary conditions. Full frontend suite **2309/2309**; `tsc --noEmit` clean; `eslint --max-warnings 0` clean; `npm run build:wp` staged the plugin bundle. **Remaining:** manual verification on `wordpress.lan` (deploy via `./update_dev_plugin.sh` + SW unregister + hard refresh — required because the old SW is cached and must be replaced by the new one).

### Manual test plan (P50-F)

**Deploy to the local dev site**

1. `npm run build:wp` + `./update_dev_plugin.sh`.
2. Open `https://wordpress.lan`. In Chrome DevTools → Application → Service Workers, click "Unregister" on any existing WPSG SW, then hard-refresh (`Ctrl+Shift+R`) to load the new SW.

**Cache population**

- [ ] With DevTools open, load a gallery public page. Go to **Application → Cache Storage** → `wpsg-meta-v1` — one or two entries should appear (campaign list and/or the campaign's media list).
- [ ] Note the `x-wpsg-cached-at` timestamp in the response headers of a cached entry.

**Offline behavior (expected — not a supported use case)**

The SW caches only the metadata API responses, not the WordPress HTML page shell. This is intentional: a stale cached shell that imports Vite chunk URLs removed by a newer deploy causes broken lazy-loaded drawers and modals. Going offline shows `ERR_INTERNET_DISCONNECTED` on any reload — there is nothing wrong.

- [ ] Set DevTools → Network to **Offline** and reload (regular or hard). Confirm `ERR_INTERNET_DISCONNECTED` — this is correct behavior.
- [ ] Check **Application → Cache Storage** — the `wpsg-meta-v1` entries are **still present** after the offline attempt; going offline does not clear the cache.

> Full offline support (app shell caching with versioned deploy-time cache busting) is deferred to a future track — see `docs/FUTURE_TASKS.md` § Build & Bundle.

**Online — stale-while-revalidate**

- [ ] Re-enable the network.
- [ ] Reload the page. The gallery renders immediately from cache (stale-while-revalidate).
- [ ] Wait ~5 seconds. Re-inspect the cache entry — the `x-wpsg-cached-at` timestamp should have advanced (background revalidation fired and updated the cached response).

**TTL throttle check**

- [ ] While the cache entry is fresh (< 5 min old), reload the page repeatedly. Observe in DevTools Network that no `campaigns` or `campaigns/{id}/media` request is made (the cached entry is served without triggering a background fetch).
- [ ] After 5 minutes (or manually set the system clock forward and reload), a background fetch should appear in the Network tab.

**Admin API not cached**

- [ ] Navigate to the WPSG admin panel. In DevTools Network, confirm that `admin/asset-library`, `admin/font-library`, and other admin REST calls show up as network requests (not served from cache).
- [ ] Confirm `wpsg-meta-v1` contains only the two public endpoint URLs.

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

### Implementation rationale (2026-06-12)

- **Auth component scope adjustment:** The plan assumed `AuthBarFloating` and `AuthBarMinimal` were clean for `shared-ui`. A pre-implementation check revealed both import `SpaceSwitcher`, which uses `usePageSpaces` — a WPSG-specific hook. Only `LoginForm` (Mantine-only) is truly decoupled. `AuthBarFloating` and `AuthBarMinimal` remain in `src/components/Auth/`; this is the correct call and aligns with the P51-A spike scope for further audit.
- **Vite alias over npm workspace resolution:** Rather than relying on npm workspace `node_modules/.bin` symlinks for bundling, both packages are wired as Vite aliases (`@wp-super-gallery/shared-utils` → `packages/shared-utils/src/index.ts`) and tsconfig paths. This is the correct approach for a co-deployed monorepo using `"noEmit": true` — the packages are always bundled by Vite, never independently compiled or published, and alias resolution is faster and avoids Node ESM resolution edge cases.
- **Inline `import()` type syntax missed by sed:** `src/types/index.ts` and `src/components/CampaignGallery/CampaignCard.tsx` use `import('@/lib/cssUnits').TypeName` syntax for inline type references. Bulk `sed` on `from '@/lib/'` patterns misses these. Fixed by a targeted `sed -i "s|import('@/lib/cssUnits')|import('@wp-super-gallery/shared-utils')|g"` pass.
- **Test file mock paths:** Seven test files used `vi.mock('@/components/Galleries/Shared/Lightbox', ...)` or `vi.mock('...Lightbox', ...)` + one dynamic `await import('@/components/Galleries/Shared/Lightbox')`. All updated to `@wp-super-gallery/shared-ui`. `Lightbox.test.tsx` updated its direct `'./Lightbox'` relative import to use the package.
- **Validation:** `tsc --noEmit --skipLibCheck` clean; `npm test` 167 files / 2309 tests passing; `grep -rn "from '@/lib/" src/` returns 0 results; `grep -rn "Galleries/Shared/Lightbox" src/` returns 0 results.

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

---

## Track P50-I — General Asset Library + Unified Upload (MVP)

### Problem

While testing P50-B, the "Overlay section" appeared to be missing from the Layout Builder's Media & Assets panel. It actually exists — buried inside the collapsed **Design Assets** accordion → **Graphic Layers** sub-section ([LayoutBuilderMediaPanel.tsx:65-98](src/components/Admin/LayoutBuilder/LayoutBuilderMediaPanel.tsx#L65-L98)) — and is mislabeled. Three related gaps compound the discoverability problem:

1. **No general / decorative media bucket (apparently).** Users want to add non-campaign, decorative images to a layout. In fact the overlay library *is* exactly that bucket (global, campaign-agnostic, placed as free-floating canvas layers via `builder.addOverlay`, per-space isolated by P50-B) — it is just hidden and named "overlay".
2. **No transparency / file-type cues.** A user can't tell a transparent PNG from an opaque JPG in the grid, nor differentiate formats.
3. **Awkward upload path.** Adding campaign media means leaving the builder for the Admin Media tab; there is no way to add general/decorative media at all from the builder, and the overlay uploader is the bare `AssetUploader` (no drag-drop, narrow file types).

Hard constraint discovered: campaign media is hard-bound to a campaign (`media_items` post meta; `wpsg_media_refs` requires a `campaign_id`) — it genuinely cannot be "general". The general bucket therefore *has* to be the overlay/library store (Key Decision H).

### Fix

**Backend (PHP)**

- **`is_universal` column on `wpsg_overlays`** (`class-wpsg-db.php`): bump `DB_VERSION` `'12'` → `'13'`; add `maybe_upgrade_overlays_v13_is_universal()` following the v11 `space_id` column pattern (INFORMATION_SCHEMA guard, then `ALTER TABLE … ADD COLUMN is_universal TINYINT(1) NOT NULL DEFAULT 0`); add the column to the fresh-install `CREATE TABLE`.
- **`WPSG_Overlay_Library`**: `get_all()` returns `isUniversal`; `add()` accepts/stores optional `is_universal`; new `set_universal(string $overlay_id, bool $universal): bool`.
- **Filter bypass** (`class-wpsg-content-controller.php` → `filter_library_for_space()`): for delegated spaces, include an item when `!empty($item['isUniversal'])` **OR** it is in the association allow-list. Open-mode / unscoped behaviour unchanged.
- **REST**: extend `POST /admin/overlay-library` to read optional `is_universal`; add `PATCH /admin/overlay-library/{id}` (calls `set_universal()`, `require_admin`).
- **Fonts:** universal-for-fonts is **deferred to P50-J** (fonts live in a WP option, a different storage mechanism — keep this track to one).

**Frontend (TS/React)**

- **Type + queries**: add `isUniversal: boolean` to `OverlayLibraryItem` (`BuilderDockContext.tsx`); add a "set universal" PATCH mutation + refetch (`layoutTemplateQuery.ts` / `apiClient.ts`), paralleling `handleDeleteLibraryOverlay`.
- **Grid indicators** (`DesignAssetsGrid.tsx`): per-item **file-type badge** (PNG / SVG / JPG / WEBP / GIF, derived from URL extension); **checkered background** behind each thumbnail so transparency reads visually at zero cost; per-item **universal toggle** (globe/star ActionIcon, tooltip "Available to all spaces", badge when on, default off).
- **Re-surface the bucket** (`LayoutBuilderMediaPanel.tsx`): rename "Graphic Layers" → **"Asset Library"** (drop "overlay" wording); default the section expanded; add an **"Upload / Add media"** button opening the unified modal.
- **Unified upload modal** (`MediaAddModal.tsx` + new `MediaUploadController.tsx`): add an **optional "Add to" target `Select`** (campaigns + "General library") — when the prop is omitted the modal behaves exactly as today, so MediaTab is unaffected; restyle the drop area with a **dashed outline** + clearer drag-active state (no `@mantine/dropzone` dependency). The new container owns `useXhrUpload` and routes by target: campaign → existing `POST /media/upload` flow; general library → `postForm('/admin/overlay-library', …)` then refetch.
- **Entry points**: builder Media panel "Upload" button (`defaultTarget` = general library); **Admin Panel → Campaigns** per-row "Add media" action (`CampaignsTab.tsx`, `defaultTarget` = that campaign), reusing the same modal.

**Dependencies:** P50-B (per-space association + filter), the existing overlay library, `MediaAddModal` / `useXhrUpload`.

### Acceptance criteria

- The Media panel shows a clearly-labeled **Asset Library** section, expanded by default, with file-type badges and a checkered transparency cue.
- Uploading supports broadened image types (incl. JPEG); a transparent PNG visibly shows the checkered backing, an opaque JPG does not.
- Marking an asset **universal** makes it appear in a delegated space that has **no** association row for it; a non-universal unassociated asset stays hidden; open-mode spaces see everything (unchanged).
- The "Upload" button (builder) and "Add media" action (Campaigns) both open the unified modal; the "Add to" selector routes uploads to the general library or the chosen campaign correctly; drag-drop works on the dashed dropzone.
- `MediaTab`'s existing upload flow is unchanged (the "Add to" selector is opt-in).

### Validation

- **PHP**: universal overlay visible in a delegated space without an association row; non-universal still hidden; open-mode unchanged; `set_universal` round-trip; idempotent v13 migration. Guard against the P50-B `dbDelta` implicit-commit cross-run contamination (add `tearDownAfterClass` TRUNCATE if fixtures insert overlays).
- **Frontend**: `DesignAssetsGrid` renders badge + universal toggle and fires the mutation; `MediaAddModal` shows the "Add to" selector only when `campaigns` is provided; `MediaUploadController` routes to the correct endpoint per target; CampaignsTab "Add media" opens the modal with the campaign preset.
- `tsc --noEmit` clean; full frontend suite green; `npm run build` clean; full PHP suite green on consecutive runs.

### Implementation rationale (2026-06-11)

Re-verified every claim in this track against the live code before building — DB version, the v11 migration pattern, `filter_library_for_space()`, the overlay-library class, and the frontend wiring all matched the plan, so no course-correction was needed.

**Backend.** `is_universal` was added as a `TINYINT(1) NOT NULL DEFAULT 0` column on `wpsg_overlays` two ways for safety: in the fresh-install `CREATE TABLE` *and* via an idempotent `maybe_upgrade_overlays_v13_is_universal()` (INFORMATION_SCHEMA guard + `ALTER TABLE … ADD COLUMN`), `DB_VERSION` `'12'` → `'13'`. The migration is belt-and-suspenders: `maybe_create_overlays_table()`'s `dbDelta` would also add the column, but the explicit guarded `ALTER` is the reliable path (dbDelta is formatting-sensitive) and both are no-ops once the column exists. `WPSG_Overlay_Library::get_all()`/`add()` now read/write the flag (returning camelCase `isUniversal`); new `set_universal()` returns `true` when the row exists even if the value was unchanged (uses an existence check, since `$wpdb->update` returns `0` for a no-op write). The filter bypass is a one-line `OR` in `filter_library_for_space()`: an item passes when `!empty($item['isUniversal'])` **or** it is in the association allow-list, so open-mode/unscoped behaviour is untouched. REST: `upload_overlay()` reads an optional `is_universal` (via a shared `to_bool()` helper that accepts native bools and `"1"/"true"/"on"/"yes"`), and a new **`POST`** route on `/admin/overlay-library/{id}` → `update_overlay()` toggles the flag (chose POST over PATCH because the HTTP transport has no `patch` verb; the plan explicitly allowed either).

**Frontend.** `OverlayLibraryItem` gained `isUniversal`; the modal exposes a `handleSetOverlayUniversal` handler (POSTs the id, refetches the library) and now also passes `apiClient` through `BuilderDockContext` so the Media panel can drive the unified uploader. `DesignAssetsGrid` renders a per-item **file-type badge** (`getAssetFileType`, extracted to `src/utils/assetFileType.ts` to keep the component file fast-refresh clean), a **checkered backing** behind every thumbnail (pure CSS, transparency reads for free), and an opt-in **universal toggle** (globe icon) shown only when `onSetUniversal` is supplied — so the mask/background pickers that reuse the grid are unaffected. The buried "Design Assets → Graphic Layers" accordion is renamed **Asset Library** (already default-expanded via the persisted `designAssetsOpen`), and the bare `AssetUploader` is replaced by an **"Upload / Add media"** button opening the new unified modal.

**Unified upload.** `MediaAddModal` stayed presentational; it gained opt-in `targetOptions`/`targetValue`/`onTargetChange`/`targetExtra` props (the "Add to" Select renders only when `targetOptions` is non-empty, so `MediaTab` is untouched) and a **dashed dropzone** with a clearer drag-active state. A new self-contained `MediaUploadController` owns the upload state and routes by target: **general library** → per-file `postForm('/admin/overlay-library', …)` (with the universal checkbox) then invalidate the overlay-library query; **campaign** → `uploadMany('/media/upload', { campaign_id })` then `addCampaignMediaBatch` then invalidate that campaign's media query. Query-key invalidation (not callback plumbing) keeps the builder grid and campaign media lists fresh automatically. The controller deliberately omits the heavy oEmbed/video flow (that remains MediaTab's richer path); its external-URL field does a simple direct image-URL registration, which is the builder's real need. Entry points: the builder Media panel (`defaultTarget` = general library) and a per-row **"Add media"** action on Admin → Campaigns (`useCampaignsRows` fires a callback; `AdminPanel` owns the modal with `defaultTarget` = that campaign).

**Discoverability follow-up (2026-06-11).** First manual check found the upload entry point too easy to miss: the only "Add media" button lived *inside* the Asset Library accordion, so a collapsed accordion (a stale `designAssetsOpen=false` carried over from the old "Design Assets" section) hid it entirely. Fixed by surfacing an **always-visible primary "Add media" button at the top of the Media & Assets panel** (directly under the campaign selector), independent of accordion state and of whether the library has any items; the in-accordion button is retained as a contextual "Upload to library". (Note: the dev site also serves the SPA through a service worker, so a hard refresh / SW-unregister is required after deploy to pick up a new bundle.)

**Second manual round (2026-06-11).** The Asset Library section appeared entirely missing. Root cause: `MediaPickerSidebar` is `h="100%"`, so the campaign media list consumed the whole panel and pushed the Asset Library accordion off-screen (it was rendering, just below the fold). Fixed by making the Media panel a flex column — the campaign media list now flexes/scrolls internally and the Asset Library accordion is pinned below it (`flexShrink: 0`), always visible. Two adjacent asks were handled at the same time: (1) **GIFs** were already supported end-to-end (the unified modal accepts `image/*`, the overlay endpoint allows `image/gif`, and the optimizer already skips GIFs so animation is preserved) — the earlier failure was the old narrow `AssetUploader`, now replaced. (2) **Larger images**: overlay uploads were being downscaled to 1920×1920 by the shared image optimizer; added a `WPSG_Image_Optimizer::$wpsg_skip_resize` flag set during overlay/asset-library uploads so decorative assets keep full resolution (WebP generation, if enabled, still runs); campaign media is unaffected (flag defaults off). Also renamed the background picker's "Design Assets" section header → "Asset Library" for consistency. **Setting an asset as the background** is via the existing flow: select the canvas background → Properties → Background → mode **Image** → the Asset Library grid appears, click an asset (`setBackgroundImage(url)`), then adjust Fit/Alpha. New optimizer tests cover skip-resize (full-res preserved) vs. the default constrained path (19 optimizer tests green).

**Tests & verification.** New PHP suite `WPSG_P50I_Universal_Assets_Test` (8 tests, 23 assertions) covers universal visibility in a delegated space, the open-mode bypass, the `set_universal` round-trip + unknown-id, the REST toggle (+404), upload persistence, and idempotent v13 migration — with a `tearDownAfterClass` TRUNCATE to avoid the P50-B dbDelta implicit-commit contamination. Frontend: `DesignAssetsGrid` (badge + universal toggle + `getAssetFileType`), `MediaAddModal` ("Add to" selector visibility), and `MediaUploadController` (per-target routing) tests added. Green across the board: full PHP suite **932 tests OK on two consecutive runs**, frontend **2246/2247** (the lone failure is a pre-existing flaky `CardGallery` pagination test, unrelated and green in isolation), `tsc --noEmit` clean, `npm run build` clean, `eslint --max-warnings 0` clean. **Manual test passed (2026-06-12)** on `wordpress.lan` — asset library discoverable, uploads (incl. GIF/large) work, universal toggle behaves; this also unblocked the original P50-B verification.

---

## Track P50-J — Asset-Layer Parity, Fonts Universal & Deeper Polish

### Problem

After P50-I, graphic-layer ("asset") layers are discoverable and uploadable, but they remain second-class compared to slots: `LayoutGraphicLayer` exposes ~11 adjustable properties (position, size, z-index, opacity, pointer-events, name, visibility, locked) while `LayoutSlot` exposes ~48 (shape, mask, border, fit, filters, shadow, blend, tilt, interaction, …). A creative user placing a decorative asset cannot reshape, mask, border, or apply effects to it the way they can to a slot. Additionally, the universal flag from P50-I covers overlays but not fonts.

### Fix

**A. Asset-layer property parity** — `GraphicLayerPropertiesPanel.tsx` + `updateOverlay` (already accepts `Partial<LayoutGraphicLayer>`, so most work is new type fields + UI controls + renderer support). Curated parity set:

- **Transform:** rotation, flip H/V (opacity already present).
- **Shape & geometry:** shape presets, custom clip-path, mask layers (position/scale/feather) — reuse the slot `shape` / `clipPath` / `maskLayer` types and existing mask rendering. **High value for decorative assets** (user-requested inclusion).
- **Border:** radius, width, color.
- **Effects:** drop shadow, blend mode, filter effects (brightness/contrast/saturate/blur/grayscale/sepia/hue/invert) — reuse `SlotFilterEffects` / `SlotShadow` / `SlotBlendMode` and existing effect-rendering helpers.
- **Fit:** object-fit / object-position (only if a layer can crop to a box).
- **Excluded** (N/A for a static graphic, or slot-interaction-specific): media binding (the asset *is* the image), click action / hover / glow / 3D tilt — revisit case-by-case.
- **Renderer parity:** apply the new properties wherever overlays are drawn (builder canvas + public gallery layout renderer) so they actually display.

**B. Fonts universal parity** — add `isUniversal` to each entry in the `wpsg_font_library` WP option; extend `filter_library_for_space()` to honour it for the `font` asset type (mirrors the overlay bypass, different storage).

**C. Deeper polish** — optionally migrate `MediaTab` onto `MediaUploadController` for a single upload path; best-practice upload refinements (accepted-type hints, per-file validation messaging, duplicate handling in the general library); reconsider any cross-campaign media affordance if still wanted after the MVP.

**Dependencies:** P50-I.

### Acceptance criteria

- A graphic-layer asset can be reshaped (preset/clip-path/mask), bordered, and given shadow/blend/filter/rotation effects from its properties panel, and renders identically in the builder canvas and the public gallery.
- A font marked universal is visible to all spaces (delegated included), defaulting to space-specific.
- (If included) `MediaTab` upload behaviour is unchanged after migrating to the shared container.

### Validation

- **Frontend**: property-panel controls mutate the layer and the canvas reflects each change; a saved template round-trips the new fields; renderer parity verified against the public gallery.
- **PHP**: universal-font filter bypass test (delegated space sees a universal font with no association row).
- `tsc --noEmit` clean; full frontend suite green; full PHP suite green.

### Open item to confirm at track start

The parity set above is the proposed scope (now including shape/clip-path/mask per the user). Confirm before building, and finalize whether object-fit/position and flip are in the first pass.

**Resolved (2026-06-12):** confirmed with the user — first-pass parity set is **rotation + flip H/V, shape preset / custom clip-path / mask, border (radius/width/color), and effects (CSS filters, drop-shadow, blend-mode)**. **object-fit / object-position is deferred** (a free-floating graphic layer's box *is* its image, so cropping rarely applies — revisit only if a concrete need appears). Fonts-universal parity (part B) is in. Deeper-polish part C (migrating `MediaTab` onto `MediaUploadController`) is **not** in this pass — left for a later slice to keep blast radius contained.

### Implementation rationale (2026-06-12)

- **Claims re-verified before building.** `LayoutGraphicLayer` carried exactly the ~11 props the doc described (no shape/mask/border/effects/transform). `updateOverlay(id, Partial<LayoutGraphicLayer>)` already exists in `useLayoutBuilderState` and is wired to the panel's `onUpdate`, so adding optional fields to the type is automatically accepted with **no persistence/migration work** — all new fields are optional, so existing saved templates round-trip unchanged. The slot rendering helpers (`getClipPath`, `buildFilterCss`, `getBlendModeCss` in `clipPath.ts` / `slotEffects.ts`) were already shared and reusable.
- **Part B was smaller than the doc implied.** `filter_library_for_space()` already honored `! empty($item['isUniversal'])` **generically for both `asset` and `font`** types (the P50-I/K filter is type-agnostic), so the font *filter* side needed no change. Part B reduced to: `WPSG_Font_Library::get_all()` normalizes an `isUniversal` bool on every record (legacy entries included), `add()` persists the flag, new `set_universal()`; a `POST /admin/font-library/{id}` → `update_font` route mirroring `update_asset`; and a globe toggle in `FontLibraryManager` (with an "All spaces" badge).
- **Renderer parity via one shared component.** Rather than replicate the slot's intricate clip/mask/border CSS at all three overlay draw sites (builder canvas preview branch, builder canvas react-rnd branch, public `LayoutBuilderGallery`), the visual is centralized in a new presentational `GraphicLayerContent` — it applies transform (rotation + flip), shape clip-path, mask (with feather via `useFeatheredMask`), border (the slot's proven double-container technique for clipped/masked shapes; plain CSS border + radius for rectangles), CSS filters, drop-shadow and blend-mode. The three call sites keep ownership of *positioning* (absolute box / rnd frame, z-index, opacity, pointer-events) and just drop `<GraphicLayerContent>` inside. This guarantees the builder and the rendered gallery draw identically — the acceptance criterion — by construction. Transform/filter/blend sit on an inner wrapper so the builder's dashed selection outline (on the rnd frame) stays axis-aligned and unfiltered. `getClipPath(slot)` was generalized to `getClipPathForShape(shape, clipPath?)` so slot and overlay clip from one source of truth; `buildGraphicLayerTransform` lives in a util file (`graphicLayerTransform.ts`) to keep the component fast-refresh clean (the P50-I/K react-refresh lesson). `GraphicLayerContent`'s deps are all lightweight shared utils (no react-rnd / builder-heavy imports), so it is safe in the public gallery bundle.
- **Curated controls, not the full 48.** `GraphicLayerPropertiesPanel` gains a Transform block (rotation slider, Flip H/V toggles) inline, plus a collapsed Accordion (Shape & Border / Mask / Effects) so the panel doesn't balloon. The slot panel's effect sub-sections aren't exported, so the new panel uses focused, self-contained controls built from the same Mantine primitives (a future consolidation could extract shared effect controls — deliberately out of scope to avoid destabilizing the well-tested slot panel). The mask editor is panel-driven (URL + mode + position/scale/feather); the slot-only *canvas-drag* mask affordance is not brought over this round.
- **Validation done.** New `WPSG_P50J_Font_Universal_Test` (9 tests: universal-font visible in a delegated space without association, non-universal hidden, open-mode + unscoped bypass, `set_universal` round-trip + unknown-id, `add()` persistence + `get_all()` bool normalization, REST toggle +404 +400) — uses an option-`delete` `tear_down` (no DDL, so no dbDelta cross-run contamination). Frontend: new `GraphicLayerContent.test` (transform composition, rect-vs-clipped branch, clip-path + border + transform application), extended `GraphicLayerPropertiesPanel.test` (flip toggles, rotation slider, accordion sections, custom clip-path binding/edit, border + mask `onUpdate`), new `FontLibraryManager.test` (universal badge + toggle POSTs the correct flag). Two existing `LayoutBuilderGallery` overlay tests were updated to account for the one extra `GraphicLayerContent` wrapper now between the positioned div and the `<img>` (opacity/pointer-events still on the positioned wrapper, asserted via the `[data-wpsg-graphic-layer]` boundary). Green across the board: full PHP suite **951 tests OK on two consecutive runs** (2 pre-existing skips); frontend **2293/2293**; `tsc --noEmit` clean; `npm run build` clean; `eslint . --max-warnings 0` clean. **Remaining:** manual verification on `wordpress.lan` (deploy via `build:wp` + `update_dev_plugin.sh` + hard refresh).

---

## Track P50-K — Asset Library Terminology Sweep + Per-Space Visual Library, Tags & Builder Scoping

### Problem

Manual testing of the P50-B per-space library surfaced five issues, plus an overarching naming problem:

1. **Silent grey-out** — the Space-Management **Library** tab was `disabled` for `open` spaces with no explanation.
2. **Double checkmark** — that view also mounts on the WP-admin Spaces page (`#wpsg-spaces-admin`, light DOM), so WordPress admin's native `input[type=checkbox]:checked` dashicon rendered *under* Mantine's SVG check. No WP-admin CSS reset existed; it affected every Mantine checkbox in the admin.
3. **Ambiguous wording + poor scale** — "Control which… are available" + a flat checkbox list reads either way and collapses as a deployment accumulates many decorative assets.
4. **Known gap** — the per-space restriction never applied in the Layout Builder (the asset fetch was unscoped).
5. **Overloaded "overlay" terminology** — the reusable visual-asset library was called "overlay" throughout, but an overlay is one *use* of an asset (a canvas layer), not the asset itself.

### Fix

**Terminology sweep (`overlay` → `asset`, library/source only; clean rename, no aliases — Key Decision K).**
- **DB** (`class-wpsg-db.php`): `DB_VERSION` 13→14; idempotent `maybe_rename_overlays_to_assets_v14()` (`RENAME TABLE wpsg_overlays → wpsg_assets` when old exists and new doesn't); `get_overlays_table()` → `get_assets_table()`; `maybe_migrate_assoc_overlay_type_v14()` re-labels association rows `asset_type 'overlay' → 'asset'`; `LIBRARY_ASSET_TYPES` = `['asset','font']`.
- **Class**: `WPSG_Overlay_Library` → `WPSG_Asset_Library` (file renamed; all refs updated; **no `class_alias`**). Legacy carve-outs kept with comments: the physical upload subdir `wpsg-overlays` and the internal `overlay_id` PK column.
- **REST** (`class-wpsg-content-controller.php`): route renamed outright to `/admin/asset-library` (+ `/{id}`); handlers `upload_asset`/`update_asset`/`delete_asset`/`list_asset_library`; **no deprecated alias**. Space controller association handlers use `assetType:'asset'`; `GET /spaces/{id}/library` returns `{ asset, font }`.
- **Frontend** (~15 files, library-meaning only): `AssetLibraryItem`, `useAssetLibrary`, `getAssetLibraryQueryKey`, context `assetLibrary`/`handleUploadAsset`/`handleDeleteLibraryAsset`/`handleSetAssetUniversal`, endpoint strings. The placed canvas layer keeps "overlay" (`LayoutGraphicLayer`, `template.overlays`, `addOverlay`, `selectedOverlayId`); `OverlayArrows` / `SlotOverlayEffect` untouched.

**Image-asset tags.** `wpsg_assets.tags` (JSON-array TEXT column, v14 migration); `WPSG_Asset_Library::get_all/add/set_tags`; REST `update_asset` accepts `tags` **alongside** `is_universal` as a partial update (only provided fields change); `AssetLibraryItem.tags`; a per-item tag editor (`TagsInput` popover) in `DesignAssetsGrid` and a `tags` input in the unified upload modal. Filtering is client-side.

**Per-space visual library.** New `SpaceAssetLibrary` component replaces the asset checkbox list in `SpaceManagementView`: a thumbnail grid (checkered backing + file-type badge, reusing `getAssetFileType` + the shared `CHECKERED_BG`) with an association toggle per tile, **search**, **tag-filter chips**, and **Select all / Clear all** over the filtered set. Fonts stay checkboxes this round. Wording clarified ("Select the assets this space is allowed to use…"); open-mode spaces show an explanatory `Alert` and the tab is always enabled.

**Close the gap.** `useAssetLibrary(apiClient, enabled, spaceId?)` appends `?space=<id>` (and keys on it) when scoped; `selectedSpaceId` is threaded `AdminPanel → LayoutTemplateList → LayoutBuilderModal`. The backend filter already honored `?space=` + the universal bypass, so this was frontend-only.

**WP-admin checkbox bleed.** New `src/styles/wpAdminFormReset.css` (imported in `main.tsx`) neutralizes WP admin's native `input[type=checkbox|radio]` appearance + `::before` dashicon on Mantine controls — no-op outside wp-admin, never crosses the shadow boundary. Fixes every admin checkbox.

### Acceptance criteria

- No `overlay`-named library symbols remain (table/REST/class/TS); the canvas-layer "overlay" concept is untouched; both meanings are unambiguous.
- Library tab: open spaces show the explanatory Alert; delegated spaces show the visual grid; checkboxes render a single check; associate/dissociate + select-all/clear-all + search/tag-filter work.
- Tagging an asset (builder grid or on upload) makes it appear in the tag filter.
- With a delegated space active, the builder Asset Library shows only associated + universal assets; open/all scope shows everything.

### Validation

- **PHP**: clean rename with no aliases — all `WPSG_Overlay_Library`/`get_overlays_table`/`maybe_create_overlays_table`/`overlay-library`/`asset_type 'overlay'` references updated across source **and tests**. New `WPSG_P50K_Asset_Tags_Test` (8 tests): tags round-trip (`set_tags`/`add`/`get_all`, de-dupe/sanitize), REST upload persists tags, `update_asset` updates tags without clobbering `is_universal` (and vice-versa), no-field update → 400, and the v14 `tags` column + idempotency. The rename-from-legacy *precondition* is not reproducible under WP's per-test transaction (`DROP TABLE` doesn't take effect in-transaction — same DDL fragility as P50-B), so that test verifies the canonical table + tags column + idempotency rather than dropping the live table. Full PHP suite **942 tests OK on two consecutive runs**.
- **Frontend**: `SpaceManagementView.test` rewritten for the visual grid (association toggles, open-space Alert, `assetType:'asset'`); `DesignAssetsGrid.test` gains tag-editor coverage; fixtures carry `tags`; `useAssetLibrary` scope. `tsc --noEmit` clean, full `vitest` **2275/2275**, `npm run build` clean, `eslint .` clean (added `storybook-static` to ignores).
- **Manual test passed (2026-06-12)**: on `wordpress.lan`, an asset dissociated from a delegated space in the WP admin no longer appears in that space's Layout Builder Asset Library (builder scoping confirmed); the visual library, tags, and open-space Alert all behave.

### Implementation rationale (2026-06-11)

Scoped the rename surgically: of ~870 TS "overlay" hits, only the ~15 *library* files were touched via symbol-specific renames, leaving the canvas-layer and unrelated meanings (`OverlayArrows`, `SlotOverlayEffect`) intact — a blanket replace would have conflated three distinct concepts. Chose a **clean rename with no back-compat shims** after weighing it with the user: aliases earn their keep only with external API consumers you can't update; here the repo is co-deployed with full test coverage, so aliases would just leave confusing legacy names. The DB `RENAME TABLE` is the one necessary migration (data, not an alias). The double-checkmark root cause was WP-admin CSS bleed in the light-DOM admin mounts — fixed globally at the Mantine-input level rather than per-component. The visual grid reuses the P50-I asset-grid primitives (`CHECKERED_BG` extracted to `src/utils/checkeredBg.ts`, `getAssetFileType`) to avoid a parallel implementation.
