# Phase 59 - LayoutBuilder Text & Caption Layers

**Status:** A/B/C/D/E/F shipped 2026-07-01 (E opened by PR review, F user-directed)
**Created:** 2026-06-26
**Last updated:** 2026-07-01

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P59-A | `text` layer type — schema, state CRUD, persistence | ✅ Done | Medium |
| P59-B | Text properties panel + on-canvas inline editing | ✅ Done | Medium |
| P59-C | Render path, i18n-aware output, a11y semantics, tests | ✅ Done | Medium |
| P59-D | Text authoring UX polish — intuitive typography/effect inputs | ✅ Done | Medium |
| P59-E | `duplicate()` id-remap for groups & per-breakpoint overrides | ✅ Done | Medium |
| P59-F | Discoverable persistent-guide removal | ✅ Done | Small |

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

### Implementation notes (P59-D — landed 2026-07-01)

- **Patterns adapted.** Figma/Webflow-style value+unit editing (a `NumberInput` with the unit
  chooser embedded in the field's own right edge, not a separate boxed dropdown) plus
  click-drag-to-scrub on the label — the same interaction devtools/Figma/Webflow number fields
  use so a mouse drag adjusts the value without needing to click into the field.
- **`parseCss()`** added to `packages/shared-utils/src/cssUnits.ts` alongside the existing
  `toCss`/`toCssOrUndefined`/`toCssOrNumber` helpers — parses a CSS string (`'28px'`) into
  `{value, unit}`, coercing unit-less legacy values (`'10'`) to a default unit rather than
  failing, and returning `undefined` for empty/invalid input. Also added `CSS_TRACKING_UNITS`
  (`px`/`em`/`rem` — no `%`, which isn't valid for letter-spacing/word-spacing/stroke-width/shadow
  offsets & blur in CSS).
- **Shared interaction layer, not a one-off.** Rather than build a typography-only control, the
  `NumberInput` + unit selector + drag-scrub + per-unit clamping logic was extracted into a new
  low-level `UnitScrubField` (`src/components/Common/UnitScrubField.tsx`). Two thin adapters sit
  on top of it: `DimensionInput` (`src/components/Settings/DimensionInput.tsx`, refactored
  in-place — its public `value: number` + `unit: string` contract and existing
  `DimensionInput.test.tsx` suite are unchanged, so every existing Settings call site gained
  drag-to-scrub for free) and the new `CssValueInput` (`src/components/Common/CssValueInput.tsx`),
  which adapts `UnitScrubField` to `TypographyOverride`'s optional-CSS-string contract via
  `parseCss`/`toCss`. This was a user-directed course-correct during planning — the storage
  contracts (`DimensionInput`'s split number+unit vs. `CssValueInput`'s single CSS string) are
  different and weren't unified, but the interaction layer is now genuinely shared. A
  `/future-task-it` entry (Code Quality & Refactoring, added 2026-06-30) tracks migrating the
  remaining ad hoc numeric input — the bespoke rotation-degree scrub in `SlotPropertiesPanel.tsx`
  — and auditing for other candidates, deferred out of this track.
- **Embedded unit selector, not a boxed dropdown.** First pass put the unit `Select` next to the
  `NumberInput` in a `Group` (mirroring the original `DimensionInput` layout), but manual QA
  showed a visible height mismatch — the `NumberInput` defaulted to Mantine's `sm` size while the
  adjacent `Select` was forced to `xs`, so the two boxes didn't align. Fixed by moving the unit
  `Select` into the `NumberInput`'s own `rightSection` (`variant="unstyled"`, a thin left border
  as a divider, height locked to 100% of the input) so value and unit render as one bordered box
  with the unit flush against the right edge and vertically centered by Mantine's own layout —
  matching the Elementor-style reference the user pointed to. Confirmed via the Mantine source
  (`NumberInput.mjs`) that a custom `rightSection` cleanly replaces the built-in stepper
  chevrons; that's an acceptable trade since drag-to-scrub now covers the same role.
- **Scrub discoverability.** Manual QA also surfaced that the drag-to-scrub label had no visual
  affordance — nothing signaled it was draggable. Added a small `IconArrowsHorizontal` (Tabler)
  next to every scrubbable label, always visible (not hover-only), matching how design tools
  typically hint a draggable numeric field.
