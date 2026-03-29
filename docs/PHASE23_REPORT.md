# Phase 23 - Settings Architecture Refactor, Responsive Gallery Config & Campaign Parity
**Status:** In Progress 🚧
**Version:** v0.22.0
**Created:** March 25, 2026
**Last updated:** March 29, 2026

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P23-A | Backend settings decomposition | In Progress 🚧 | Medium-Large (1-2 days) |
| P23-B | Frontend settings decomposition | Completed ✅ | Medium-Large (1-2 days) |
| P23-C | Authoritative adapter schema | In Progress 🚧 | Medium (1 day) |
| P23-D | Nested responsive gallery config model | In Progress 🚧 | Large (1-2 days) |
| P23-E | Shared resolver and inheritance layer | In Progress 🚧 | Medium-Large (1 day) |
| P23-F | Shared Gallery Config editor UX | Completed ✅ | Large (1-2 days) |
| P23-G | Campaign full gallery config parity | In Progress 🚧 | Large (1-2 days) |
| P23-H | Render-path consolidation | In Progress 🚧 | Medium (1 day) |
| P23-I | Shared sanitization and REST support | In Progress 🚧 | Medium-Large (1 day) |
| P23-J | Documentation, testing, and rollout verification | In Progress 🚧 | Medium (1 day) |
| P23-J1 | PHP test audit and coverage expansion | Planned 📋 | Medium (0.5-1 day) |

---

## Table of Contents

