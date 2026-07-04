# Phase 58 - LayoutBuilder Enhancements

**Status:** Done
**Created:** 2026-06-26
**Last updated:** 2026-06-26

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P58-A | Editor UX Polish — real `Ctrl+C`/`Ctrl+V` clipboard + per-slot opacity + nudge steps (align/distribute hotkeys split to [FUTURE_TASKS.md](FUTURE_TASKS.md)) | Done | Small-Medium |
| P58-B | Responsive / per-breakpoint slot overrides (hide/move/resize per device) | Done | Medium-High |
| P58-C | Starter template library — already shipped (P15-J); enhanced with rotated/split presets + faithful previews | Done | Small |
| P58-D | Marquee multi-select on the canvas | Done | Small-Medium |
| P58-E | Slot entrance animations (scroll-reveal at gallery render) | Done | Medium |
| P58-F | Auto-grid slot generator | Done | Small-Medium |

---

## Rationale

The LayoutBuilder is mature — Phase 57 landed the last batch of design-tool affordances (saved swatches, eyedropper, layer search, persistent guides, slot rotation). What remains are the editor-parity gaps and net-new capabilities that turn it from "good" into a builder users would pay for.

1. **What triggered it.** Three items sat in [FUTURE_TASKS.md](FUTURE_TASKS.md) › Builder after Phase 54's production-readiness review (Editor UX Polish, per-breakpoint responsive, text/caption layers), and a planning pass (2026-06-26) surfaced four net-new additions worth scheduling now. Text/caption layers is large enough to own [PHASE59_REPORT.md](PHASE59_REPORT.md); the rest land here.
2. **Why it belongs together.** All six tracks extend the same surfaces — the `useLayoutBuilderState` schema, `LayoutCanvas`, and the `LayoutBuilderGallery` render path — on the cleaner base left by Phase 55's decomposition. Each is independently shippable and revertible.
3. **Success.** Designers get true clipboard + keyboard parity with Figma, per-device control over slots, a fast start from curated templates, rubber-band selection, on-scroll entrance motion, and one-click grid scaffolding — each usable on its own.

> **Builds on Phase 55 / 57.** Tracks that touch the template/slot schema (B, E) extend the decomposed `useLayoutBuilderState.ts` and `LayoutBuilderGallery.tsx`. Sequence them after the lower-risk UI-only tracks.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Phase scope | **All four net-new additions in (C/D/E/F)** plus the remaining Editor UX Polish + responsive items. (User direction, 2026-06-26.) Text/caption layers split to [PHASE59_REPORT.md](PHASE59_REPORT.md). |
| B | Zoom/pan | **Excluded — already shipped.** `react-zoom-pan-pinch` drives canvas zoom/pan in `LayoutBuilderCanvasPanel.tsx` (keys `0`/`+`/`-`); not re-scoped here. |
| C | Small polish items | **Per-slot opacity and Shift+arrow large-nudge folded into P58-A** rather than their own tracks — both are one-field/one-handler changes. |
| D | Responsive sizing | **P58-B kept in this phase but flagged as the heavyweight;** if its schema/resolution work grows, split it to its own phase rather than bloating Phase 58. |
| E | Pro gating | Per-breakpoint responsive (P58-B) and the starter library (P58-C) are **natural Pro-tier features** — note the gating seam for [PHASE62_REPORT.md](PHASE62_REPORT.md) but do not gate here. |

## Execution Priority

1. **P58-A (Editor UX Polish)** — UI-only, finishes existing patterns, no schema change; lands first for immediate perceived polish.
2. **P58-D (Marquee select)** and **P58-F (Auto-grid)** — canvas/state interactions, no persisted-schema change; low risk.
3. **P58-C (Starter library)** — reuses the JSON import path; net-new data + a picker, no slot-schema change.
4. **P58-E (Entrance animations)** — adds one slot field + a render-path reveal; isolated.
5. **P58-B (Responsive)** — last; the only track that adds a per-breakpoint override layer to the template schema and carries the most risk/back-compat surface.

---

## Track P58-A - Editor UX Polish

### Problem

