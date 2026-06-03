# Phase 38 — Admin Media Expansion & Promoted Follow-On Tracks

**Status:** Complete
**Created:** 2026-05-31
**Last updated:** 2026-06-01

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P38-MA0 | Admin Media responsive-grid investigation spike | Complete | M |
| P38-MA1 | Admin Media container-measured column counting (narrowed) | Complete | S |
| P38-MA2 | Admin Media card layout refresh | Complete | M |
| P38-UX1 | Admin keyboard shortcut user configuration | Complete | M |
| P38-MD1 | Near-duplicate detection (pHash follow-up) | Complete | M |

> **Note:** Phase 38 started as a tightly scoped admin-media discovery spike
> plus a gated implementation track.
>
> A later planning pass broadened the phase to absorb three phase-ready
> follow-on items that already had concrete anchors in the repo: Media card
> layout refresh, admin shortcut user configuration, and near-duplicate
> detection.
>
> `P38-MA0` and `P38-MA1` remain the architectural anchor for the phase.
> `P38-MA1` should not begin until `P38-MA0` records a recommended path,
> rejected alternatives, reusable modules, and a concrete test strategy. The
> added tracks should align with those findings where they touch the same Admin
> Media surface, but they do not change the original gate on `P38-MA1`.

---

## Rationale

Phase 37 intentionally stops short of a full Media tab layout-system rewrite.
`P37-MT2` stabilizes card widths inside the current grid model so the immediate
admin-panel-width regression can be corrected without dragging a broader
responsive-layout refactor into the same phase.

That bounded fix does not answer the larger architectural question: if product
direction remains "card widths should be computed from the Media tab itself,
not inherited from the admin panel container," the current `MediaTab.tsx`
layout needs a more deliberate redesign. The existing implementation is tied to
fixed `Grid.Col` span presets and has no container-measurement layer. Changing
that has downstream consequences for drag-and-drop, card-size presets,
lightbox triggers, usage-badge overlays, and the surrounding tests.

The codebase already contains strong reusable patterns for this work:

- `src/hooks/useBreakpoint.ts` measures container width and exposes responsive
  breakpoint information.
- `src/utils/gridLayout.ts` contains width/column helpers used by listing-mode
  campaign-card surfaces.
- `src/components/CampaignGallery/CardGallery.tsx` and
  `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx` show
  how to combine fixed-width wrappers, responsive fallbacks, and width-aware
  layout calculation.

Phase 38 therefore keeps two deliberately sequenced anchor tracks while also
absorbing three promoted follow-ons that already had clear scope and existing
implementation anchors:

1. **Investigation spike (`P38-MA0`)** — establish the recommended
  architecture, explicit tradeoffs, reusable modules, rejected options, and the
  exact test strategy.
2. **Implementation (`P38-MA1`)** — execute the chosen full-decoupling path,
  but only if the spike concludes that the product need remains larger than the
  bounded Phase 37 stabilization.
3. **Card layout refresh (`P38-MA2`)** — clean up Media card badge hierarchy,
  overlay treatment, and cross-view chrome once the responsive-layout direction
  is clear enough to avoid conflicting with the architecture work.
4. **Shortcut user configuration (`P38-UX1`)** — promote the fixed admin
  shortcut map into a configurable browser-local experience with conflict
  validation and reset-to-defaults support.
5. **Near-duplicate detection (`P38-MD1`)** — extend the existing exact
  duplicate-upload flow with a perceptual-hash follow-up, but only after a
  feasibility pass validates a PHP/GD-compatible path.

---

## Track P38-MA0 — Admin Media Responsive-Grid Investigation Spike

### Problem

The current Admin Panel > Media grid is controlled by span-based Mantine Grid
presets in `src/components/Admin/MediaTab.tsx`. That makes card width a direct
function of admin-panel width. Phase 37's `P37-MT2` deliberately contains the
immediate fix to bounded width stabilization, but it does not settle whether a
true decoupling refactor is the right long-term direction.

There are at least three plausible paths:

- Keep the current grid model and add bounded width caps only.
- Add a settings-based max-width override on top of the current model.
- Replace the span-only approach with a container-measured responsive layout.

Those paths have different code surfaces, reuse opportunities, test costs, and
operator-facing complexity. The implementation track should not start until the
project has a recorded recommendation.

### Goal