- [Phase 23 - Settings Architecture Refactor, Responsive Gallery Config \& Campaign Parity](#phase-23---settings-architecture-refactor-responsive-gallery-config--campaign-parity)
    - [Tracks](#tracks)
  - [Table of Contents](#table-of-contents)
  - [Rationale](#rationale)
  - [Key Decisions (Pre-Resolved)](#key-decisions-pre-resolved)
  - [Architecture Decisions](#architecture-decisions)
  - [Settings Pipeline Reference](#settings-pipeline-reference)
    - [Existing pipeline](#existing-pipeline)
    - [Phase 23 pipeline goals](#phase-23-pipeline-goals)
  - [Execution Priority](#execution-priority)
  - [Track P23-A - Backend Settings Decomposition](#track-p23-a---backend-settings-decomposition)
    - [Problem](#problem)
    - [Fix](#fix)
    - [Progress so far](#progress-so-far)
    - [Files to modify](#files-to-modify)
    - [Acceptance criteria](#acceptance-criteria)
  - [Track P23-B - Frontend Settings Decomposition](#track-p23-b---frontend-settings-decomposition)
    - [Problem](#problem-1)
    - [Fix](#fix-1)
    - [Progress so far](#progress-so-far-1)
    - [Files to modify](#files-to-modify-1)
    - [Acceptance criteria](#acceptance-criteria-1)
  - [Track P23-C - Authoritative Adapter Schema](#track-p23-c---authoritative-adapter-schema)
    - [Problem](#problem-2)
    - [Fix](#fix-2)
    - [Progress so far](#progress-so-far-2)
    - [Files to modify](#files-to-modify-2)
    - [Acceptance criteria](#acceptance-criteria-2)
  - [Track P23-D - Nested Responsive Gallery Config Model](#track-p23-d---nested-responsive-gallery-config-model)
    - [Problem](#problem-3)
    - [Fix](#fix-3)
    - [Progress so far](#progress-so-far-3)
    - [Files to modify](#files-to-modify-3)
    - [Acceptance criteria](#acceptance-criteria-3)
  - [Track P23-E - Shared Resolver and Inheritance Layer](#track-p23-e---shared-resolver-and-inheritance-layer)
    - [Problem](#problem-4)
    - [Fix](#fix-4)
    - [Progress so far](#progress-so-far-4)
    - [Files to modify](#files-to-modify-4)
    - [Acceptance criteria](#acceptance-criteria-4)
  - [Track P23-F - Shared Gallery Config Editor UX](#track-p23-f---shared-gallery-config-editor-ux)
    - [Problem](#problem-5)
    - [Fix](#fix-5)
    - [Progress so far](#progress-so-far-5)
    - [Files to modify](#files-to-modify-5)
    - [Acceptance criteria](#acceptance-criteria-5)
  - [Track P23-G - Campaign Full Gallery Config Parity](#track-p23-g---campaign-full-gallery-config-parity)
    - [Problem](#problem-6)
    - [Fix](#fix-6)
    - [Progress so far](#progress-so-far-6)
    - [Files to modify](#files-to-modify-6)
    - [Acceptance criteria](#acceptance-criteria-6)
  - [Track P23-H - Render-Path Consolidation](#track-p23-h---render-path-consolidation)
    - [Problem](#problem-7)
    - [Fix](#fix-7)
    - [Progress so far](#progress-so-far-7)
    - [Files to modify](#files-to-modify-7)
    - [Acceptance criteria](#acceptance-criteria-7)
  - [Track P23-I - Shared Sanitization and REST Support](#track-p23-i---shared-sanitization-and-rest-support)
    - [Problem](#problem-8)
    - [Fix](#fix-8)
    - [Progress so far](#progress-so-far-8)
    - [Files to modify](#files-to-modify-8)
    - [Acceptance criteria](#acceptance-criteria-8)
  - [Track P23-J - Documentation, Testing, and Rollout Verification](#track-p23-j---documentation-testing-and-rollout-verification)
    - [Problem](#problem-9)
    - [Fix](#fix-9)
    - [Progress so far](#progress-so-far-9)
    - [Files to modify](#files-to-modify-9)
    - [Acceptance criteria](#acceptance-criteria-9)
  - [Track P23-J1 - PHP Test Audit and Coverage Expansion](#track-p23-j1---php-test-audit-and-coverage-expansion)
    - [Problem](#problem-10)
    - [Fix](#fix-10)
    - [Files to modify](#files-to-modify-10)
    - [Acceptance criteria](#acceptance-criteria-10)
  - [Testing Strategy](#testing-strategy)
    - [Automated](#automated)
    - [Manual verification](#manual-verification)
    - [Documentation verification](#documentation-verification)
  - [Planned File Inventory](#planned-file-inventory)
    - [Primary implementation targets](#primary-implementation-targets)
    - [Phase 23 docs](#phase-23-docs)
    - [Conditional additive docs](#conditional-additive-docs)

---

## Rationale

The current settings system has crossed the point where incremental cleanup is enough. The problem is no longer just file size. Gallery behavior is now controlled through a mix of flat settings, partially responsive selection rules, duplicated adapter option lists, special cases for unified versus per-type rendering, and a campaign editing flow that does not expose the same configuration power as global settings.

That creates four concrete failures:

1. Settings logic is monolithic in both PHP and React, making future settings changes expensive and error-prone.
2. Responsive gallery behavior exists only in fragments, not as a coherent data model.
3. Adapter-specific configuration is present in practice, but not treated as a first-class schema-driven concept.
4. Global settings and campaign overrides can drift because they do not share the same editor, resolver, or sanitization pipeline.

Phase 23 solves those problems by introducing a shared gallery configuration architecture with three goals:

1. Clean, non-monolithic settings code.
2. Responsive gallery configuration that works for unified and per-type modes.
3. Full campaign-level gallery parity using the same underlying editor model as global settings.

Legacy flat fields remain part of the compatibility bridge throughout Phase 23. A follow-on cleanup phase should remove them only after the nested model is proven stable and adoption makes deprecation safe.

---

## Key Decisions (Pre-Resolved)

| # | Decision | Resolution |
|---|----------|------------|
| A | Campaign override depth | **Option 3 selected.** Campaigns require full gallery config parity, not just adapter selection or adapter-specific deltas. |
| B | Responsive support in unified mode | **Yes.** Unified gallery mode participates in the same responsive gallery model as image/video scoped galleries. |
| C | Gallery config UX | **Hybrid.** Keep selector rows visible, then launch a focused Gallery Config editor for deeper settings. |
| D | Backward compatibility strategy | **Bridge, not migration-first.** Existing flat settings and current campaign adapter meta remain readable during transition. New nested config takes precedence when present. |
| E | Adapter metadata ownership | **Centralized.** Adapter ids, labels, capabilities, scope restrictions, and setting groups must come from one authoritative schema. |
| F | Documentation scope | **Required.** Phase 23 includes a phase report, data model doc, and UI flow doc. New map docs are conditional and additive only if the implementation materially changes architecture. |
| G | New map document timing | **Deferred to the end of Phase 23.** Additive component tree and Mantine map refreshes should only be considered in the final documentation step, after implementation reveals whether they provide lasting reference value. |

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-1 | Introduce nested `galleryConfig` alongside existing flat settings | This allows a clean responsive model without forcing immediate destructive migration of existing installs. |
| AD-2 | Use one shared editor concept for global settings and campaign overrides | Eliminates UX drift and reduces maintenance cost. Different contexts should differ in inheritance behavior, not in core interaction model. |
| AD-3 | Treat adapter-specific settings as schema-driven field groups | Avoids hardcoded conditional UI in multiple locations and allows renderer, UI, and sanitization to stay aligned. |
| AD-4 | Centralize effective config resolution | Unified settings, campaign overrides, and rendering must all rely on one resolver to avoid divergence. |
| AD-5 | Campaign parity must still be inheritance-first | Full parity is required, but the campaign editor should default to inherited values and expose reset actions so flexibility does not become chaos. |
| AD-6 | Decompose backend and frontend before expanding settings surface | Trying to add the new model into the current monoliths would harden the very problems Phase 23 is meant to solve. |

---

## Settings Pipeline Reference

Phase 23 extends the existing settings pipeline rather than replacing it outright.

### Existing pipeline

1. PHP defaults live in `WPSG_Settings::$defaults`.
2. PHP validation lives in `$valid_options` and `$field_ranges`.
3. REST conversion uses `to_js()` and `from_js()`.
4. TypeScript types and defaults live in `src/types/index.ts`.
5. The Settings panel edits a merged settings object and saves it through the REST endpoint.

### Phase 23 pipeline goals

1. Move defaults and validation metadata into a registry-oriented backend module structure.
2. Extend TypeScript types to include a nested `galleryConfig` model.
3. Keep existing flat fields as compatibility inputs during the transition.
4. Use schema-based conversion/sanitization for both global settings and campaign gallery overrides.
5. Make renderer and runtime consumers resolve settings through the same shared utilities.

---

## Execution Priority

1. P23-A Backend settings decomposition
2. P23-B Frontend settings decomposition
3. P23-C Authoritative adapter schema
4. P23-D Nested responsive gallery config model
5. P23-E Shared resolver and inheritance layer
6. P23-I Shared sanitization and REST support
7. P23-F Shared Gallery Config editor UX
8. P23-G Campaign full gallery config parity
9. P23-H Render-path consolidation
10. P23-J Documentation, testing, and rollout verification
11. P23-J1 PHP test audit and coverage expansion

The priority is intentional: the schema and resolver must exist before the shared editor can be built safely, and the editor must exist before campaign parity can be delivered without duplication.

---

## Track P23-A - Backend Settings Decomposition

### Problem

`class-wpsg-settings.php` currently combines defaults, validation, sanitization, snake/camel conversion, admin renderer registration, and individual field rendering. That centralization once helped move fast, but now makes structural change expensive.

### Fix

Split backend settings responsibilities into:

1. thin facade
2. registry/defaults/validation module
3. conversion utilities module
4. renderer module
5. field-group renderer modules

### Progress so far

Completed extractions:

1. conversion utilities module
2. admin renderer module
3. settings support service module
4. registry/defaults/validation metadata module
5. sanitization module
6. core auth/display/performance field-group module
7. typography font metadata and helper module

Remaining backend decomposition in P23-A is primarily follow-up cleanup to reduce the remaining compatibility surface in `WPSG_Settings` and any additional renderer grouping that still proves worthwhile as the shared gallery config work lands.

### Files to modify

- `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php`
- new files under `wp-plugin/wp-super-gallery/includes/settings/`

### Acceptance criteria

- Settings facade exposes stable public API.
- Defaults, validation, and sanitization are no longer embedded in one giant class body.
- REST consumers can continue to use the same outward settings API.

---

## Track P23-B - Frontend Settings Decomposition

### Problem

`src/components/Admin/SettingsPanel.tsx` carries too many unrelated responsibilities, and the gallery adapter controls are embedded in conditional logic that cannot scale to full campaign parity.

### Fix

Split the settings panel into:

1. shell/container
2. per-tab modules
3. reusable controls
4. shared settings hook
5. dedicated gallery configuration editor modules

### Progress so far

Completed decomposition slices:

1. moved the gallery adapter selection block into a dedicated `GalleryAdapterSettingsSection` module
2. introduced a narrower gallery-focused update callback so gallery settings logic no longer depends directly on the full `SettingsPanel` implementation details
3. reduced inline adapter-selection and adapter-specific visibility logic inside `SettingsPanel`
4. corrected adapter-specific field visibility for per-breakpoint selections so compact-grid, justified, masonry, and shape controls reflect the active breakpoint adapters instead of only the legacy per-type pair
5. extracted the remaining layout-tab carousel, section sizing, and adapter sizing accordion items into a dedicated `GalleryLayoutDetailSections` module
6. validated the new `SettingsPanel` structure with a green production `build:wp` run and the existing focused `SettingsPanel` test suite
7. extracted viewport background and gallery label accordion items into a dedicated `GalleryPresentationSections` module so the layout tab now delegates most gallery-specific field blocks
8. revalidated the updated `SettingsPanel` composition with a green production `build:wp` run and the focused `SettingsPanel` test suite after recovering from an intermediate malformed panel edit during extraction
9. extracted the entire campaign viewer tab body into a dedicated `CampaignViewerSettingsSection` module so `SettingsPanel` now delegates another large, self-contained settings domain instead of holding the viewer-specific control tree inline
10. revalidated the viewer-tab extraction with a green production `build:wp` run and the focused `SettingsPanel` test suite
11. extracted the advanced tab into a dedicated `AdvancedSettingsSection` module so the remaining inline `SettingsPanel` surface is more clearly limited to orchestration and typography-specific flows
12. revalidated the advanced-tab extraction with a green production `build:wp` run and the focused `SettingsPanel` test suite
13. extracted the typography tab into a dedicated `TypographySettingsSection` module so `SettingsPanel` now delegates more of its self-contained tab bodies and further narrows its responsibility toward state orchestration, save/reset handling, and shared update helpers
14. revalidated the typography extraction with a green production `build:wp` run and the focused `SettingsPanel` test suite after normalizing uploaded-font entries to the existing typography editor font shape
15. extracted the entire campaign-cards tab into a dedicated `CampaignCardSettingsSection` module so `SettingsPanel` now delegates card appearance, grid, and pagination controls instead of holding that non-gallery settings tree inline
16. revalidated the campaign-cards extraction with a green production `build:wp` run and the focused `SettingsPanel` test suite
17. extracted the remaining general-tab body into a dedicated `GeneralSettingsSection` module so `SettingsPanel` now delegates theme, app-container, viewer-wrapper, auth-bar, security, and developer controls instead of holding that non-gallery panel inline
18. revalidated the general-tab extraction with a green production `build:wp` run and the focused `SettingsPanel` test suite after fixing the resulting stale import and prop-type mismatch surfaced by the build
19. extracted the entire media-display tab body into a dedicated `MediaDisplaySettingsSection` module so `SettingsPanel` now delegates the remaining legacy gallery viewport, tile, thumbnail-strip, transition, and navigation controls instead of holding that large accordion inline
20. revalidated the media-display extraction with a green production `build:wp` run and the focused `SettingsPanel` test suite after fixing the matching updater-prop type mismatch surfaced by the build
21. extracted the remaining gallery-layout tab shell into a dedicated `GalleryLayoutSettingsSection` module so `SettingsPanel` now delegates the last inline layout-tab composition instead of holding the adapter/editor entry wiring directly
22. revalidated the layout-shell extraction with a green production `build:wp` run and the focused `SettingsPanel` test suite after removing the stale imports surfaced by the build

P23-B is now complete: `SettingsPanel` has been reduced to shell/orchestration responsibilities, the gallery-layout composition lives in dedicated section modules, and the shared responsive gallery editor remains reusable outside the main settings panel.

### Files to modify

- `src/components/Admin/SettingsPanel.tsx`
- new files under `src/components/Settings/` or equivalent destination

### Acceptance criteria

- Settings shell is thin.
- Gallery configuration becomes a dedicated subsystem instead of inline conditional blocks.
- Shared editor modules can be reused outside the main settings panel.

---

## Track P23-C - Authoritative Adapter Schema

### Problem

Adapter option lists and adapter-specific setting visibility rules are duplicated in multiple places. The runtime registry currently knows how to resolve components, but not enough to drive editor UX or validation.

### Fix

Promote adapter definitions into a richer schema that owns:

1. adapter id
2. label
3. scope support
4. breakpoint/mobile restrictions
5. capabilities
6. common setting groups
7. adapter-specific field groups
8. migration fallbacks where needed

### Progress so far

Completed initial schema extraction:

1. centralized built-in adapter metadata in the runtime registry
2. added canonical id and alias normalization for `classic`/`carousel` and `justified`/`mosaic`
3. moved breakpoint restriction metadata for `layout-builder` into the shared registry
4. replaced duplicated adapter option lists in SettingsPanel and UnifiedCampaignModal with registry-driven options
5. switched gallery render paths to resolve runtime adapters through the shared registry instead of local switch statements
6. added focused tests for registry metadata and resolver compatibility
7. moved the compact-grid, justified, and masonry adapter field definitions into registry-owned setting-group metadata so `GalleryAdapterSettingsSection` can render part of the adapter-specific UI from schema instead of hardcoded group branches
8. validated the schema-driven field-definition slice with focused registry tests, the existing `SettingsPanel` suite, and a green production `build:wp` run
9. extended the registry-owned field metadata to cover the shape adapter group as well, including unified and per-type tile-size fields, so the remaining adapter-specific sizing controls also render from schema definitions
10. revalidated the expanded schema-driven adapter field rendering with focused registry tests, the existing `SettingsPanel` suite, and a green production `build:wp` run
11. extended the adapter field schema to support select controls and moved the layout-builder scope selector into registry-owned metadata so the adapter settings UI is no longer limited to schema-driven numeric fields
12. revalidated the select-field schema migration with focused registry tests, the existing `SettingsPanel` suite, and a green production `build:wp` run
13. added registry-owned setting-group layout, placement, and contextual-scope metadata so the adapter settings UI can derive not just fields, but also which setting groups render inline versus in the shared section area
14. replaced the remaining hardcoded adapter group branches in `GalleryAdapterSettingsSection` with iteration over active registry setting-group definitions, while preserving the special image/video split behavior for contextual groups like shape adapters
15. moved the remaining layout-builder per-type selection transition rules into a shared registry helper so the settings UI no longer hardcodes the adapter-specific state changes required to coerce unsupported per-type layout-builder selections into the existing per-breakpoint model
16. validated the shared adapter-selection helper with focused registry tests, the existing `SettingsPanel` suite, and a green production `build:wp` run
17. extracted the legacy image/video breakpoint adapter key and fallback lookup into a shared utility consumed by the registry helper, the nested gallery-config compatibility bridge, and the runtime resolver so editor and runtime paths now share one source of truth for per-type adapter slot resolution
18. replaced the remaining settings-panel adapter-id list assembly with shared selection helpers so `GalleryAdapterSettingsSection` and `GalleryLayoutDetailSections` no longer manually rebuild unified/per-type/per-breakpoint adapter arrays from legacy fields
19. added shared campaign gallery-override helpers, wired the campaign modal to preserve and update nested `galleryOverrides`, taught admin campaign rows to recognize nested overrides, and extended campaign REST read/write support so nested campaign gallery overrides now round-trip through the backend instead of existing only as runtime-only data
20. exposed `galleryOverrides.mode` in the campaign modal through shared override helpers so campaign editors can now opt a campaign into unified or per-type gallery mode without falling back to flat legacy-only fields
21. introduced a shared responsive gallery config editor modal and wired the first shell into both SettingsPanel and the campaign modal so both contexts now share one nested gallery-selection surface while retaining inline quick selectors for scanability
22. expanded the shared gallery config editor to own the first common-settings slice by editing nested section padding and adapter content padding, while projecting those values back into global flat settings so the existing layout controls stay in sync during the migration
23. moved the first adapter-specific setting group into the shared gallery config editor by rendering the registry-defined masonry field from schema metadata and seeding/projecting its value through the global flat-settings bridge during the migration
24. added baseline reset controls to the shared gallery config editor so users can revert either the current per-type breakpoint draft or the full editor draft back to the config state that was opened, giving both global and campaign contexts reversible edits before inheritance-specific reset UX lands
25. added an explicit campaign-only clear action in the shared gallery config editor so campaign editors can remove stored gallery overrides entirely and fall back to inherited global behavior instead of only resetting the current modal draft
26. added campaign inherited-versus-overridden state messaging inside the shared gallery config editor so the reset and clear actions now explain whether the campaign is currently inheriting global gallery settings or storing custom gallery overrides
27. generalized nested adapter-settings support by seeding registry-defined legacy flat values into the shared editor, rendering active adapter groups from schema instead of a masonry-only branch, and projecting nested adapter settings back through the runtime resolver so campaign overrides now affect real adapter behavior instead of only the global compatibility bridge
28. expanded the shared common-settings slice to include adapter item gap and adapter justification so both global settings and campaign overrides can now edit those nested spacing/distribution controls from the shared editor while the flat compatibility fields stay synchronized on save
29. expanded the shared common-settings slice again to cover section sizing controls, including section max/min width, height mode, manual max height, min height, and per-type equal-height behavior, while fixing SettingsPanel seed precedence so flat migration-bridge values stay authoritative when nested defaults disagree
30. expanded the shared common-settings surface to include adapter sizing mode plus manual max width/max height percentages so both global settings and campaign overrides can edit nested adapter fit constraints from the shared editor while the legacy flat fields continue to round-trip through SettingsPanel during the migration
31. added the first schema-driven `carousel` adapter setting group for the classic adapter, including visible-cards, gap, loop, drag, autoplay, darken, and edge-fade controls, so the shared editor can now expose real classic adapter-specific fields instead of leaving the registry group empty
32. expanded that schema-driven classic `carousel` group again to cover the first overlay-arrow and dot-navigator behavior controls, so the shared editor can now round-trip classic navigation position, sizing, visibility, and placement behavior from nested adapter settings without relying on the remaining inline legacy-only controls
33. added a schema-driven freeform text field type and used it to register the remaining live classic navigation color controls, so the shared editor can now round-trip arrow foreground/background colors and active/inactive dot colors instead of leaving those runtime-owned values stranded in the flat legacy surface
34. extended the schema-driven classic `carousel` group to include `imageViewportHeight` and `videoViewportHeight`, while adding scope-aware field applicability so unified classic galleries can still expose both base media heights without incorrectly treating them as shared common settings
35. extended that same schema-driven classic `carousel` group again to include image/video shadow presets plus custom shadow values, so nested config can now round-trip the remaining classic depth controls through adapter settings instead of leaving them stranded on the inline flat legacy path
36. added a shared `media-frame` adapter group for `imageBorderRadius` and `videoBorderRadius`, attaching it to classic plus the rectangular grid adapters so mixed-media rounded-surface controls can live in nested adapter settings without pretending they are generic common settings
37. added a shared `photo-grid` adapter group for `thumbnailGap`, attaching it to justified and masonry so the remaining photo-album spacing field can round-trip through nested adapter settings without collapsing into the broader `common.adapterItemGap` surface
38. added a shared `tile-appearance` adapter group for tile border, hover-bounce, and glow fields, attaching it to the shape adapters plus justified and masonry so the shared tile-style contract can round-trip through nested adapter settings with the same conditional visibility rules as the legacy inline UI
39. extended the shared `shape` adapter group to include `tileGapX` and `tileGapY`, so the remaining shape-only spacing fields can round-trip through nested adapter settings instead of staying stranded on the flat legacy path
40. extended the existing `layout-builder` adapter group to include `tileGlowColor` and `tileGlowSpread` as slot-default fallback settings, so layout-builder-specific glow defaults can round-trip through nested adapter settings without pretending the full shared tile-appearance contract applies there

Remaining work in P23-C is now concentrated on broader non-gallery appearance slices and any future adapter field families that still need a clear nested ownership model.

### Files to modify

- `src/components/Galleries/Adapters/GalleryAdapter.ts`
- `src/components/Galleries/Adapters/adapterRegistry.ts`
- gallery configuration editor modules

### Acceptance criteria

- Settings UI and campaign UI derive their adapter choices from the same schema.
- Adapter-specific field visibility is schema-driven.
- Renderer support restrictions and editor restrictions stay aligned.

---

## Track P23-D - Nested Responsive Gallery Config Model

### Problem

The current flat settings do not express breakpoint-aware gallery configuration cleanly. Per-breakpoint adapter selection exists, but layout/sizing/justification and unified-mode behavior do not sit inside a coherent model.

### Fix

Add a nested `galleryConfig` structure that organizes gallery behavior by:

1. global mode
2. breakpoint
3. scope (`unified`, `image`, `video`)
4. common settings
5. adapter-specific settings

### Progress so far

Completed initial compatibility bridge:

1. added shared nested `galleryConfig` types to the frontend settings contract
2. added `galleryOverrides` typing to campaigns for the future parity path
3. added a legacy-to-nested compatibility builder that derives breakpoint and scope adapter config from existing flat settings
4. updated `mergeSettingsWithDefaults()` so explicit nested config overlays the legacy-derived bridge instead of competing with it
5. added focused tests for nested config parsing, merge precedence, and legacy hydration

Remaining work in P23-D is to move actual runtime/editor consumers onto the nested model incrementally and expand the nested structure beyond the first-pass common settings bridge.

### Files to modify

- `src/types/index.ts`
- `src/utils/mergeSettingsWithDefaults.ts`
- backend registry/sanitization modules

### Acceptance criteria

- Global settings can express responsive unified and per-type configuration coherently.
- Existing flat settings remain readable during transition.
- The new model is documented and testable.

---

## Track P23-E - Shared Resolver and Inheritance Layer

### Problem

Different parts of the app currently derive effective adapter behavior differently. That drift risk becomes unacceptable once campaign full parity is introduced.

### Fix

Create shared resolver utilities that determine effective gallery behavior in one place, using a consistent resolution order across contexts.

Recommended order:

1. campaign nested override
2. campaign legacy override
3. global nested breakpoint/scope config
4. global legacy flat fields
5. hard fallback

### Progress so far

Completed initial resolver migration:

1. added shared gallery mode resolution that prefers nested `galleryConfig.mode` over legacy `unifiedGalleryEnabled`
2. updated per-type adapter resolution to prefer nested breakpoint scope adapters before legacy flat fields
3. added shared unified adapter resolution for the current breakpoint
4. preserved legacy flat adapter fallback and mobile restriction fallback behavior under the nested-aware resolver path
5. moved CampaignViewer runtime section selection onto the shared gallery mode resolver
6. added shared common-settings resolution so runtime section sizing and adapter layout fields can flow through nested breakpoint and scope config
7. updated unified and per-type viewer sections to project resolved common settings back onto the existing adapter runtime contract
8. added campaign nested override awareness to resolver precedence so runtime behavior can honor future gallery parity work without re-branching
9. added focused tests covering nested precedence, common-setting projection, and the updated viewer path
10. nested common-setting resolution now also projects gallery label and visibility controls back onto the legacy runtime settings contract, so nested config can affect live adapter title rendering without requiring local per-adapter fallback logic
11. nested common-setting resolution now also projects scope-aware viewport background controls back onto the legacy runtime settings contract, so nested image/video/unified background presentation can flow through the shared resolver instead of remaining stranded on the flat settings path

Remaining work in P23-E is to extend the resolver beyond adapter ids and mode selection so common settings, campaign overrides, and inheritance/reset semantics all flow through the same effective-config path.

### Files to modify

- `src/utils/resolveAdapterId.ts`
- new gallery config resolution utilities
- backend support utilities where needed

### Acceptance criteria

- Global UI, campaign UI, and renderers all use the same effective resolution logic.
- Resolution order is covered by tests.
- Layout builder restrictions and adapter fallbacks are handled centrally.

---

## Track P23-F - Shared Gallery Config Editor UX

### Problem

Current gallery controls are hard to scan and do not expose adapter-specific settings coherently. Pushing more controls inline would recreate the monolithic problem in a different form.

### Fix

Create a shared Gallery Config editor with hybrid UX:

1. selector rows remain visible in parent UI
2. a focused editor opens for common and adapter-specific settings
3. breakpoint and scope switching happen inside the editor
4. reset and inheritance affordances are explicit

The editor itself should be lazy-loaded so SettingsPanel and UnifiedCampaignModal do not pay its bundle cost until users open it.

### Progress so far

Completed shared editor slices:

1. introduced a shared responsive gallery config editor that both SettingsPanel and UnifiedCampaignModal can open for the nested gallery model while retaining inline quick selectors for scanability
2. expanded the editor to cover shared section spacing, shared section sizing, shared adapter sizing, baseline reset actions, campaign clear actions, inherited-versus-overridden campaign messaging, and registry-driven adapter-specific groups
3. expanded the shared editor again to expose the nested classic-gallery height controls already supported by the runtime and compatibility bridge, so `gallerySizingMode` and `galleryManualHeight` can now be edited from the same nested surface as the other shared common settings
4. extended the shared editor schema support to handle boolean adapter fields and used that to render the first real classic-carousel adapter-specific group from registry metadata instead of leaving the classic adapter on inline-only legacy controls
5. expanded the shared editor's classic-carousel schema slice to include overlay-arrow and dot-navigator behavior controls that already drive the live runtime, closing another chunk of the classic adapter's nested editor parity without introducing a new freeform text-control type yet
6. added schema-driven text-input support to the shared editor and used it for the remaining live classic navigation color fields, so nested classic config can now edit arrow and dot color tokens directly from the shared responsive editor
6. restored the required P23-F lazy-load behavior by loading the shared editor only when users open it from either SettingsPanel or UnifiedCampaignModal
7. updated the affected integration tests to treat the editor as a lazy-loaded modal entry point instead of a synchronously mounted subtree, while keeping direct editor field/value coverage in the shared editor test file
8. expanded the shared editor's common-settings surface again to include scope-aware viewport background controls, so nested image/video/unified background presentation can now be edited from the same responsive editor and projected back through the compatibility bridge
9. expanded the shared editor's classic-carousel adapter slice to expose `imageViewportHeight` and `videoViewportHeight` through schema-driven adapter settings, keeping shared height mode/manual height in common settings while leaving the per-media base heights adapter-owned
10. expanded the shared editor's classic-carousel adapter slice again to expose image/video shadow presets and custom shadow strings, including conditional custom-field visibility when the matching preset is set to `custom`
11. expanded the shared editor again to expose a shared `Media Frame` adapter group for `imageBorderRadius` and `videoBorderRadius`, so classic and rectangular grid adapters can edit nested rounded-corner settings from the same responsive surface while mixed-media runtime consumers stay aligned
12. expanded the shared editor again to expose a shared `Photo Grid` adapter group for `thumbnailGap`, so justified and masonry can edit their remaining dense-grid spacing field from the same responsive surface without pushing that legacy-specific value into shared common settings
13. expanded the shared editor again to expose a shared `Tile Appearance` adapter group for tile border, hover-bounce, and glow fields, including conditional detail-field visibility for border color and glow settings so the nested editor preserves the same progressive disclosure as the inline legacy tile-appearance UI
14. expanded the shared editor again to expose the remaining shape-only spacing controls under the shared `Shape Layout` group, so `tileGapX` and `tileGapY` now edit through the same responsive adapter-settings surface as the existing shape tile-size controls
15. expanded the shared and inline schema-driven adapter renderers to understand `color` fields, then used that support to expose layout-builder default glow color and spread under the existing `Layout Builder` group without keeping those slot-default values flat-only

Remaining work in P23-F is now limited to UX polish or follow-up ergonomics discovered while completing campaign parity, not the core shared-editor architecture itself.

### Files to modify

- new shared gallery config editor components
- global settings panel modules
- campaign editing modules

### Acceptance criteria

- Users can scan active adapter choices without entering a modal.
- Users can configure common and adapter-specific settings without navigating a giant flat form.
- Global and campaign contexts use the same editor concept.
- The shared editor is lazy-loaded from both entry points.

---

## Track P23-G - Campaign Full Gallery Config Parity

### Problem

Campaign editing currently offers only shallow gallery overrides. That is insufficient for the required level of deep individual customization.

### Fix

Allow campaigns to override the same gallery configuration surface supported globally by the shared editor. Campaigns should still default to inherited global values and store only what they override.

Campaign nested gallery overrides should be stored under a dedicated post-meta key: `_wpsg_gallery_overrides`.

### Progress so far

Completed parity slices:

1. campaign settings already open the same shared responsive gallery config editor used by global settings, with inherited-versus-overridden messaging and clear-all campaign reset behavior
2. campaign overrides already persist nested `galleryOverrides` alongside the legacy flat bridge fields so the shared editor can round-trip full nested config state
3. the shared editor now allows campaign-level unified adapter overrides instead of forcing unified mode to inherit the global adapter, closing the most obvious remaining campaign/editor mismatch
4. the campaign settings tab now mirrors unified-mode quick overrides more accurately by swapping the inline image/video selectors for a unified adapter selector when the campaign override mode is unified, and campaign override summaries now report unified adapter selections instead of only per-type fields
5. the campaign settings tab now surfaces live gallery override summary badges plus an inline `Use Inherited Gallery Settings` reset action, so editors can scan and clear campaign-specific gallery state without reopening the shared modal just to understand or discard it
6. campaign override summaries now distinguish adapter-selection overrides from deeper responsive-setting customizations, so admin and editing surfaces no longer misreport non-adapter nested overrides as if they were only adapter-choice changes

Remaining P23-G work is now concentrated on the last persistence/polish edges and any scope-specific reset ergonomics discovered during end-to-end verification, not on basic shared-editor capability or inherited-state visibility.

### Files to modify

- `src/components/Campaign/UnifiedCampaignModal.tsx`
- `src/hooks/useUnifiedCampaignModal.ts`
- `src/types/index.ts`
- backend campaign REST/meta handling

### Acceptance criteria

- Campaigns can override responsive gallery behavior deeply.
- Inheritance from global settings remains the default starting point.
- Campaign override reset flows are available at useful scopes.
- Campaign nested overrides are stored under `_wpsg_gallery_overrides` with stable REST handling.

---

## Track P23-H - Render-Path Consolidation

### Problem

Unified and per-type gallery rendering still rely on local component switching and direct field lookups. That makes runtime behavior vulnerable to UI drift.

### Fix

Route render-time gallery selection through the shared resolver and adapter schema instead of scattered local switch statements.

### Progress so far

Completed render-path slices:

1. `CampaignViewer` already resolves unified versus per-type mode through the shared gallery resolver using campaign nested overrides
2. `UnifiedGallerySection` already resolves the effective unified adapter id and common/adapter settings through the shared resolver helpers instead of reading flat fields directly
3. `PerTypeGallerySection` already resolves image/video adapter ids and effective settings through the same shared resolver path, including central adapter normalization and fallback handling
4. focused viewer coverage now asserts that campaign nested mode overrides can flip the runtime between unified and per-type section rendering even when the global settings mode points the other direction
5. focused section-level coverage now asserts both layout-builder branching and unsupported mobile fallback behavior for unified and per-type runtime sections, so the renderer path is no longer only indirectly covered through top-level viewer tests
6. added shared campaign gallery render-plan helpers that resolve per-scope adapter ids, effective settings, wrapper backgrounds, border radii, tile-size projection, and equal-height state from one place instead of duplicating that planning logic inside each section component
7. rewired `UnifiedGallerySection` and `PerTypeGallerySection` through a shared `CampaignGalleryAdapterRenderer`, so layout-builder branching and adapter rendering no longer live in two divergent section implementations

Remaining P23-H work is now focused on explicit render-parity coverage and any last-mile cleanup around the outer viewer shell, not on duplicated section-level adapter planning.

### Files to modify

- `src/components/CardViewer/UnifiedGallerySection.tsx`
- `src/components/CardViewer/PerTypeGallerySection.tsx`
- related gallery rendering helpers

### Acceptance criteria

- Renderers use the same adapter selection rules as the editor.
- Unified and per-type sections both honor responsive resolution.
- Adapter restrictions and fallbacks are not reimplemented locally.

---

## Track P23-I - Shared Sanitization and REST Support

### Problem

Global settings sanitization and campaign gallery override handling currently live on separate, inconsistent paths. That will not scale to a nested parity model.

### Fix

Adopt schema-driven sanitization rules for nested gallery config and use them in both:

1. global settings update flow
2. campaign gallery override update flow

### Progress so far

Completed sanitization/REST slices:

1. campaign REST handling already reads and writes nested campaign gallery overrides under `_wpsg_gallery_overrides`
2. campaign nested override payloads already flow through a dedicated sanitizer path before persistence, including breakpoint and scope pruning for invalid or empty values
3. PHP coverage already includes campaign nested override round-trip verification for create, update, and clear flows
4. the global settings registry now exposes a first-class `gallery_config` default so the settings REST bridge no longer silently drops the nested gallery model on the PHP side
5. the global settings sanitizer now preserves and sanitizes nested `gallery_config` payloads structurally instead of falling through the generic scalar sanitizer path
6. campaign override persistence now reuses the shared settings-side nested gallery sanitizer instead of keeping a second near-duplicate REST-local implementation, reducing drift between global and campaign validation behavior
7. known nested `common` and `adapterSettings` fields now reuse backend defaults, valid-option lists, and numeric ranges for field-level validation in both global settings and campaign override payloads, while unknown nested keys still fall back to compatibility-safe generic sanitization
8. nested `adapterSettings` validation is now limited to an explicit adapter-related key map instead of broad matching against any flat default key, so unrelated nested keys no longer get accidentally treated as schema-known fields
9. nested payload sanitization now rejects misplaced keys that map to known top-level settings but are not allowed in nested `common` or `adapterSettings`, while still preserving genuinely unknown nested keys for forward compatibility
10. nested `adapterSettings` now also explicitly own the live classic carousel runtime fields that `MediaCarouselAdapter`, `OverlayArrows`, and `DotNavigator` consume, so nested payloads can reuse backend ranges and enums for viewport height, border radius, thumbnail gap, arrow controls, dot-nav controls, and shadow presets instead of rejecting them as misplaced flat settings
11. nested `common` settings now also explicitly own the live gallery label and visibility controls used across adapter renderers, so nested payloads can sanitize and project label text, justification, icon visibility, and section-label visibility through the shared backend and resolver pipeline instead of treating them as stray top-level fields
12. nested `common` settings now also explicitly own the scope-aware viewport background controls used by gallery section wrappers, so global settings and campaign override payloads can sanitize background type/color/gradient/image values through the same shared backend path

Remaining P23-I work is concentrated on the smaller set of legacy settings that are still outside the shared editor's current schema surface, so the remaining compatibility-preserved unknown keys can either move into explicit validation maps or be intentionally rejected once their intended ownership is settled.

### Files to modify

- backend registry/sanitization modules
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`

### Acceptance criteria

- Nested gallery config is sanitized consistently in both contexts.
- REST responses remain stable and compatibility-safe.
- Legacy fields continue to work while nested config is phased in.

---

## Track P23-J - Documentation, Testing, and Rollout Verification

### Problem

This phase changes architecture, data shape, runtime resolution, and editing UX. Without explicit documentation and verification, the refactor will be hard to review and easy to regress.

### Fix

Produce and maintain:

1. this phase report
2. a gallery data model document
3. a gallery configuration UI flow document
4. tests for merge behavior, resolution, visibility rules, inheritance, and render parity

### Progress so far

Completed documentation/testing slices:

1. this phase report has been kept current through the recent P23-F and P23-G checkpoints instead of being left as a static planning artifact
2. focused frontend coverage now exists for nested merge behavior, resolver precedence, viewer and section render-path parity, the shared gallery config editor, lazy-loaded global/campaign entry points, and campaign override helper utilities
3. PHP coverage already exercises campaign override REST round-trip behavior, and focused settings tests now also cover global `gallery_config` conversion, sanitization, and REST round-trip expectations even though the WordPress PHPUnit environment was not available locally for execution in this session
4. focused PHP sanitizer coverage now also exercises the shared nested campaign override helper directly so global and campaign nested payload rules no longer rely only on route-level tests for parity
5. the repo-documented `wp-env` PHPUnit path is now validated locally again for the affected settings and campaign REST suites, including a real JSON-body campaign override case that exercises mixed valid and invalid nested values through the live route path
6. the focused `wp-env` suite remains green after tightening nested `adapterSettings` to an explicit allowlist of adapter-related keys, and now covers the distinction between schema-known adapter fields and compatibility-preserved unknown nested keys
7. the focused `wp-env` suite remains green after adding rejection coverage for misplaced known top-level settings inside nested payloads, so the live REST path now distinguishes between disallowed known keys and forward-compatible unknown keys
8. the focused `wp-env` suite now also covers nested classic-carousel runtime fields through both helper-level and live JSON-body campaign tests, keeping the shared sanitizer aligned with the fields the current carousel renderer and navigation helpers actually use
9. focused resolver tests and the same `wp-env` PHP suite now also cover nested gallery label and visibility controls, so both frontend runtime projection and backend REST sanitization stay aligned for those common presentation fields
10. the shared responsive gallery editor now exposes those nested gallery presentation fields directly, and focused `GalleryConfigEditorModal` plus `SettingsPanel` coverage confirms the global save bridge still projects nested label, justification, and visibility values back into the legacy flat settings contract during the migration
11. focused frontend coverage now also verifies that nested classic-gallery height controls seed into the shared editor and still project back through the global flat-settings bridge, while related carousel runtime tests remain part of the broader frontend validation pass because those adapters consume the resolved height constraint directly
12. focused registry, shared-editor, settings-panel, resolver, and carousel runtime coverage now also validates the first schema-driven classic-carousel adapter group, so nested `carousel` adapter settings can seed from legacy flat fields, round-trip through the shared editor, and continue driving the live classic runtime without a parallel hand-maintained editor branch
13. that focused frontend coverage now also exercises the first schema-driven classic navigation behavior controls, confirming overlay-arrow and dot-navigator settings seed from legacy flat fields and project back through nested `carousel` adapter settings without breaking the live classic runtime suites
14. the same focused frontend coverage now also validates the new schema-driven classic navigation color fields, confirming the shared editor seeds arrow/dot color values from flat settings and still projects them back through nested `carousel` adapter settings after introducing text-field schema support
15. focused shared-editor, settings-panel, resolver/runtime, and `wp-env` settings/campaign REST coverage now also validates scope-aware viewport background common settings, confirming legacy seeding, global save projection, runtime background rendering, and backend sanitization stay aligned for the newly migrated presentation slice
16. focused frontend coverage now also validates classic viewport height adapter settings, confirming schema-driven seeding, shared-editor rendering, global save projection, and unified runtime resolution all stay aligned without moving those base heights into nested common settings
17. focused frontend coverage now also validates classic shadow adapter settings, confirming schema-driven seeding, conditional custom-shadow editor rendering, global save projection, and unified runtime resolution stay aligned for the remaining classic depth controls
18. focused frontend coverage now also validates shared `media-frame` border-radius settings, confirming schema-driven seeding, shared-editor rendering, flat save projection, unified wrapper resolution, and mixed-media tile runtime behavior stay aligned across classic, compact-grid, justified, and masonry
19. focused frontend coverage now also validates shared `photo-grid` thumbnail-gap settings, confirming schema-driven seeding, shared-editor rendering, flat save projection, and resolver/runtime projection stay aligned for justified and masonry without rerouting the field through common spacing controls
20. focused frontend coverage now also validates shared `tile-appearance` settings, confirming schema-driven seeding, conditional shared-editor rendering, flat save projection, and resolver projection stay aligned for the shape adapters plus justified and masonry
21. focused frontend coverage now also validates shared shape-layout gap settings, confirming schema-driven seeding, shared-editor rendering, flat save projection, and resolver projection stay aligned for `tileGapX` and `tileGapY` on the shape adapters
22. focused frontend coverage now also validates layout-builder default glow settings, confirming registry-defined layout-builder fields, shared-editor rendering, flat save projection, and resolver projection stay aligned for `tileGlowColor` and `tileGlowSpread` without reusing the full tile-appearance ownership model
23. focused frontend coverage remains green after extracting the inline campaign-cards tab into `CampaignCardSettingsSection`, preserving the existing card-tab interaction coverage while reducing the remaining `SettingsPanel` monolith surface
24. focused frontend coverage remains green after extracting the inline general tab into `GeneralSettingsSection`, preserving the existing general-tab interaction and theme-selector coverage while reducing the remaining `SettingsPanel` monolith surface again
25. focused frontend coverage remains green after extracting the inline media-display tab into `MediaDisplaySettingsSection`, preserving the existing gallery-tab interaction coverage while removing the last large legacy accordion body from `SettingsPanel`
26. focused frontend coverage remains green after extracting the remaining gallery-layout tab shell into `GalleryLayoutSettingsSection`, preserving the shared responsive-editor entry-point coverage while leaving `SettingsPanel` as a shell/coordinator
27. focused frontend coverage now also validates the shared campaign render-plan helpers plus the inline campaign override summary/reset UX, keeping campaign parity messaging and viewer section planning green through the latest P23-G/P23-H consolidation slice

Remaining P23-J work is broader documentation completion, wider suite validation, and final rollout verification once the remaining parity and consolidation slices are finished.

### Files to modify

- `docs/PHASE23_REPORT.md`
- `docs/GALLERY_CONFIG_DATA_MODEL.md`
- `docs/GALLERY_CONFIG_UI_FLOW.md`
- test files across frontend and backend as implementation lands

### Acceptance criteria

- Reviewers can understand the architecture without reconstructing it from code.
- Resolution behavior is validated by tests.
- Implementation follows the documented model rather than inventing new patterns ad hoc.

---

## Track P23-J1 - PHP Test Audit and Coverage Expansion

### Problem

The plugin already has a meaningful PHP test suite, but it has not been systematically updated to match the growing server-side surface area and the settings architecture changes planned for Phase 23.

### Fix

Audit the existing PHP tests, identify stale or missing coverage areas, and expand the suite to cover the new settings decomposition, nested gallery config compatibility, resolver-facing REST behavior, and campaign gallery override persistence.

### Files to modify

- existing files under `wp-plugin/wp-super-gallery/tests/`
- new focused PHP tests where gaps are found
- supporting bootstrap/config only if required

### Acceptance criteria

- Existing PHP tests are reviewed for relevance against the current codebase.
- New settings-architecture work lands with matching PHP coverage.
- REST/settings/campaign override regressions introduced by Phase 23 are covered by automated PHP tests.

---

## Testing Strategy

### Automated

1. Settings merge tests for legacy plus nested config.
2. Resolver tests for global and campaign contexts across breakpoints/scopes.
3. UI tests for adapter-specific field visibility and inheritance/reset flows.
4. Render-path tests ensuring editor-selected behavior matches runtime behavior.
5. PHP test audit and expansion for settings REST flows, campaign override persistence, compatibility bridging, and extracted backend modules.

### Manual verification

1. Desktop/tablet/mobile responsive behavior in unified and per-type modes.
2. Global settings editor flow.
3. Campaign override flow with inheritance, partial overrides, and full reset.
4. Layout builder restrictions and fallback behavior.

### Documentation verification

1. Confirm implementation still matches the data model doc.
2. Confirm implementation still matches the UI flow doc.
3. Create additive map docs only if implementation materially changes the documented component or Mantine usage picture.

---

## Planned File Inventory

### Primary implementation targets

- `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`
- `src/components/Admin/SettingsPanel.tsx`
- `src/components/Campaign/UnifiedCampaignModal.tsx`
- `src/hooks/useUnifiedCampaignModal.ts`
- `src/types/index.ts`
- `src/utils/mergeSettingsWithDefaults.ts`
- `src/utils/resolveAdapterId.ts`
- `src/components/Galleries/Adapters/GalleryAdapter.ts`
- `src/components/Galleries/Adapters/adapterRegistry.ts`
- `src/components/CardViewer/UnifiedGallerySection.tsx`
- `src/components/CardViewer/PerTypeGallerySection.tsx`

### Phase 23 docs

- `docs/PHASE23_REPORT.md`
- `docs/GALLERY_CONFIG_DATA_MODEL.md`
- `docs/GALLERY_CONFIG_UI_FLOW.md`

### Conditional additive docs

- `docs/COMPONENT_TREE_MAP_PHASE23.md`
- `docs/MANTINE_COMPONENT_MAP_PHASE23.md`

These two map docs should only be evaluated in the final documentation step of Phase 23, and only created if the completed implementation materially changes component relationships or Mantine usage enough to provide new long-term reference value.