Two editor affordances stop short of design-tool parity. True clipboard **copy/paste** is a no-op — `Ctrl+C` does nothing and copy is effectively routed through `Ctrl+D` duplicate. Alignment/distribute exist only as Layers-panel buttons with **no keyboard shortcuts** (unlike Figma). Two smaller parity gaps ride along: slots have no render **opacity** (overlays do — `LayoutGraphicLayer.opacity`, `src/types/index.ts:404`), and arrow-key nudge has no large-step (Shift) modifier.

### Fix

- Add a real in-memory clipboard buffer in `useLayoutBuilderState.ts`: `Ctrl+C` captures the selected slots, `Ctrl+V` pastes with a small position offset to avoid exact overlap (cross-template paste optional). Wire it through `useLayoutBuilderKeyboardHandlers.ts`.
- Bind keyboard shortcuts for the existing align/distribute actions exposed by `LayoutBuilderLayersPanel.tsx` / `BuilderDockContext`.
- Add `opacity?: number` (0–1, default 1) to `LayoutSlot` (`src/types/index.ts`), mirroring `LayoutGraphicLayer.opacity`; render it in `LayoutSlotComponent.tsx` and expose a control in `SlotPropertiesPanel.tsx`.
- Add a Shift+arrow large-nudge step in `useLayoutBuilderKeyboardHandlers.ts`.
- Update `BuilderKeyboardShortcutsModal.tsx` with the new bindings.

### Acceptance criteria

- `Ctrl+C` then `Ctrl+V` creates an offset copy of the selected slot(s); the original is untouched.
- Align and distribute actions are invokable from the keyboard and match the Layers-panel buttons.
- A slot's opacity is editable and renders in both the builder and the gallery output.
- Shift+arrow moves the selection in a larger step than a plain arrow.
- The keyboard-shortcuts modal lists every new binding.

### Validation

- `npm run test` for the clipboard buffer, opacity field default/merge, and the keyboard handler; manual QA of copy/paste, align/distribute hotkeys, opacity, and Shift-nudge via the `see-wp` flow.

### Implementation notes (2026-06-26)

Shipped: real clipboard, per-slot opacity, and the three-tier nudge. **Align/distribute keyboard shortcuts were split off** to [FUTURE_TASKS.md](FUTURE_TASKS.md) › Builder (binding scheme needs design — user direction); the rest landed.

- **Clipboard** — `copySlots`/`pasteSlots` in `useLayoutBuilderState.ts`, backed by per-hook-instance `useRef`s (`clipboardRef`, `pasteCountRef`) so the buffer never leaks across builders; wired to `Ctrl+C`/`Ctrl+V` in `useLayoutBuilderKeyboardHandlers.ts` (gated on `!isPreview`). Copy deep-clones via `structuredClone` (captures nested `maskLayer`/`filterEffects`/`shadow`/`tilt`/`overlayEffect`); paste offsets `+3%` cumulatively per repeat and selects the new slots as one undo entry.
  - **Gotcha:** `mutate()` runs its recipe inside a deferred functional updater (`setTemplateRaw((prev) => produce(prev, recipe))`), so IDs generated *inside* the recipe aren't visible to the synchronous `setSelectedSlotIds` that follows. `pasteSlots` pre-builds clones + IDs *before* `mutate` (mirroring `addSlot`). Caught by a test asserting paste selects the new slots.
  - **Pre-existing bug noticed (not fixed here):** `duplicateSlots` has the same shape — it populates `newIds` inside the recipe then guards `setSelectedSlotIds` on `newIds.length`, which is `0` synchronously, so Ctrl+D never updates the selection to the copy. Untested + out of P58-A scope; flagged for the user.
- **Slot opacity** — optional `LayoutSlot.opacity` (no `schemaVersion` bump; absence ⇒ 1). `Slider` in `SlotPropertiesPanel` (clears to `undefined` at 100%). Rendered via `slot.opacity ?? 1` in the builder preview wrappers, the edit-mode rotation-wrapper (keeps the selection ring + rotation handle crisp; badges inside fade with the media — acceptable), and the gallery `GallerySlotView` (clip + rect) plus the listing-mode container for parity.
- **Nudge** — `step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1` (Figma convention): plain `1%`, Shift `10%` (large), Alt `0.1%` (fine). Flips the prior Shift=fine behavior; shortcuts modal updated.
- **Verified:** 75/75 `useLayoutBuilderState` tests, `tsc -b`, and `eslint` all green.