Produce a concrete decision record for the Admin Media width-decoupling problem:
recommended architecture, rejected alternatives, reusable modules, migration
surface, and a precise implementation/test plan for the approved path.

### Investigation outline

1. Map the current control path in `src/components/Admin/MediaTab.tsx`:
   view mode, card-size preset handling, span-based layout, drag/reorder
   behavior, overlay placement, and list/grid/compact divergences.
2. Compare at least three implementation options:
   - bounded caps inside the current Grid model,
   - settings-based max-width override,
   - full container-measured responsive decoupling.
3. Evaluate reuse candidates in:
   - `src/hooks/useBreakpoint.ts`,
   - `src/utils/gridLayout.ts`,
   - `src/components/CampaignGallery/CardGallery.tsx`,
   - `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx`.
4. Record the recommended path, explicit rejected alternatives, expected file
   touch points, fallback behavior at narrow widths, and whether any new saved
   settings are justified.
5. Convert the findings into a concrete acceptance/test plan for `P38-MA1`.

### Key files

- `src/components/Admin/MediaTab.tsx`
- `src/components/Admin/MediaTab.test.tsx`
- `src/components/Admin/MediaCard.tsx`
- `src/components/Admin/MediaCard.module.scss`
- `src/components/Admin/mediaTabLayout.ts` _(was missing from original list; critical module)_
- `src/components/Admin/MediaTab.module.scss`
- `src/hooks/useBreakpoint.ts`
- `src/utils/gridLayout.ts`
- `src/components/CampaignGallery/CardGallery.tsx`
- `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx`
- `src/components/Settings/AdvancedSettingsSection.tsx`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php`

### Pre-conditions

- Phase 37's admin-media tracks have documented the bounded first-pass problem
  correctly (`P37-MT1`, `P37-MT2`).
- Existing Media tab interactions remain stable enough that the spike can focus
  on layout architecture rather than unrelated behavior defects.

### Open follow-ups

- **Does Phase 37 already satisfy the product need?** _(resolved — see Findings below)_
- **Is a saved setting actually justified?** — no; the current per-preset caps
  are sufficient without an operator-configurable override.

### Findings

**Layout control path** (`src/components/Admin/MediaTab.tsx` + `mediaTabLayout.ts` + `MediaTab.module.scss`):

1. `sizeConfig` in MediaTab maps each preset key (`compact` / `small` / `medium` / `large`) to `{ span, height, maxWidth }`.
2. `buildMediaGridShellVars(activeGridPreset)` in `mediaTabLayout.ts` computes four CSS custom properties — `--wpsg-media-grid-max-{base|sm|md|lg}` — each equal to `N × maxWidth + (N−1) × gutter` where `N` is the column count for that Mantine breakpoint.
3. Those CSS vars are applied as `style` on a `Box.mediaGridShell` wrapper that also carries the class `.mediaGridShell`.
4. `.mediaGridShell` in `MediaTab.module.scss` uses `max-width: var(--wpsg-media-grid-max-base, 100%)` (and overrides at each `@media` breakpoint) plus `width: 100%; margin-inline: auto`.
5. The inner `Grid` fills 100% of the capped shell. Each `Grid.Col span={preset.span}` takes a fraction of that capped width, so individual card widths are bounded by `preset.maxWidth` regardless of admin-panel width.

**Conclusion on Phase 37 adequacy:**

Phase 37 already satisfies the core product need. Card widths are bounded by `MEDIA_GRID_MAX_WIDTHS` (`compact: 112px`, `small: 160px`, `medium: 224px`, `large: 320px`) via a CSS `max-width` cap on the grid shell. Cards cannot exceed their declared maxWidth even in a very wide admin panel.

**Remaining gap:**

The responsive breakpoints controlling _column count_ changes (`sm`/`md`/`lg`) respond to **viewport** width (Mantine's standard breakpoints: 48 em / 62 em / 75 em), not admin-panel container width. In a narrow admin panel on a wide viewport (e.g., a floating or sidebar layout), the viewport breakpoints fire at the full window width rather than at the panel's available space. This can inflate the column count relative to what the panel's actual width would support.

**Recommendation:**

- **Option A (current — CSS var row-max-width cap):** Fully implemented. Satisfies the product need.
- **Option B (container measurement):** Narrow `P38-MA1` to replace viewport-breakpoint column counting with container-measured column counting via `useBreakpoint(gridContainerRef)`. The existing `max-width` cap stays in place; only the `sizeConfig.span` responsive lookup is replaced with a single column count derived from measured container width. Scope is small: wire a `ref` to the grid container, pass it to `useBreakpoint`, use the returned breakpoint to pick a single `span` value instead of passing a `{ base, sm, md, lg }` object to `Grid.Col`.
- **Option C (settings override):** Rejected. Operator tuning is not justified given the existing hardcoded caps match the card design intent.
- **Option D (full container layout rewrite):** Rejected. Not needed; the CSS var cap approach is already doing the right thing.

**Reusable modules:**

- `src/hooks/useBreakpoint.ts` — exact reuse path for Option B: attach a `ref` to the `mediaGridShell` container and call `useBreakpoint(ref)` to get a container-aware breakpoint.
- `src/components/Admin/mediaTabLayout.ts` — already in use; `resolveResponsiveMediaGridSpan` can be called with the container-resolved breakpoint to pick the correct span.

### Acceptance criteria

- The current Media tab layout-control path is explicitly documented. ✓
- The spike records a recommended architecture and rejected alternatives with
  reasoning. ✓
- Reusable modules and exact migration surfaces are identified. ✓
- `P38-MA1` is narrowed per the findings above.

### Status: Complete — P38-MA1 narrowed (see updated MA1 scope below)

---

## Track P38-MA1 — Admin Media Container-Measured Column Counting

### Problem

`P38-MA0` concluded that Phase 37's CSS-variable row-max-width cap satisfies the
core product need (card widths are bounded regardless of admin-panel width). The
remaining gap is narrower: the responsive breakpoints controlling _column count_
respond to viewport width rather than the admin-panel container's measured width.
In a narrow admin panel on a wide viewport, column count can be inflated relative
to the available panel space.

### Goal

Replace viewport-breakpoint-based column counting in `MediaTab.tsx` with
container-measured column counting, using `useBreakpoint` on the grid shell
container. The Phase 37 `max-width` cap infrastructure remains unchanged.

### Implementation outline

1. Attach a `ref` to the `Box.mediaGridShell` wrapper in `MediaTab.tsx`.
2. Call `useBreakpoint(gridShellRef)` to get a container-aware breakpoint
   (`'mobile'` / `'tablet'` / `'desktop'`).
3. In `sizeConfig`, convert from responsive span objects to per-breakpoint span
   values — or map `useBreakpoint`'s three breakpoints to the existing
   `MediaGridBreakpoint` entries in `mediaTabLayout.ts`.
4. Pass a single resolved `span` number to `Grid.Col` instead of the responsive
   `{ base, sm, md, lg }` object.
5. Keep all `MEDIA_GRID_MAX_WIDTHS` / CSS var / `mediaGridShell` class behavior
   exactly as-is.
6. Verify that drag/reorder, lightbox, sort mode, and list-view behavior are
   unaffected.
7. Update `MediaTab.test.tsx` for the container-breakpoint resolved span path.

### Key files

- `src/components/Admin/MediaTab.tsx`
- `src/components/Admin/MediaTab.test.tsx`
- `src/components/Admin/mediaTabLayout.ts`
- `src/hooks/useBreakpoint.ts`

### Pre-conditions

- `P38-MA0` is complete. ✓

### Acceptance criteria

- `Grid.Col` receives a single resolved `span` number driven by container width,
  not a responsive object driven by viewport breakpoints.
- Card `max-width` capping behavior from Phase 37 is unchanged.
- Drag/reorder, lightbox, sort mode, and list-view behavior remain correct.
- `MediaTab.test.tsx` is updated for the resolved span path.

### Status: Complete — container-measured span path shipped (2026-06-01)

---

## Track P38-MA2 — Admin Media Card Layout Refresh

### Problem

The current Admin Panel > Media card presentation has accumulated a handful of
one-off layout decisions across grid, compact, and list views. Phase 37's
usage-badge cleanup addresses the immediate regression, but the broader card
system still lacks a deliberate hierarchy for badges, thumbnail overlays,
metadata rows, and action chrome.

That leaves the Media surface visually inconsistent even when the underlying
responsive-grid behavior is corrected. The remaining work is not about one more
badge-placement tweak; it is about deciding how high-priority thumbnail metadata
should be surfaced and how the card shell should behave across all three views.

### Goal

Define and implement a cohesive Admin Media card system so grid, compact, and
list views share a deliberate badge hierarchy, overlay treatment, and card
chrome without fighting the responsive-layout direction established by
`P38-MA0`.

### Implementation outline

1. Audit the current card chrome in grid, compact, and list presentations,
   including badge placement, thumbnail overlays, caption/meta rows, and action
   affordances.
2. Rework badge hierarchy and spacing as one system instead of incrementally
   placing individual badges.
3. Move the campaign-usage badge into an intentional thumbnail overlay
   treatment unless `P38-MA0` findings require a different width-aware layout.
4. Normalize caption, metadata, thumbnail, and action-row presentation across
   the three view modes so they feel like variants of one card system.
5. Preserve drag/reorder affordances, lightbox triggers, edit/delete targets,
   sort-mode behavior, and accessibility labels while the chrome is refreshed.
6. Extend tests and manual QA to cover the refreshed card treatment at narrow,
   default, and wide admin widths.

### Key files

- `src/components/Admin/MediaTab.tsx`
- `src/components/Admin/MediaTab.test.tsx`
- `src/components/Admin/MediaCard.tsx`
- `src/components/Admin/MediaCard.test.tsx`
- `src/components/Admin/MediaCard.module.scss`

### Pre-conditions

- Phase 37's bounded Media card stabilization work is in place.
- `P38-MA0` has at least narrowed the responsive-layout direction enough that
  the card-chrome refresh will not immediately conflict with the chosen width
  model.

### Open follow-ups

- **Reconcile with `P38-MA0` before final visual lock** — if the responsive
  spike recommends a materially different wrapper or metadata structure, update
  the overlay and card-chrome decisions so this track lands on the approved
  architecture rather than parallel assumptions.

### Acceptance criteria

- Grid, compact, and list views share a deliberate badge hierarchy instead of
  one-off placements.
- The campaign-usage badge overlay treatment is intentional and stable rather
  than an ad hoc adjustment.
- Card captions, metadata, thumbnail treatment, and actions feel visually
  aligned across the three view modes.
- Drag/reorder, lightbox, edit/delete, and sort-mode behavior remain correct.
- Manual QA passes at narrow/default/wide admin widths, and tests are updated
  for the refreshed card chrome where practical.

### Status: Complete — badge hierarchy unified, compact drag handle added (2026-06-01)

---

## Track P38-UX1 — Admin Keyboard Shortcut User Configuration

### Problem

The admin shortcut map is currently fixed. The existing help modal documents the
defaults, but power users cannot remap keys to match their habits, avoid
browser conflicts, or recover from an awkward binding without changing source
code.

That limitation is acceptable for the initial shortcut rollout, but it is a
poor long-term fit for advanced admin workflows. The next step is not a broad
server-side preferences system; it is a bounded user-configuration pass that
keeps scope local and predictable.

### Goal

Allow admins to customize the supported shortcut map in a browser-local settings
surface with conflict detection, reserved-key protection, and reset-to-defaults
behavior, while preserving the current "disabled while typing" guardrails.

### Implementation outline

1. Define stable action IDs and a default map for the currently supported admin
   shortcuts.
2. Add a settings UI for editing shortcut bindings and resetting them to the
   shipped defaults.
3. Persist the effective map in `localStorage`, keyed by action ID, rather than
   expanding scope into WordPress user-meta synchronization.
4. Validate conflicts at save time and block reserved shortcuts such as Escape
   and standard browser/system combinations that should not be remappable.
5. Update hotkey resolution and the shortcuts-help modal so both reflect the
   active user-configured bindings.
6. Extend tests for remapping, persistence, conflict handling, reset behavior,
   and suppression while focus is inside a text input.

### Key files

- `src/hooks/useShortcutConfig.ts` _(new)_
- `src/hooks/useShortcutConfig.test.ts` _(new)_
- `src/hooks/useAdminCampaignActions.ts`
- `src/components/Admin/KeyboardShortcutsModal.tsx`
- `src/components/Admin/AdminPanel.tsx`

_Note: `SettingsPanel.tsx` was listed in the original outline but is not the
right home for shortcut config. SettingsPanel manages gallery-settings scoped
to a shortcode root ID; keyboard shortcuts are admin-panel-level browser-local
preferences. The edit UI lives in `KeyboardShortcutsModal` as an edit mode._

### Pre-conditions

- The first-pass scope remains browser-local. Cross-device or per-user
  WordPress persistence is explicitly out of scope for this track.

### Open follow-ups

- **Keep persistence local for Phase 38** — if product later wants shortcut
  sync across devices, promote that as a separate track instead of widening
  this implementation mid-phase.

### Acceptance criteria

- Supported admin shortcuts can be remapped through a settings surface.
- Conflicting or reserved bindings are rejected with clear validation.
- A reset-to-defaults path restores the shipped shortcut map.
- The shortcuts-help modal reflects the effective configured bindings.
- Shortcut handlers remain disabled while focus is inside a text input or other
  editing surface.

### Status: Complete

**Implementation summary:**

- New `src/hooks/useShortcutConfig.ts` — `useShortcutConfig()` hook manages the action ID → key map, persists overrides to `localStorage` under `wpsg_admin_shortcuts`, validates reserved keys and intra-map conflicts, and exposes `updateShortcut`, `resetToDefaults`, and `hasCustomizations`.
- `src/hooks/useAdminCampaignActions.ts` — calls `useShortcutConfig()` and builds `hotkeyHandler` dynamically from `effectiveMap`; exposes `shortcutConfig` in the return value.
- `src/components/Admin/KeyboardShortcutsModal.tsx` — accepts an optional `config` prop; shows the current effective bindings; adds an "Edit shortcuts" toggle that enters an edit mode with per-row key capture, conflict/reserved-key error display, per-row reset affordances, and a "Reset all to defaults" button.
- `src/components/Admin/AdminPanel.tsx` — passes `campaignActions.shortcutConfig` to `KeyboardShortcutsModal`.
- Tests: 50 tests covering hook logic, persistence, conflict/reserved-key validation, modal edit-mode rendering, and reset behavior.

---

## Track P38-MD1 — Near-Duplicate Detection (pHash Follow-Up)

### Problem

Phase 28-N already ships MD5-based exact duplicate detection and duplicate
response handling during upload. The remaining gap is near-duplicate detection
for images that are visually equivalent but not byte-identical.

That follow-up has clear product value, but it should not be treated as routine
incremental work until the project validates that a PHP/GD-compatible
perceptual-hash path is feasible at acceptable upload-time cost. The first step
for this track is therefore a bounded feasibility decision, not blind
implementation.

### Goal

Extend the existing duplicate-upload flow with perceptual-hash-based
near-duplicate warnings and reuse affordances, but only after a feasibility pass
confirms the implementation approach, threshold strategy, and upload-path cost.

### Implementation outline

1. Validate a PHP/GD-compatible perceptual-hash implementation and its
   performance profile on representative upload sizes.
2. Decide whether near-duplicate checks should run synchronously during upload
   or as a tightly bounded post-upload follow-up, and record the threshold
   strategy for Hamming-distance matching.
3. Store and index the selected pHash metadata for uploaded images.
4. Compare new uploads against the pHash index and surface near-duplicate match
   data when the configured threshold is crossed.
5. Extend the upload UX to show a side-by-side warning and offer reuse of the
   existing asset while preserving the current exact-duplicate and force-upload
   paths.
6. Add focused REST, PHP, and manual QA coverage for feasibility, threshold
   behavior, warning payloads, and reuse/override flows.

### Key files

- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`
- `wp-plugin/wp-super-gallery/tests/WPSG_P28N_Duplicate_Detection_Test.php`
- `src/components/Admin/MediaTab.tsx`

