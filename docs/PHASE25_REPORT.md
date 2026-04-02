# Phase 25 - Modal Reliability, Shared Media Entry, and Backlog Cleanup

**Status:** In Progress
**Created:** March 31, 2026
**Last updated:** April 1, 2026

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
| P25-I | Add campaign card image-resolution controls for thumbnail imagery | Planned | Medium (0.5-1 day) |
| P25-J | Stabilize carousel multi-card focus and smooth small-set looping | Completed ✅ | Medium (0.5 day) |
| P25-K | Audit remaining carousel autoplay and advanced loop behavior in modal contexts | Planned | Medium (0.5 day) |
| P25-L | Add carousel card aspect-ratio and image-fit controls for image slides | Planned | Medium-Large (1-2 days) |
| P25-M | Fix WordPress `Campaigns > Settings` saves so SPA settings no longer appear reset to defaults | Completed ✅ | Medium (0.5-1 day) |
| P25-N | Restore campaign card and adapter justification controls for partial rows | Completed ✅ | Small-Medium (0.25-0.5 day) |
| P25-O | Evaluate live preview for broader visual settings beyond gallery-config editing | Proposed | Medium-Large (1-2 days) |
| P25-P | Run a three-pass settings IA audit covering redundancy, grouping, and side-panel feasibility | Completed ✅ (3 passes); implementation → P25-U | Large (2-3 days) |
| P25-Q | Evaluate vertical justification of campaign card gallery viewports within their container | Proposed | Small-Medium (0.5 day) |
| P25-R | Add `blur` as a background-type option across relevant background selectors | Proposed | Medium (0.5-1 day) |
| P25-S | Define primary scale / aspect-ratio sizing controls plus advanced raw overrides for cards and gallery items | Proposed | Medium-Large (1-2 days) |
| P25-T | Map and expose layered positioning controls for card grids, gallery shells, sections, and adapter blocks | Proposed | Medium-Large (1-2 days) |
| P25-U | Execute settings IA overhaul: 6-tab regroup, Modal→Drawer conversion, control relocations, accordion restructuring | Planned | Large (3-5 days) |

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

Card thumbnail tuning still lacks a dedicated image-resolution control path, which makes it harder to intentionally trade off fidelity against payload size for image-heavy galleries.

### Proposed direction

Add an image-only card-thumbnail resolution selector with common presets plus a custom path, scoped to card imagery rather than videos.

## Track P25-J - Carousel Multi-Card Focus and Small-Set Looping COMPLETE

### Problem

Carousel multi-card mode was still tracking the leftmost snap as the active item, which made captions and dot state feel off-center in multi-card layouts. Small multi-card sets also needed a safer looping path because Embla can fall back or jump abruptly when there are not enough distinct slides for a clean native loop.

### Fix

Treat the centered slide as the active item in multi-card mode, keep arrow/dot navigation aligned to that centered focus, and use a synthetic three-band loop fallback for small multi-card sets. The synthetic loop now waits for Embla `settle` before the invisible recenter so the last-to-first wrap remains visually smooth.

### Acceptance criteria

- Multi-card captions and dot state track the centered slide rather than the leftmost snap.
- Small multi-card sets can still wrap cleanly without exposing empty trailing frames.
- The synthetic last-to-first wrap completes with a smooth visible transition before the invisible recenter occurs.

## Track P25-K - Carousel Autoplay Audit

### Problem

QA still reports autoplay inconsistency in some modal/tablet contexts, which needs an isolated pass now that breakpoint resolution and basic multi-card guardrails are in better shape.

### Proposed direction

Audit Embla autoplay behavior with the current modal viewer lifecycle, hover handling, and drag interaction settings before making additional runtime changes.

## Track P25-L - Carousel Image Fit / Aspect Ratio Controls

### Problem

The classic carousel still lacks targeted image-card aspect-ratio and fit controls, which limits visual polish for image-dominant campaigns.

### Proposed direction

Add image-focused aspect-ratio and fit controls so carousel cards can be tuned more like image tiles, without forcing the same constraints onto videos.

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

## Track P25-Q - Campaign Card Viewport Vertical Justification Audit

### Problem

Horizontal card justification is now restored, but the gallery viewports themselves may still need better vertical justification within their container when card content, viewport heights, and surrounding layout constraints do not naturally align.

### Proposed direction

Audit how campaign card gallery viewports align vertically in their available container, identify whether the current behavior is fixed, inherited, or accidental, and determine whether an explicit vertical-justification control is warranted.

## Track P25-R - Background Blur Option

### Problem

Background selectors currently expose multiple visual treatment modes, but they do not offer a blur-based option for cases where softened imagery or backdrop treatment would better support foreground readability.

### Proposed direction

Add `blur` as a supported option for the relevant background-type selectors, then define the minimum supporting controls needed to make that mode usable without fragmenting the selector model across different settings sections.

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

#### Phase 3: Control relocations (~25 controls)

| Setting(s) | From | To | Reason |
|---|---|---|---|
| `galleryTitleText`, `gallerySubtitleText` | Advanced > Gallery Text | Page & Theme > Page Header | Next to `showGalleryTitle`/`showGallerySubtitle` toggles |
| `campaignAboutHeadingText` | Advanced > Gallery Text | Campaign Viewer > Content Visibility | Next to `showCampaignAbout` toggle |
| `modalContentMaxWidth` (Advanced copy) | Advanced > Modal / Viewer | **Deleted** | Duplicate — single owner in Campaign Viewer |
| `modalCloseButtonBgColor`, `modalMobileBreakpoint` | Advanced > Modal / Viewer | Campaign Viewer > Modal Appearance | Modal visual chrome |
| `galleryImageLabel`, `galleryVideoLabel`, `galleryLabelJustification`, `showGalleryLabelIcon` | Gallery Layout > Gallery Labels | Campaign Viewer > Gallery Labels | Labels are a campaign viewer feature |
| `authBarBackdropBlur`, `authBarMobileBreakpoint` | Advanced > System | Page & Theme > Auth Bar | Auth bar visual properties |
| Card Appearance group (8 controls) | Advanced > Card Appearance | Campaign Cards > Card Internals | Card tuning stays with cards |
| `preserveDataOnUninstall` | Advanced > System | System & Admin > Data Maintenance | Admin lifecycle control |

#### Phase 4: Structural improvements

1. Add accordion structure to **Page & Theme** (flat with 6 dividers → 6 accordions: Theme & Layout, Page Container, Page Header, Page Background, Auth Bar, Security & Login).
2. Add accordion structure to **Campaign Viewer** (flat with 6 dividers → 6 accordions: Open Mode & Sizing, Modal Appearance, Content Visibility, Gallery Labels, Modal Background, Cover Image & Responsive).
3. Convert inline adapter quick-selectors to **read-only summary** showing current adapter per breakpoint, with click-to-open responsive editor modal.
4. Scope-prefix duplicate labels ("Background Type" → "Page Background Type" / "Modal Background Type" / "Viewport Background Type").

#### Phase 5: Verification

1. Run existing test suite (`SettingsPanel.test.tsx`, `App.test.tsx`, related component tests).
2. Run `npm run build:wp` for clean build.
3. Manual QA: all 6 tabs render, controls function, save/load persists.
4. Verify Drawer z-index with campaign viewer modal open.
5. Verify adapter read-only summary opens editor correctly.
6. Test mobile full-screen fallback at <576px.
7. Run WordPress PHP tests for settings persistence round-trip.

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