- **jsdom test-infra additions.** jsdom has never implemented the `PointerEvent` constructor
  (`window.PointerEvent` is `undefined`) or `Element.setPointerCapture`/`releasePointerCapture`/
  `hasPointerCapture`, so `fireEvent.pointerDown/Move/Up` from `@testing-library/dom` silently
  fell back to a plain `Event` and dropped `clientX`/`buttons`/`pointerId` — scrub tests failed
  with zero calls until this was diagnosed. Polyfilled both (a thin `MouseEvent` subclass for
  `PointerEvent`, no-op stubs for capture) in `src/test/setup.ts`, following the same pattern
  already used there for `IntersectionObserver`/`ResizeObserver`/`scrollIntoView`/
  `URL.createObjectURL`. This also unblocks testing the deferred rotation-scrub migration.
- **Field tuning.** `fontSize` uses `CSS_SPACING_UNITS` (px/em/rem/%, matching real CSS
  font-size); the other seven (letter/word-spacing, stroke width, shadow offset X/Y, shadow blur,
  glow blur) use `CSS_TRACKING_UNITS`. Offsets and letter/word-spacing allow negative values
  (CSS permits negative tracking and shadow offsets); stroke width and blur values do not (CSS
  disallows a negative blur radius). `lineHeight` was left untouched — it's already a unitless
  `NumberInput` (a CSS multiplier), out of scope per this track's problem statement.
- **No schema/persistence changes.** `TypographyOverride`, the PHP sanitizer, and
  `migrateTemplate`/`schemaVersion` were untouched — this stayed a pure input-layer change, since
  `typographyOverrideToStyle()` already consumed complete CSS strings.
- **Tests.** `UnitScrubField.test.tsx` (render/label, unit dropdown, per-unit clamping, and new
  scrub coverage — drag increases/decreases value, respects `min`/`max`/`allowNegative`, stops on
  pointerup), `CssValueInput.test.tsx` (parse/serialize round-trip, clear → `undefined`, unit-less
  legacy coercion, unit re-serialization), plus `parseCss` unit tests in `cssUnits.test.ts`. The
  existing `DimensionInput.test.tsx` suite passes unmodified against the refactored adapter. Full
  `vitest run`: 3624/3624 passing; `tsc -b` clean. Manual QA via `see-wp`: authored a text layer,
  set a glow color + scrubbed the glow blur value, reloaded, and confirmed it persisted and
  rendered correctly in the gallery.

## Track P59-E - `duplicate()` id-remap for groups & per-breakpoint overrides

> Opened by the 2026-07-01 PR review (see **PR Review & Fixes** below). Sized as its own track
> because the fix is cross-cutting (touches P58-B and P30-G data) and out of scope for the
> text-layer work under review.

### Problem

`WPSG_Layout_Templates::duplicate()` regenerates fresh UUIDs for `slots`, `overlays`, and `texts`
so a copied template does not collide with its source. It does **not** remap the structures that
*reference* those ids:

- `groups[].memberIds` / `childGroupIds` / `parentGroupId` (P30-G) — nested-group membership.
- `breakpointOverrides[bp][slotId]` (P58-B) — the per-breakpoint override map is keyed by slot id.

Because these still point at the source's (now-stale) ids, duplicating a template that uses groups
or per-breakpoint overrides yields a copy whose groups are orphaned (members no longer resolve) and
whose per-breakpoint overrides are silently dropped on the client (the slot-id keys match nothing).
The source template is unaffected — this only degrades the *copy*. The gap became reachable once
`groups` and `breakpointOverrides` started round-tripping through the sanitizer in this branch.

### Fix

In `duplicate()`, build a single old→new id map while regenerating slot/overlay/text/group ids,
then rewrite every reference through it in one pass:

- Assign new ids to `slots`, `overlays`, `texts`, **and** `groups`, recording `old → new` in the map.
- Rewrite `groups[].memberIds`, `childGroupIds`, and `parentGroupId` through the map (leave unknown
  ids untouched rather than dropping them).
- Rekey `breakpointOverrides[bp]` from old slot id → new slot id.