### Pre-conditions

- The pHash feasibility pass has selected an implementation path with acceptable
  runtime and operational constraints.

### Open follow-ups

- **Close or re-scope if feasibility fails** — if a PHP/GD-compatible pHash
  path is not viable within the project's constraints, update or close this
  track instead of landing a partial near-duplicate detector by inertia.

### Acceptance criteria

- Exact duplicate detection behavior remains intact.
- Near-duplicate implementation does not proceed past planning assumptions until
  the feasibility path is explicitly validated.
- Near-duplicate warnings include enough information to identify and reuse the
  existing asset.
- Threshold behavior and override paths are covered by focused tests and manual
  QA.

### Status: Complete (2026-06-01)

---

## Implementation Notes

### P38-MA0 (2026-06-01)

Investigation confirmed that Phase 37's CSS variable row-max-width system in
`mediaTabLayout.ts` + `MediaTab.module.scss` already achieves the core product
goal. `P38-MA1` is narrowed to a targeted container-measured column-count pass
using `useBreakpoint`. `mediaTabLayout.ts` added to the key files list.

### P38-UX1 (2026-06-01)

Keyboard shortcut user configuration shipped: `useShortcutConfig` hook,
`KeyboardShortcutsModal` edit mode, dynamic hotkey handler in
`useAdminCampaignActions`. `SettingsPanel.tsx` was not touched — the edit UI
is correctly placed in the shortcuts modal, not the gallery settings panel.

