# Phase 48 - Mixed Improvements: Media UX, Builder, Spaces, Exports & Adapters

**Status:** In progress
**Created:** 2026-06-09
**Last updated:** 2026-06-09

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P48-A | Campaign Mgmt — accumulative multi-file selection with per-file preview | Done | Small-Medium |
| P48-B | Builder — alignment variants: distribute-by-gap & group-entity alignment | To do | Low-Medium |
| P48-C | Gallery Spaces — per-instance full-bleed CSS scoping (P47 follow-on) | Done | Small |
| P48-D | Gallery Spaces — space-scoped rate-limit buckets (P47 follow-on) | Done | Small-Medium |
| P48-E | Exports — audit log binary export (reuses Export Engine) | To do | Small-Medium |
| P48-F | Exports — media library binary export (reuses Export Engine) | To do | Small-Medium |
| P48-G | Adapters — Coverflow / 3D adapter | Done | Medium |
| P48-H | Adapters — Mosaic / Pinterest adapter | Done | Medium-High |

---

## Rationale

1. Phase 47 closed the Gallery Spaces core but left two small well-scoped follow-ons (per-instance full-bleed CSS scoping and space-scoped rate-limit buckets) that are cheap to clear now before they age further.
2. The accumulative file-selection UX (`handleSelectFiles` replacing rather than merging the queue) was flagged as the primary friction point for bulk media upload; it is a self-contained frontend change with no backend dependency.
3. The two alignment gaps — distribute-by-gap and group-as-entity alignment — have been explicitly unblocked since Phase 30 (P30-K spike and P30-G group coordinate model both complete); the naming/icon conventions and reference-frame toggle design are settled.
4. The Export Engine (shipped P39-CM1) has two natural extension points (audit log, media library) that share nearly all infrastructure with the existing campaign export; deferring further adds no value and the pattern is already proven.
5. The gallery adapter backlog has been static since Phase 22; Coverflow/3D and Mosaic/Pinterest are the two highest visual-impact entries and both fit the existing `GalleryAdapterProps` contract without interface changes.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Adapter interface | Both new adapters register via the existing `registerAdapter` call and implement `GalleryAdapterProps` — no interface changes needed. |
| B | Export Engine reuse | P48-E and P48-F call `WPSG_Export_Engine::create_job()` directly; no new engine infrastructure. |
| C | File accumulation dedup key | `name + size + lastModified` fingerprint — cheap, deterministic, and matches the existing `File` object API without hashing. |
| D | Modal width for file queue | Always `size="lg"` when files are queued in `MediaAddModal`; revert to default when queue is empty. Prevents awkward thumbnail-grid wrapping. |
| E | Full-bleed scoping attribute | Stamp `.wpsg-full-bleed` wrapper with `data-space="<slug>"` (PHP side) rather than a generated class, to keep the PHP side readable and the selector debuggable in DevTools. |

## Execution Priority

1. **P48-C** — Smallest track, pure PHP + CSS, no JS dependency, closes a known P47 v1 limitation.
2. **P48-D** — Small PHP-only change, closes the other P47 rate-limit gap.
3. **P48-A** — Frontend-only, no backend change required, highest day-to-day user impact.
4. **P48-B** — Frontend-only, unblocked, design settled.
5. **P48-E** — Backend, reuses Export Engine; establishes the pattern for P48-F.
6. **P48-F** — Backend, follows the P48-E pattern exactly.
7. **P48-G** — Coverflow adapter: self-contained, medium complexity.
8. **P48-H** — Mosaic adapter: self-contained, most complex layout algorithm; goes last.

---

## Track P48-A — Accumulative Multi-File Selection with Per-File Preview

### Problem

`handleSelectFiles` in `MediaTab.tsx` calls `setSelectedFiles(limitedFiles)` — each new drag-drop or "Choose files" picker invocation **replaces** the pending list. A user who drags five files, then drags five more, ends up with only the second batch. The current pending-file display is also a plain filename list with no visual feedback and no way to remove a single file before uploading.

### Fix

