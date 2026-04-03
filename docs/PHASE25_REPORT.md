# Phase 25 - Modal Reliability, Shared Media Entry, and Backlog Cleanup

**Status:** In Progress
**Created:** March 31, 2026
**Last updated:** April 2, 2026

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P25-A | Fix broken gallery-config dropdowns inside modal stacks | Completed ✅ | Small-Medium (0.5 day) |
| P25-B | Unify campaign media add flows around one shared entry surface | Completed ✅ | Medium-Large (1-2 days) |
| P25-C | Raise Settings panel above campaign/card modal stacks | Completed ✅ | Small (0.25 day) |
| P25-D | Reorganize `FUTURE_TASKS.md` and promote/prune backlog items | Completed ✅ | Medium (0.5-1 day) |
| P25-E | Add live gallery-config preview with cancel-to-revert and save-to-persist semantics | Completed ✅ | Medium (0.5-1 day) |
| P25-F | Restore true per-breakpoint adapter selection in the shared gallery-config editor | Completed ✅ | Medium (0.5 day) |
| P25-G | Raise the shared Manage Media modal above the campaign viewer stack | Completed ✅ | Small (0.25 day) |
| P25-H | Reorganize Campaign Gallery Config into accordions and only expose adapter settings for explicit overrides | Completed ✅ | Medium (0.5 day) |
| P25-I | Add campaign card image-resolution controls with srcset for WP media sizes | Planned | Medium (0.5-1 day) |
| P25-J | Stabilize carousel multi-card focus and smooth small-set looping | Completed ✅ | Medium (0.5 day) |
| P25-K | Fix carousel autoplay lifecycle: lightbox pause, synthetic-loop conflict, test coverage | Completed ✅ | Medium (0.5 day) |
| P25-L | Add carousel image-fit and aspect-ratio controls for both image and video slides | Planned | Medium-Large (1-2 days) |
| P25-M | Fix WordPress `Campaigns > Settings` saves so SPA settings no longer appear reset to defaults | Completed ✅ | Medium (0.5-1 day) |
| P25-N | Restore campaign card and adapter justification controls for partial rows | Completed ✅ | Small-Medium (0.25-0.5 day) |
| P25-O | Evaluate live preview for broader visual settings beyond gallery-config editing | Proposed | Medium-Large (1-2 days) |
| P25-P | Run a three-pass settings IA audit covering redundancy, grouping, and side-panel feasibility | Completed ✅ (3 passes); implementation → P25-U | Large (2-3 days) |
| P25-Q | Add vertical justification controls for campaign card gallery grid | Completed ✅ | Small-Medium (0.25-0.5 day) |
| P25-R | Add `blur` as a background-type option with backdrop-blur and image-blur modes | Planned | Medium (0.5-1 day) |
| P25-S | Define primary scale / aspect-ratio sizing controls plus advanced raw overrides for cards and gallery items | Proposed | Medium-Large (1-2 days) |
| P25-T | Map and expose layered positioning controls for card grids, gallery shells, sections, and adapter blocks | Proposed | Medium-Large (1-2 days) |
| P25-U | Execute settings IA overhaul: 6-tab regroup, Modal→Drawer conversion, control relocations, accordion restructuring | Completed ✅ | Large (3-5 days) |
| P25-V | Stabilize heavyweight Vitest suites by reducing hidden DOM work and documenting worker timeout failure modes | Completed ✅ | Medium (0.5-1 day) |
| P25-W | Add batch media upload with parallel file handling and per-file progress | Planned | Medium-Large (1-2 days) |

---

## Rationale

Phase 24 closed the responsive gallery parity work, but it left a few high-friction issues in the modal stack and campaign-admin workflow that now block QA:

1. Gallery-config dropdowns in the campaign flow are not usable.
2. The card/menu Add Media path is weaker than the Admin Panel flow because it cannot upload files.
3. Settings can open behind an already-open campaign/card modal.
4. `FUTURE_TASKS.md` has drifted into a mixed document of active work, historical work, and genuine deferred work.

This phase is intentionally focused. The first goal is to restore reliable QA surfaces, then unify the duplicate media-entry UX, then normalize backlog hygiene so future phase planning is based on current reality instead of stale carryover notes.

## Key Decisions (Pre-Resolved)

| # | Decision | Resolution |
|---|----------|------------|
| A | Dropdown fix strategy | Use a shared modal-scoped `Select` wrapper that forces `comboboxProps.withinPortal = false` so dropdowns stay inside the active modal tree. |
| B | Settings stacking fix | Keep the Settings modal root-mounted, but explicitly raise its modal `zIndex` above the campaign/edit modal layer. |
| C | Add Media unification scope | Unify the upload + external URL entry flow first. Library-picking can remain attached to the full campaign media tab if keeping it separate reduces complexity. |
| D | `FUTURE_TASKS` cleanup policy | Normalize structure first, mark prune candidates instead of silently deleting them, and move clearly completed work into the appropriate historical phase docs. |

## Execution Priority

1. **P25-A** Fix gallery-config dropdown behavior in modal contexts.
2. **P25-C** Ensure Settings always opens above campaign/card modals.
3. **P25-B** Extract or share the campaign media add surface so upload and external URL entry behave consistently.
4. **P25-D** Normalize and prune `FUTURE_TASKS.md`, then promote high-value work into active planning.

## QA Follow-On Bugs

Manual QA after the first implementation pass confirmed that dropdowns and Settings stacking were fixed, but it also surfaced three follow-on issues that still belonged in Phase 25 rather than a later phase:

1. Gallery-config changes inside the campaign viewer did not preview live, which made responsive tuning slow and opaque.
2. The shared responsive editor was still flattening unified adapter choices across breakpoints even though the runtime resolver supports per-breakpoint unified adapters.
3. The shared Manage Media modal still opened below the campaign viewer stack because it was using the default modal layer.

These became P25-E through P25-G.

## Second QA Follow-On Set

The next QA pass surfaced a more UX-oriented batch that still fits Phase 25 because it sits directly on top of the responsive gallery-config and carousel work already in flight:

1. Campaign Gallery Config is too flat and needs accordion structure so sections can be collapsed while tuning breakpoints.
2. The campaign override editor should only surface adapter-specific controls for explicit adapter choices on the active breakpoint instead of defaulting inherited scopes to carousel controls.
3. Card image settings need a focused image-resolution control path for thumbnail imagery.
4. Carousel multi-card behavior still needs cleanup around centered focus, visible-card counts, looping, autoplay, and image-specific fit/aspect-ratio controls.

These became P25-H through P25-L.

## Critical Settings Sync Follow-On

While verifying the new carousel behavior in the WordPress-hosted app, a more serious regression surfaced: saving app settings could make the WordPress side appear to reset gallery configuration back to defaults.

That issue belongs in the same phase because it blocks safe QA of the newly added gallery-config/editor work. It also exposed a second hardening gap: the plugin still lacks export/import for full settings snapshots.

The destructive reset bug became P25-M. Export/import remains a follow-on candidate once the sync fix is verified in a full WordPress test environment.

## Latest QA Follow-On

That QA pass confirmed the modal dropdown repair, but it also showed two important follow-ups at the time:

1. The classic WordPress `Campaigns > Settings` save path still left the SPA looking reset to defaults, so P25-M required a file-level review of the admin-form save path.
2. Campaign card row-justification controls were no longer visible in normal settings flows, and that regression needed to be fixed before further card-grid QA.

The row-justification regression became P25-N.

## Latest QA Completion Pass

The newest QA round closed the remaining active verification items from the shared gallery-config and WordPress settings work:

1. Classic WordPress `Campaigns > Settings` saves no longer make the SPA appear reset to defaults.
2. The shared Manage Media modal now reliably opens above the campaign viewer.
3. Campaign Gallery Config now uses accordions as intended.
4. Live preview while manipulating campaign gallery config is working.
5. Per-breakpoint adapter selection is present and functioning in the shared editor.

That completion pass closes P25-E, P25-F, P25-G, P25-H, and P25-M.

## New Follow-On Tracks

The same QA and planning pass surfaced the next tranche of Phase 25 candidate work, and later sizing / positioning feasibility reviews added two more bounded follow-on candidates:

1. Extend live preview behavior to more of the visually obvious settings surface beyond the campaign gallery-config editor.
2. Run a deeper settings information-architecture review to identify redundant controls, better grouping, and whether Settings should move from a modal to a side-panel interaction model.
3. Evaluate vertical justification of campaign card gallery viewports within their available container height.
4. Add `blur` as a new option anywhere background-type selectors currently support visual background treatments.
5. Add an incremental scale control path for campaign cards and gallery items so sizing can be nudged without manually retuning multiple width and height fields.
6. Audit and expose vertical-alignment plus fine-positioning controls for the card gallery grid, gallery shell stacks, and adapter-section containers.

Because the settings IA question is larger than a direct implementation tweak, it should begin with three independent analysis passes before code changes are proposed.

## Track P25-E - Live Campaign Gallery Preview COMPLETE

### Problem

Campaign viewer gallery-config edits only became visible after a save roundtrip, which prevented fast visual iteration and made it harder to tell whether responsive gallery choices were actually taking effect.

### Fix

Keep a viewer-local preview copy of the campaign gallery overrides while the responsive editor is open. Draft changes now update the rendered viewer immediately, cancel restores the last saved campaign state, and only Save persists the draft through the campaign API.

### Acceptance criteria

- Viewer gallery changes preview immediately while editing.
- Cancel reverts the viewer back to the last saved campaign state.
- Save remains the only action that persists responsive gallery changes to the backend.

## Track P25-F - Breakpoint-Specific Unified Adapters COMPLETE

### Problem

The shared responsive editor supported breakpoint-specific settings but still exposed unified adapter selection as one cross-breakpoint control, which effectively forced the desktop unified adapter onto tablet and mobile too.

### Fix

Move unified adapter selection into each breakpoint tab so the editor writes to `galleryConfig.breakpoints[breakpoint].unified.adapterId` instead of copying one unified adapter to every breakpoint.

### Acceptance criteria

- Unified gallery adapters can differ across desktop, tablet, and mobile.
- Editing one unified breakpoint does not overwrite sibling breakpoints.
- Runtime resolution continues to use the active breakpoint-specific unified adapter.

## Track P25-G - Manage Media Modal Layering COMPLETE

### Problem

After the shared media-entry modal replaced the card-menu external-only dialog, the campaign viewer could still sit above Manage Media because the shared modal kept Mantine's default layer.

### Fix

Pass an explicit high `zIndex` through the campaign Manage Media wrapper so the shared media-entry modal consistently opens above the campaign viewer and nested gallery-config editor stack.

### Acceptance criteria

- Manage Media always opens above the campaign viewer.
- The admin Media tab can continue using the shared modal without inheriting campaign-viewer-specific stacking assumptions.

## Track P25-H - Campaign Gallery Config UX Cleanup COMPLETE

### Problem

Campaign Gallery Config has become hard to scan because every shared setting block stays expanded, and inherited breakpoint scopes were still surfacing carousel controls even when that breakpoint did not actually define an explicit adapter override.

### Fix

Reorganize the shared campaign gallery editor into accordion sections and only expose adapter-specific controls when the active breakpoint has an explicit adapter override for the relevant scope.

### Acceptance criteria

- Campaign Gallery Config sections can be collapsed while editing.
- Inherited scopes no longer masquerade as explicit classic/carousel overrides.
- Adapter-specific settings reflect the adapter actually selected on the active breakpoint.

## Track P25-I - Card Image Resolution Controls

### Problem

Card thumbnail tuning still lacks a dedicated image-resolution control path, which makes it harder to intentionally trade off fidelity against payload size for image-heavy galleries. The REST API currently returns a single `thumbnail` URL via `wp_get_attachment_url()`, and `CampaignCard` renders it as a plain `<Image src={url}>` with no `srcset` or resolution awareness.

### Current state

WordPress already generates multiple image sizes for uploaded attachments, including two custom registered sizes (`wpsg_gallery` 400×400, `wpsg_thumb` 400×400) plus the standard `thumbnail`, `medium`, `large`, and `full` sizes. The campaign REST response only returns one URL, so the browser has no opportunity to pick an appropriate resolution.

### Planned implementation

1. **Extend REST API**: Modify `format_campaign()` in `class-wpsg-rest.php` to return a `thumbnails` map alongside the existing `thumbnail` field. Use `wp_get_attachment_image_src()` for each registered WP size (`thumbnail`, `medium`, `large`, `full`) and include dimensions. The existing `thumbnail` field stays for backward compatibility.
2. **Update Campaign type**: Add optional `thumbnails?: Record<string, { url: string; width: number; height: number }>` to the TypeScript `Campaign` interface.
3. **Add setting**: `cardThumbnailResolution: 'auto' | 'thumbnail' | 'medium' | 'large' | 'full'` (default: `'auto'`). Named sizes map directly to WP sizes. The `'auto'` mode uses `srcset` (see below).
4. **Generate `srcset`**: In `CampaignCard.tsx`, when `cardThumbnailResolution === 'auto'` and `campaign.thumbnails` is available, build an HTML `srcset` attribute from the available sizes so the browser natively picks the best match for the rendered card dimensions. Also set a `sizes` attribute based on the card's rendered width. When a specific size is selected, use that URL directly without `srcset`.
5. **Fallback**: Campaigns with external URLs or older API responses that lack `thumbnails` fall back gracefully to the existing `campaign.thumbnail` field with no `srcset`.
6. **Settings UI**: Add a resolution selector in `CampaignCardSettingsSection.tsx` under the Card Appearance accordion.
7. **PHP chain**: Add `card_thumbnail_resolution` to the settings registry defaults and sanitizer.

### Risk assessment for srcset

Adding `srcset` to Mantine's `<Image>` is safe: the attribute passes through to the underlying `<img>` element via spread props. The `thumbnails` object is purely additive to the REST response. Browsers that do not support `srcset` ignore it and use `src` as normal. External-URL campaigns are unaffected because `srcset` is only generated when WP size variants are present. No breakage risk.

### Acceptance criteria

- REST API returns `thumbnails` map with available WP size variants and their dimensions.
- `auto` mode generates `srcset` + `sizes` so the browser picks the optimal resolution.
- Named size modes (`thumbnail`, `medium`, `large`, `full`) use the corresponding URL directly.
- External-URL campaigns fall back to the existing single `thumbnail` field.
- Settings persist and round-trip through save/load and REST API.

## Track P25-J - Carousel Multi-Card Focus and Small-Set Looping COMPLETE

### Problem

Carousel multi-card mode was still tracking the leftmost snap as the active item, which made captions and dot state feel off-center in multi-card layouts. Small multi-card sets also needed a safer looping path because Embla can fall back or jump abruptly when there are not enough distinct slides for a clean native loop.

### Fix

Treat the centered slide as the active item in multi-card mode, keep arrow/dot navigation aligned to that centered focus, and use a synthetic three-band loop fallback for small multi-card sets. The synthetic loop now waits for Embla `settle` before the invisible recenter so the last-to-first wrap remains visually smooth.

### Acceptance criteria

- Multi-card captions and dot state track the centered slide rather than the leftmost snap.
- Small multi-card sets can still wrap cleanly without exposing empty trailing frames.
- The synthetic last-to-first wrap completes with a smooth visible transition before the invisible recenter occurs.

## Track P25-K - Carousel Autoplay Audit and Fixes COMPLETE

### Problem

QA still reports autoplay inconsistency in some modal/tablet contexts, which needs an isolated pass now that breakpoint resolution and basic multi-card guardrails are in better shape.

### Audit findings

Pre-implementation analysis identified three concrete issues:

1. **No lightbox pause/resume**: The carousel autoplay plugin keeps ticking when a lightbox modal opens over the carousel. `isLightboxOpen` state exists but is only used for lightbox visibility, not autoplay lifecycle.
2. **Synthetic loop + autoplay conflict**: The settle-based invisible recenter used for small multi-card sets can fire while autoplay is advancing, causing a visual jump.
3. **No autoplay test coverage**: Neither `carouselBehavior.test.ts` nor `MediaCarouselAdapter.test.tsx` test autoplay plugin inclusion, pause/resume, or interaction behavior.

Additionally, `stopOnInteraction: true` is hardcoded in the Embla autoplay plugin config. This is the correct UX default (autoplay should stop permanently after user drag/click, not resume) and does not need to be exposed as a setting.

### Planned implementation