## Track P58-B - Responsive / per-breakpoint slot overrides

### Problem

Device presets today are **preview-only** — you can view the canvas at desktop/tablet/mobile widths but cannot give a slot a different position, size, or visibility per breakpoint. This is a real gap versus Elementor/Figma responsive editing.

### Fix

- Add a per-breakpoint override layer to the slot model in `useLayoutBuilderState.ts`: a base layout plus optional `desktop`/`tablet`/`mobile` overrides (position, size, `visible`). Mirror the gallery config breakpoint model in `src/utils/galleryConfig.ts` for naming consistency.
- Resolve the active breakpoint's effective slot at render in `LayoutBuilderGallery.tsx`, and reflect the selected breakpoint while editing in `LayoutCanvas.tsx`.
- Bump the template `schemaVersion` and provide back-compat resolution so existing single-layout templates load unchanged.

### Acceptance criteria

- A slot can be hidden, moved, or resized for a specific breakpoint without affecting the others.
- The gallery renders the correct per-breakpoint layout at each device width.
- Editing a breakpoint clearly indicates which device is being edited.
- Templates saved before this change load and render identically (back-compat).

### Validation

- `npm run test` for schema resolution + back-compat; manual QA editing per-device overrides and confirming render at each width. Note in the doc if this track is split to its own phase.

### Implementation notes (2026-06-26)

**Shipped.** Per-breakpoint slot overrides landed in full across the schema, state, builder UI, and gallery render path.

**Schema** (`src/types/index.ts`): Added `SLOT_BREAKPOINT_OVERRIDE_KEYS` (`x`, `y`, `width`, `height`, `visible`, `rotation`, `opacity`, `zIndex`), `SlotBreakpointOverrides`, and `LayoutTemplate.breakpointOverrides?: Partial<Record<ResponsiveBreakpoint, Record<string, SlotBreakpointOverrides>>>`. Bumped `schemaVersion` from 1 → 2.

**Migration** (`src/hooks/useLayoutBuilderState.ts`): `migrateTemplate()` upgrades v1 → v2 (no data to transform; just initialises `breakpointOverrides: {}`). New state field `activeBreakpoint` (default `'desktop'`). New actions: `setActiveBreakpoint`, `setSlotBreakpointOverride`, `clearSlotBreakpointOverride`. `moveSlot`, `resizeSlot`, and `nudgeSlots` are now breakpoint-aware: in desktop mode they update the base slot; in tablet/mobile they write to `template.breakpointOverrides[bp][slotId]` instead.

**Resolver** (`src/utils/layoutSlotAssignment.ts`): `resolveSlotForBreakpoint(slot, template, bp)` merges base slot with the sparse per-breakpoint override. `containerWidthToBreakpoint(width)` maps px → `ResponsiveBreakpoint` using the existing Mantine thresholds (< 768 mobile, < 1200 tablet).

**Builder UI** (`src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx`): A **Breakpoint** `SegmentedControl` (Desktop/Tablet/Mobile) in the edit-mode footer sets `activeBreakpoint`. When a non-desktop breakpoint is selected, the canvas is constrained to the breakpoint's reference width (tablet = 768 px, mobile = 390 px) and a blue alert banner appears: "Editing [Tablet/Mobile] layout — moves and resizes apply to this breakpoint only."

**Canvas rendering** (`src/components/Admin/LayoutBuilder/LayoutCanvas.tsx`): Accepts `activeBreakpoint` prop. Computes `effectiveSlots` via `resolveSlotForBreakpoint` for all relevant computations (slot rendering, selection rect, snap guides, marquee hit-testing, multi-drag delta). Slots with `visible: false` in the active breakpoint are skipped.

**Gallery rendering** (`src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`): Derives `activeBreakpoint` from `containerWidth` (tracked by existing ResizeObserver). `slotPositionCss` now resolves each slot through `resolveSlotForBreakpoint` before computing pixel positions, handles `visible: false` with `display:none`, and includes `opacity` in the CSS. The JSX slot loop also applies the breakpoint override and skips hidden slots.