**Selection accumulation:**
- In `MediaTab.tsx` `handleSelectFiles`: when `selectedFiles` is non-empty, **merge** incoming files with the existing list rather than replacing it. De-duplicate by `name + size + lastModified` fingerprint to prevent accidental doubles.
- Enforce the existing `maxBatchUploadSize` cap across the merged list; show a Mantine notification when incoming files are trimmed to fit.
- Apply the same merge logic to `FileButton`'s `onChange` handler in `MediaAddModal` so the picker adds to the queue rather than replacing it.

**Per-file preview and removal UI:**
- Replace the current plain filename list with a thumbnail grid. Each entry shows:
  - Image files: `URL.createObjectURL` preview thumbnail.
  - Video / other files: file-type icon.
  - ✕ remove button to dequeue that file individually.
- Add a "Clear all" action for convenience when the queue is long.
- Revoke object URLs on individual removal and on modal close to avoid memory leaks.

**Modal width:**
- Set `size="lg"` on the Mantine `Modal` whenever `selectedFiles.length > 0`; revert to the default size when the queue is empty.

**Files:** `src/components/Admin/MediaTab.tsx` (`handleSelectFiles`), `src/components/Admin/MediaAddModal.tsx`

### Acceptance criteria

- Dragging two separate batches of files produces a merged queue; no files from the first drag are lost.
- Opening the file picker twice merges both selections; de-duplication prevents the same file appearing twice.
- Removing a single file via ✕ removes only that file; the rest of the queue is intact.
- "Clear all" empties the queue.
- `maxBatchUploadSize` trim fires a visible notification and keeps the combined list within the limit.
- Object URLs are revoked on individual removal and on modal close (no memory leak in DevTools).
- Modal widens to `size="lg"` when files are present.

### Validation

- Manual: open `MediaAddModal`, drag two separate batches, verify merge; use the picker twice, verify merge; confirm ✕ and "Clear all"; trigger the size cap and verify the notification.
- Unit: `handleSelectFiles` merge and dedup logic in isolation.

### Rationale

**Merge vs. replace in `handleSelectFiles`:** Added `selectedFiles` to the `useCallback` dependency array so the current queue is accessible via closure. The merge reads `existingKeys` as a `Set<string>` (O(1) lookup), filters incoming files against it, then concatenates. This keeps the operation O(n) and avoids a Map or sort.

**`onClearFiles` separate from `onSelectFiles`:** After switching `handleSelectFiles` to the merge pattern, calling `onSelectFiles([])` would produce `merged = [...selectedFiles]` (an empty incoming adds nothing), so a "Clear all" action cannot go through that path. A dedicated `onClearFiles` callback lets MediaTab reset all related state (`selectedFiles`, `uploadErrors`, `uploadTitle`, `uploadCaption`) in one atomic call.

**`FileButton`'s `onChange` returns early on `null`:** Previously `if (!value) { onSelectFiles([]); }` cleared the queue when the native file picker was dismissed without a selection. With accumulative behaviour, that would silently wipe existing queued files. The handler now returns early on null — only an explicit "Clear all" clears the queue.

**Object URL management inside `MediaAddModal`:** `useEffect` keyed on `selectedFiles` creates fresh `URL.createObjectURL` URLs on each file-list change and returns a cleanup function that revokes them. This follows the standard React effect/cleanup pattern: the previous cleanup runs before the new URLs are created, so removed files are revoked immediately and there is no leak window. Unmount also triggers cleanup, covering the modal-close case without an extra `opened`-watch effect.

**`size="lg"` when files queued:** The thumbnail grid wraps badly at the default modal width (`"md"`) once more than 4–5 files are queued. Widening to `"lg"` only when `hasFiles` is true avoids an oversized empty modal on first open.

---

## Track P48-B — Alignment Variants: Distribute-by-Gap & Group-Entity Alignment

### Problem

Two gaps remain in the P29-G-C alignment/distribution delivery:

1. **Distribute-by-gap.** The existing distribute-horizontal/vertical functions equalize slot *centers*, which produces overlap when slots have mixed sizes. Professional tools (Figma "space evenly", Canva "tidy up") equalize the *gaps between slot edges*, never producing overlap.

