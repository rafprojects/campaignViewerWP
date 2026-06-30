# Phase 59 - LayoutBuilder Text & Caption Layers

**Status:** In progress — P59-A landed
**Created:** 2026-06-26
**Last updated:** 2026-06-30

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P59-A | `text` layer type — schema, state CRUD, persistence | ✅ Done | Medium |
| P59-B | Text properties panel + on-canvas inline editing | Planned | Medium |
| P59-C | Render path, i18n-aware output, a11y semantics, tests | Planned | Medium |

---

## Rationale

LayoutBuilder layers are media/graphic/mask only — there are **no first-class text layers**. Captions, titles, and call-to-action text today require baking text into an uploaded image, which is non-editable, non-translatable, and inaccessible. This is the #3 user-prioritized LayoutBuilder gap from the Phase 54 review and was explicitly sized as its own phase.

1. **What triggered it.** [FUTURE_TASKS.md](FUTURE_TASKS.md) › Builder, "Text / Caption Layers" — a new layer type touching schema, a properties panel, the render path, persistence, and tests. Too large to ride inside [PHASE58_REPORT.md](PHASE58_REPORT.md).
2. **Why it belongs together.** The three tracks are one feature sliced by layer: data model first, then authoring UI, then rendering/accessibility. They share the new text-layer shape and cannot ship piecemeal.
3. **Success.** A designer can add a real text layer, style its typography, edit it inline on the canvas, and have it render as translatable, semantically correct, accessible text in the gallery — unlocking a major class of layouts without an external image editor.

