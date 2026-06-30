# Phase 59 - LayoutBuilder Text & Caption Layers

**Status:** A/B/C shipped 2026-06-30 · P59-D (text UX polish) planned
**Created:** 2026-06-26
**Last updated:** 2026-06-30

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P59-A | `text` layer type — schema, state CRUD, persistence | ✅ Done | Medium |
| P59-B | Text properties panel + on-canvas inline editing | ✅ Done | Medium |
| P59-C | Render path, i18n-aware output, a11y semantics, tests | ✅ Done | Medium |
| P59-D | Text authoring UX polish — intuitive typography/effect inputs | Planned | Medium |

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
- **Server-side persistence (PHP — completed post-QA).** P59-A's schema was frontend-only; manual QA surfaced that the PHP layout-template sanitizer (`wp-plugin/.../includes/class-wpsg-layout-templates.php`) **allowlists** fields and silently dropped `texts` on save (the "text slot removed on-save" bug). Fixed by adding a `texts` field to `build_template` + `sanitize_texts()` / `sanitize_text_typography()` (typography reuses the same allowed-props as the settings sanitizer; content via `sanitize_textarea_field`; colors via the CSS sanitizer), bumping PHP `SCHEMA_VERSION` 2→3, adding a `migrate_template` v2→v3 step (mirrors the TS), and regenerating text IDs on template duplicate. 48 PHP tests green. **Known follow-up:** the campaign export/import controller (a separate Phase-41 post-meta path) does not yet round-trip `texts`.
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

### Implementation notes (P59-B — landed 2026-06-30)

- **Typography reuse.** The panel embeds the shared `<TypographyEditor>` bound to `LayoutTextLayer.typography` (font picker incl. Google fonts + fallback chain, weight/style/transform/decoration, stroke/shadow/glow) — no bespoke font controls (see the P59-A typography-reuse note).
- **`TextPropertiesPanel.tsx`** (filename matches the pre-registered coverage exclusion): content (Textarea, commit-on-blur), semantic role (Select → h2/h3/p), alignment (SegmentedControl), `<TypographyEditor>`, position/size, rotation/opacity, z-order, name, remove. Routed in `LayoutBuilderPropertiesPanel` after the overlay branch.
- **Selection.** Mirrors the overlay model — a local `selectedTextId` in `BuilderDockContext`/`LayoutBuilderModal`, mutually exclusive with slot/overlay/background/mask (cleared at every selection site in `LayoutBuilderCanvasPanel`).
- **Canvas.** `LayoutCanvas` renders each text layer in an `Rnd` (drag/resize parity with overlays) with a selection outline; **double-click enters inline edit** (a fill `<textarea>`: Enter commits, Shift+Enter newline, Escape cancels, blur commits). A shared `TextLayerContent` renders the semantic element + typography and is reused by the P59-C gallery render; `textLayerTextStyle` also styles the inline editor.
- **Add + Layers panel.** An "Add text" toolbar button (`IconLetterT`) creates + selects a layer. Text layers are first-class in the unified layer list: `buildLayerList` emits a `text` `LayerKind`; `LayerRow`/`LayerPanel` dispatch select/rename/visible/lock/delete + keyboard nav; z-order ops and `computeReorderedZIndices` include texts.
- **Admin i18n note.** Panel labels are hardcoded English, consistent with every sibling builder panel (Slot/Graphic/Mask/Background); full admin-panel i18n is the deferred Phase 60-B follow-on (its Decision B). Decision C's translatable-DOM requirement lands in the user-facing render (P59-C).
- **Tests.** `TextPropertiesPanel.test.tsx` (content/role/align/geometry/z-order/remove/rename + TypographyEditor wiring) and `layerList` text-kind coverage (kind, ordering, name fallback, reorder, back-compat). Typecheck clean; full builder + layerList suites green.

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

### Implementation notes (P59-C — landed 2026-06-30)

- **Render.** `LayoutBuilderGallery` renders `(template.texts ?? [])` in an absolutely-positioned loop mirroring the overlay loop, but reuses the shared `TextLayerContent` so the published output is the semantic element (h2/h3/p) carrying the layer's typography — identical to the builder canvas. Position/size (% → px), `zIndex`, `opacity`, and `rotation` are applied inline.
- **i18n (Decision C, resolved).** Text content is the layer's plain string rendered directly into the semantic element — the same surface media titles already use. It is therefore translatable by multilingual plugins (WPML/Polylang) and reachable, the real win over text baked into an uploaded image. No gettext-key indirection (the catalog is build-time/static).
- **a11y.** The text container is **not** `aria-hidden` (overlays are), so the content sits in the accessibility tree; the role→element map gives sensible heading/paragraph semantics. `pointer-events: none` keeps text non-interactive in v1 (clicks fall through to slots; no a11y impact) — the clickable CTA is the deferred follow-on. The Playwright a11y sweep needs a gallery fixture containing text layers to assert end-to-end; the semantic/reachable markup is unit-covered meanwhile.
- **Tests.** `TextLayerContent.test.tsx` covers the role→element mapping, reachability (`getByRole('heading')` succeeds ⇒ not aria-hidden), typography/alignment application, and the `textLayerStyle` helpers. The full-gallery component is coverage-excluded; integration is covered by `tsc -b` + the production build + manual QA.