2. **Group-as-entity alignment.** When a persisted group and another slot are both selected and an alignment operation runs, the group's members are treated as individual slots. The expected behavior is that the group's union bounding box is the alignment unit and all member positions shift by the same delta.

### Fix

**Distribute-by-gap:**
- Add a distribute-by-gap variant for both axes. Algorithm: sort slots by leading edge; compute total gap = container span − sum of slot sizes; divide by (n − 1); assign positions such that gaps between trailing edge of slot[i] and leading edge of slot[i+1] are equal.
- Offer alongside the existing center-distribute (icon + label distinguishes the two).

**Group-as-entity alignment:**
- Before running any alignment operation, detect persisted groups in the selection. For each group, compute the union bounding box of its members and treat that box as a single virtual slot for the alignment calculation.
- After computing each slot's target position, apply the same delta to every member of that group.

**Files:** Locate existing P29-G-C distribute functions (search for `distributeHorizontal` / `distributeVertical` or equivalent in `src/components/Builder/`); add the gap variant alongside; update the alignment toolbar to expose it.

### Acceptance criteria

- Distributing mixed-size slots horizontally/vertically with the gap variant produces equal inter-slot gaps with no overlap.
- Center-distribute behavior is unchanged.
- Selecting a persisted group + one other slot and running any alignment operation moves the group as a unit; individual member relative positions are preserved.

### Validation

- Manual: create 3 slots of different widths; distribute with gap variant; confirm equal gaps, no overlap; confirm center-distribute still works.
- Manual: create a persisted group + a free slot; align left — confirm group moves as a unit.
- Unit: gap-distribute calculation with known inputs.

---

## Track P48-C — Per-Instance Full-Bleed CSS Scoping

### Problem

The shortcode emits a server-rendered `<style>` block targeting `.wpsg-full-bleed` globally. When two shortcodes on the same page reference spaces with different full-bleed settings, the last shortcode's `<style>` block wins for both instances — a v1 limitation noted in the Phase 47 report.

### Fix

- On the PHP shortcode render path (P47-E file), stamp the `.wpsg-full-bleed` wrapper with `data-space="<slug>"`.
- Scope the emitted `<style>` rules to `.wpsg-full-bleed[data-space="<slug>"]` instead of `.wpsg-full-bleed`.
- Verify that the `alignfull` class (WP Full Bleed escape mechanism) still takes effect with the scoped wrapper — may require the scoped div to also carry `alignfull` or be its direct child.

**Files:** Shortcode render function (P47-E — `wp-plugin/wp-super-gallery/` shortcode PHP), inline `<style>` output.

### Acceptance criteria

- Two shortcodes on the same page with different full-bleed settings each apply their own CSS correctly.
- A single shortcode page is unaffected (behavior identical to v1).
- `alignfull` breakout still works when full-bleed is enabled.

### Validation

- Manual: add two shortcodes to a WP test page with different `full_bleed` settings; confirm each respects its own setting independently.

### Rationale

**Approach:** Added `$space_slug` resolution immediately after `resolve_space_id()` in `render_shortcode()`. Used `WPSG_DB::get_space($space_id)->slug` with a fallback to the numeric ID string for robustness when the DB class is unavailable or the space row doesn't exist. The `data-space` attribute is stamped on the wrapper `<div>` and the CSS selector is changed from `.wpsg-full-bleed{…}` to `.wpsg-full-bleed[data-space="<slug>"]{…}` in all six media-query rules. `esc_attr()` is applied to the slug in both the HTML attribute and the CSS selector string.

**Why attribute over class:** A `data-*` attribute is readable in DevTools without the noise of auto-generated class suffixes, and is easier to target in future JS if needed.

**Test added:** `test_render_shortcode_full_bleed_css_is_space_scoped` — asserts the `data-space` attribute exists on the wrapper and that the CSS selector is scoped (not bare `.wpsg-full-bleed{`). All 16 embed tests pass.

---

## Track P48-D — Space-Scoped Rate-Limit Buckets

### Problem