1. **Lightbox pause/resume**: Add an effect in `MediaCarouselAdapter.tsx` that watches `isLightboxOpen` and calls `emblaApi.plugins().autoplay?.stop()` on open, `emblaApi.plugins().autoplay?.play()` on close (only if autoplay was previously active).
2. **Synthetic loop guard**: In the settle-based recenter callback in `carouselBehavior.ts`, stop autoplay before the invisible recenter and restart it after, so the autoplay timer does not fire during the jump.
3. **Test coverage**: Add tests for autoplay plugin inclusion/exclusion, lightbox pause/resume, and settle-recenter autoplay guard.

### Acceptance criteria

- Opening the lightbox pauses carousel autoplay; closing resumes it (if autoplay was running).
- Synthetic loop last→first wrap does not cause autoplay to fire during the invisible recenter.
- `stopOnInteraction: true` remains hardcoded with a code comment explaining the UX rationale.
- New autoplay tests pass in the test suite.
- No regressions in existing carousel navigation or multi-card behavior.

## Track P25-L - Carousel Image and Video Fit / Aspect Ratio Controls

### Problem

The classic carousel still uses hardcoded `fit="contain"` for all slides and hardcoded aspect ratios (`3/2` for images, `16/9` for videos). That limits visual polish for image-dominant campaigns and prevents intentional aspect-ratio choices for video-heavy layouts.

### Current state

Constants at the top of `MediaCarouselAdapter.tsx`:
- `IMAGE_ASPECT_RATIO = '3 / 2'` and `IMAGE_ASPECT_RATIO_MULTIPLIER = 1.5`
- `VIDEO_ASPECT_RATIO = '16 / 9'` and `VIDEO_ASPECT_RATIO_MULTIPLIER = 16 / 9`
- `fit="contain"` hardcoded on `<Image>` and `objectFit: 'contain'` on `<video>`

Height-constraint modes (`auto`, `viewport`, `manual`) interact with aspect ratio: manual mode ignores aspect ratio entirely.

### Planned implementation

1. **Add settings to types** (`GalleryBehaviorSettings` in `src/types/index.ts`):
   - `carouselImageFit: 'contain' | 'cover' | 'fill' | 'scale-down'` (default: `'contain'`)
   - `carouselVideoFit: 'contain' | 'cover' | 'fill' | 'scale-down'` (default: `'contain'`)
   - `carouselImageAspectRatio: 'auto' | '1/1' | '4/3' | '3/2' | '16/9' | '21/9' | 'custom'` (default: `'3/2'`)
   - `carouselVideoAspectRatio: 'auto' | '1/1' | '4/3' | '3/2' | '16/9' | '21/9' | 'custom'` (default: `'16/9'`)
   - `carouselImageAspectRatioCustom: string` (default: `''`) — freeform ratio string for custom mode
   - `carouselVideoAspectRatioCustom: string` (default: `''`) — freeform ratio string for custom mode
2. **Add settings to PHP chain**: registry defaults + sanitizer with allowlist validation.
3. **Update adapter settings schema** in `adapterRegistry.ts`: add field definitions to the carousel adapter's settings groups so they appear in the gallery-config editor.
4. **Replace hardcoded constants** in `MediaCarouselAdapter.tsx`: resolve fit and aspect ratio from settings, falling back to the current hardcoded values as defaults so the change is non-breaking.
5. **Per-breakpoint support**: These settings flow through `galleryConfig.adapterSettings` so they can differ across breakpoints via the responsive editor.
6. **Height-constraint interaction**: Manual height mode continues to ignore aspect ratio. `auto` and `viewport` modes use the setting-driven aspect ratio.

### Acceptance criteria

- Image slides respect `carouselImageFit` and `carouselImageAspectRatio` settings.
- Video slides respect `carouselVideoFit` and `carouselVideoAspectRatio` settings.
- Defaults produce identical behavior to current hardcoded values (non-breaking).
- Custom aspect ratio accepts freeform ratio strings (e.g., `5/4`).
- Per-breakpoint overrides work through the responsive editor.
- Manual height-constraint mode still ignores aspect ratio.
- Settings persist through save/load and REST API.

## Track P25-M - WordPress Settings Sync / Reset Bug COMPLETE

### Problem

The remaining settings reset bug is now isolated to the classic WordPress `Campaigns > Settings` save path. That PHP form only submits the small set of registered admin fields, while `sanitize_settings()` was returning only the keys present in the incoming payload. Any existing non-posted settings, including nested `gallery_config`, were therefore dropped from the stored option on save. On the next load, those missing keys fell back to defaults, which made the SPA look like the full settings state had reset.

Classic checkbox fields also needed an explicit false path because unchecked WordPress checkboxes submit nothing by default.

### Fix

Keep the earlier PHP-side gallery bridge in place for reads, but harden the classic admin save path by merging partial PHP form submissions over the raw stored option before sanitization so non-posted settings survive. Add hidden `0` inputs for the classic checkbox fields so unchecked saves persist explicit false values instead of silently reusing the old truthy state.

### Acceptance criteria

- Saving from the classic WordPress `Campaigns > Settings` page no longer drops nested `gallery_config` or other non-posted settings.
- Unchecked classic admin checkbox fields persist `false` instead of inheriting the previously saved truthy value.
- PHP callers and REST responses continue to project legacy flat gallery fields from nested `gallery_config` for compatibility.

## Track P25-O - Visual Settings Live Preview Expansion

### Problem

Live preview currently exists for campaign gallery-config editing, but many other visual settings still require save-close-reopen cycles before their effect can be judged. That slows design iteration and makes visual tuning feel uneven across the Settings surface.

### Proposed direction

Audit which visual settings can safely preview locally without creating destructive or confusing side effects, then define a consistent preview model for those controls so the UX does not mix instant-preview and save-only behavior arbitrarily.

## Track P25-P - Settings Information Architecture Deep Dive

### Problem

The Settings surface has grown broad enough that redundancy, section placement, and interaction model now need a dedicated review rather than incremental tweaks. There is also an open product question about whether Settings should remain modal-first or evolve toward a side-panel interaction.

### Proposed direction

Start with three separate analysis passes by different agents before implementation. Those passes should cover setting redundancy, more optimal grouping and ordering, and the technical plus UX feasibility of converting Settings from a modal into a side-panel surface.

### Required analysis before implementation

- Pass 1: redundancy and overlap audit across settings sections, labels, and controls.
- Pass 2: organization and grouping proposal focused on task flow, scanability, and progressive disclosure.
- Pass 3: feasibility study for a side-panel architecture versus the current modal, including modal-stack interactions and responsive constraints.

### Analysis progress