### P38-MA2 (2026-06-01)

`overlayBadge` (campaign-usage badge) separated from the inline type/source badge row into
its own `data-testid="media-card-usage-overlay"` element, resolving the TODO comment at
`MediaCard.tsx:90`. Type/source badges remain at top-left; usage badge sits bottom-right.
Compact mode now renders a drag handle button when `dragHandleProps` is provided, matching
full-mode affordance. `MediaCard.test.tsx` updated: overlay-badge assertion migrated to
`media-card-usage-overlay`; new test covers compact drag handle. 25 tests pass.

**Follow-up fixes during MA2:**

- Overlay positioning was originally CSS-module-class-only, which collapsed when classes
  evaluated falsy. Reworked to explicit inline `style` props (`position: relative/absolute`,
  `top/bottom/left/right`, `zIndex`) on all overlay elements; removed the now-redundant
  `.previewWrapper`, `.overlayStack`, `.badgeGroup`, and `.usageBadgeOverlay` SCSS classes.
  Only `.mediaCard` and the reduced-motion block remain in `MediaCard.module.scss`.

- Hover glow for the usage badge was originally a CSS `:hover` rule on the wrapper Box, which
  did not trigger due to Mantine `Popover.Target`'s `cloneElement` interfering with event
  propagation. Switched to `onMouseEnter`/`onMouseLeave` React state driving an inline
  `filter: drop-shadow()` on hover. `drop-shadow` traces the Badge's visual alpha shape rather
  than the wrapper Box's bounding rectangle, so the glow aligns correctly with the pill.