### Acceptance criteria

- Duplicating a template with a group whose `memberIds` reference slots produces a copy whose group
  members resolve to the copy's regenerated slot ids.
- Duplicating a template with `breakpointOverrides` produces a copy whose overrides are keyed by the
  copy's regenerated slot ids and apply on the client.
- Existing `duplicate()` behavior for slots/overlays/texts is unchanged.

### Validation

- New `WPSG_Layout_Templates_Test.php` cases for group-reference and breakpoint-override remapping
  on duplicate; full PHPUnit suite green via `wp-env`.

### Implementation notes (P59-E — landed 2026-07-01)

- **Single old→new id map, two passes.** `duplicate()` (`class-wpsg-layout-templates.php`) now builds
  one flat `$id_map` while regenerating ids for `slots`, `overlays`, `texts`, **and** `groups` in a
  first pass (all four collections looped by a shared `foreach ( [...] as $collection )`), then a
  second pass rewrites every reference through the map. Group ids must be assigned *before* the
  rewrite pass because `childGroupIds` can point at a group that appears later in the array.
- **What the map actually needs vs. what it unions (verified, plan claim corrected).** The plan's
  premise that `memberIds` can reference overlay/text ids is **not** how selection works today: the
  multi-select `selectedSlotIds` set that feeds `createGroup()` holds **only slot ids** — overlays
  and texts use the mutually-exclusive single-selection `selectedOverlayId`/`selectedTextId` and are
  cleared via `clearSelection()` at every slot/marquee select site (`LayoutBuilderCanvasPanel.tsx`).
  So in practice `memberIds` references only slot ids and `childGroupIds`/`parentGroupId` only group
  ids; the *only* references that exist are slot→(group member / breakpoint key) and group→group.
  The map still unions all four collections anyway — it's harmless (all ids are UUIDs, no aliasing)
  and keeps the remap correct if member types ever broaden. This is the one plan claim that didn't
  survive verification; behaviour is unchanged either way.
- **Unknown ids are kept, not dropped.** `memberIds`/`childGroupIds`/`parentGroupId` and the
  `breakpointOverrides[bp]` keys are all rewritten via `$id_map[$id] ?? $id`, leaving ids absent from
  the map untouched (an already-orphaned reference in the source stays as-is rather than silently
  vanishing). This differs from the plan's "drop unmatched breakpoint-override keys" — kept uniform
  with the group handling instead, since the client resolves overrides by slot lookup so a stale key
  is simply never read, and a uniform "remap what you can, leave the rest" rule is simpler to reason
  about. Well-formed templates never hit this path (every reference resolves).
- **Remap runs before `self::create()`.** `create()`/`build_template()` only *sanitize* the data
  handed to them (`sanitize_groups` / `sanitize_breakpoint_overrides` / `sanitize_slots` etc. each
  preserve an incoming id, only generating a fresh UUID when one is absent) — they do no
  cross-reference remapping. So `duplicate()` resolves all references itself first; the regenerated
  ids then survive the re-sanitization unchanged. No schema, sanitizer, or `migrate_template` change
  was needed — this is a pure `duplicate()`-local fix.