**Tests**: 24 new test cases across `useLayoutBuilderState.test.ts` (breakpoint move/resize/nudge/override CRUD, `migrateTemplate`, `setActiveBreakpoint`) and `layoutSlotAssignment.test.ts` (`resolveSlotForBreakpoint` with each overridable field, `containerWidthToBreakpoint` boundary conditions). All 516 layout-builder tests pass.

**Back-compat**: Templates without `breakpointOverrides` render identically — the resolver returns the base slot unchanged when no overrides exist.

### Post-ship fixes

Manual QA after the initial ship surfaced several issues and UX gaps, fixed across four follow-up rounds. The first two rounds are documented issue-by-issue in [PHASE58B_ISSUES.md](PHASE58B_ISSUES.md); rounds 3–4 are summarized here.

**Round 1 — 8 issues (2026-06-26).** See [PHASE58B_ISSUES.md](PHASE58B_ISSUES.md) B-1…B-8. Headline: **B-4 was a server-persistence bug** — the PHP allowlist in `class-wpsg-layout-templates.php` had drifted from the TS type and silently stripped `breakpointOverrides` (and, as a full TS↔PHP audit found, slot `opacity`, `entranceAnimation`, `groups`, and the P50-J overlay field set) on every save, so overrides never reached the gallery. All now persist behind `SCHEMA_VERSION = 2` with a round-trip regression test. Also: `updateSlot`/`toggleSlotVisible` made breakpoint-aware (B-1/B-2), rotation composes through hover via `--wpsg-slot-rot` (B-7), the slot-mismatch banner gated to `isAdmin` (B-8), Layout Builder re-enabled at mobile (B-5), a contextual campaign template picker (B-6), and the adapter-per-breakpoint "unblock + inherit" contract (B-3).

**Round 2 — 3 follow-ups (2026-06-28).** See [PHASE58B_ISSUES.md](PHASE58B_ISSUES.md) F-1…F-3. Restore the shared `activeCampaign` context on Edit-Campaign close (F-1); pass `layoutTemplates` to the in-app `UnifiedCampaignModal` so the picker appears in both edit paths (F-2); and resolve the gallery breakpoint from the authoritative `runtime.breakpoint` with a **responsive cascade** (mobile ← tablet ← desktop) in `resolveSlotForBreakpoint`, fixing the reversed/stuck-mobile layouts (F-3).

**Round 3 — Builder boundary guide (no-clip editing).** The breakpoint edit view originally *clipped* the canvas to the device width, hiding inherited slots positioned beyond that window and making them un-editable. Replaced the clip with a non-clipping model: edit mode shows the **full canvas** plus a centered, to-scale **device-width guide band** (390 mobile / 768 tablet) marking the breakpoint's visible area (`LayoutCanvas.tsx`). Added a breakpoint-aware `updateSlots` (so the align/distribute toolbar writes per-breakpoint overrides on tablet/mobile, not the base), a `fitRectsIntoBand` helper (`packages/shared-utils/src/alignSlots.ts`), and a **"Fit to viewport"** action that scales/centers the selection (or all slots) into the active breakpoint's band. *(This supersedes the "canvas is constrained to the breakpoint's reference width" behaviour described in the Builder-UI note above — the canvas is no longer clipped in edit mode.)*

**Round 4 — Publish at the actual breakpoint + toolbar polish (2026-06-29).** The published gallery rendered the canvas at its design width and **left-aligned the scroll**, so a phone showed the *left edge* of the desktop canvas instead of the centered band the editor designed. Now, at tablet/mobile the gallery renders **only the centered device-width band, scaled to fill the container** — matching the builder's guide exactly. Implemented via a new pure helper `computeBreakpointBand` (`packages/shared-utils/src/breakpointViewport.ts`): the canvas renders at its design size inside an `overflow:hidden` window and is cropped + `transform: scale()`'d to the band. Slots stay percentages of the design canvas (no coordinate remap), so builder and gallery share one coordinate basis. Model (user-confirmed): **scale-to-fill** + a **full-height vertical slice** of the design canvas (per-breakpoint canvas aspect is out of scope — see [FUTURE_TASKS.md](FUTURE_TASKS.md) › Builder "Published Responsive Canvas Sizing"). Also: **"Fit to viewport"** now shows on desktop too (labelled "Fit to canvas" — pulls stray slots back into bounds), and the redundant **"Add Slot"** footer button was removed (slots are added via the Layers panel and canvas double-click).

