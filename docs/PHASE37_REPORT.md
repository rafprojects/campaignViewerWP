# Phase 37 — Layout-Builder Listings & Carry-Forward Implementation Tracks

**Status:** Planned
**Created:** 2026-05-30
**Last updated:** 2026-05-30

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P37-LB | Layout-builder adapter for campaign listings (whole-card-per-slot) | Planned | L |
| P37-HA1 | Hero / Spotlight sizing controls | Planned | S |
| P37-LB1 | Layout Builder non-canvas theme propagation | Planned | M |
| P37-SE1 | Shared searchable entity input adoption | Planned · blocked on P36-B stabilization | M |
| P37-KS1 | Legacy storage-key scoping audit and migration | Planned | M |

> **Note:** Phase 37 combines the promoted P36-X1 implementation track
> (`P37-LB`) with four direct carry-forwards from the P36 Related Planning
> section (`P37-HA1`, `P37-LB1`, `P37-SE1`, `P37-KS1`).
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

Phase 37 therefore groups five implementation tracks:

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

`P37-LB` remains the largest track and the architectural anchor. `P37-HA1`,
`P37-LB1`, and `P37-KS1` are independent carry-forwards that can proceed in
parallel. `P37-SE1` is intentionally gated on accepted P36-B corrections so the
new primitive is not extracted from a still-unsettled company-entry surface.

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

### Status: Planned

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

### Status: Planned

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

### Status: Planned · blocked on accepted P36-B corrections

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
- `src/components/Auth/AuthBarFloating.tsx`
- `src/hooks/useReloadSafeView.ts`
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

### Status: Planned

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
- Deferred to P38+:
  - **X2-experimental** — shape-adapter thumbnail-only prototype (not recommended;
    requires explicit product leadership initiation).
  - **LB-section** — slot-to-card-section composition (R&D track; not scheduled).
