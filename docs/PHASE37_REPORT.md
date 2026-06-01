# Phase 37 — Layout-Builder Listings & Carry-Forward Implementation Tracks

**Status:** Planned
**Created:** 2026-05-30
**Last updated:** 2026-05-31 (P37-MT2 complete)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P37-LB | Layout-builder adapter for campaign listings (whole-card-per-slot) | Planned | L |
| P37-HA1 | Hero / Spotlight sizing controls | Complete | S |
| P37-LB1 | Layout Builder non-canvas theme propagation | Complete | M |
| P37-SE1 | Shared searchable entity input adoption | Complete | M |
| P37-KS1 | Legacy storage-key scoping audit and migration | Complete | M |
| P37-MT1 | Media tab usage-badge overlay cleanup | Complete | S |
| P37-MT2 | Media tab card-width stabilization | Complete | M |

> **Note:** Phase 37 combines the promoted P36-X1 implementation track
> (`P37-LB`) with four direct carry-forwards from the P36 Related Planning
> section (`P37-HA1`, `P37-LB1`, `P37-SE1`, `P37-KS1`).
>
> Two additional admin-media follow-ups (`P37-MT1`, `P37-MT2`) are added from
> the 2026-05-31 Admin Panel > Media review. `P37-MT2` is intentionally limited
> to bounded width stabilization inside the current Media tab layout. The full
> "decouple card widths from admin panel width" investigation and any resulting
> implementation are promoted into Phase 38 as a separate discovery-first pair
> of tracks (`P38-MA0`, `P38-MA1`).
>
> P36-X2 (shape adapters for listings) remains formally rejected. That
> determination is recorded in the Implementation Notes below; it is not a
> Phase 37 implementation track.
>
> Slot-to-card-section composition (the alternative X1 path) remains an R&D-only
> item with no scheduled implementation. `P37-SE1` should not begin until the
> P36-B company-entry implementation is corrected and accepted; the other
> Phase 37 tracks can proceed independently.

---

## Rationale

Phase 36 produced two different kinds of carry-forward work that now belong in
one implementation plan:

- **P36-X1 / P36-X2** closed the evaluation-only layout-adapter questions.
  `P37-LB` is the one promoted implementation track: the layout-builder can
  support listings via the whole-card-per-slot model. Shape adapters remain
  rejected.
- **Related Planning in P36** surfaced four bounded implementation items that
  were intentionally left out of P36 delivery: `HA1`, `LB1`, `SE1`, and `KS1`.
  Those items are implementation work, not open-ended placeholders, and they now
  need concrete track definitions in Phase 37.
- **Admin Panel > Media review (2026-05-31)** surfaced two bounded follow-ups:
  clean up the campaign-usage badge overlay (`MT1`) and stabilize grid/compact
  card widths against wider admin-panel containers (`MT2`) without prematurely
  expanding into a full responsive-layout refactor.

Phase 37 therefore groups seven implementation tracks:

1. **Layout-builder listing support (`P37-LB`)** — the main promoted track from
  P36-X1.
2. **Adapter sizing parity (`P37-HA1`)** — close the remaining Spotlight and
  Scroll Snap max-width control gap using the existing adapter-settings
  pipeline.
3. **Builder theme propagation (`P37-LB1`)** — remap non-canvas builder
  overlays and chrome to theme-derived tokens without reopening canvas-content
  rendering.
4. **Shared searchable entity input adoption (`P37-SE1`)** — extract a generic
  single-entity combobox from the P36-B company-entry work and validate it with
  one immediate reuse outside the campaign company flow.
5. **Legacy storage-key scoping audit (`P37-KS1`)** — finish the intentionally
  deferred admin/media/builder localStorage audit after P36-A.
6. **Media tab usage-badge cleanup (`P37-MT1`)** — move the campaign-usage
  badge out of the lower-left card overlay path so it stops competing with the
  media caption block.
7. **Media tab card-width stabilization (`P37-MT2`)** — keep the existing
  compact/small/medium/large card presets visually proportional as admin-panel
  width changes, using bounded width behavior rather than a full layout-system
  replacement.

`P37-LB` remains the largest track and the architectural anchor. `P37-HA1`,
`P37-LB1`, `P37-KS1`, `P37-MT1`, and `P37-MT2` are independent
carry-forwards/additions that can proceed in parallel. `P37-SE1` is
intentionally gated on accepted P36-B corrections so the new primitive is not
extracted from a still-unsettled company-entry surface.

`P37-MT2` is intentionally bounded. If product direction remains "make Media tab
card widths truly independent from admin panel width," that work is handled by
Phase 38's investigation-first track pair rather than by expanding `P37-MT2` in
place.

The Phase 35 host/adapter split is the implementation anchor:
- The host (`CardGallery`) owns item rendering, filters, modal state, and
  pagination.
- The adapter owns layout only.
- `CardGallery` passes `items`, `renderItem`, and `listingMode` to the adapter.

Layout-builder listing support must preserve this contract without exception.

---

## Track P37-LB — Layout-Builder Listings (whole-card-per-slot)