**Deferred from these rounds** (to [FUTURE_TASKS.md](FUTURE_TASKS.md) › Builder): a better published responsive sizing model (the on-page left/right constraint and progressive-shrink across breakpoints), and a faithful builder Preview (align the Preview render with the published breakpoint model and surface runtime effects — glow, bounce, entrance, tilt — in Preview).

## Track P58-C - Starter template library

### Problem

Every layout starts from a blank canvas. New users face a cold start with no examples to learn the model or move quickly.

### Fix

- Ship a curated set of starter `LayoutTemplate` presets (e.g. magazine, hero + grid, polaroid scatter, split feature) as JSON, reusing the existing import path in `useLayoutBuilderFileIO.ts`.
- Add a "New from template" picker on builder open that previews each preset (render thumbnails via `LayoutBuilderGallery.tsx`) and clones the chosen one into an editable canvas.
- Keep presets text-free until [PHASE59_REPORT.md](PHASE59_REPORT.md) lands text layers, so no baked-in copy needs translating.

### Acceptance criteria

- The picker shows each starter layout with a visual preview.
- Choosing a preset produces a fully editable, populated canvas (a clone — editing it never mutates the preset).
- Presets contain no baked text (i18n-safe).

### Validation

- `npm run test` for the clone-on-select path; manual QA picking each preset and editing the result.

### Implementation notes (2026-06-26)

**Already shipped.** The track's core was delivered in **P15-J.1/J.2**: a `PresetGalleryModal` "Start from Template" picker (wired into `LayoutTemplateList`, `handleCreateFromPreset`) with mini-canvas previews and clone-on-select over `LAYOUT_PRESETS` in `src/data/layoutPresets.ts`. All three P58-C acceptance criteria were already met — the picker shows visual previews, choosing a preset creates a fully editable new template (immer guarantees the module-constant presets are never mutated), and presets are image-only (i18n-safe). The doc's "blank-canvas cold start" premise was outdated.

**Enhancements added (per user direction to "also enhance C"):**
- Two new presets: **Polaroid Scatter** (scattered, rotated, white-bordered slots — the first preset to exercise the P57-F slot `rotation`) and **Split Feature** (feature + two stacked supports).
- `PresetPreview` now applies `rotation` and reflects a slot's border, so thumbnails render faithfully (previously axis-aligned rectangles only).
- `layoutPresets.test.ts` updated (14 presets; new names/slot-counts; a rotation-showcase assertion).

## Track P58-D - Marquee multi-select on the canvas

### Problem

There is no rubber-band selection. Selecting multiple slots requires shift-clicking each one or using the Layers panel — slow for dense layouts. (Verified: no marquee/box-select code exists in `src/components/Admin/LayoutBuilder` or `src/hooks`.)

### Fix

- Add a canvas-level drag-rectangle in `LayoutCanvas.tsx`: dragging from empty canvas draws a selection box and adds every intersecting slot to the existing `Set<string>` selection. Respect locked/hidden slots.
- Integrate with the existing multi-select operations (align, distribute, group, nudge) so they operate on a marquee selection unchanged.

### Acceptance criteria

- Dragging on empty canvas draws a marquee and selects all intersected, unlocked, visible slots.
- A marquee selection works with align/distribute/group/nudge exactly like a shift-click selection.
- Dragging that starts on a slot still moves the slot (marquee only starts from empty canvas).

### Validation

- `npm run test` for the intersection logic; manual QA marquee-selecting and then aligning/grouping.

### Implementation notes (2026-06-26)

