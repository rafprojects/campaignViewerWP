# Phase 58 - LayoutBuilder Enhancements

**Status:** Planned
**Created:** 2026-06-26
**Last updated:** 2026-06-26

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P58-A | Editor UX Polish — real `Ctrl+C`/`Ctrl+V` clipboard + per-slot opacity + nudge steps (align/distribute hotkeys split to [FUTURE_TASKS.md](FUTURE_TASKS.md)) | Done | Small-Medium |
| P58-B | Responsive / per-breakpoint slot overrides (hide/move/resize per device) | Planned | Medium-High |
| P58-C | Starter template library — pre-built layouts to clone | Planned | Medium |
| P58-D | Marquee multi-select on the canvas | Planned | Small-Medium |
| P58-E | Slot entrance animations (scroll-reveal at gallery render) | Planned | Medium |
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
| E | Pro gating | Per-breakpoint responsive (P58-B) and the starter library (P58-C) are **natural Pro-tier features** — note the gating seam for [PHASE61_REPORT.md](PHASE61_REPORT.md) but do not gate here. |

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

_To be completed once the phase ships._

- What shipped.
- What was deferred.
- What should happen next.