## Track P59-D - Text authoring UX polish (intuitive typography & effect inputs)

**Added 2026-06-30 (post-ship, user direction).** A follow-on track to make the text-authoring
controls more intuitive and forgiving.

### Problem

The text-layer typography panel (P59-B) reuses the shared `<TypographyEditor>`, whose numeric
inputs (font size, letter/word spacing, glow/shadow blur & offsets, stroke width) are **free-text
fields where the user must type the CSS unit themselves** (e.g. `10px`). This is a UX trap: a
unit-less value like `10` produces invalid CSS and the effect silently does nothing — surfaced
during P59 QA, where a glow appeared "broken" only because its spread/blur had no unit. More
broadly, the text-authoring affordances are functional but not as discoverable or forgiving as
professional design tools.

### Fix (direction — research-led)

- **Explore proven professional patterns first.** Survey how Figma, Webflow, Canva, and browser
  devtools handle numeric-with-unit inputs and typography/effect controls (scrubbable number
  fields, explicit unit selectors, sensible defaults, live previews) and adapt the best fit.
- **Concrete starting idea (user):** replace free-text unit entry with a **value field + a small
  right-oriented unit dropdown inside the input** (px / em / rem / %), so a bare number can never
  produce invalid CSS — the unit is always explicit and defaulted. Build it as a **shared control**
  so the settings `TypographyEditor` benefits too, not just text layers.
- Add forgiveness: coerce unit-less numeric input to a sensible default unit; surface a live
  preview of the effect so the result is visible while editing.

### Acceptance criteria

- A user cannot accidentally enter a unit-less value that silently breaks an effect.
- Numeric typography/effect inputs use the new value+unit control with a sensible default unit.
- The chosen approach is documented against the professional patterns it adapts.

### Validation

- `npm run test` for the new control's binding + unit behavior; manual QA authoring text + effects
  via the `see-wp` flow.

### Notes

- Effort/scope to be refined when the track is picked up — the research step gates the design.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Rich text (multi-style runs) | v1 is single-style per layer; mixed styling within one layer is a larger editor lift. |
| Text-on-path | Niche; depends on path tooling not yet present. |
| Bound / dynamic captions from media metadata | Useful but requires a binding model between layers and media fields. |

## Implementation Notes

- Record completed work at a high level as tracks land. Keep short and factual.

## Outcome

Shipped 2026-06-30 — a first-class **text layer** for the LayoutBuilder, across all three tracks.

- **What shipped.** A `text` layer type (`LayoutTextLayer`, `schemaVersion` 3) with full CRUD + undo/redo + autosave and back-compat (P59-A); an authoring UI — `TextPropertiesPanel` reusing the shared `<TypographyEditor>`, on-canvas drag/resize + double-click inline editing, an "Add text" button, and first-class layers-panel listing (P59-B); and a gallery render path emitting real, semantic, screen-reader-reachable, translatable DOM text (P59-C). A designer can now add editable, accessible, translatable text without an external image editor.
- **Key decision (course-correct).** Typography reuses the existing app-wide `TypographyOverride` + `<TypographyEditor>` + the extracted `typographyOverrideToStyle` converter rather than a bespoke set of flat fields — caught mid-phase and corrected in P59-A.
- **What was deferred.** A clickable/linking **CTA** text layer (href + accessible anchor) → recorded in [FUTURE_TASKS.md](FUTURE_TASKS.md). Full admin-panel i18n of the new builder labels rides with the [PHASE60_REPORT.md](PHASE60_REPORT.md) P60-B follow-on (Decision B; sibling panels are likewise hardcoded). Rich multi-style runs, text-on-path, and bound/dynamic captions remain Follow-On candidates.
- **What should happen next.** **P59-D** (text authoring UX polish — researched value+unit controls)
  was added post-ship as a follow-on track. The Phase 60-B i18n harvest should include the new admin
  strings when it lands; Pro-gating of text layers is noted for [PHASE61_REPORT.md](PHASE61_REPORT.md)
  (Decision D). A small a11y follow-up could add a text-layer fixture to `e2e/accessibility.spec.ts`
  for an end-to-end axe sweep. The campaign export/import path does not yet round-trip `texts`.