- **Pure helpers** in `packages/shared-utils/src/canvasMeasurement.ts`: `normalizeDragRect(x0,y0,x1,y1)` (any-direction drag → positive-size rect clamped 0–100) and `pctRectsIntersect(a,b)` (AABB overlap; edge-touch = no overlap). 8 unit tests.
- **Canvas** (`LayoutCanvas.tsx`): the marquee starts only on a left-button mousedown landing directly on the canvas background (`e.target === e.currentTarget`), gated `!isPreview && !isHandTool` — slots are Rnd children, so a slot press never starts a marquee (no event-swallowing conflict). `mousemove`/`mouseup` are attached to `window` for the drag; corners come from `getBoundingClientRect()` so react-zoom-pan-pinch scale is handled.
  - **Deselect-vs-marquee:** the prior immediate `onCanvasClick()` clear was moved into the mouseup *click* branch (movement `< 4px`). A real drag commits the marquee and never clears; a slot drag ends on the canvas but never started a marquee, so it never clears either.
- **Commit:** intersecting **visible + unlocked** slots → `onMarqueeSelect(ids, additive)`. `additive` (Shift/Ctrl/Cmd held at mousedown) → `addSlotsToSelection` (union); otherwise `selectSlotsInRange` (replace). Existing align/distribute/group/nudge operate on the resulting selection unchanged. Box rendered as a `pointerEvents:'none'` dashed overlay.
- **Verified:** state + geometry tests, `tsc -b`, and `eslint` all green.

## Track P58-E - Slot entrance animations

### Problem

Slots support hover effects but have **no entrance motion** — they cannot fade/slide/zoom in as the gallery scrolls into view, a common expectation for modern layouts. (Verified: no entrance/scroll-reveal code in the render path.)

### Fix

- Add an `entranceAnimation` field to `LayoutSlot` (`none | fade | slide | zoom`, plus a delay/stagger value).
- Drive the reveal with an `IntersectionObserver` in `LayoutBuilderGallery.tsx` so each slot animates on first viewport entry.
- Honor `prefers-reduced-motion` (no animation when the user opts out) and expose a builder-side toggle to preview the effect.

### Acceptance criteria

- Slots animate in on first scroll into view at gallery render, per the chosen variant and stagger.
- With `prefers-reduced-motion` set, slots appear immediately with no animation.
- The builder can preview the entrance effect without leaving the editor.

### Validation

- `npm run test` for the field default/merge + the reduced-motion branch; manual QA scrolling a rendered gallery and toggling reduced-motion.

### Implementation notes (2026-06-26)

User direction: **full controls** (type + direction + duration + delay).

- **Field** — `SlotEntranceAnimation { type: 'fade'|'slide'|'zoom'; direction?; durationMs?; delayMs? }` added to `LayoutSlot` (optional; no `schemaVersion` bump).
- **Pure helper** — `src/utils/slotEntrance.ts` (`buildSlotEntranceCss`): per-slot `@keyframes` + a pre-reveal hidden state + a revealed-state animation + a `prefers-reduced-motion` override. Transforms **compose the slot's rotation** so a rotated slot (e.g. the new Polaroid Scatter preset) keeps its angle while animating in. Unit-tested (`slotEntrance.test.ts`).
- **Gallery reveal** — `LayoutBuilderGallery` injects the entrance CSS and runs an `IntersectionObserver` that adds `wpsg-lb-revealed` on first viewport entry (one-shot; `obs.unobserve` after). No-IO fallback reveals everything immediately. Entrance runs **only in the rendered gallery** (front-end) — the builder canvas uses `LayoutSlotComponent` and is unaffected.
- **Properties UI** — an "Entrance" section in `SlotPropertiesPanel` (type/direction/duration/delay) with an in-panel **mini "Play preview"** that replays the chosen animation (used `Select`, not `SegmentedControl`, to avoid the known setState-in-ref-callback loop). This is the builder-side preview the criteria call for.
- **Verified:** helper unit test, `tsc -b`, `eslint`, and the full regression suite all green.

## Track P58-F - Auto-grid slot generator

### Problem

Slots are added one at a time. Building a regular grid means repetitive manual placement.

### Fix

- Add a small dialog (rows × columns, gap, outer margin) that generates evenly spaced slots via the existing `addSlot` action in `useLayoutBuilderState.ts`.
- Emit the whole batch as a **single** undoable history entry so one `Ctrl+Z` removes the generated grid.