> **Sequenced before release.** Land Phase 59 before [PHASE60_REPORT.md](PHASE60_REPORT.md) so any admin-facing strings introduced by the text-layer UI are covered by that phase's i18n harvest, and the new layer renders translatable from day one.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Own phase vs. a track in Phase 58 | **Own phase.** Matches the FUTURE_TASKS sizing (new layer type + panel + render + persistence + tests). Keeps Phase 58 focused on polish + responsive. (User direction, 2026-06-26.) |
| B | Text richness | **Single-style text per layer** for v1 (one font/size/weight/color/alignment per layer). Rich multi-style runs are a Follow-On. |
| C | Translatability | **i18n-aware rendering from the start** — text content flows through the same i18n surface as other user-facing strings; no baked, non-translatable copy. |
| D | Pro gating | Text layers are a **natural Pro-tier feature**; note the gating seam for [PHASE61_REPORT.md](PHASE61_REPORT.md) (gate at the layer's entry point), but do not gate in this phase. |

## Execution Priority

1. **P59-A (schema + state)** — nothing can be authored or rendered until the `text` layer type exists in the template and `useLayoutBuilderState` can CRUD it.
2. **P59-B (authoring UI)** — the properties panel and on-canvas inline edit depend on the schema from A.
3. **P59-C (render + i18n + a11y + tests)** — last; turns authored text into correct, accessible, translatable gallery output and locks behavior with tests.

---

## Track P59-A - `text` layer type (schema, state, persistence)

### Problem

The template schema models media slots, graphic overlays, and masks — there is no representation for text. Without a data model, there is nothing to author, persist, or render.

### Fix

- Introduce a `text` layer type alongside media/graphic/mask in the template schema and add CRUD actions (add/update/remove/reorder) in `useLayoutBuilderState.ts`, following the existing overlay/group sub-hook patterns.
- Define the text-layer shape: `content`, font family/size/weight/line-height/letter-spacing, color, alignment, `x`/`y`/`width`/`height`, `zIndex`, `rotation`, `opacity`, plus `visible`/`locked`/`name` for parity with other layers.
- Bump the template `schemaVersion` and ensure back-compat so existing templates (with no text layers) load unchanged.

### Acceptance criteria

- A text layer can be created, updated, reordered, and removed through `useLayoutBuilderState` actions.
- Text layers persist with the template and survive save/reload (including the local-draft autosave path).
- Templates saved before this change load without error and render identically.

### Validation

- `npm run test` for the new CRUD actions, default shape, and back-compat resolution.

### Implementation notes (P59-A — landed 2026-06-30)

- **Data model.** Added `LayoutTextLayer` (+ `LayoutTextSemanticTag`, `LayoutTextAlign`, `DEFAULT_TEXT_LAYER`) in `src/types/index.ts`, mirroring `LayoutGraphicLayer` for the shared geometry/layer fields, plus `content`, `semanticTag`, `textAlign`, and **`typography: TypographyOverride`** (see next bullet). New top-level `template.texts?: LayoutTextLayer[]`, parallel to `slots`/`overlays`.
- **Typography reuse (course-correct, 2026-06-30).** Initially added flat typography fields; on review, switched the layer to store the existing app-wide `TypographyOverride` shape instead of reinventing one. This lets P59-B drop in the canonical `<TypographyEditor>` (grouped System/Google font picker, `loadGoogleFont`, fallback chain, weight/style/transform/decoration + stroke/shadow/glow) and P59-C reuse the same override→CSS converter — extracted as the pure `typographyOverrideToStyle()` from `src/hooks/useTypographyStyle.ts` (single source of truth for both settings-driven and text-layer typography). `semanticTag` + `textAlign` stay as layer fields (box/role, not part of `TypographyOverride`).
- **i18n decision (Decision C → resolved).** `content` is stored as a **plain string** — no gettext-key indirection. The i18n catalog here is build-time/static (i18next + `window.__WPSG_I18N__`), so user-authored runtime text cannot be harvested into a `.pot`; the codebase already renders other user content (media titles) directly. Rendering text as real semantic DOM in P59-C is what makes it translatable (WPML/Polylang) and screen-reader reachable — the real win over text baked into an image. The Phase 60 harvest will cover only the **panel's developer-authored labels** introduced in P59-B.
- **Schema version.** Bumped `schemaVersion` 2 → 3. `migrateTemplate()` is now cumulative (v1→v2 `breakpointOverrides`, v2→v3 `texts: []`). Note: `migrateTemplate` is invoked only by tests today; production load paths rely on defensive defaults — so every consumer reads `texts ?? []` and writers lazily run `if (!d.texts) d.texts = []`.
- **State.** New `useLayoutBuilderText` sub-hook (mirrors `useLayoutBuilderOverlays`): `addText`/`removeText`/`updateText`/`moveText`/`resizeText` + `renameText`/`toggleTextVisible`/`toggleTextLocked`, all through the shared Immer `mutate()` so they inherit undo/redo, dirty tracking, and autosave. Wired into `useLayoutBuilderState`; z-order ops (`bringToFront`/`sendToBack`/`bringForward`/`sendBackward`) extended to include text layers.
- **Deferred to P59-B.** The layers-panel projection (`buildLayerList`/`computeReorderedZIndices` + a `text` `LayerKind`) is UI-layer work and rides with the panel/canvas track, not the data model.
- **Tests.** `useLayoutBuilderText.test.ts` (CRUD, z-order, undo, legacy pre-v3 back-compat, draft-autosave persistence) + updated `migrateTemplate`/`createEmptyTemplate` tests for v3. Full `vitest run` green (118 tests in the two hook files); `tsc -b` clean.

## Track P59-B - Text properties panel + on-canvas inline editing

### Problem

Even with a data model, there is no way to author text — no typography controls and no way to type directly on the canvas.

### Fix

- Add a new `TextLayerPropertiesPanel.tsx` (a sibling of the existing slot/graphic/mask property panels) with controls for content, font family/size/weight/line-height/letter-spacing, color, and alignment. Reuse the Phase 57 saved-swatch color store for the color control.
- Support drag/resize on the canvas with parity to other layers, plus double-click-to-edit inline text entry.

### Acceptance criteria

- Selecting a text layer shows the typography panel; changes apply live.
- A text layer can be dragged, resized, and rotated like other layers.
- Double-clicking a text layer enters inline edit mode; clicking away commits the text.
- The color control shares the saved-swatch history from Phase 57.

### Validation

- `npm run test` for the panel's control bindings and inline-edit commit/cancel; manual QA authoring a caption end-to-end via the `see-wp` flow.

## Track P59-C - Render path, i18n-aware output, a11y semantics, tests

### Problem

Authored text must render correctly in the gallery — and do so translatably and accessibly, not as a visually-styled `<div>` that screen readers and translators cannot reach.

### Fix

- Render text layers in `LayoutBuilderGallery.tsx` with semantic tags appropriate to their role (e.g. heading vs. caption vs. CTA) and correct `role`/`aria` attributes.
- Make text content **i18n-aware** so it is translatable through the same surface as other user-facing strings (coordinate with the [PHASE60_REPORT.md](PHASE60_REPORT.md) i18n harvest).
- Add unit tests covering schema resolution, the properties panel, and render output (including the a11y semantics).

### Acceptance criteria

- Text layers render at the correct position/typography in the gallery.
- Rendered text uses semantic, accessible markup (screen-reader reachable; sensible heading/caption roles).
- Text content is translatable (no hard-baked, untranslatable strings in the render path).

### Validation

- `npm run test` for render + a11y semantics; Playwright `e2e/accessibility.spec.ts` shows no new critical/serious violations; manual QA of a rendered gallery with text layers.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Rich text (multi-style runs) | v1 is single-style per layer; mixed styling within one layer is a larger editor lift. |
| Text-on-path | Niche; depends on path tooling not yet present. |
| Bound / dynamic captions from media metadata | Useful but requires a binding model between layers and media fields. |

## Implementation Notes

- Record completed work at a high level as tracks land. Keep short and factual.

## Outcome

_To be completed once the phase ships._

- What shipped.
- What was deferred.
- What should happen next.