### P38-MA1 (2026-06-01)

`mapToMediaGridBreakpoint` added to `mediaTabLayout.ts` (mobile→base, tablet→md,
desktop→lg). `MediaTab.tsx` wires `gridShellRef` to both `Box.mediaGridShell`
elements (skeleton and live grid), calls `useBreakpoint(gridShellRef)`, and resolves
a single `span` number via `resolveResponsiveMediaGridSpan` before passing it to
`Grid.Col`. `GridColProps` import removed; `SortableGridItemProps.gridSpan` narrowed
to `number`. CSS-var max-width system and `sizeConfig` presets are untouched.
`mediaTabLayout.test.ts` and `MediaTab.test.tsx` updated (36 tests, all pass).

### P38-MD1 (2026-06-01)

Feasibility validated and shipped in full within the same session.

**PHP — new `WPSG_PHash` class** (`class-wpsg-phash.php`): dHash implementation
using GD's `imagescale` to resize to 9×8, then comparing adjacent pixel
brightness to build a 64-bit fingerprint encoded as 16 lowercase hex chars.
`compute(string $path): ?string`, `hamming_distance(string $a, string $b): int`,
`is_image_mime(string $mime): bool` are the public surface. All GD calls are
guarded; non-image files and GD errors return `null`.

**PHP — `WPSG_DB::get_campaigns_for_attachment_id(int $id): array`**: scans all
non-trashed `wpsg_campaign` posts, reads their `media_items` postmeta, and returns
`[['id' => string, 'title' => string], ...]` for each campaign that references the
given WordPress attachment ID. Bypasses the UUID-indexed `wp_wpsg_media_refs` table
because that table indexes media UUIDs, not attachment IDs. Called only on duplicate
detection so the O(campaigns) scan is acceptable.