- Pass 1 completed by GPT-5.4: redundancy and overlap audit recorded in `docs/P25P_PASS1_GPT54_SETTINGS_REDUNDANCY_AUDIT.md`.
- Pass 2 completed by Claude Opus 4.6: regrouping proposal recorded in `docs/P25P_PASS2_CLAUDE_OPUS_46_SETTINGS_REGROUP.md`.
- Pass 3 completed by Grok: data model redundancy analysis and side-panel feasibility assessment shared via [Grok conversation](https://grok.com/share/bGVnYWN5_85bca226-4ff8-4cf6-99fd-1fb397f00a47).

### Three-pass synthesis

All three passes converge on the same core findings:

1. **~35-40% of `GalleryBehaviorSettings` (~180 fields) is deprecated legacy projection** of `galleryConfig`. The nested model is already canonical; the flat fields inflate the TypeScript interface, defaults object, and PHP sanitizer.
2. **`modalContentMaxWidth` is a true duplicate** — exposed in both Campaign Viewer and Advanced > Modal / Viewer.
3. **Campaign viewer configuration is the worst-performing workflow** — 6 tabs touched to fully configure one conceptual object. Text content and styling across 5 tabs is the second worst.
4. **The Advanced tab conflates power-user visual tuning with system/admin controls** — it should be narrowed to genuine internals.
5. **Gallery labels, text strings, and their visibility toggles are fragmented** across 2-3 tabs each. Co-locating them with their toggles is the highest-impact IA fix.
6. **Side-panel (Mantine Drawer) is high-feasibility / low-effort** — the existing modal body, footer, tab structure, and child sections are fully independent of modal semantics. A `<Modal>` → `<Drawer>` swap is nearly drop-in with full-screen fallback at <576px.

### Resolved decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Tab regroup depth | Full 6-tab regroup per Pass 2 task-flow analysis |
| B | Gallery & Media merge | Yes — merge Media Display + Gallery Layout into one tab with 9 accordions |
| C | Modal → Drawer | Yes — include in the implementation track (low effort, high UX value) |
| D | Data model cleanup | Separate follow-on — `CoreSettings` split and legacy bridge removal deferred |
| E | Inline adapter quick-selectors | Convert to read-only summary with click-to-open-editor |

Implementation proceeds as Track P25-U.

## Track P25-Q - Campaign Card Gallery Vertical Justification COMPLETE

### Problem

Horizontal card justification is now restored, but the card gallery grid container has no vertical alignment control. The grid uses `display: flex; flex-wrap: wrap` with `justifyContent` for horizontal distribution, but no `align-content` or `min-height`. When the grid has fewer cards than fill the viewport (first page load, filtered results, small campaigns), the grid simply collapses to content height and anchors to the top.

### Planned implementation

1. **Add `cardGalleryVerticalAlign`** (`'start' | 'center' | 'end'`, default: `'start'`) to `GalleryBehaviorSettings` in `src/types/index.ts`, PHP registry, and PHP sanitizer.
2. **Add `cardGalleryMinHeight`** (number, default: `0`, min: 0, max: 1200) to the same chain. Vertical alignment only has a visible effect when the container has spare height, so a min-height companion is required.
3. **Expose both controls** in `CampaignCardSettingsSection.tsx` under the Card Grid & Pagination accordion.
4. **Wire into `CardGallery.tsx`**: Apply `alignContent` and `minHeight` to the existing flex grid container style object.

### Acceptance criteria

- Card grid with fewer items centers vertically when `cardGalleryMinHeight` exceeds content height and `cardGalleryVerticalAlign` is `'center'`.
- Default `'start'` with `minHeight: 0` retains current top-anchored behavior (non-breaking).
- Settings persist and round-trip through save/load and REST API.

## Track P25-R - Background Blur Option

### Problem

Background selectors currently expose multiple visual treatment modes (`none`, `solid`, `gradient`, `image`), but they do not offer a blur-based option. Five background-type selectors exist across the settings surface: image viewport, video viewport, unified viewport, viewer/modal, and page. Backdrop blur is already used for the settings drawer overlay toggle (`settingsDrawerBlurEnabled`), so the visual pattern has precedent in the app.

### Planned implementation

Support two blur modes: **backdrop blur** (CSS `backdrop-filter` that blurs content behind the section) and **image blur** (a background image rendered with a blur filter).

1. **Extend `ViewportBgType`** in `src/types/index.ts`: add `'blur'` to the union.
2. **Add per-scope blur settings** (for each of the 5 background scopes: image, video, unified, viewer, modal):
   - `*BgBlurMode: 'backdrop' | 'image'` (default: `'backdrop'`)
   - `*BgBlurAmount: number` (default: `8`, min: 1, max: 50) — blur radius in px
   - Reuse existing `*BgImageUrl` fields for the image-blur source where those fields already exist.
3. **Update `resolveBackground()`** in `GallerySectionWrapper.tsx`:
   - Backdrop mode: return `{ backdropFilter: 'blur(Npx)', WebkitBackdropFilter: 'blur(Npx)' }` (webkit prefix for Safari).
   - Image mode: return styles for a `::before` pseudo-element approach — the background image + `filter: blur()` must be on a positioned pseudo-element so section children are not blurred. Add a CSS class with the pseudo-element in the component's style layer.
4. **Update modal/viewer background** in `CampaignViewer.tsx`: add blur case to `modalBgStyle` logic.
5. **Update selector UI** in `GalleryPresentationSections.tsx` (`GalleryBackgroundFields`): add `{ value: 'blur', label: 'Blur' }` to the dropdown. Conditionally show blur-mode selector and blur-amount slider when `type === 'blur'`. Show image-URL input when blur mode is `'image'`.
6. **Update gallery-config editor** background selectors in `GalleryConfigEditorModal.tsx`.
7. **PHP chain**: Add all new fields to the settings registry defaults and sanitizer.

### Image-blur rendering approach

CSS `filter` on the element itself would blur all children. The recommended approach is a `::before` pseudo-element with `position: absolute; inset: 0; z-index: 0` carrying the `background-image` + `filter: blur()`, with section content at `position: relative; z-index: 1`. This keeps the existing `GallerySectionWrapper` pattern clean and avoids adding extra DOM nodes.

### Acceptance criteria

- Backdrop blur mode visually blurs content behind the gallery section.
- Image blur mode renders a blurred background image without blurring section children.
- Blur amount slider adjusts the effect intensity.
- Default `'none'` retains current behavior (non-breaking).
- All 5 background-type selectors show the new blur option.
- Settings persist through save/load and REST API.

## Track P25-S - Incremental Card / Gallery Item Scale Controls

### Problem

Sizing adjustments are currently possible, but they are fragmented across card max width, thumbnail height, min height, gallery section sizing, adapter manual width percentages, compact-grid card width and height, justified row height, masonry columns, shape tile sizes, and carousel visible-card behavior. That makes simple "make this about 10% larger or smaller" tuning slower than it needs to be and forces users to reason about adapter-specific math.

### Proposed direction

This looks feasible, but it should be implemented as a layout-aware multiplier rather than a raw CSS `transform` applied after layout. A completely flat "expose every sizing knob everywhere" surface is also technically possible, but it would mostly duplicate the size drivers that already exist across cards, gallery sections, and adapter-specific settings. The cleaner approach is a tiered model: keep scale and aspect ratio as the primary sizing surface, then leave the lower-level width, height, row-height, column-count, and tile-size controls in advanced or adapter-specific contexts. Campaign cards can derive scale from the existing card sizing inputs, while gallery-item scale should map onto the active adapter's real size drivers inside nested `galleryConfig.adapterSettings` so runtime spacing, pagination, and hit targets stay coherent. Masonry likely needs a columns-first rule or an explicit exception because its primary sizing lever is column count rather than tile dimensions.

### Recommendation

Do not build one giant "complete sizing" panel. The better model is:

- Primary flow: expose a small number of scale and aspect-ratio controls that cover the most common "make this bigger / smaller" tuning tasks.
- Secondary flow: keep the existing raw width, height, min-height, section-size, row-height, column-count, and tile-size controls available in advanced or adapter-specific surfaces.
- Adapter exceptions: treat masonry and other layout-rule-driven adapters as special cases instead of forcing them into a fake universal width/height model.

### Current control owners

- Campaign cards already size through card-thumbnail height, card max width, card aspect ratio, and card min height.
- Gallery viewports / wrappers already size through modal gallery width and margin, gallery section min/max width and height, gallery height mode, section padding, and adapter manual max width / height percentages.
- Gallery items already size through adapter-specific fields such as carousel visible cards, compact-grid card width / height, justified row height, masonry columns, and shape tile size.

### Proposed primary-vs-advanced sizing matrix

| Surface | Primary controls | Secondary / advanced controls | Notes |
|---------|------------------|-------------------------------|-------|
| Campaign cards | `cardScale`, existing `cardAspectRatio` | existing card thumbnail height, card max width, card min height, card max columns | `cardScale` should feel like the default "bigger / smaller" control for the card as a whole rather than another raw pixel field |
| Gallery viewports / sections | candidate `sectionScale` | existing modal gallery max width, gallery section min/max width, min/max height, height mode, adapter max width / height percentages | Avoid a universal viewport aspect-ratio control in v1 because section height behavior already varies by adapter and sizing mode |
| Gallery items | candidate `itemScale`, adapter-specific aspect-ratio only where it makes sense | existing adapter settings such as carousel visible cards, compact-grid width / height, justified row height, masonry columns, shape tile size | Keep one shared scale concept, but resolve it into the adapter's real size driver under the hood |

### Candidate setting names

- `cardScale`: top-level campaign-card sizing multiplier.
- `sectionScale`: shared gallery section / viewport sizing multiplier, likely living alongside the existing shared gallery common settings.
- `itemScale`: adapter-facing gallery-item sizing multiplier, persisted in adapter settings or a shared adapter-setting group where supported.

### Recommended v1 scope

1. Add `cardScale` as the primary card-sizing control and keep `cardAspectRatio` as the primary shape control.
2. Add `sectionScale` for gallery wrappers / viewports, but do not add a universal viewport aspect-ratio field in the same pass.
3. Add `itemScale` for adapters whose sizing is already driven by width / height / row-height / tile-size logic.
4. Keep masonry out of the first scale pass unless a clean columns-first mapping is agreed on.
5. Leave the existing raw sizing controls in place as advanced controls instead of replacing them.

### Proposed implementation slices

1. Inventory the current sizing owners and classify each as primary or advanced rather than adding new controls blindly.
2. Add `cardScale`, `sectionScale`, and `itemScale` to the settings types, defaults, settings UI, nested gallery-config bridge, and WordPress sanitizer / REST surfaces.
3. Implement resolver logic that maps `itemScale` into adapter-specific settings without breaking pagination, spacing, or hit targets.
4. Explicitly document masonry and layout-builder exceptions before UI is exposed.
5. Add targeted tests for settings persistence plus resolver behavior for compact-grid, justified, carousel, and at least one shape adapter.

### Acceptance criteria

- Campaign card sizing can be nudged larger or smaller from one incremental control instead of retuning multiple card dimensions manually.
- Supported gallery adapters expose one consistent scale concept even if it resolves to adapter-specific width, height, row-height, or tile-size fields under the hood.
- Primary settings flows stay concise by treating scale and aspect ratio as the default sizing entry points instead of flattening every raw sizing field into one universal panel.
- Existing raw sizing controls remain available where they already provide real value, but they are clearly secondary to the new primary scale controls.
- The implementation keeps layout calculations authoritative instead of relying on post-layout visual scaling that would desync spacing, pagination, or interaction surfaces.

## Track P25-T - Gallery Container / Section Positioning Controls

### Problem

Positioning controls currently exist only in partial form and at mismatched layers. The card gallery grid exposes horizontal row justification, but not vertical positioning within a taller parent. The campaign viewer has one outer `modalContentVerticalAlign` control plus shell width, gap, and edge-margin controls, but the gallery shell stack, per-type section stack, section wrapper, and most adapter root `Stack` containers still default to top/start alignment. That makes vertical centering or fine placement of unified, image, and video gallery blocks inconsistent and often impossible without code changes.

### Proposed direction

Audit the layout at three explicit layers: the card gallery grid container, the campaign viewer gallery shell / per-type section stack, and the adapter root container inside each `GallerySectionWrapper`. Add a minimal shared positioning model first: vertical alignment, horizontal alignment where it is still missing, and bounded offset or inset nudges only where they do not fight the existing layout math. Prefer flex/grid alignment and spacing controls over absolute positioning. Adapters with intrinsic geometric offsets such as diamond, hexagonal, and layout-builder should be treated as explicit exceptions or adapter-specific follow-ons instead of forcing one generic positioning contract onto them.

### Current container map

1. Card gallery grid container: the card-gallery flex wrapper in `CardGallery` already owns horizontal row distribution through `cardJustifyContent`, but it has no companion vertical-positioning model.
2. Outer campaign viewer content box: `CampaignViewer` already owns whole-modal vertical placement through `modalContentVerticalAlign`.
3. Gallery shell box: `CampaignViewer` separately owns gallery width, gap, and side margins for the media area, but not shell-level vertical alignment or shell-level nudging.
4. Per-type section layout container: `PerTypeGallerySection` switches between a `Stack` and `SimpleGrid`, but does not expose explicit alignment controls beyond equal-height stretch behavior.
5. Gallery section wrapper: `GallerySectionWrapper` centers horizontally with `marginInline: auto` and clamps width / height, but it does not expose content alignment inside the wrapper.
6. Adapter root block: most adapters render a root `Stack` or `Box` container that can be centered or nudged as a whole, but those roots do not yet share a positioning contract.

### Recommendation

Keep positioning layered and explicit. Reuse the existing `modalContentVerticalAlign` as the sole owner of outer modal-body placement, then add missing controls lower in the tree instead of creating a second competing top-level alignment setting.

### Proposed control owners and candidate setting names

| Layer | Candidate settings | Purpose | Notes |
|-------|--------------------|---------|-------|
| Card gallery grid area | `cardGalleryMinHeight`, `cardGalleryVerticalAlign`, optional `cardGalleryOffsetY` | Lets the full card grid sit top / center / bottom when its parent has spare height | Do not add a separate horizontal-placement control here because `cardJustifyContent` already owns row distribution |
| Campaign viewer gallery shell | `modalGalleryVerticalAlign`, optional `modalGalleryOffsetY` | Aligns the unified / per-type gallery shell within the available viewer content area | Should complement, not replace, the existing shell width / gap / margin controls |
| Gallery section wrapper content | `gallerySectionContentAlignX`, `gallerySectionContentAlignY`, optional `gallerySectionContentOffsetX`, `gallerySectionContentOffsetY` | Positions the rendered adapter block inside each section wrapper | This is the first shared layer that can support both unified and per-type sections consistently |
| Adapter root block | `adapterBlockAlignX`, `adapterBlockAlignY`, optional `adapterBlockOffsetX`, `adapterBlockOffsetY` | Fine-tunes the adapter's rendered block when wrapper-level alignment is not enough | Keep this scoped to compatible adapters and avoid using it as a catch-all replacement for shell / section alignment |

### Recommended v1 scope

1. Preserve `modalContentVerticalAlign` as-is and do not duplicate it under a new name.
2. Add shell-level vertical alignment for the media shell in `CampaignViewer`.
3. Add shared content alignment inside `GallerySectionWrapper`.
4. Add card-grid vertical alignment only together with a meaningful min-height or bounded-height companion so the control has visible effect.
5. Add adapter-root alignment only for adapters that already render as a single centered block without internal absolute-layout assumptions.
6. Treat layout-builder slot positioning and internal diamond / hexagonal row offsets as out of scope for the first pass.

### Proposed implementation slices

1. Document the current owner of each alignment decision so new controls do not overlap with existing shell, section, and adapter sizing fields.
2. Add new positioning settings to the shared types, defaults, UI, and nested gallery-config persistence surface.
3. Update `CampaignViewer`, `PerTypeGallerySection`, and `GallerySectionWrapper` to honor shell and section alignment separately.
4. Introduce a tiny shared helper for adapter-root positioning so compatible adapters can adopt one contract without copy-paste.
5. Exclude or explicitly no-op unsupported adapters instead of shipping inconsistent partial behavior.
6. Add focused tests covering shell alignment, wrapper alignment, and one compatible adapter-root alignment path.

### Acceptance criteria

- The campaign card gallery grid can be centered or otherwise aligned within its parent container when spare vertical space exists.
- The campaign viewer gallery shell and per-type section stack can vertically center their content instead of always anchoring to the top.
- Compatible gallery adapters can vertically center or fine-tune their rendered block within the section wrapper without breaking spacing, labels, or hit targets.
- The control surface stays layered and explicit so shell, section, and adapter positioning do not become three overlapping ways to move the same content.
- Outer modal-content positioning continues to be owned only by the existing `modalContentVerticalAlign` control rather than being duplicated by the new track.

## Track P25-N - Card / Adapter Justification Controls COMPLETE

### Problem

QA confirmed that campaign card row-justification controls were effectively missing from the normal Settings flow, which removed direct control over how partial rows distribute when the card grid does not fully fill the available width. Compact-grid justification also needed verification because it depends on the same family of layout controls.

### Fix

Restore the visible card-justification control in the Campaign Cards settings section and make the responsive card-grid branch honor `cardJustifyContent` directly, not just the fixed-width fallback branch. Compact-grid adapter justification remains wired through `adapterJustifyContent` and stays covered as part of the same regression pass.

### Acceptance criteria

- Card justification is visible again from the Campaign Cards settings flow.
- Partial campaign-card rows honor the selected justification even when card max width is not manually constrained.
- Compact-grid adapter justification remains available and continues to affect supported gallery layouts.

## Track P25-W - Batch Media Upload

### Problem

The current media upload flow in `MediaAddModal` only handles single-file selection and upload. The `FileButton` component accepts one file, `useXhrUpload` posts one file to `/media/upload`, and a separate POST to `/campaigns/{id}/media` associates that single file. For campaigns with many media items, this forces repetitive one-at-a-time upload cycles.

### Current architecture

1. **UI**: `MediaAddModal.tsx` renders a `FileButton` (single file) + drag-and-drop `Paper` zone + external URL input.
2. **Upload**: `useXhrUpload.ts` wraps XMLHttpRequest with FormData and per-file progress tracking. Posts to `POST /wp-super-gallery/v1/media/upload`.
3. **Association**: After upload returns `{ attachmentId, url, thumbnail }`, a separate `POST /campaigns/{id}/media` adds the item to the campaign's `media_items` post_meta array.
4. **PHP handler**: `upload_media()` uses `media_handle_upload()` for one `$_FILES['file']` entry. Runs image optimizer if enabled.

### Planned implementation

1. **Multi-file UI**: Convert `FileButton` to accept `multiple` and update the drag-and-drop zone to accept multiple files. Show a file queue with per-file progress bars and status indicators (pending, uploading, complete, failed).
2. **Parallel upload with concurrency limit**: Upload files in parallel using the existing `useXhrUpload` hook, but cap concurrency at 3 simultaneous uploads to avoid overwhelming the server. Queue remaining files and start the next upload as each completes.
3. **Batch campaign association**: After each individual file upload succeeds, immediately associate it with the campaign via the existing `POST /campaigns/{id}/media` endpoint (one call per file, same as today). This avoids needing a new batch endpoint and keeps partial-failure semantics simple — each file either fully succeeds or fully fails independently.
4. **Per-file error handling**: Files that fail upload show an error state in the queue with a retry button. Successfully uploaded files are not rolled back if a sibling fails. The modal stays open until the user explicitly closes it, so they can retry failures.
5. **Progress aggregation**: Show both per-file progress and an overall progress summary (e.g., "3 of 7 uploaded").
6. **Max file count**: Enforce a reasonable client-side limit (20 files per batch) to prevent accidental bulk operations that overwhelm the server or confuse the user. Show a warning if the user selects more.

### Decisions resolved

| # | Decision | Resolution |
|---|----------|------------|
| A | Upload strategy | Parallel with concurrency cap (3), not sequential — sequential is too slow for 10+ files |
| B | Campaign association | Individual POST per file after its upload completes — no new batch PHP endpoint needed |
| C | Partial failure handling | Per-file: failed files can be retried, successful files persist. No all-or-nothing rollback |
| D | PHP changes | None required — existing single-file `/media/upload` and `/campaigns/{id}/media` endpoints work as-is when called per file |
| E | Max batch size | 20 files client-side limit with user-facing warning |
| F | Non-media file handling | Auto-prune: filter dropped/selected files to `image/*` and `video/*` MIME types client-side before queuing. `FileButton` with `accept="image/*,video/*"` handles the file-picker path natively. Drag-and-drop gets an explicit `file.type.startsWith('image/') \|\| file.type.startsWith('video/')` filter with a brief notification when files are pruned (e.g., "2 non-media files skipped") |

### Acceptance criteria

- Users can select or drag-drop multiple files at once.
- Files upload in parallel (max 3 concurrent) with per-file progress tracking.
- Each successfully uploaded file is immediately added to the campaign.
- Failed uploads show per-file error state with retry option.
- Successfully uploaded files are not affected by sibling failures.
- Overall progress summary visible during batch operation.
- Client-side limit of 20 files per batch with warning on exceeded selection.
- External URL add flow is unaffected.
- No PHP endpoint changes required.
- Non-media files are silently filtered from drag-and-drop selections with a notification showing how many were skipped.

## Follow-On Candidates After Core QA

These are not active implementation tracks yet, but they were promoted out of the general backlog as the next most defensible Phase 25 follow-ons once the current modal and QA blockers are verified.

| Candidate | Why it was surfaced |
|-----------|---------------------|
| Final legacy gallery bridge removal | Explicit carryover from Phase 24; legacy flat-field reads and bridge helpers still exist in the current codebase |
| Builder template deep clone | Solves a real duplication surprise with contained scope |
| Global settings export/import | Adds a recovery path for destructive config regressions and makes settings migration safer across environments |
| Time-limited access grants | High user value for event-style galleries with a clear implementation path |
| Admin tab data reuse / SWR cache hardening | Medium user impact with a bounded audit-first implementation path |

## Track P25-A - Gallery Config Dropdown Reliability COMPLETE

### Problem

The shared gallery-config editor is opened inside other modal flows (`CampaignViewer`, campaign edit, and settings). Mantine `Select` dropdowns currently escape the active modal tree, which makes them unreliable or effectively unusable when layered inside nested dialogs.

### Fix

Introduce a shared modal-safe `Select` wrapper and use it for the gallery-config editor plus the other campaign modal surfaces that rely on the same select behavior.

### Acceptance criteria

- Gallery-config dropdowns open and can be selected inside the campaign modal flow.
- The fix is shared, not duplicated ad hoc across individual controls.
- Existing settings/theme select behavior remains intact.

## Track P25-B - Shared Add Media Entry COMPLETE

### Problem

The card/menu Add Media flow only supports external URLs, while the Admin Panel media flow already supports upload plus external URLs. That split creates a weaker UX in the place where admins often need the action most.

### Fix

Move toward one shared media-entry surface for campaign-level add-media actions, starting with the common upload and external-URL behaviors. The Admin Panel can keep any additional library-management affordances that are specifically admin-workspace oriented.

### Acceptance criteria

- The card/menu flow supports upload as well as external URLs.
- Shared upload and external-add UI/logic is reused instead of copy-pasted.
- Campaign media add success/error handling stays consistent across entry points.

## Track P25-C - Settings Modal Layering COMPLETE

### Problem

When a campaign/card modal is already open, launching Settings from the admin menu can place the Settings dialog behind the active modal stack.

### Fix

Raise the Settings modal layer above the campaign modal layer while preserving the existing nested responsive gallery editor behavior.

### Acceptance criteria

- Settings always opens above campaign/card/edit modals.
- The nested responsive gallery editor still opens above Settings.

## Track P25-D - `FUTURE_TASKS.md` Cleanup COMPLETE

### Problem

`FUTURE_TASKS.md` currently mixes genuine deferred work with historical items that were already implemented, phase-specific work that belongs in report docs, and exploratory notes that should be separated from actionable backlog items.

### Fix

Reorganize the backlog into a cleaner schema, identify prune candidates for confirmation, move finished items into the correct historical phase docs or an archival/details note, and promote high-value items into active planning where warranted.

### Acceptance criteria

- One consistent structure for remaining deferred work.
- Clear prune-candidate marking instead of silent removal.
- Completed items moved out of the active backlog.
- High-value items surfaced into active phase planning rather than buried in a catch-all list.

## Track P25-U - Settings IA Overhaul

### Problem

The three-pass P25-P analysis confirmed that the Settings surface suffers from severe workflow fragmentation (campaign viewer config touches 6 tabs), scattered text/label controls, an overloaded Advanced tab, and a modal container that blocks visual context while editing. The current 7-tab structure with flat divider-based sections in General and Campaign Viewer compounds the scanability issues.

### Scope

Execute the regrouping proposal from P25-P Pass 2 with the Drawer conversion from Pass 3. Data model cleanup (`CoreSettings` interface split, legacy flat-field removal) is explicitly deferred to a separate follow-on track.

### Implementation phases

#### Phase 1a: Settings container conversion (Modal → Drawer) ✅

1. Replace `<Modal>` with `<Drawer position="right" size="lg">` in `SettingsPanel.tsx`.
2. Preserve footer (Save/Reset), scroll area, `hasChanges`, and `revertThemePreview` logic.
3. Full-screen fallback at <576px via Mantine responsive prop.
4. Verify z-index layering with campaign viewer modal stack (currently z-450).

#### Phase 1b: Gallery Config Editor conversion (Modal → Drawer) + backdrop blur toggle

1. Replace `<Modal>` with `<Drawer position="right" size="lg">` in `GalleryConfigEditorModal.tsx` (rename to `GalleryConfigEditorDrawer`).
2. Add `settingsDrawerBlurEnabled` boolean to `GalleryBehaviorSettings` (default: `true`).
3. Wire the new setting into `overlayProps.blur` for both the Settings Drawer and the Gallery Config Editor Drawer.
4. Expose the toggle in the Settings UI (Advanced / System & Admin section).
5. Add the new field to the PHP settings registry defaults.
6. Update test selectors from `.mantine-Modal-*` to `.mantine-Drawer-*` where applicable.

#### Phase 2: Tab restructure (7 → 6 tabs)

1. Update `SettingsPanel.tsx` tab list: **Page & Theme**, **Campaign Cards**, **Gallery & Media**, **Campaign Viewer**, **System & Admin**, **Typography**.
2. Rename `GeneralSettingsSection.tsx` → `PageThemeSettingsSection.tsx`.
3. Create `GalleryMediaSettingsSection.tsx` composing content from `MediaDisplaySettingsSection`, `GalleryLayoutSettingsSection`, `GalleryAdapterSettingsSection`, `GalleryPresentationSections`, and `GalleryLayoutDetailSections` into 9 accordion sections.
4. Rename `AdvancedSettingsSection.tsx` → `SystemAdminSettingsSection.tsx`.
5. Update all `SettingsPanel` imports and conditional tab rendering.

#### Phase 3: Control relocations (~25 controls) ✅

All planned relocations complete across two commits (Phase 3a + 3b).

**Phase 3a (d4cd855):**
- `galleryTitleText`, `gallerySubtitleText` moved to General > Viewer Header Visibility (next to their show/hide toggles)
- `campaignAboutHeadingText` moved to Campaign Viewer > Visibility (next to `showCampaignAbout` toggle)
- `modalContentMaxWidth` duplicate deleted from Advanced > Modal / Viewer (single owner remains in Campaign Viewer)
- "Gallery Text" accordion removed from Advanced (now empty)

**Phase 3b:**
- `modalCloseButtonBgColor`, `modalMobileBreakpoint` moved from Advanced > Modal / Viewer to Campaign Viewer > Modal Controls
- `galleryImageLabel`, `galleryVideoLabel`, `galleryLabelJustification`, `showGalleryLabelIcon` moved from Gallery Layout > Gallery Labels to Campaign Viewer > Gallery Labels (new divider section)
- `authBarBackdropBlur`, `authBarMobileBreakpoint` moved from Advanced > System to General > Auth Bar
- Card Appearance group (10 controls: cardLockedOpacity, cardGradientStartOpacity, cardGradientEndOpacity, cardLockIconSize, cardAccessIconSize, cardBadgeOffsetY, cardCompanyBadgeMaxWidth, cardThumbnailHoverTransitionMs, cardPageTransitionOpacity, cardAutoColumnsBreakpoints) moved from Advanced > Card Appearance to Campaign Cards > Card Internals (new accordion item)
- `preserveDataOnUninstall` moved from Advanced > System to Advanced > Data Maintenance
- "Card Appearance" accordion removed from Advanced (now empty)
- "Modal / Viewer" accordion renamed to "Settings Drawer" (only `settingsDrawerBlurEnabled` remains)
- "Gallery Labels" accordion removed from GalleryPresentationSections
- Advanced reduced from 10 to 7 accordion items

#### Phase 4: Structural improvements ✅ (items 1, 2, 4) / deferred (item 3)

1. ✅ Add accordion structure to **Page & Theme** (flat with 6 dividers → 6 accordions: Theme & Layout, Page Container, Page Header, Page Background, Auth Bar, Security & Login).
2. ✅ Add accordion structure to **Campaign Viewer** (flat with 7 dividers → 6 accordions: Open Mode & Sizing, Modal Appearance, Content Visibility, Gallery Labels, Modal Background, Cover Image & Responsive).
3. _Deferred_ — Convert inline adapter quick-selectors to **read-only summary** showing current adapter per breakpoint, with click-to-open responsive editor modal. (Requires deeper refactor of GalleryAdapterSettingsSection; scheduled as a separate follow-on.)
4. ✅ Scope-prefix duplicate labels ("Background Type" → "Page Background Type" / "Modal Background Type").

#### Phase 5: Verification ✅

1. ✅ Full JS test suite: 1253/1253 pass (settings tests cut from 405s → 187s via lazy accordion panels).
2. ✅ `npm run build:wp` clean.
3. ✅ Manual QA: all 6 tabs render, controls function, save/load persists.
4. ✅ Settings Drawer above campaign viewer modal confirmed. Gallery Config Drawer above campaign viewer confirmed.
5. _N/A_ — Adapter read-only summary deferred (Phase 4 item 3).
6. ✅ Mobile full-screen fallback at <576px confirmed.
7. ✅ WordPress PHP tests: 503/503 pass (1478 assertions).

### Files affected

| File | Change |
|---|---|
| `src/components/Admin/SettingsPanel.tsx` | Modal→Drawer swap, 6-tab list, updated imports, blur toggle wiring |
| `src/components/Common/GalleryConfigEditorModal.tsx` | Modal→Drawer swap, accept blur prop |
| `src/types/index.ts` | Add `settingsDrawerBlurEnabled` to `GalleryBehaviorSettings` and defaults |
| `wp-plugin/.../class-wpsg-settings-registry.php` | Add `settings_drawer_blur_enabled` default |
| `src/components/Settings/GeneralSettingsSection.tsx` | Rename to `PageThemeSettingsSection.tsx`, add accordions, gain text/auth controls |
| `src/components/Settings/CampaignCardSettingsSection.tsx` | Gain Card Internals accordion from Advanced |
| `src/components/Settings/CampaignViewerSettingsSection.tsx` | Add accordions, gain Gallery Labels + about heading + modal chrome controls |
| `src/components/Settings/MediaDisplaySettingsSection.tsx` | Absorb into new `GalleryMediaSettingsSection.tsx` |
| `src/components/Settings/GalleryLayoutSettingsSection.tsx` | Absorb into `GalleryMediaSettingsSection.tsx` |
| `src/components/Settings/GalleryAdapterSettingsSection.tsx` | Absorb + convert to read-only summary |
| `src/components/Settings/GalleryPresentationSections.tsx` | Absorb into `GalleryMediaSettingsSection.tsx` |
| `src/components/Settings/GalleryLayoutDetailSections.tsx` | Absorb into `GalleryMediaSettingsSection.tsx` |
| `src/components/Settings/AdvancedSettingsSection.tsx` | Rename to `SystemAdminSettingsSection.tsx`, lose relocated sections |
| `src/components/Settings/TypographySettingsSection.tsx` | No changes |

### Scope boundaries

- **Included**: Tab regroup, control relocations, Modal→Drawer, accordion restructuring, adapter summary conversion, label disambiguation.
- **Excluded**: Data model refactor (`CoreSettings` split), legacy bridge removal (`LEGACY_GALLERY_SETTING_KEYS`), new settings controls, typography changes. These remain candidates for a dedicated follow-on track.

### Acceptance criteria

- Settings opens as a right-side Drawer instead of a centered modal.
- Gallery Config Editor opens as a right-side Drawer instead of a centered modal.
- Backdrop blur can be toggled off via the `settingsDrawerBlurEnabled` setting.
- 6 tabs with scope-accurate names replace the current 7-tab layout.
- Campaign viewer configuration can be fully configured without leaving Campaign Viewer + Typography (down from 6 tabs).
- Gallery labels, text content, and their visibility toggles are co-located with their primary owner.
- `modalContentMaxWidth` has a single owner (Campaign Viewer); the Advanced duplicate is removed.
- General and Campaign Viewer use accordion structure consistent with all other tabs.
- Inline adapter quick-selectors show a read-only summary with click-to-open editor.
- All existing tests pass. Build succeeds. Settings round-trip correctly through save/load.

## Track P25-V - Heavy Test Suite Stability and Render-Cost Audit

### Problem

`git push` was intermittently blocked by the pre-push hook, but the underlying failure was not Git or GitHub. The hook runs `npm run test`, and the default parallel Vitest path was stalling inside the heaviest jsdom suites until Vitest threw `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`.

The failure clustered around four suites:

1. `src/components/Common/GalleryConfigEditorModal.test.tsx`
2. `src/components/Admin/SettingsPanel.test.tsx`
3. `src/components/Campaign/UnifiedCampaignModal.test.tsx`
4. `src/components/Admin/AdminPanel.test.tsx`

The last two were partially improved earlier in the session, but the first two were still heavy enough to destabilize the full parallel run.

### Observed failure mode

- `npm run test:silent` could appear to hang for minutes while the reporter spinner cycled inside `GalleryConfigEditorModal.test.tsx` and `SettingsPanel.test.tsx`.
- A full parallel run eventually failed with repeated worker RPC errors: `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`.
- `npm run test:quieter-triage` completed successfully because it disables file parallelism and avoids the most expensive worker-reporting path.
- `git push --no-verify` succeeded after a clean serial validation run, which confirmed the branch itself was sound and the unstable piece was the default parallel test path.

### Root causes discovered

#### 1. `GalleryConfigEditorModal` was still mounting too much hidden DOM per render

The shared gallery editor remained expensive even after the earlier accordion restructure because it still did most of its work eagerly on first render:

- the outer accordion defaulted to every shared section being open,
- Mantine accordion panels keep their children mounted unless the app gates them explicitly,
- breakpoint tabs rendered all desktop / tablet / mobile panel trees rather than only the active one,
- the adapter-specific area can render multiple nested groups of `NumberInput`, `ColorInput`, `TextInput`, and select controls.

That meant one test render could eagerly create most of the responsive editor even when the test only cared about one subsection.

#### 2. `SettingsPanel` remained heavy by test volume even after the gallery-editor modal mock

`SettingsPanel.test.tsx` already mocks `GalleryConfigEditorModal`, which removed the worst nested modal cost, but the suite still has 43 tests that repeatedly mount the settings drawer, wait for tabs, switch tabs, and exercise dense form sections.

The suite is not dominated by one broken assertion. It is dominated by repeated deep renders across a large number of tests.

#### 3. Vitest parallel worker pressure was the real failure boundary

The heaviest suites did not always fail by a normal test timeout. Instead they starved Vitest's worker bookkeeping badly enough that the runner itself timed out while trying to publish task progress back to the parent process.

That is why the recurring fatal signature was `onTaskUpdate`, not a normal assertion or a per-test timeout.

#### 4. Earlier mitigations helped, but did not fully clear the last hotspots

Before P25-V started, two mitigations were already in place:

- `vite.config.ts` caps the Vitest forks pool instead of letting the runner use the full CPU count.
- `UnifiedCampaignModal.test.tsx` no longer uses an async mock factory for the gallery-config modal.

Those changes materially improved `UnifiedCampaignModal` and `AdminPanel`, but `GalleryConfigEditorModal` and `SettingsPanel` were still heavy enough to trigger worker-RPC failures during parallel runs.

### Implementation notes in this pass

#### Gallery editor render-cost reductions

This pass reduces work in the real component rather than only papering over the tests:

1. The outer gallery-editor accordion now defaults to the two highest-value sections:
	- `Breakpoint Adapters`
	- `Adapter-Specific Settings`
2. The remaining shared sections are lazily mounted on first expansion via `useLazyAccordion`, so hidden sections do not pay their render cost up front.
3. Breakpoint tabs inside `GalleryConfigEditorModal` now use `keepMounted={false}`, so inactive desktop / tablet / mobile panels no longer stay mounted.

This is both a runtime UX improvement and a test performance improvement. The drawer is less visually overwhelming on open, and the DOM footprint is materially smaller.

#### Settings panel hardening

`SettingsPanel` already conditionally gated most tab content behind `activeTab === ...`, but the Mantine tab container now also uses `keepMounted={false}` so inactive panels are not retained at the framework layer.

That is a smaller win than the gallery-editor changes, but it aligns the implementation with the intended progressive-disclosure model.

The follow-up pass went one level deeper inside the heaviest settings sections:

1. `GeneralSettingsSection` now lazily mounts its accordion panels after first expansion.
2. `CampaignViewerSettingsSection` now does the same for viewer-specific controls.
3. `AdvancedSettingsSection` now defers its dense system / maintenance forms until the relevant accordion section is opened.

That reduced the default `Page & Theme` render cost that shows up in most `SettingsPanel.test.tsx` cases without changing persisted behavior.

#### Test-suite updates

`GalleryConfigEditorModal.test.tsx` now explicitly opens the shared accordion section it is exercising before asserting on those fields. That keeps the test intent intact while matching the lighter-weight default UI state.

`SettingsPanel.test.tsx` now also explicitly opens lazily mounted accordion sections before asserting on controls that are intentionally hidden until expansion.

### Validation outcome

- `CI=1 npm run test:silent -- src/components/Admin/SettingsPanel.test.tsx` passed after the second pass with 43/43 tests green and a lower isolated runtime than the prior baseline.
- `npm run test` now completes successfully again on the default parallel path with 91/91 test files and 1253/1253 tests passing, which clears the original pre-push reliability concern.

### Stable validation guidance

If this class of issue resurfaces, validate in this order:

1. Run `npm run test:silent` to see whether the parallel path is healthy.
2. If the failure signature is `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`, treat it as worker-pressure / suite-weight instability rather than as a Git problem.
3. Run `npm run test:quieter-triage` to get a stable serial verdict on the branch.
4. Check the heaviest suites first:
	- `src/components/Common/GalleryConfigEditorModal.test.tsx`
	- `src/components/Admin/SettingsPanel.test.tsx`
	- `src/components/Campaign/UnifiedCampaignModal.test.tsx`
	- `src/components/Admin/AdminPanel.test.tsx`

### Remaining follow-up candidates

- Consider splitting the heaviest `GalleryConfigEditorModal` assertions into narrower logical groups if the suite still dominates parallel runs after the render-path reductions.
- Consider extracting more `SettingsPanel` assertions downward into section-level tests where a full drawer mount is not required.
- If Vitest worker-RPC failures persist even after suite-cost reductions, lower parallelism again or move the pre-push hook to the known-stable serial command until the suite weight is further reduced.

## Current Implementation Notes

- P25-A implementation now uses a shared modal-safe `Select` wrapper so gallery-config and campaign modal dropdowns stay in the active modal tree.
- P25-B implementation now routes the card-menu manage-media action through the same richer media-entry modal used in the admin campaign media flow, including upload plus external URL support.
- P25-C implementation now raises the Settings modal above the campaign/edit modal layer and keeps nested responsive gallery editors above both.
- P25-D backlog cleanup is now reflected in `docs/FUTURE_TASKS.md`, with active follow-on candidates separated from prune candidates and already-completed work.
- P25-E implementation now keeps a viewer-local draft of campaign gallery overrides so responsive edits preview immediately and cancel restores the last saved viewer state.
- P25-F implementation now exposes unified adapter selection inside each breakpoint tab instead of flattening one unified adapter across desktop, tablet, and mobile.
- P25-G implementation now raises the campaign Manage Media wrapper above the viewer stack without changing the admin Media tab's default modal layer.
- P25-H implementation now organizes the campaign gallery editor into accordion sections and only exposes adapter-specific controls for explicit active-breakpoint adapter overrides.
- P25-J implementation now treats the centered slide as the active multi-card focus, routes arrow/dot navigation through that centered focus, and uses a settle-based synthetic loop fallback for small multi-card sets so last-to-first wraps stay smooth.
- P25-M implementation now preserves non-posted settings during classic WordPress admin saves by merging partial `Campaigns > Settings` submissions over the stored option before sanitization, while still projecting legacy flat gallery fields from nested `gallery_config` on PHP reads and REST responses.
- Targeted validation passed for `src/App.test.tsx`, `src/components/Common/ModalSelect.test.tsx`, `src/components/Common/GalleryConfigEditorModal.test.tsx`, `src/components/Campaign/UnifiedCampaignModal.test.tsx`, `src/components/CardViewer/CampaignViewer.test.tsx`, and `src/components/Admin/SettingsPanel.test.tsx`.
- Additional targeted validation passed for `src/components/Galleries/Adapters/carouselBehavior.test.ts`, `src/components/Galleries/Adapters/MediaCarouselAdapter.test.tsx`, `src/components/Common/GalleryConfigEditorModal.test.tsx`, `src/components/Admin/SettingsPanel.test.tsx`, and `npm run build:wp`.
- WordPress PHPUnit validation now passed in `wp-env` for `tests/WPSG_Settings_Test.php`, `tests/WPSG_Settings_Extended_Test.php`, and `tests/WPSG_Settings_Rest_Test.php` after adding focused coverage for classic admin partial-save preservation and checkbox false persistence.
- Manual QA has now confirmed P25-E, P25-F, P25-G, P25-H, and P25-M as complete.
- `docs/FUTURE_TASKS.md` already has live worktree edits; cleanup there should be patched carefully and remain candidate-based.
- The existing modal tests are useful for regression coverage, but they do not fully simulate Mantine portal behavior, so this phase should keep at least one explicit test around modal-scoped select props.