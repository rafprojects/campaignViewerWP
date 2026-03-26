# Phase 23 - Settings Architecture Refactor, Responsive Gallery Config & Campaign Parity
**Status:** In Progress 🚧
**Version:** v0.22.0
**Created:** March 25, 2026
**Last updated:** March 25, 2026

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P23-A | Backend settings decomposition | In Progress 🚧 | Medium-Large (1-2 days) |
| P23-B | Frontend settings decomposition | In Progress 🚧 | Medium-Large (1-2 days) |
| P23-C | Authoritative adapter schema | In Progress 🚧 | Medium (1 day) |
| P23-D | Nested responsive gallery config model | In Progress 🚧 | Large (1-2 days) |
| P23-E | Shared resolver and inheritance layer | In Progress 🚧 | Medium-Large (1 day) |
| P23-F | Shared Gallery Config editor UX | Planned 📋 | Large (1-2 days) |
| P23-G | Campaign full gallery config parity | Planned 📋 | Large (1-2 days) |
| P23-H | Render-path consolidation | Planned 📋 | Medium (1 day) |
| P23-I | Shared sanitization and REST support | Planned 📋 | Medium-Large (1 day) |
| P23-J | Documentation, testing, and rollout verification | Planned 📋 | Medium (1 day) |
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
    - [Files to modify](#files-to-modify-5)
    - [Acceptance criteria](#acceptance-criteria-5)
  - [Track P23-G - Campaign Full Gallery Config Parity](#track-p23-g---campaign-full-gallery-config-parity)
    - [Problem](#problem-6)
    - [Fix](#fix-6)
    - [Files to modify](#files-to-modify-6)
    - [Acceptance criteria](#acceptance-criteria-6)
  - [Track P23-H - Render-Path Consolidation](#track-p23-h---render-path-consolidation)
    - [Problem](#problem-7)
    - [Fix](#fix-7)
    - [Files to modify](#files-to-modify-7)
    - [Acceptance criteria](#acceptance-criteria-7)
  - [Track P23-I - Shared Sanitization and REST Support](#track-p23-i---shared-sanitization-and-rest-support)
    - [Problem](#problem-8)
    - [Fix](#fix-8)
    - [Files to modify](#files-to-modify-8)
    - [Acceptance criteria](#acceptance-criteria-8)
  - [Track P23-J - Documentation, Testing, and Rollout Verification](#track-p23-j---documentation-testing-and-rollout-verification)
    - [Problem](#problem-9)
    - [Fix](#fix-9)
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

Completed first extraction slice:

1. moved the gallery adapter selection block into a dedicated `GalleryAdapterSettingsSection` module
2. introduced a narrower gallery-focused update callback so gallery settings logic no longer depends directly on the full `SettingsPanel` implementation details
3. reduced inline adapter-selection and adapter-specific visibility logic inside `SettingsPanel`
4. corrected adapter-specific field visibility for per-breakpoint selections so compact-grid, justified, masonry, and shape controls reflect the active breakpoint adapters instead of only the legacy per-type pair
5. extracted the remaining layout-tab carousel, section sizing, and adapter sizing accordion items into a dedicated `GalleryLayoutDetailSections` module
6. validated the new `SettingsPanel` structure with a green production `build:wp` run and the existing focused `SettingsPanel` test suite
7. extracted viewport background and gallery label accordion items into a dedicated `GalleryPresentationSections` module so the layout tab now delegates most gallery-specific field blocks
8. revalidated the updated `SettingsPanel` composition with a green production `build:wp` run and the focused `SettingsPanel` test suite after recovering from an intermediate malformed panel edit during extraction

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

Remaining work in P23-C is to extend the schema beyond labels and breakpoint restrictions so it can own adapter-specific field groups and become the authoritative input for the future shared gallery config editor.

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