### Problem

The `layout-builder` adapter is not tagged `listing-compatible` in the adapter
registry. Its current rendering pipeline is built around media-slot semantics:
`GallerySlotView` renders positioned images/videos with lightbox, objectFit,
focal-point, shape clip-path, and hover effects. `assignMediaToSlots()` binds media
items to slots by media identity, not by list position.

Campaign listings use a different contract: the host supplies `renderItem`, which
returns a full `<CampaignCard />`. The adapter places items in a layout; it does
not know or care about card internals.

The P36-X1 evaluation confirmed that extending the layout-builder to support this
contract is feasible via a **whole-card-per-slot** model — each template slot
becomes a positioned container for one campaign card. The evaluation also identified
five constraints that the implementation must observe, and specified that builder
guardrails are required to prevent template authors from inadvertently misusing
image-level slot controls against campaign-card content.

### Goal

Make the layout-builder a first-class listing adapter: one campaign card per slot,
positioned by the authored template geometry, with pagination driven by slot count
and builder UX scoped to listing-safe controls.

### Phasing

The work is split into two passes so the rendering contract can be validated
before builder guardrails are added on top.

**Pass A — Rendering + registry** (ship first)

1. Add `listing-compatible` to the layout-builder entry in `adapterRegistry.ts`.
2. Add a listing-mode branch in `LayoutBuilderGallery`. When `listingMode` is true:
   - Accept `items` and `renderItem` from the host (same props as other listing
     adapters).
   - Render each slot as a positioned container for `renderItem(item[slotIndex])`.
   - Hide slots whose index exceeds the item count (partial fill → hidden, not
     placeholder).
   - Slot-level `clickAction` is ignored; `CampaignCard` owns CampaignViewer click.
3. Bypass `assignMediaToSlots()` in listing mode. Treat slots as **ordered
   containers**: slot 0 → item 0, slot 1 → item 1. No media-identity binding.
4. Wire `CardGalleryHostPagination` to derive page size from the template's slot
   count when the layout-builder adapter is active in listing mode.

**Pass B — Builder guardrails** (second pass within P37)

5. In `SlotPropertiesPanel`, when editing a template in listing mode, disable and
   hide the following image-level controls:
   - `objectFit` / `objectPosition` / focal point (CSS image properties; no direct
     image at the slot level in listing mode — the card manages its own thumbnail).
   - Clip-path shape selector (`hexagonal` / `diamond` / `circular`) — applying a
     shape clip to a slot container clips card text, badges, and the info panel,
     recreating the X2 failure modes within a single slot.
   - Slot click behavior (`lightbox` / `no-click`) — card owns the click; slot
     click settings have no effect in listing mode and should not be presented.
6. Add a listing-mode warning banner in `SlotPropertiesPanel` that reads:
   _"This template is used in listing mode. Container effects (tilt, border,
   overlay, blend) apply to the card wrapper. Image-specific controls are hidden."_
7. Add template validation: warn in the builder if a template's slot count exceeds
   a sensible listing page size (> 24 slots) or is unusually small (< 2 slots).

### Container-level controls remain available in listing mode

The following slot controls act on the `div` wrapping `<CampaignCard />`, not on
image content, and work correctly in listing mode without modification:

- Tilt / rotation transform
- Border and drop-shadow styling
- Background color of the slot container
- Blend mode on the container
- Overlay color or gradient (as a slot background effect — heavy overlays that
  obscure card text are a template-author choice, covered by the warning banner)
- Hover scale / shadow effects on the container
- Slot geometry: position, size, z-index (core value of the layout-builder)

These controls are not restricted. Authors can use tilt, overlay, and container
effects intentionally on listing templates.

### Key files

- `src/components/Galleries/Adapters/adapterRegistry.ts` — add `listing-compatible`
  flag to the layout-builder adapter entry.
- `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx` —
  listing-mode branch: `items` / `renderItem` props, ordered-container slot render,
  partial-fill hiding, click ownership.
- `src/utils/layoutSlotAssignment.ts` — ordered-container path that bypasses
  media-identity binding for listing mode.
- `src/components/CampaignGallery/CardGallery.tsx` — pass `items` / `renderItem` /
  `listingMode` through to the layout-builder adapter (already done for other
  listing adapters; verify or wire up).
- `src/components/CampaignGallery/CardGalleryHostPagination.tsx` — derive page size
  from template slot count when layout-builder is the active listing adapter.
- `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx` — Pass B: hide
  image-level controls in listing mode; render warning banner.
- `src/components/Admin/LayoutBuilder/LayoutBuilderGallery.tsx` (builder preview
  variant, if distinct from the public-facing component) — confirm listing-mode
  preview renders correctly.
- `docs/testing/QA_PLAN_LAYOUT_BUILDER.md` — extend with listing-mode QA scenarios.

### Pre-conditions

- Phase 35 listing-adapter pipeline is stable (✓ done).
- Phase 36 P36-X1 evaluation complete (✓ done — see `docs/PHASE36_X1_X2_EVALUATION.md`).

### Open follow-ups

