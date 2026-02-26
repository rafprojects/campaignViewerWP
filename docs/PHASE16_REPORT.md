# Phase 16 — Layer System

**Status:** 🚧 In Progress  
**Version:** v0.14.0  
**Created:** February 25, 2026  
**Last updated:** February 25, 2026 — Implementation started

### Progress Log

| Date | Commit | Milestone |
|------|--------|-----------|
| 2026-02-25 | *pending* | Phase 16 started — types extended (`name?`, `visible?`, `locked?` on `LayoutSlot` + `LayoutOverlay`), `layerList.ts` + tests created, new state actions, `LayerPanel` + `LayerRow` components, `LayoutBuilderModal` restructure, locked canvas support |

---

## Table of Contents

1. [Rationale](#rationale)
2. [Architecture Decisions](#architecture-decisions)
3. [Data Model Changes](#data-model-changes)
4. [Track P16-A — Unified Layer Panel](#track-p16-a--unified-layer-panel)
5. [Track P16-B — State Actions](#track-p16-b--state-actions)
6. [Track P16-C — Canvas Locked Support](#track-p16-c--canvas-locked-support)
7. [Track P16-D — Modal Restructure](#track-p16-d--modal-restructure)
8. [Execution Priority](#execution-priority)
9. [Testing Strategy](#testing-strategy)
10. [Risk Register](#risk-register)

---

## Rationale

Phase 15 delivered a fully functional Layout Builder. After implementation review, three friction points emerged:

1. **No cross-type z-index visibility** — a slot at z-index 3 and an overlay at z-index 2 are managed in separate tabs with no unified stacking view.
2. **Tab navigation overhead** — switching between Slots/Overlays/BG tabs loses selection context and adds cognitive load in complex templates.
3. **No element naming** — identifying "which slot is the hero image" in an 8-slot template requires clicking each one.

Phase 16 delivers a **Photoshop/Figma-style layer panel** as a non-breaking UI projection over the existing `slots` and `overlays` arrays. Zero data migration. Full backward compatibility.

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-1 | UI projection in 16a — no data model consolidation | `slots` + `overlays` arrays unchanged. Layer panel reads and writes z-index/name/visible/locked from the existing structures. Zero migration risk for saved templates. |
| AD-2 | Cross-type drag reorder via `reorderLayers()` | Dragging a slot above/below an overlay is the primary value. `normalizeZIndices()` extended to operate cross-array. |
| AD-3 | `visible: false` = builder ghost only in 16a | Finalized gallery renders all elements regardless of `visible`. No effect on lightbox indexing or thumbnail strip. Clean scope for 16a. |
| AD-4 | Native HTML5 DnD for layer list reorder | ~40 lines, zero deps, keyboard-accessible. `react-rnd` is for 2D canvas drag (orthogonal purpose). No third-party list library. |
| AD-5 | `getLayerName()` as single source of truth | Used by layer panel row, canvas tooltip, and properties panel header. Fallback: "Slot N" / "Overlay N" / "Background". |
| AD-6 | All new actions routed through Immer history | `renameSlot`, `toggleSlotVisible`, `toggleSlotLocked`, `reorderLayers` all push to undo stack. Ctrl+Z works for every layer action. |
| AD-7 | Background row always present at panel bottom | Background is selectable — clicking it shows BG properties in the right panel (same pattern as slot/overlay). No special tab. |

---

## Data Model Changes

### LayoutSlot additions

```typescript
interface LayoutSlot {
  // ... existing fields ...
  /** Human-readable display name. Falls back to "Slot N" if absent. */
  name?: string;
  /** Builder-only visibility toggle. false = ghost at 10% opacity in editor.
   *  No effect on finalized gallery rendering. */
  visible?: boolean;
  /** Locks drag/resize in the builder. No effect on gallery rendering. */
  locked?: boolean;
}
```

### LayoutOverlay additions

```typescript
interface LayoutOverlay {
  // ... existing fields ...
  /** Human-readable display name. Falls back to "Overlay N" if absent. */
  name?: string;
  /** Builder-only visibility toggle. false = ghost at 10% opacity. */
  visible?: boolean;
  /** Locks drag/resize in the builder. */
  locked?: boolean;
}
```

All three fields are optional with safe defaults (`visible` defaults to `true`, `locked` to `false`) — full backward compatibility with all existing saved templates.

---

## Track P16-A — Unified Layer Panel

### P16-A.1 — `buildLayerList()` + `getLayerName()` utilities

**File:** `src/utils/layerList.ts`

```typescript
export type LayerItem =
  | { kind: 'background'; id: 'background'; name: string; visible: boolean }
  | { kind: 'overlay'; id: string; name: string; visible: boolean; locked: boolean; opacity: number }
  | { kind: 'slot'; id: string; name: string; visible: boolean; locked: boolean; index: number };
```

- `buildLayerList(template)` — sorted descending by zIndex, slots + overlays interleaved, background last
- Stable sort: original array index as tie-breaker for equal z-index values
- `getLayerName(item, template)` — single source of truth for display names

### P16-A.2 — `LayerRow` + `LayerPanel` components

**Files:** `src/components/Admin/LayoutBuilder/LayerRow.tsx`, `LayerPanel.tsx`

Row anatomy: `[drag handle] [type icon] [name (inline edit)] [eye] [lock] [⋮ menu]`

Drag implementation: Native HTML5 DnD (`draggable` + `onDragStart` / `onDragOver` / `onDrop`). Cross-type reordering supported.

Layer panel keyboard shortcuts:

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate rows |
| `Space` | Toggle visibility |
| `L` | Toggle lock |
| `F` / `B` | Bring to Front / Send to Back |
| `Delete` | Delete layer |

### P16-A.3 — Ghost mode for hidden elements

`visible: false` renders element at 10% opacity in the canvas editor. Already implemented for overlays via `overlaysVisible` flag — extended to per-element `visible` field for both slots and overlays.

---

## Track P16-B — State Actions

**File:** `src/hooks/useLayoutBuilderState.ts`

New actions added to `LayoutBuilderActions`:

| Action | Description |
|--------|-------------|
| `renameSlot(id, name)` | Persist human-readable label on slot |
| `renameOverlay(id, name)` | Persist human-readable label on overlay |
| `toggleSlotVisible(id)` | Toggle `slot.visible` |
| `toggleOverlayVisible(id)` | Toggle `overlay.visible` |
| `toggleSlotLocked(id)` | Toggle `slot.locked` |
| `toggleOverlayLocked(id)` | Toggle `overlay.locked` |
| `reorderLayers(draggedId, targetId)` | Cross-type z-index reorder via merged-list normalisation |

`normalizeZIndices()` extended to operate across merged `slots + overlays` list in a single pass.

---

## Track P16-C — Canvas Locked Support

**Files:** `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx`, `LayoutSlotComponent.tsx`

When `locked: true`:
- `Rnd` receives `disableDragging={true}` and `enableResizing={false}`
- `IconLock` badge renders in slot corner (14px)
- Cursor: `default` instead of `move`
- **No effect on `LayoutBuilderGallery.tsx`** — gallery ignores `locked`

---

## Track P16-D — Modal Restructure

**File:** `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx`

- Remove `leftTab` + Tabs (Slots/Overlays/BG)
- Replace left panel with `<LayerPanel>` (fixed 220px width, scrollable)
- Move background controls → Properties Panel (shown on background layer selection)
- Media picker moves to collapsible sidebar

##### Regression Checklist

- [ ] Slot selection highlight correct on canvas
- [ ] Panel widths: 220px layer panel, correct properties panel, canvas fills remainder
- [ ] Media picker open/close without canvas layout shift
- [ ] Right panel transitions smoothly on selection change (slot → overlay → background)
- [ ] Responsive modal at narrow viewports
- [ ] Keyboard focus: Tab order through layer panel → canvas → properties panel
- [ ] All Phase 15 builder tests still pass

---

## Execution Priority

| Sprint | Tracks | Notes |
|--------|--------|-------|
| 1 | P16-B (types + state) | Foundation — pure logic, fully testable |
| 2 | P16-A.1 (layerList utility) | Pure function, testable in isolation |
| 3 | P16-A.2 (LayerRow + LayerPanel) | UI components |
| 4 | P16-C (locked canvas) | Small, isolated |
| 5 | P16-D (modal restructure) | Highest regression risk — do last |

---

## Testing Strategy

| File | Tests | Coverage Target |
|------|-------|-----------------|
| `layerList.test.ts` | ~15 | Sort order, cross-type interleave, tie-breaking, `getLayerName` fallbacks |
| `LayerPanel.test.tsx` | ~12 | Row count, eye/lock toggle callbacks, rename callback, keyboard shortcuts |
| `useLayoutBuilderState` additions | ~10 | Each new action + cross-type `reorderLayers` |
| `LayoutSlotComponent` locked | 3 | Locked badge visible, Rnd props, cursor style |

Target: maintain ≥75% coverage across layout builder files.

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Modal restructure causes visual regression | Medium | Medium | Regression checklist; run full test suite before merge |
| Native DnD not smooth enough for layer list | Low | Low | Fallback: `@dnd-kit/sortable` (~5KB) if user testing reveals issues |
| Cross-type z-index normalisation creates gaps/conflicts | Low | Medium | Pure-function tests cover edge cases; normalise always produces gapless 1..N |
| `visible` flag misunderstood as gallery visibility | Low | Medium | Clear tooltip in layer row; document explicitly in builder UI |

---

## New File Inventory

| File | Track | Purpose |
|------|-------|---------|
| `src/utils/layerList.ts` | P16-A.1 | `buildLayerList()` + `getLayerName()` + `LayerItem` type |
| `src/utils/layerList.test.ts` | P16-A.1 | ~15 pure-function tests |
| `src/components/Admin/LayoutBuilder/LayerPanel.tsx` | P16-A.2 | Unified layer panel UI |
| `src/components/Admin/LayoutBuilder/LayerRow.tsx` | P16-A.2 | Single layer row sub-component |

---

*Document created: February 25, 2026*