`WPSG_Rate_Limiter` keys its counters site-globally. A heavy-traffic space can exhaust the shared quota and throttle requests from unrelated spaces. Phase 47 relaxed `rate_limit_authenticated()` to accept `manage_wpsg OR space-grant`, but did not add per-space quota isolation.

### Fix

- Add a `space_id` dimension to the rate-limit transient/option key in `WPSG_Rate_Limiter`, e.g. `wpsg_rl_<space_slug>_<scope>_<uid>_<route_md5>`.
- Expose a per-space `rate_limit_requests_per_minute` key in `settings_overrides` with the global value as the default (resolved via the existing settings inheritance from P47-D).
- The public `rate_limit_public()` path does not require space-scoping unless per-space public quotas are explicitly desired — leave it global for now.

**Files:** `class-wpsg-rate-limiter.php` (or wherever `rate_limit_authenticated` lives), settings schema / `settings_overrides` field list.

### Acceptance criteria

- Authenticated requests to space A do not consume quota from space B's bucket.
- A space with no explicit `rate_limit_requests_per_minute` override falls back to the global setting.
- Existing behavior on single-space (Default Space) installations is unchanged.

### Validation

- Unit: confirm transient key contains the space identifier.
- Manual: saturate one space's limit via repeated requests; confirm a second space is unaffected.

### Rationale

**Approach:** Three-file change: settings registry, sanitizer, and REST base.

- `class-wpsg-settings-registry.php`: Added `rate_limit_requests_per_minute => 0` to `$defaults` (0 = use global filter fallback) and appended the field to `$space_overridable_fields`. Default of 0 means existing single-space installs are completely unaffected.
- `class-wpsg-settings-sanitizer.php`: Added sanitization: `intval`, clamped to `[0, 6000]` (6000 req/min = 100 req/s, a reasonable ceiling).
- `class-wpsg-rest-base.php` — `rate_limit_authenticated()`: After resolving the global limit via the filter, reads `space_id` from `id` or `space_id` request params (covers both space-primary and space-secondary routes). If a space-level override is set, it replaces the global limit. Passes `$space_id` through to `rate_limit_check()`.
- `rate_limit_check()`: Added optional `$space_id = 0` param. When > 0, the transient/cache key gains a `_s{space_id}` segment: `wpsg_rl_{scope}_s{id}_{user}_{route_md5}`. This isolates each space's quota bucket from all others without touching the public path.

**Why `id` and `space_id` params:** REST routes use `id` for space-primary routes (e.g., `/spaces/{id}`) and `space_id` for nested routes. Both are tried; first non-zero wins. Requests with no space param (site-wide admin ops) get no space segment and share the global bucket, which is the safe default.

**Tests added:** 3 new assertions in `WPSG_Rate_Limiter_Test` — default value, field in space-overridable list, and sanitizer clamping. Full 893-test suite green.

---

## Track P48-E — Audit Log Binary Export

### Problem

Operators can only download the audit log as CSV. A binary ZIP containing the CSV plus referenced campaign media snapshots would be more useful for offline analysis, archival, and regulatory compliance handoffs. `WPSG_Export_Engine` (shipped P39-CM1) already handles background ZIP generation — this track adds the audit-log manifest on top of it.

### Fix

- **Manifest builder:** produce a JSON index of log entries (action, actor, campaign_id, campaign_title, occurred_at), associated campaign IDs and titles, and the requested date range.
- **Optional media snapshot pass:** for each unique campaign referenced in the log window, include its cover image and media thumbnails in the `media/` folder (same pattern as campaign binary export).
- **New REST route:** `POST /admin/audit-log/export/binary` — validates the request (date range, optional campaign filter), builds the manifest, calls `WPSG_Export_Engine::create_job('audit', $manifest, $media_items)`, returns the job ID.
- **Frontend:** add a "Download ZIP" button to the audit log admin view alongside the existing CSV export button.

**Files:** `class-wpsg-export-engine.php` (existing — no changes needed beyond confirming the `create_job` signature), new REST route controller, audit log admin React component.

### Acceptance criteria