### Acceptance criteria

- Specifying an N×M grid produces N×M correctly positioned, evenly spaced slots.
- Gap and margin inputs are respected.
- The generation is one history entry (a single undo reverts the entire grid).

### Validation

- `npm run test` for the generator's geometry + single-history-entry behavior; manual QA generating a few grid sizes and undoing.

### Implementation notes (2026-06-26)

- **Geometry** — `computeGridSlots(rows, cols, gapPct, marginPct)` in `packages/shared-utils/src/canvasMeasurement.ts` (pure, %-space). Solves `2*margin + cols*cellW + (cols-1)*gap = 100` for the cell size; floors fractional counts; clamps negative gap/margin to 0; returns `[]` when the gap + margin over-constrain the canvas (cell ≤ 0). 8 unit tests in `canvasMeasurement.test.ts`.
- **State action** — `generateGrid({ rows, cols, gapPct, marginPct, replace? })` in `useLayoutBuilderState.ts`: a single `mutate('Generate grid')` (one undo reverts the whole grid, incl. a replace), pre-building slots + IDs *before* the recipe (same deferred-recipe reason as `pasteSlots`), then selecting them. Appends by default; `replace` clears first.
- **Dialog** — `AutoGridDialog.tsx` (Mantine `Modal`): rows/cols/gap/margin `NumberInput`s, a "Replace existing slots" `Switch` (only when the canvas has slots), a live preview driven by the *same* `computeGridSlots`, and a Generate button disabled when the settings yield no cells.
- **Trigger** — "Generate grid…" in the menu bar **Edit** menu (`onOpenGridGenerator`); **menu-only, no hotkey** (user direction). Wired in `LayoutBuilderModal.tsx`.
- **Verified:** state + geometry tests, `tsc -b`, and `eslint` all green.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Split P58-B to its own phase | Only if the per-breakpoint schema/resolution work grows beyond a single track during execution. |
| History persistence across sessions | Promoted to [FUTURE_TASKS.md](FUTURE_TASKS.md) › Builder (per user direction). |
| Reusable "symbol" / linked-component slots | Promoted to [FUTURE_TASKS.md](FUTURE_TASKS.md) › Builder. |
| Slot constraints / pinning (anchor-to-edge) | Promoted to [FUTURE_TASKS.md](FUTURE_TASKS.md) › Builder; a deeper responsive model complementing P58-B. |

## Implementation Notes

- Record completed work at a high level as tracks land. Keep short and factual.

## Outcome

_Updated 2026-06-26 — all six tracks shipped. Updated 2026-06-29 — P58-B post-ship fixes (four rounds) landed._

- **What shipped.** P58-A (clipboard, per-slot opacity, three-tier nudge), P58-D (marquee multi-select), P58-F (auto-grid generator), P58-C (already delivered in P15-J; enhanced with rotated/split presets + faithful previews), P58-E (scroll-reveal entrance animations with full per-slot controls), and P58-B (responsive / per-breakpoint slot overrides — schema v2, breakpoint editing UI, gallery resolution). Plus a fix for a pre-existing `duplicateSlots` selection bug found along the way.
- **P58-B post-ship.** Four follow-up rounds (see Track P58-B › Post-ship fixes): the 8-issue round (B-4 PHP persistence drift was the headline), the F-1/F-2/F-3 round, the builder boundary-guide (no-clip editing + device-width band), and the publish-at-breakpoint round (centered band scaled-to-fill via `computeBreakpointBand`, desktop "Fit to canvas", removed "Add Slot").
- **What was deferred.** The align/distribute keyboard shortcuts (originally folded into P58-A) were split to [FUTURE_TASKS.md](FUTURE_TASKS.md) › Builder pending a binding-scheme design. From the P58-B post-ship work: a better published responsive sizing model and a faithful builder Preview (with runtime effects), both in [FUTURE_TASKS.md](FUTURE_TASKS.md) › Builder.
- **What should happen next.** Manual QA of all tracks via the `see-wp` flow is recommended, especially P58-B's responsive editing UX. The align/distribute hotkeys can be picked up when a conflict-free binding is chosen.