- **Tests.** Added to the `// ── Duplicate ──` section of `WPSG_Layout_Templates_Test.php`:
  `test_duplicate_remaps_group_member_ids` (members resolve to the clone's regenerated slot ids),
  `test_duplicate_remaps_group_parent_and_child_ids` (parent/child links resolve to the clone's
  regenerated group ids), `test_duplicate_remaps_breakpoint_override_keys` (override map rekeyed to
  the clone's slot id, payload intact), and `test_duplicate_generates_new_overlay_and_text_ids`
  (locks the overlay/text id regeneration the refactor now shares). Existing duplicate tests
  (`…_generates_new_slot_ids`, etc.) pass unchanged.
- **QA.** Focused `WPSG_Layout_Templates_Test.php` via `wp-env`: **OK (53 tests, 198 assertions)**,
  exit 0 (49 → 53 with the four new cases). Full PHPUnit suite: **1072 tests, 13098 assertions, 2
  skipped** (the expected pre-existing skips), 0 failures/errors, exit 0.

## Track P59-F - Discoverable persistent-guide removal

> Opened 2026-07-01 (user-directed) — persistent guides (P57-E) can be added but the user found no
> apparent way to remove one.

### Problem

Investigation found this is only half true: `removeGuide(id)` already exists, is fully wired,
undo-aware, and tested (`useLayoutBuilderGuides.ts:25-32`), and is already triggered by
**double-clicking a guide line** on the canvas (`PersistentGuidesOverlay.tsx:109-112`, covered by
`PersistentGuidesOverlay.test.tsx:68`). The real gap is **discoverability** — nothing on the guide
(no icon, tooltip, or hint) signals that double-click deletes it, so in practice it cannot be found.
This is inconsistent with every other layer type (slots, overlays, text), which all have a visible
delete affordance (a Layers-panel trash icon and/or a keyboard shortcut).

### Fix

1. **Visible delete icon.** Add a second small hand-drawn SVG icon next to the existing lock icon in
   `PersistentGuidesOverlay.tsx` (this file renders inside an `<svg>`, so no Mantine `ActionIcon` —
   mirror the lock icon's existing raw-SVG-primitive style), `onClick` → `onRemoveGuide(guide.id)`,
   plus a native SVG `<title>` for a built-in hover tooltip. Keep double-click as a bonus shortcut.
2. **Select + Delete/Backspace.** Add `selectedGuideId` state to `LayoutBuilderModal.tsx` (mirrors
   `selectedTextId`/`selectedOverlayId`, mutually exclusive with them). Add click-vs-drag
   disambiguation to `startGuideDrag` (a mousedown-move threshold) since guides don't use
   `react-rnd` and have no existing click concept. Give the selected guide a distinct stroke. Wire
   Delete/Backspace to remove the selected guide via a new branch in `handleDeleteSelected`
   (verified that function today only handles `selectedSlotIds` — overlay/text deletion via
   Delete/Backspace is a separate pre-existing gap, not fixed by this track).
3. **"Clear guides" menu item.** Add `clearGuides()` to `useLayoutBuilderGuides.ts` as a single
   `mutate()` call (one undo step, not a loop over `removeGuide`), exposed through
   `useLayoutBuilderState.ts` and `BuilderDockContext.tsx`, and added to the existing **View →
   Canvas** menu section in `LayoutBuilderMenuBar.tsx` (next to "Reset layout") rather than a new
   toolbar button — keeps the toolbar uncluttered, matches this codebase's convention for
   infrequent canvas-scoped actions. No confirm dialog, consistent with the Edit-menu "Delete" and
   "Reset layout" precedent of relying on undo/redo instead of a modal.

### Acceptance criteria

- Every guide shows a discoverable way to delete it once selected (no reliance on knowing about
  double-click).
- A guide can be selected by click (not drag) and removed with Delete/Backspace, mirroring slot
  deletion.
- A "Clear guides" action exists in the View menu, is disabled when there are no guides, and removes
  all guides in a single undo step.
- Existing guide behavior (add, drag-to-move, lock/unlock) is unchanged.

### Validation

- `npm run test` for `PersistentGuidesOverlay.test.tsx` (delete icon, click-select, drag threshold),
  `useLayoutBuilderGuides.test.ts` (`clearGuides` single-undo-step), and the menu item's
  enabled/disabled state.
- Manual QA via `see-wp`: add several guides, delete one via the new icon, select+delete another via
  keyboard, confirm dragging is unaffected, then use "Clear guides" and confirm a single undo
  restores everything.

### Implementation notes (P59-F — landed 2026-07-01)

- **Manual QA course-corrects (user, live on `see-wp`).** The first pass shipped both icons
  always-visible, offset horizontally from the lock icon regardless of guide axis. Live QA on the
  actual dev site (not just jsdom) surfaced that this looked cluttered — a vertical guide's icon
  pair stuck out sideways, perpendicular to the line, and every guide showed icons all the time
  even when idle. Two fixes, both in `PersistentGuidesOverlay.tsx`:
  1. **Icons are selected-only.** The lock/delete icon pair now renders only when
     `guide.id === selectedGuideId` — an idle canvas with several guides shows only the lines (the
     locked/unlocked state itself stays visible via the dashed-vs-solid stroke regardless of
     selection, so no information is lost by hiding the icons). The first click on a guide selects
     it (revealing the icons); a second, deliberate click on an icon performs the action — this
     already fell out of the existing click-to-select wiring with no extra state needed.
  2. **Icons stack along the guide's own axis**, not always sideways: vertical guides stack the
     delete icon *below* the lock icon (same X, offset Y); horizontal guides stack it to the
     *right* (same Y, offset X, unchanged from the first pass). This hugs the guide's line instead
     of poking out perpendicular to it.
- **Double-click-to-delete removed (user decision, post-QA).** The original `onDoubleClick` handler
  on the hit-rect (inherited from P57-E, the guide's original and only removal path) was kept
  through the first P59-F pass as a "bonus shortcut." Manual QA raised a real conflict: now that a
  plain click selects a guide (a new, frequent interaction), two clicks in quick succession at the
  same spot — a routine byproduct of clicking to (re)select — fire the browser's native `dblclick`
  and would silently delete the guide with no confirm dialog, unlike before P59-F where a bare
  click was a no-op and accidental double-clicks were harmless. Discussed the tradeoff and agreed
  to remove the handler entirely: the delete icon and keyboard path both require a deliberate extra
  step and don't share this accidental-deletion risk, and double-click no longer fills a
  discoverability gap now that a real affordance exists. A regression test
  (`double-click on hit rect does not delete`) locks in the new behavior rather than just deleting
  the old coverage, to guard against reintroducing the footgun.
- **Selection independent of lock.** `removeGuide` has no lock check (deletion always worked on
  locked guides), so `onSelectGuide` fires on mousedown for locked guides too — otherwise a locked
  guide's delete icon/keyboard path would be unreachable. Locked guides just skip the drag-threshold
  logic entirely (mousedown selects immediately; nothing to distinguish from a drag since dragging
  is disallowed).
- **Mutual exclusivity.** `selectedGuideId` (new state in `LayoutBuilderModal.tsx`) is cleared at
  every other selection site across `LayoutBuilderCanvasPanel.tsx` and `LayoutBuilderLayersPanel.tsx`
  (slot/overlay/text/background/mask/group select, marquee select, canvas-click-to-deselect, grid
  generation), and selecting a guide clears the others — mirrors the existing
  `selectedOverlayId`/`selectedTextId`/`isBackgroundSelected` pattern exactly, just one more flag in
  the same already-established (if verbose) convention rather than a new selection model.
- **Known pre-existing gap, not fixed here.** `handleDeleteSelected` was already slot-only before
  this track — pressing Delete/Backspace on a selected overlay or text layer does nothing (they're
  only removable via the Layers-panel trash icon or their panel's Remove button). This track adds a
  guide-specific branch ahead of the slot branch rather than trying to unify with overlay/text,
  which is a separate, wider inconsistency out of scope here.
- **Tests.** `PersistentGuidesOverlay.test.tsx` grew to 17 cases: delete-icon click, click-vs-drag
  threshold (select vs. move), locked-guide immediate select, selected-guide stroke styling,
  icons-hidden-when-unselected, icons-shown-only-for-the-selected-guide (not leaking to others),
  axis-based stacking (vertical → same X/different Y, horizontal → same Y/different X), and the
  double-click-no-longer-deletes regression guard. `useLayoutBuilderGuides.test.ts` added
  `clearGuides` cases (empties in one call, single undo step restores all, no-op on an empty list).
  New `LayoutBuilderMenuBar.test.tsx` covers the "Clear guides" menu item's disabled/enabled state
  and click dispatch. Full `vitest run`: 3641/3641 passing; `tsc -b` clean.
- **No schema/persistence changes.** `PersistentGuide`, the PHP sanitizer, and
  `migrateTemplate`/`schemaVersion` were untouched — pure interaction-layer work on top of the
  already-existing P57-E data model and the already-wired `removeGuide` action.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Rich text (multi-style runs) | v1 is single-style per layer; mixed styling within one layer is a larger editor lift. |
| Text-on-path | Niche; depends on path tooling not yet present. |
| Bound / dynamic captions from media metadata | Useful but requires a binding model between layers and media fields. |

## Implementation Notes

- Record completed work at a high level as tracks land. Keep short and factual.

## Outcome

Shipped 2026-06-30 (A/B/C) and 2026-07-01 (D, E, F) — a first-class **text layer** for the LayoutBuilder, with intuitive, forgiving authoring controls, across all six tracks.

- **What shipped.** A `text` layer type (`LayoutTextLayer`, `schemaVersion` 3) with full CRUD + undo/redo + autosave and back-compat (P59-A); an authoring UI — `TextPropertiesPanel` reusing the shared `<TypographyEditor>`, on-canvas drag/resize + double-click inline editing, an "Add text" button, and first-class layers-panel listing (P59-B); a gallery render path emitting real, semantic, screen-reader-reachable, translatable DOM text (P59-C); and a value+unit + drag-to-scrub control (`UnitScrubField`, with `DimensionInput`/`CssValueInput` adapters) replacing the free-text CSS-unit fields across `<TypographyEditor>`'s typography/effect inputs, so a bare unit-less number can no longer silently produce invalid CSS (P59-D). A designer can now add editable, accessible, translatable text — with forgiving, professional-tool-style controls — without an external image editor. A post-review follow-up (P59-E) then closed a pre-existing `duplicate()` gap: copying a template now regenerates layer ids *and* remaps everything that references them (group membership + per-breakpoint override keys), so duplicating a grouped or responsive layout no longer orphans its groups or drops its overrides. A user-directed follow-up (P59-F) made persistent-guide removal (P57-E) actually discoverable — a selection-gated delete icon, click-to-select + Delete/Backspace, and a "Clear guides" menu action — replacing an undiscoverable, ultimately-risky double-click-only delete path.
- **Key decisions (course-corrects).** Typography reuses the existing app-wide `TypographyOverride` + `<TypographyEditor>` + the extracted `typographyOverrideToStyle` converter rather than a bespoke set of flat fields — caught mid-phase and corrected in P59-A. In P59-D, the value+unit control was generalized into a shared `UnitScrubField` (rather than a typography-only component) after user direction during planning, and its unit selector was moved from a separate boxed `Select` into the `NumberInput`'s own `rightSection` after manual QA surfaced a height mismatch between the two — both caught and corrected mid-track. In P59-F, live manual QA on the actual dev site (not just jsdom) surfaced that always-visible, sideways-offset guide icons looked cluttered — fixed by gating icons behind selection and stacking them along the guide's own axis — and that surfaced a second issue: the legacy double-click-to-delete path (kept as a "bonus shortcut") now risked accidental deletion once plain click became a frequent select gesture, so it was removed entirely after discussion.
- **What was deferred.** A clickable/linking **CTA** text layer (href + accessible anchor) → recorded in [FUTURE_TASKS.md](FUTURE_TASKS.md). Full admin-panel i18n of the new builder labels rides with the [PHASE60_REPORT.md](PHASE60_REPORT.md) P60-B follow-on (Decision B; sibling panels are likewise hardcoded). Rich multi-style runs, text-on-path, and bound/dynamic captions remain Follow-On candidates. Migrating the remaining ad hoc numeric input (`SlotPropertiesPanel`'s rotation scrub) and auditing for other `UnitScrubField` rollout candidates is future-tasked (`FUTURE_TASKS.md`, Code Quality & Refactoring).
- **What should happen next.** The Phase 60-B i18n harvest should include the new admin
  strings when it lands; Pro-gating of text layers is noted for [PHASE61_REPORT.md](PHASE61_REPORT.md)
  (Decision D). A small a11y follow-up could add a text-layer fixture to `e2e/accessibility.spec.ts`
  for an end-to-end axe sweep. The campaign export/import path does not yet round-trip `texts`.

## PR Review & Fixes (2026-07-01)

A post-ship review pass over the whole phase-59 branch (`main...HEAD`, ~6k lines / 76 files).
There was no open GitHub PR, so this ran as a high-effort `/code-review` — four parallel
finder agents partitioned by risk area (PHP persistence/migration, TS state/hooks, TS
rendering/components, cleanup/altitude/conventions), with every candidate re-verified against
the code before acting. Six issues were accepted and fixed; the rest were rejected or deferred
with rationale below.

### Accepted & fixed

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | High | `reorderLayers` rebuilt the layer list including text layers and computed a z-index map spanning them, but only wrote the map back to `slots` and `overlays` — never `texts`. Any layer-panel drag left text layers with a stale z-index, silently corrupting text stacking order (and dragging a text row did nothing). | Apply the computed z-map to `d.texts` as well. |
| 2 | Med-High | `CssValueInput` dropped the clamp when switching to a smaller-range unit. `UnitScrubField` fired `onValueChange(clamped)` then `onUnitChange(newUnit)` as two separate callbacks; `CssValueInput` serialized the first with the *stale* old unit and the second re-serialized the *pre-clamp* value with the new unit, and the second `onChange` won — e.g. `400px` → `%` stored `400%` instead of the intended `100%`. (`DimensionInput` was unaffected: it stores value/unit as independent state fields.) | Extended `UnitScrubField.onUnitChange` to `(unit, clampedValue)` so `CssValueInput` composes one consistent `onChange`; `DimensionInput`'s passthrough is unchanged in behavior. |
| 3 | Low | `addOverlay`'s "max z-index" spanned only `slots` + `overlays`, so a new overlay could be placed *underneath* an existing high-z text layer (inconsistent with `addText`, which already included all three). | Include `texts` in the max-z computation. |
| 4 | Low | PHP `sanitize_texts` used `$t['id'] ?? wp_generate_uuid4()`, which keeps an explicit empty-string id (`??` only fires on `null`). Two text layers with blank ids would collide, breaking selection and React keys. | Fall back to a generated UUID on a blank *or* missing id. |
| 5 | Trivial | `SCHEMA_VERSION` docblock documented v2 but not the current v3. | Added the v3 (P59) line. |
| 6 | Trivial | A stray doubled `/**` opener above `containerWidthToBreakpoint` in `layoutSlotAssignment.ts`. | Removed the orphaned comment line. |

Regression tests were added for #1–#4: `useLayoutBuilderState.test.ts` (text z-index is renumbered
on reorder; a new overlay stacks above an existing text layer), `CssValueInput.test.tsx` /
`UnitScrubField.test.tsx` / `DimensionInput.test.tsx` (clamp persisted on unit switch; the new
two-arg `onUnitChange` contract), and `WPSG_Layout_Templates_Test.php` (blank text-layer ids get
distinct generated UUIDs).

### Rejected / deferred

- **Rejected — typography color stored as `''`.** Colors that fail the PHP color regex persist as
  an empty string rather than being dropped. No observable effect: `typographyOverrideToStyle`
  guards `if (override.color)`, so an empty string never reaches the rendered CSS. Not worth a
  behavior change.
- **Rejected — cleanup duplication.** A shared `maxLayerZIndex(template)` helper, a shared
  Google-font-load helper, and de-duplicating the text-layer positioned wrapper between the
  builder canvas and the published gallery are quality-only observations, not defects; noted for
  future-tasking rather than changed under this review.
- **Deferred → resolved in P59-E — `duplicate()` id remap was incomplete.** `duplicate()`
  regenerated `slots`/`overlays`/`texts` ids but did **not** remap `groups[].memberIds`/
  `childGroupIds`/`parentGroupId` (P30-G) or the `breakpointOverrides` slot-id keys (P58-B).
  Duplicating a template that uses groups or per-breakpoint overrides yielded a copy with orphaned
  group members / lost overrides (the original is unaffected). The correct fix is a cross-cutting
  old→new id-map touching P58-B and P30-G, with its own tests — outside the P59 text-layer scope
  under review, so it was promoted to its own track, **P59-E**, and shipped 2026-07-01 (see the
  P59-E implementation notes above).

### QA

- `tsc -b && vite build`: clean.
- `vitest run` (full): **3627/3627 passing** (the three `DimensionInput` tests that asserted the
  old single-arg `onUnitChange` were updated to the `(unit, clampedValue)` contract).
- PHPUnit via `wp-env` (full suite): **1068 tests, 13072 assertions, 2 skipped** (expected), exit 0;
  the focused `WPSG_Layout_Templates_Test.php` file passes at 49 tests / 172 assertions.