**PHP — `WPSG_REST` changes**: two new private helpers:
`find_near_duplicates_by_phash()` (scans `_wpsg_file_phash` postmeta for the
closest Hamming match within the configurable `wpsg_phash_hamming_threshold` filter,
default 10 bits) and `find_attachment_origin_meta()` (returns filename + campaign
list for a given attachment ID). `upload_single_media_file()` now: (a) enriches
the exact-duplicate `wpsg_duplicate_file` error with `existing_name` /
`existing_campaigns`, (b) runs pHash near-duplicate detection after the MD5 check
and returns `wpsg_near_duplicate_file` with `similar_id`, `similar_url`, `distance`,
`similar_name`, `similar_campaigns`, and (c) stores the computed pHash as
`_wpsg_file_phash` postmeta on successful upload. Both single-file and batch
response paths in `upload_media()` pass the new fields through to the REST response.

**TS — `types/index.ts`**: new `UploadDuplicateCampaign` interface; `BatchUploadResult`
extended with `existing_name`, `existing_campaigns`, `near_duplicate`, `similar_id`,
`similar_url`, `similar_name`, `similar_campaigns`, `distance`.

**React — new `NearDuplicateWarning` component** (`src/components/Common/NearDuplicateWarning.tsx`):
shows a side-by-side warning card when a near-duplicate is detected. Title:
"Visually similar image found". Body names the original file (`originalName` prop).
Campaign membership is rendered as a single compact line — "Not in any campaign" /
"Used in: A" / "Used in: A, B" / "Used in: A, B and N more". Offers "Upload Anyway"
(force re-upload) and "Use Existing" (add the matched attachment to the campaign
without a new upload). Separate loading spinners for each action path.