- **Compact card baseline (P37-LB)** — the P36-X1 evaluation recommends a
  "compact or fixed-height card baseline" for predictable slot heights. Before Pass A
  lands, confirm: (1) whether `CampaignCard` already supports a compact or
  fixed-height variant; (2) if not, whether a `compact` prop or a CSS constraint on
  the slot container (e.g., `overflow: hidden` + fixed slot height) is sufficient for
  the first implementation. A free-form full-height card inside an arbitrarily sized
  slot is not the first version.
- **Template listing-mode flag (P37-LB)** — determine how the builder knows a given
  template is being used in listing mode, so Pass B guardrails activate at the right
  time. The host can pass `listingMode` at render time, but the builder's slot
  properties panel needs a signal too. Check whether a template-level
  `listingCompatible` flag should be stored on the template record itself, or whether
  the builder infers listing mode from the active adapter selection in the preview
  panel. The latter is simpler and sufficient if the preview adapter can be set to
  layout-builder-listing in the builder.

### Acceptance criteria

- `adapterRegistry` marks layout-builder as `listing-compatible`.
- `CardGallery` selects layout-builder as the active listing adapter when
  configured; campaign cards render inside slots at authored positions.
- Slot geometry (position, size, tilt, border, overlay, blend) applies to the
  card container.
- Partial fill (last page): slots beyond the item count are hidden, not rendered
  as placeholders.
- Card click opens `CampaignViewer`; slot `clickAction` has no effect in listing mode.
- Page size matches the template's slot count.
- Pass B: `objectFit` / `objectPosition` / focal point / clip-path shape / slot click
  behavior controls are hidden in the builder when in listing mode.
- Pass B: Listing-mode warning banner is visible in the slot properties panel.
- Pass B: Builder validation warns on slot count outside sensible range.
- Manual QA: responsive slot geometry verified across viewport sizes; lock /
  request-access states render correctly within slots; permission-gated cards
  correctly restricted.
- `QA_PLAN_LAYOUT_BUILDER.md` updated with listing-mode scenarios.

### Status: Planned

---

## Track P37-HA1 — Hero / Spotlight Sizing Controls

### Problem

`spotlight` and `scroll-snap` still lack max-width controls for their primary
hero/container surfaces. That leaves those layouts as the only remaining gap in
the width/dimension-control family: compact-grid, masonry, justified, and shape
adapters already expose width, column, or tile-size controls through the shared
adapter-settings pipeline.

### Goal

Add bounded sizing controls for Spotlight and Scroll Snap using the same
adapter-settings contract already used elsewhere in the gallery system.

### Implementation outline

1. Extend the existing `spotlight` and `scroll-snap` setting groups in
   `adapterRegistry.ts` with `spotlightHeroMaxWidth` and
   `scrollSnapMaxWidth` dimension controls plus unit keys.
2. Add the matching TypeScript settings fields, Zod schema entries, and PHP
   sanitizer mappings so the new settings stay parity-validated across the
   stack.
3. Apply the resolved max-width values in `SpotlightGallery.tsx` and
   `ScrollSnapGallery.tsx`, preserving current behavior when the new settings
   are unset.
4. Validate through the existing adapter-settings parity script plus responsive
   manual QA at mobile, tablet, and desktop widths.

### Key files