- Triggering the export creates a background job; polling returns progress; completed ZIP is downloadable.
- ZIP contains `manifest.json` (log entries index) + `media/` folder with referenced campaign thumbnails.
- Requesting an export with no matching log entries returns a valid ZIP with an empty entries array and no `media/` folder.
- `ext-zip` unavailable: returns a 503 with a clear error message (same guard as campaign export).

### Validation

- Manual: trigger the export for a date range with known campaigns; download and unzip; confirm `manifest.json` structure and media files.
- Confirm the existing CSV export is unaffected.

---

## Track P48-F — Media Library Binary Export

### Problem

There is no way for operators to download all or selected WP media attachments as a portable ZIP, making asset migration between WordPress instances or pre-migration archival cumbersome.

### Fix

- **Manifest builder:** query WP attachments filtered by campaign, date range, and/or MIME type; produce a media reference list (attachment ID, filename, URL, MIME type, associated campaign IDs).
- Call `WPSG_Export_Engine::create_job('media_library', $manifest, $media_items)`.
- **New REST route:** `POST /admin/media/export/binary` — accepts filter params, builds the manifest, kicks off the job.
- **Import path:** extend `POST /campaigns/import/binary` or add a separate `POST /media/import/binary` that sideloads the ZIP contents into the WP media library via `media_handle_sideload`.
- **Frontend:** trigger button in the media admin surface.

**Files:** `class-wpsg-export-engine.php` (existing), new REST route controller, media admin React component.

### Acceptance criteria

- Export of a filtered selection produces a ZIP with `manifest.json` and all selected attachments in `media/`.
- Import from a media ZIP sideloads all attachments into the WP media library.
- Large sets respect the existing 100 MB size cap; a notification is shown when the cap is hit.

### Validation

- Manual: export a selection of media; download and inspect ZIP; re-import to a clean WP instance; confirm attachments are present in the Media Library.

---

## Track P48-G — Coverflow / 3D Adapter

### Problem

The adapter registry has no CSS 3D perspective carousel. This is a classic high-visual-impact layout pattern useful for campaign highlight presentations.

### Fix

- New `CoverflowAdapter` implementing `GalleryAdapterProps`.
- Layout: active item is centered and full-size; adjacent items are rotated on the Y axis (`transform: perspective(800px) rotateY(±45deg)`) and scaled down; items further out have higher `rotateY` and lower `scale`.
- Navigation: click on a side item to bring it to the front; keyboard left/right arrows; drag/swipe (reuse `useSwipe` from `src/lib/useSwipe.ts`).
- Register via `registerAdapter('coverflow', CoverflowAdapter)`.

**Files:** New `src/components/Galleries/Adapters/CoverflowAdapter.tsx`, adapter registry entry.

### Acceptance criteria

- Active item is centered and full-size; flanking items are visually recessed with correct perspective rotation.
- Clicking a flanking item promotes it to center with a smooth CSS transition.
- Keyboard left/right and swipe gestures work.
- No layout breakage at narrow viewport widths (items stack or clip gracefully).

### Validation

- Manual: add the adapter to a test gallery; navigate via click, keyboard, and swipe; confirm transitions; check mobile viewport.

### Rationale

**Approach:** New `src/components/Galleries/Adapters/coverflow/CoverflowAdapter.tsx` implementing `GalleryAdapterProps`. Items are absolutely positioned within a `perspective: 1000px` container. Each item's transform is computed from its offset relative to `currentIndex`: active item gets `rotateY(0deg) scale(1)`; ±1 flanking items get `rotateY(±45deg) scale(0.825)`; ±2 items get `rotateY(±75deg) scale(0.65)`; items beyond ±2 are hidden (`opacity: 0; pointer-events: none`). `transformOrigin` is set to the far edge of each flanking item (right for left items, left for right items) so the rotation appears anchored naturally. Horizontal stride is 28% of container width, item width is 60% — chosen to keep ±1 items clearly visible at typical gallery widths without overlap with the active item.

**Navigation reuse:** `useCarousel` manages index/direction state; `useLightbox` handles the lightbox (opened only when clicking the active item — flanking item clicks advance the index instead); `useSwipe` provides pointer-event swipe detection; keyboard ArrowLeft/ArrowRight on the focus-receiving container wrapper.