**React — `MediaTab.tsx`**: added `NearDuplicateEntry` interface (file, filename,
similarId, similarUrl, distance, similarName, campaigns) and a
`pendingNearDuplicates` queue. `handleUpload()` splits upload results into
near-duplicate entries (routed to the queue) and hard errors (shown inline); exact
duplicate inline errors are now formatted as "Already uploaded as 'name'" /
"…used in Campaign" / "…used in N campaigns" instead of the raw `result.error`
string. `handleNearDupUseExisting()` / `handleNearDupForceUpload()` resolve the
front-of-queue entry and refresh the media list on success.

**Tests**: `WPSG_P38MD1_PHash_Test.php` (new — 10 tests: dHash unit tests, pHash
storage on upload, near-duplicate 409 detection with origin meta, campaign lookup
correctness, exact-duplicate 409 unchanged, force=true bypass, video exclusion).
`WPSG_P28N_Duplicate_Detection_Test.php` and `WPSG_P28D_Batch_Media_Upload_Test.php`
updated to assert the new `existing_name` / `existing_campaigns` fields. 741 PHP
tests pass; 1978 React tests pass.

---

## PR Review — Comment Resolutions (PR #53)

### Thread: pHash not computed/stored when `force=true` (Copilot)

**Decision: Accept.**

The pHash computation block was gated entirely on `!$force`, mirroring the
near-duplicate *check* but unlike MD5, which is always computed (only the check is
guarded). This meant "Upload anyway" results never stored `_wpsg_file_phash`, so
they were permanently invisible to future near-duplicate scans.

Fix: moved the class-exists/mime guard outward so pHash is computed for all image
uploads; the near-duplicate check (`find_near_duplicates_by_phash`) remains gated on
`!$force`.

**Changes:** `class-wpsg-rest.php` ~line 2816 — `!$force` moved from outer `if`
condition to the inner `if ($phash !== null && !$force)` check.

### Thread: `find_near_duplicates_by_phash()` O(N) full-table scan (Copilot)

**Decision: Accept.**

Three issues fixed:
1. **Scope** — query now JOINs `wp_posts` and filters `post_type = 'attachment'`
   AND `post_status = 'inherit'`, excluding non-attachment postmeta rows.
2. **Early exit** — distance-0 (exact perceptual match) now breaks the loop
   immediately rather than continuing to scan remaining rows.
3. **Prepared statement** — query wrapped in `$wpdb->prepare()` to satisfy
   WPDB/PHPCS prepared-SQL requirements even for constant meta-key literals.

**Changes:** `class-wpsg-rest.php` `find_near_duplicates_by_phash()` — query
rewritten with JOIN + prepare; early break added on `$d === 0`.

### Thread: `nearDupFilenames` Set uses filename string instead of File identity (Copilot)

**Decision: Accept.**

Files from different folders with the same name share a filename string, so using a
`Set<string>` of names could incorrectly suppress hard-error entries for files that
are not near-duplicates. `File` objects are reference-typed, so a `Set<File>` gives
correct identity semantics at zero extra cost.

**Changes:** `MediaTab.tsx` ~line 641 — `nearDupFilenames` (Set of `.name` strings)
replaced with `nearDupFiles` (Set of `File` references); filter updated accordingly.

## PR Review — Comment Resolutions (PR #53, Round 2)

### Thread: `find_near_duplicates_by_phash()` scalability concern (Copilot — Round 2)