- `src/components/Galleries/Adapters/adapterRegistry.ts`
- `src/types/index.ts`
- `src/types/settingsSchemas.ts`
- `src/components/Galleries/Adapters/spotlight/SpotlightGallery.tsx`
- `src/components/Galleries/Adapters/scroll-snap/ScrollSnapGallery.tsx`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php`

### Acceptance criteria

- `spotlightHeroMaxWidth` and `scrollSnapMaxWidth` are available through the
  existing adapter settings UI and persist correctly.
- TypeScript, Zod, adapter metadata, and PHP sanitizer definitions remain in
  parity for the new settings.
- Spotlight and Scroll Snap respect the configured max-width values without
  overflow or layout regression.
- `scripts/validate-adapter-settings-parity.mjs` passes.
- Responsive manual QA confirms expected behavior at mobile, tablet, and
  desktop widths.

### Implementation Notes

- `spotlightHeroMaxWidth` / `spotlightHeroMaxWidthUnit` added to: `adapterRegistry.ts` (spotlight group), `GalleryBehaviorSettings`, `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`, `GalleryAdapterSettingsSchema`, and the PHP `$nested_adapter_field_map`.
- `scrollSnapMaxWidth` / `scrollSnapMaxWidthUnit` added to the same four layers for the scroll-snap group.
- Both adapters apply the configured max-width to their outer `Stack` shell via `marginInline: 'auto'` centering; a value of `0` (default) leaves current behavior unchanged.
- `toCss` import added to `ScrollSnapGallery.tsx` (previously only `toCssOrNumber` was imported).
- `scripts/validate-adapter-settings-parity.mjs` passes: all 86 registry keys present in the PHP map.
- TypeScript: no errors.

### Status: Complete

---

## Track P37-LB1 — Layout Builder Non-Canvas Theme Propagation

### Problem

The layout builder still hardcodes rgba and hex colors across its non-canvas UI
affordances: rulers, grid overlays, smart guides, measurement labels, slot
selection borders, empty-slot placeholders, and a few builder panel surfaces.
That breaks alignment with the theme system even though the rest of the app is
already theme-driven. Canvas content rendering is explicitly out of scope.

### Goal

Propagate the active theme into the layout builder's overlays and supporting UI
chrome so those surfaces respond to theme changes without altering canvas
content rendering semantics.

### Implementation outline

1. Derive a small builder color map from `ThemeContext` at the builder entry
   surface (`LayoutBuilderModal.tsx`) and thread it through builder context or
   focused props.
2. Replace hardcoded colors in `CanvasRulers.tsx`, `CanvasGrid.tsx`,
   `SmartGuides.tsx`, `MeasurementOverlay.tsx`, `LayoutSlotComponent.tsx`, and
   empty-slot placeholders with theme-derived tokens.
3. Align the remaining fixed-color builder chrome and panel surfaces to the
   same token map where those surfaces currently sit outside normal Mantine
   theming.
4. Validate live theme switching, light/dark contrast, and no regression to
   layout geometry, masks, or interactions.

### Key files

- `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx`
- `src/components/Admin/LayoutBuilder/CanvasRulers.tsx`
- `src/components/Admin/LayoutBuilder/CanvasGrid.tsx`
- `src/components/Admin/LayoutBuilder/SmartGuides.tsx`
- `src/components/Admin/LayoutBuilder/MeasurementOverlay.tsx`
- `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx`
- `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`

### Acceptance criteria

- Builder overlays and empty-slot affordances use theme-derived colors instead
  of hardcoded rgba/hex values.
- Switching themes while the builder is open updates the themed builder
  surfaces without a page reload.
- Light and dark themes both preserve contrast and readability for rulers,
  guides, and measurement labels.
- No regression is introduced to canvas positioning, clip-path behavior,
  masking, or slot interaction.
- Canvas content rendering remains explicitly out of scope and unchanged.

### Implementation Notes

- Created `src/hooks/useBuilderOverlayColors.ts` — a thin hook that calls `useTheme()` and returns a typed `BuilderOverlayColors` object with concrete color strings for both dark and light `colorScheme` values.
- Follow-up shell pass added `src/hooks/useBuilderShellColors.ts` plus local `--wpsg-builder-*` vars on `LayoutBuilderModal.tsx` so non-canvas builder chrome can use concrete theme-derived surface/border/text tokens without touching the actual canvas background.
- `CanvasRulers.tsx`: removed 4 module-level color constants (`RULER_BG`, `TICK_COLOR`, `LABEL_COLOR`, `SELECTION_COLOR`); replaced with `useBuilderOverlayColors()` call and token references.
- `CanvasGrid.tsx`: removed `MAJOR_STROKE` / `MINOR_STROKE` constants; replaced with `colors.gridMajor` / `colors.gridMinor` from the hook.
- `SmartGuides.tsx`: removed `EDGE_COLOR`, `CENTER_COLOR`, `SPACING_COLOR`; `guideColor()` now accepts the colors object as a second argument.
- `MeasurementOverlay.tsx`: removed `LINE_COLOR`, `LABEL_BG`, `LABEL_FG`; split the internal `MeasureLine` interface into `MeasureLineData` (data-only) and `MeasureLineProps` (extends data + `colors`) so `useMemo` can build lines without colors and the render step injects them.
- `LayoutSlotComponent.tsx`: replaced 3 hardcoded badge/tooltip background values (`rgba(0,0,0,0.6/0.65/0.82)`) with `overlayColors.slotBadgeBg`, `slotLockBg`, and `slotLiveInfoBg`.
- `LayoutBuilderModal.tsx` now passes Dockview a real custom `theme` whose `className` is `dockview-theme-wpsg`, replacing Dockview's default `themeAbyss` dark-blue chrome; `src/styles/builder.css` remaps Dockview's root `--dv-*` variables from the injected builder-shell vars on that actual theme root so the side-panel tabs, background strip, and separators use the active builder-shell colors.
- Final follow-up after visual QA: the last unthemed strip between the builder toolbar and the dock/canvas row was still coming from Dockview's default theme-selection path. Switching from `className`-only wiring to Dockview's explicit `theme` option closed that gap while keeping the canvas itself on the intentionally hardcoded dark-gray background.
- `LayoutBuilderLayersPanel.tsx`, `LayoutBuilderMediaPanel.tsx`, `LayoutBuilderPropertiesPanel.tsx`, `LayerPanel.tsx`, and the non-canvas footer bars in `LayoutBuilderCanvasPanel.tsx` now use the same builder-shell vars, keeping panel bodies and toolbar/footer surfaces aligned with the active theme while leaving the hardcoded dark canvas unchanged.
- Dark-scheme values in the hook match the previous hardcoded constants exactly, preserving all 309 existing builder tests (18 SmartGuides color assertions pass unchanged).
- TypeScript: no errors.
- Canvas content rendering (slot images, overlays, clip-paths, Mantine CSS vars already in use) was not touched.

### Status: Complete

---

## Track P37-SE1 — Shared Searchable Entity Input Adoption

### Problem

P36-B introduced a shared company-entry combobox, but that control is still
domain-specific and `AccessTab` continues to maintain a second custom Combobox
implementation for user search. The repo now has enough evidence that a generic
searchable/freeform single-entity input is worthwhile, but the P36-B company
entry surface still needs to be corrected before it becomes the abstraction
source.

### Goal

Extract a reusable searchable entity-input primitive and validate it with one
immediate reuse outside the campaign company flow.

### Implementation outline

1. Start only after the P36-B company-entry implementation is corrected and
   accepted (slug search, exhaustive company dataset handling, and the final
   company contract/cache behavior).
2. Extract a generic searchable/freeform single-entity input under
   `src/components/Common/`, leaving `CompanyCombobox` as a thin domain wrapper.
3. Replace the custom user-search combobox in `AccessTab.tsx` with the new
   primitive while preserving email/name search, admin badge rendering, and the
   numeric user-ID fallback.
4. Explicitly defer hierarchical category selectors, fixed-option selects, and
   broader tag/category adoption until a later track.

### Key files

- `src/components/Common/CompanyCombobox.tsx`
- `src/components/Common/`
- `src/components/Admin/AccessTab.tsx`
- `src/hooks/useAdminAccessState.ts`

### Acceptance criteria

- A generic searchable/freeform single-entity input exists under
  `src/components/Common/` with focused unit coverage for display resolution,
  search/filter behavior, freeform create affordance, and focus/blur lifecycle.
- `CompanyCombobox` remains compatible as a thin wrapper on top of the new
  primitive.
- `AccessTab` user search uses the new primitive without regressing current
  email/name search, admin badge display, or numeric user-ID fallback behavior.
- This track does not absorb hierarchical category selectors or reopen the
  P36-B company save/read contract.

### Implementation Notes

- `SearchableEntityInput` (`src/components/Common/SearchableEntityInput.tsx`) is the new generic primitive. It owns the Mantine combobox store, blur lifecycle (150ms dropdown-close delay, synchronous `onBlur` callback), and right-section logic (clear button / loader / search icon). Dropdown content is passed as `children` — consumers render their own `Combobox.Option` and `Combobox.Empty` elements, keeping domain logic out of the primitive.
- `CompanyCombobox` retains its existing public props API unchanged. Internally it delegates the combobox shell to `SearchableEntityInput`, passing filtered company options and the optional create entry as children. The slug-resolution blur handler fires via the `onBlur` prop.
- `AccessTab` user search replaces the inline 70-line Combobox block with `SearchableEntityInput`. The numeric user-ID fallback logic remains in `AccessTab`'s `onInputChange` handler (domain-specific). `userCombobox` store and `blurTimeoutRef` were removed from `useAdminAccessState` — they now live inside the primitive.
- `SearchableEntityInput.test.tsx` covers all four acceptance criteria areas: display resolution, search/filter behavior, freeform create affordance, and focus/blur lifecycle.
- `CompanyCombobox.test.tsx` regression: all 13 tests pass without modification (public API unchanged).
- `AccessTab.test.tsx` regression: one aria-label updated (`"Clear selected user"` → `"Clear selection"`) to match the primitive's generic label; all 15 tests pass.
- TypeScript: no errors.

### Status: Complete

---

## Track P37-KS1 — Legacy Storage-Key Scoping Audit & Migration

### Problem

P36-A intentionally scoped only the new reload-safe state slice. Several older
admin, media, and builder localStorage keys remain globally scoped even though
root identity and root-scoped helpers now exist. That leaves a residual
collision surface across multi-root pages and same-origin admin views.

### Goal

Complete the deferred storage-key audit, migrate the collision-prone key
families, and document which keys remain intentionally global.

### Implementation outline

1. Audit and classify the remaining keys after P36-A. Keep auth, theme, debug,
   and already-root-scoped or already-template-scoped keys unchanged.
2. `KS1-A`: migrate `wpsg_media_sortMode` to a root-scoped key family.
3. `KS1-B`: scope builder workspace keys such as `wpsg_builder_layout` and the
   builder snap/grid/ruler/measurement/preview preferences using template-aware
   or root-aware keys as appropriate.
4. `KS1-C`: confirm whether `wpsg-authbar-pos` is truly per-root or
   intentionally shared before migrating it.
5. Add one-time migration helpers that copy legacy values into the new key
   families and clean up the old keys only after successful migration.

### Key files

- `src/components/Admin/MediaTab.tsx`
- `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx`
- `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx`
- `src/components/Admin/LayoutBuilder/LayoutBuilderMediaPanel.tsx`
- `src/components/Admin/LayoutBuilder/LayoutBuilderLayersPanel.tsx`
- `src/contexts/RootIdContext.tsx`

### Acceptance criteria

- The remaining collision-prone admin/media/builder keys are classified and the
  migration plan explicitly excludes intentional globals.
- Multi-root and cross-page collisions are eliminated for the migrated key
  families.
- One-time migration preserves existing user preferences and cleans up legacy
  keys after successful copy.
- Builder workspace keys use the correct scope boundary (root-aware or
  template-aware) rather than one global namespace.
- Documentation clearly records which keys remain intentionally global after
  the audit.

### Implementation Notes

**KS1-C decision — `wpsg-authbar-pos` is intentionally global.** The floating
auth button overlays the entire page viewport, not a specific gallery surface.
On multi-root pages the auth bar position represents a single "where on screen
is my floating button" preference, and sharing it across roots is the correct
behavior. No migration applied; `AuthBarFloating.tsx` is unchanged.

**Migrated keys (KS1-A + KS1-B):**

| Old key (global) | New key (root-scoped) | Sub-track |
|---|---|---|
| `wpsg_media_sortMode` | `wpsg_media_sortMode_${rootId}` | KS1-A |
| `wpsg_builder_snap_mode` | `wpsg_builder_${rootId}_snap_mode` | KS1-B |
| `wpsg_builder_show_grid` | `wpsg_builder_${rootId}_show_grid` | KS1-B |
| `wpsg_builder_grid_size` | `wpsg_builder_${rootId}_grid_size` | KS1-B |
| `wpsg_builder_show_rulers` | `wpsg_builder_${rootId}_show_rulers` | KS1-B |
| `wpsg_builder_show_measurements` | `wpsg_builder_${rootId}_show_measurements` | KS1-B |
| `wpsg_builder_design_assets_open` | `wpsg_builder_${rootId}_design_assets_open` | KS1-B |
| `wpsg_builder_layout` | `wpsg_builder_${rootId}_layout` | KS1-B |
| `wpsg_builder_preview_preset` | `wpsg_builder_${rootId}_preview_preset` | KS1-B |
| `wpsg_builder_custom_preview_width` | `wpsg_builder_${rootId}_custom_preview_width` | KS1-B |
| `wpsg_builder_show_preview_frame` | `wpsg_builder_${rootId}_show_preview_frame` | KS1-B |

Note: three of the KS1-B builder keys (`preview_preset`, `custom_preview_width`,
`show_preview_frame`) live in `LayoutBuilderCanvasPanel.tsx` and were not listed
in the original track outline; they belong to the same global-workspace-pref
family and were migrated in the same pass. `wpsg_builder_design_assets_open` is
written from three files (Modal, MediaPanel, LayersPanel); all three sites were
updated.

**One-time migration helpers follow the AdminPanel.tsx precedent** (P36-A):
read legacy value → write to new scoped key → delete legacy key, batched in a
single `useEffect` with `[]` dependencies so it runs once on first mount.

**Confirmed intentionally global keys (no migration):**

| Key | Rationale |
|---|---|
| `wpsg-authbar-pos` | Page-level floating button position (KS1-C) |
| `wpsg-theme-id` | User theme preference shared across all gallery instances |
| `wpsg-recent-fonts` | Cross-context font history |
| `wpsg_access_mode` | Global viewer lock/hide mode |
| `wpsg_debug` | Debug flag |
| `wpsg_access_token`, `wpsg_user`, `wpsg_permissions` | Auth identity (single per origin) |

**Already correctly scoped (no change needed):**
- `wpsg_view_${rootId}_*` — established by P36-A ✓
- `wpsg_settings_draft_${rootId}` — P36-A ✓
- `wpsg_media_viewMode_${campaignId}`, `cardSize`, `listPage`, `orphanFilter` — campaign-scoped ✓
- `wpsg_layout_draft_${templateId}` — template-scoped ✓
- `wpsg_layout_builder_campaign_${templateId}` — template-scoped ✓

### Status: Complete

---

## Track P37-MT1 — Media Tab Usage-Badge Overlay Cleanup

### Problem

In the Media tab grid and compact views, the campaign-usage chip is rendered as
a separate absolute overlay in `MediaTab.tsx`, pinned to the lower-left corner
of the card wrapper. That placement competes with the caption/details area and
is the direct cause of the reported overlap with the media name.

`MediaCard.tsx` already owns a top-left overlay cluster for media-type and
source badges. The usage badge currently bypasses that composition path, so the
card ends up with two unrelated overlay systems.

### Goal

Render the campaign-usage badge in the upper-left overlay area for grid and
compact cards so it no longer obscures the media name, while preserving current
list-view behavior and the existing usage popover interaction.

### Implementation outline

1. Remove the lower-left absolute usage-badge overlay from the grid/compact
   render path in `src/components/Admin/MediaTab.tsx`.
2. Re-anchor the usage badge to the top-left overlay system already owned by
   `src/components/Admin/MediaCard.tsx`, either by extending the existing badge
   stack or by adding a small dedicated top-left secondary slot that shares the
   same preview-overlay coordinate system.
3. Keep the list-view usage column unchanged; this track is about the card
   overlay only.
4. Verify the top-left composition wraps or stacks cleanly in compact/small
   card modes and does not collide with drag handles or action controls.

### Key files

- `src/components/Admin/MediaTab.tsx`
- `src/components/Admin/MediaCard.tsx`
- `src/components/Admin/MediaCard.module.scss`
- `src/components/Admin/MediaUsageBadge.tsx`
- `src/components/Admin/MediaTab.test.tsx`
- `src/components/Admin/MediaCard.test.tsx`
- `src/components/Admin/MediaUsageBadge.test.tsx`

### Pre-conditions

- The current `MediaUsageBadge` popover and accessible-label behavior remain the
  source of truth (✓ done).
- List-view usage rendering remains a separate column and should not be folded
  into the card-overlay change.

### Open follow-ups

- **Compact badge density** — if the top-left cluster becomes too dense on the
  smallest cards, prefer stacking or wrapping within the existing overlay area
  rather than reintroducing a second lower-left overlay system.

### Acceptance criteria

- In grid and compact views, the usage badge no longer renders in the lower-left
  overlay position.
- In grid and compact views, the usage badge renders in the upper-left overlay
  area and no longer covers the media caption/name block.
- List view still renders the usage badge in the dedicated Usage column.
- Clicking the usage badge still opens the existing popover and retains its
  accessible label semantics.
- Compact/small cards still show a readable badge composition without
  badge/control overlap.

### Implementation Notes

- `src/components/Admin/MediaCard.tsx` now owns a small top-left overlay stack
  instead of a single non-interactive badge row. The existing media-type/source
  badges remain non-interactive, while an optional `overlayBadge` slot renders
  below them for interactive overlay content.
- `src/components/Admin/MediaCard.module.scss` now splits the overlay into a
  pointer-events-disabled metadata layer and a pointer-events-enabled
  `interactiveOverlay` row so the usage badge can be clicked without reopening
  the underlying image preview.
- `src/components/Admin/MediaTab.tsx` passes `MediaUsageBadge` into the new
  `overlayBadge` slot for grid/compact cards and removes the former
  lower-left absolute usage-badge wrapper.
- `src/components/Admin/MediaUsageBadge.tsx` accepts an optional `size` prop;
  the Media tab uses `xs` sizing in the card overlay while preserving the
  existing default behavior elsewhere.
- Tests added/updated:
  - `MediaCard.test.tsx` covers custom overlay rendering and verifies clicking
    the interactive overlay does not trigger image preview.
  - `MediaTab.test.tsx` verifies the usage badge renders inside the card overlay
    path in grid view and the old bottom-left wrapper is gone.
  - Focused validation passed: `MediaCard.test.tsx`, `MediaUsageBadge.test.tsx`,
    and `MediaTab.test.tsx`.

### Status: Complete

---

## Track P37-MT2 — Media Tab Card-Width Stabilization

### Problem

`MediaTab.tsx` sizes cards entirely through fixed Mantine `Grid.Col` span
presets. Card width therefore remains a direct function of the admin panel
container width. After the addition of the admin-panel max-width control, wider
admin-panel values make the current grid and compact cards balloon horizontally
and look out of proportion.

The current Media tab already distinguishes card sizes (`small`, `medium`,
`large`, plus compact view), but those presets only change spans and heights.
There is no absolute per-size width guard.

### Goal

Keep Media tab cards visually proportional as admin-panel width changes by
adding bounded per-size width behavior for grid and compact cards, without
turning this track into a full responsive-layout refactor.

### Implementation outline

1. Define bounded target/max widths for the existing admin Media tab size
   presets (`compact`, `small`, `medium`, `large`) so each preset keeps a stable
   visual scale even when the admin panel is much wider.
2. Reuse the fixed-width card pattern already proven in
   `src/components/CampaignGallery/CardGallery.tsx` and
  `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx` by
  adapting the width-capping strategy into a small Media-tab-specific layout
  helper rather than copying the listing-grid math verbatim.
3. Apply the width cap through a centered row-level shell around the existing
  Mantine `Grid` in `src/components/Admin/MediaTab.tsx`, keeping the current
  card-size selector semantics, drag-and-drop, and list view intact. Use an
  inner per-card cap only if the row-level shell proves insufficient in QA.
4. Keep this first pass front-end only. Do not add a new advanced setting unless
  post-QA tuning shows the automatic caps are insufficient.
5. If cap-based stabilization leaves unacceptable wide-column whitespace or
  still fails proportionality goals, promote the full decoupling work tracked
  in Phase 38 rather than widening this item in place.

### Key files

- `src/components/Admin/MediaTab.tsx`
- `src/components/Admin/mediaTabLayout.ts`
- `src/components/Admin/MediaTab.module.scss`
- `src/components/CampaignGallery/CardGallery.tsx`
- `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx`
- `src/components/Admin/MediaTab.test.tsx`

### Pre-conditions

- Current Media tab grid/list/compact interactions are stable enough to treat
  width work as a presentation-layer change.
- `P37-MT1` is independent and may land before or after this track.

### Open follow-ups

- **Manual tuning request** — if operators still need an explicit override after
  the automatic-cap pass, add a separate settings-oriented follow-up modeled on
  the Phase 36 admin-width work rather than widening `P37-MT2` mid-flight.
- **True decoupling requirement** — if the product requirement remains "card
  widths are computed from the Media tab container, not inherited from admin
  panel width," proceed through `docs/PHASE38_REPORT.md` (`P38-MA0`,
  `P38-MA1`) instead of stretching this Phase 37 track.

### Acceptance criteria

- Increasing admin-panel width no longer causes grid/compact cards to stretch to
  visually oversized widths.
- The existing card-size presets remain visibly distinct and proportional to one
  another.
- Narrow admin-panel widths still degrade gracefully without overflow or broken
  drag/reorder behavior.
- Grid/compact card interactions (lightbox open, edit/delete, reorder
  affordances, usage popover) remain unchanged aside from the intended width
  behavior.
- Manual QA confirms acceptable layout at narrow/default/wide admin-panel widths
  for compact, small, medium, and large card modes.

### Implementation Notes

- `src/components/Admin/mediaTabLayout.ts` now owns the bounded-width policy for
  the Media tab: preset selection (`compact` is treated as a separate view mode,
  not a `cardSize` value), base/sm/md/lg span inheritance, derived column count,
  and responsive row-shell max-width variables.
- `src/components/Admin/MediaTab.tsx` now resolves one active preset for the
  current grid/compact view and applies a centered bounded-width shell around
  the existing Mantine `Grid` instead of relying only on unbounded `Grid.Col`
  spans.
- `src/components/Admin/MediaTab.module.scss` applies the responsive
  base/sm/md/lg width caps to that grid shell; list view remains outside this
  path.
- Post-implementation build follow-up: `CompactGridGallery` and `Lightbox`
  import paths were made consistent, `ErrorBoundary.tsx` moved Sentry capture to
  the same lazy import path used by monitoring init, and `vite.config.ts`
  vendor chunking was refined. `npm run build:wp` now completes without the
  earlier import-splitting warnings or chunk-size warnings.
- Focused validation passed: `npx vitest run src/components/Admin/mediaTabLayout.test.ts src/components/Admin/MediaTab.test.tsx`.
- Manual QA review judged the bounded row-cap pass acceptable for the current
  Phase 37 scope; the track is marked complete and any further decoupling work
  remains deferred to Phase 38.

### Status: Complete

---

## Implementation Notes

_Updated as tracks land._

### P36-X2 — Formally rejected; not a roadmap item

Hexagonal, diamond, and circular adapters are formally rejected for campaign listing
support. Evidence and reasoning are documented in `docs/PHASE36_X1_X2_EVALUATION.md`.

**Decision:** Do not promote to any Phase 38+ implementation track without an
explicit product leadership request that includes a scoped prototype budget and an
acknowledgment that the result will not meet full campaign-card parity (text
legibility, badge placement, request-access UI, rectangular focus/touch targets).

The thumbnail-only experimental fallback path identified in the evaluation is not
recommended roadmap work. It is documented as a fallback for product discussions
only.

### Slot-to-card-section composition — R&D only; not scheduled

This alternative X1 path (individual card sections as independently positioned
slots) is a separate authoring system requiring: a new slot content model, a section
registry, required/optional section rules, responsive composition rules, builder UX,
and a new test matrix. It is not a follow-on to P37-LB and should not be treated as
such. Reopen as a distinct discovery track if and when the product need arises.

### Open follow-ups

See the P37-LB track section above (compact card baseline; template listing-mode
flag). These are pre-implementation gates for Pass A and Pass B respectively.

---

## Outcome

_To be filled when Phase 37 is marked Complete._

---

## Related Planning

- Continues from: `docs/PHASE36_REPORT.md` (Reload-Safe State, Admin Convergence &
  Draft Permissions — in progress).
- Evaluation source: `docs/PHASE36_X1_X2_EVALUATION.md` (P36-X1 / P36-X2
  evaluation).
- Builds on: Phase 35 listing-adapter pipeline (`CardGallery.tsx` host,
  `CardGalleryHostPagination.tsx`, four listing-compatible adapters).
- Promoted into this phase from P36 Related Planning:
  - **P37-HA1** — Hero / Spotlight gallery sizing controls.
  - **P37-LB1** — Layout Builder non-canvas theme propagation.
  - **P37-SE1** — Shared searchable entity input adoption (blocked on accepted
    P36-B corrections).
  - **P37-KS1** — Legacy storage-key scoping audit and migration.
- Added in this phase from the 2026-05-31 Admin Panel > Media review:
  - **P37-MT1** — Media tab usage-badge overlay cleanup.
  - **P37-MT2** — Media tab card-width stabilization.
- Promoted into Phase 38:
  - **P38-MA0** — Admin Media responsive-grid investigation spike.
  - **P38-MA1** — Admin Media responsive-grid decoupling implementation (gated
    on accepted `P38-MA0` findings).
- Deferred to P38+ or later:
  - **X2-experimental** — shape-adapter thumbnail-only prototype (not recommended;
    requires explicit product leadership initiation).
  - **LB-section** — slot-to-card-section composition (R&D track; not scheduled).