**Registry wiring:** Lazy-imported (code-split) following the existing pattern; registered in `BUILTIN_ADAPTERS` with `paginationOwnership: 'adapter'` and `settingGroups: ['media-frame', 'carousel']` (reuses the existing carousel settings group with no new schema needed).

**Why stride/ratio over fixed px:** Using container-width fractions means the layout adapts gracefully at any measured width without media-query breakpoints. At narrow viewports (< ~400px) the ±2 items are hidden automatically by the `MAX_VISIBLE_SIDE` opacity guard, leaving only the active item and its immediate neighbours visible with no horizontal overflow.

---

## Track P48-H — Mosaic / Pinterest Adapter

### Problem

The adapter registry has no irregular-tile-size layout. A mosaic layout (large hero tiles mixed with small tiles based on aspect ratio) produces visually rich, densely packed galleries without manual configuration.

### Fix

- New `MosaicAdapter` implementing `GalleryAdapterProps`.
- Algorithm: inspect each media item's aspect ratio; classify into tile-size buckets (2×2 for landscape/hero, 1×2 for portrait, 2×1 for wide, 1×1 for square/fallback); pack into a CSS Grid with 2-column base tracks; fill remaining gaps greedily.
- Graceful degradation: if grid packing produces an unfillable gap, insert a 1×1 placeholder or promote a nearby item.
- Register via `registerAdapter('mosaic', MosaicAdapter)`.

**Files:** New `src/components/Galleries/Adapters/MosaicAdapter.tsx`, adapter registry entry.

### Acceptance criteria

- Gallery renders with a mix of tile sizes derived from item aspect ratios.
- No visible unfilled gaps in the layout for typical mixed-aspect-ratio sets.
- Clicking any tile opens the lightbox on that item.
- Layout is responsive: at narrow widths the grid collapses to a single-column stack.

### Validation

- Manual: add the adapter to a gallery with a mix of landscape, portrait, and square media; confirm varied tile sizes; confirm lightbox opens; check narrow viewport.

### Rationale

**Adapter ID:** `'pinterest'` — the phase doc names the adapter "mosaic" but `'mosaic'` is already a registered alias for the `'justified'` adapter (adapterRegistry.ts line 91). Using `'pinterest'` avoids a collision and accurately describes the layout style.

**Algorithm:** Used CSS Grid with `grid-auto-flow: row dense` rather than a custom JS bin-packing algorithm. The browser's dense auto-placement fills gaps greedily at zero runtime cost. Each item's `grid-column: span X` and `grid-row: span Y` are assigned from aspect ratio buckets: ratio ≥ 1.6 → 2×2 (hero), ≥ 1.2 → 2×1 (wide), ≥ 0.7 → 1×1 (square), < 0.7 → 1×2 (portrait). Unknown dimensions default to 1×1.

**Grid geometry:** 4 physical columns at ≥ 500px container width — chosen because it accommodates all four span combinations without overflow. Row unit = `⌊containerWidth / cols / 1.2⌋px` keeps rows approximately square so 2-row tall tiles look proportional rather than excessively stretched. `useMediaDimensions` (already used by MasonryGallery) asynchronously resolves width/height from image probing; items initially render as 1×1 and reflow when dimensions arrive.

**Responsive collapse:** Below 500px all tiles are capped to 1×1 (2 columns); below 360px single column. This avoids the case where a 2-column span in a narrow viewport produces an oversized tile next to a tiny gap.

**Hover state:** Managed with local `useState<number | null>` rather than CSS-only `:hover` because the zoom icon opacity and scale transform are applied inline (pattern matches CompactGridGallery's GridCard approach). No CSS class injection needed.

---

## Follow-on candidates (not in scope for Phase 48)

- Cross-Space Campaign Move (P47 follow-on) — medium complexity, deferred.
- Per-Space Library Isolation (Overlays / Fonts) — requires `wpsg_space_library_assoc` join table, deferred.
- Spotlight / Hero and Vertical Scroll Snap adapters — deferred to a future adapter-focused phase.
- Campaign Binary Export streaming for large media sets — deferred (100 MB cap covers most cases today).