**Decision: Accept (partial — max-scan limit).**

The O(N) full-scan concern was partially addressed in Round 1 (attachment JOIN +
early-exit on distance 0). Copilot's suggestion of a dedicated indexed table or
prefix bucketing is out of scope for this PR. The pragmatic middle ground is a
configurable row cap: a `wpsg_phash_max_scan` filter (default 5000) maps to a
`LIMIT %d` in the SQL, bounding worst-case memory and time without a schema change.
Implementors needing coverage beyond 5000 hashed attachments can raise the limit
via the filter or introduce a dedicated lookup table in a future phase.

**Changes:** `class-wpsg-rest.php` `find_near_duplicates_by_phash()` — `LIMIT %d`
added to query, driven by `apply_filters('wpsg_phash_max_scan', 5000)`.

### Thread: `get_campaigns_for_attachment_id()` N+1 meta reads (Copilot — Round 2)

**Decision: Reject.**

This function runs only on the rare duplicate/near-duplicate detection path (at most
once per upload attempt that happens to collide). The suggested fix — querying
`postmeta` with LIKE for a serialized `media_items` value — is fragile against PHP
serialization format variations and not meaningfully faster for typical campaign
counts. Flagged for future consideration if a campaign→attachment mapping table is
introduced.

### Thread: PHash test suite missing GD availability guard (Copilot — Round 2)

**Decision: Accept.**

`WPSG_P38MD1_PHash_Test` uses `imagecreatetruecolor()` / `imagepng()` throughout.
Without a guard, the suite hard-fails in environments without GD. Pattern taken from
`WPSG_Image_Optimizer_Test`.

**Changes:** `WPSG_P38MD1_PHash_Test::setUp()` — early `markTestSkipped` when
`imagecreatetruecolor` is not available.

### Thread: Batch upload test `create_temp_gif()` missing GD guard (Copilot — Round 2)

**Decision: Accept.**

`WPSG_P28D_Batch_Media_Upload_Test::create_temp_gif()` was rewritten from a
base64-fixture approach to GD-based image generation. Same GD guard needed.

**Changes:** `WPSG_P28D_Batch_Media_Upload_Test::setUp()` — early `markTestSkipped`
when `imagecreatetruecolor` is not available.

### Thread: `updateShortcut()` allows empty/whitespace key binding (Copilot — Round 2)

**Decision: Accept.**

An empty string passes the reserved-key check, conflicts check, and ends up stored
in the overrides map, producing an unrecoverable binding. Added an explicit guard
before the reserved-key check that returns a validation error for empty/whitespace
input.

**Changes:** `useShortcutConfig.ts` `updateShortcut()` — empty `normalized` check
added as the first guard.

---

## Outcome

All five tracks complete. Phase 38 delivered: container-measured column counting in
the Admin Media grid (P38-MA0/MA1), a unified badge hierarchy and overlay treatment
for Media cards (P38-MA2), browser-local admin keyboard shortcut remapping with
conflict validation (P38-UX1), and perceptual-hash near-duplicate detection with
richer duplicate messaging for both exact and near-match upload cases (P38-MD1).

Additional fix landed during P38-MD1 work: sign-in modal and `ArchiveCampaignModal`
were missing `withinPortal={false}`, making them invisible in shadow DOM mode due
to Mantine's theme color CSS variables being scoped to `:host` and unavailable to
portal-rendered elements outside the shadow root. Both modals are now consistent
with every other modal in the app.

---

## Related Planning

- Continues from: `docs/PHASE37_REPORT.md` (`P37-MT1`, `P37-MT2`).
- Promoted from: `docs/FUTURE_TASKS.md` (Media Tab card layout refresh,
  shortcut user configuration, near-duplicate detection).
- Prompt source: 2026-05-31 Admin Panel > Media review requesting badge cleanup
  plus a path toward true card-width decoupling from admin-panel width.
- Builds on: current Media tab grid/list/compact implementation in
  `src/components/Admin/MediaTab.tsx`; width and listing-layout helpers in
  `src/utils/gridLayout.ts`; container measurement in
  `src/hooks/useBreakpoint.ts`; fixed/responsive wrapper patterns in
  `src/components/CampaignGallery/CardGallery.tsx` and
  `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx`.
- Gating rule:
  - **P38-MA1** does not begin until **P38-MA0** records an accepted
    recommendation.