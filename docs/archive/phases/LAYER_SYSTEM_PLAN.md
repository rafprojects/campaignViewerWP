# Layer System — Implementation Plan

**Status:** ✅ Approved — proceeding to implementation  
**Proposed for:** Phase 16  
**Created:** February 25, 2026  
**Last updated:** February 25, 2026 — review complete, all decisions resolved

---

## Overview

### What Is It?

A **unified Photoshop-style layer panel** that replaces the current tab-based element management in the Layout Builder. Every canvas element — background, overlays, and slots — exists in a single ordered list. The list order directly maps to visual z-index stacking. Each row has visibility, lock, and label controls. The designer works in one place rather than navigating between three separate tabs.

### What Does It Replace?

Currently the Layout Builder left panel has three tabs:
- **Slots** — manage image slots (add, remove, list by index)
- **Overlays** — manage overlay images (upload, opacity, click-through)
- **BG** — background color, background image, fit, opacity

These are functional but architecturally siloed. A slot at z-index 3 and an overlay at z-index 2 cannot be seen relative to each other without holding both in mind simultaneously. Reordering across types is impossible without manually adjusting individual z-index numbers.

---

## Why We're Doing This

### Problem 1: No cross-type z-index visibility

A designer placing a slot over an overlay (or vice versa) must mentally track which type each element is and what z-index number it was assigned. There is no single place to see the visual stacking order.

### Problem 2: Tab navigation overhead

Moving between working with overlays and slots requires a tab switch, losing selection context. In complex layouts with 4–6 slots and 2–3 overlays, this becomes frequent friction.

### Problem 3: Background management is inconsistent

The background image is a one-off in the BG tab. From a design tool perspective, it is simply the bottom-most layer — treating it as a separate concept is conceptually incoherent once stacking becomes important.

### Problem 4: No element renaming

Slots are "Slot 1", "Slot 2". Overlays are "Overlay 1", "Overlay 2". For a template with 8 slots, identifying which slot is "hero image" vs "thumbnail top-right" requires clicking each one. Named layers make complex templates maintainable.

### Why Now?

Phase 15 delivered the full Layout Builder. The data model is stable, the rendering pipeline is proven. A layer system is the most impactful UX evolution available for Phase 16 — it makes the tool feel like a real design instrument rather than a form-with-a-canvas. Implementing it now, before templates proliferate, avoids a painful migration later when users have 50+ saved templates.

---

## Architecture Analysis

### Current Data Model

```typescript
interface LayoutTemplate {
  slots: LayoutSlot[];      // each has zIndex: number
  overlays: LayoutOverlay[]; // each has zIndex: number
  backgroundColor: string;
  backgroundImage?: string;  // one-off BG
  backgroundImageFit?: 'cover' | 'contain' | 'fill';
  backgroundImageOpacity?: number;
}
```

### Target Mental Model

Everything on the canvas is a **layer**. Layers have:
- A unique `id` and human-readable `name`
- A `type`: `'slot' | 'overlay' | 'background'`
- A `zIndex` (or implicitly: their position in the layers array)
- A `visible` boolean
- A `locked` boolean (prevents accidental drag/resize)

The layers array is ordered top-to-bottom in the panel = highest-to-lowest z-index on the canvas (identical to Figma / Photoshop conventions).

### Migration Strategy

**Non-breaking**: The `slots` and `overlays` arrays stay on `LayoutTemplate`. The layer panel is a **UI projection** over those arrays — it reads from both and computes a unified sorted-by-zIndex view. No data format change in Phase 16a. A full data consolidation (merging to a single `elements` array) is deferred to Phase 16b if the UX proves valuable.

This means:
- Zero migration of saved templates
- Full backward compatibility with existing PHP serialization
- No changes to `class-wpsg-layout-templates.php` in Phase 16a

---

## Implementation Plan

### Phase 16a — Unified Layer Panel (UI only, no data model change)

**Goal:** Replace the Slots/Overlays/BG tab structure with a single layer panel. Behaviour changes only in the admin builder, not the gallery renderer.

#### Step 1 — `buildLayerList()` + `getLayerName()` utilities

Create `src/utils/layerList.ts`:

```typescript
export type LayerItem =
  | { kind: 'background'; id: 'background'; name: string; visible: boolean }
  | { kind: 'overlay'; id: string; name: string; visible: boolean; locked: boolean; opacity: number }
  | { kind: 'slot'; id: string; name: string; visible: boolean; locked: boolean; index: number };
```

Pure function: `buildLayerList(template: LayoutTemplate): LayerItem[]`

- Background is always the last entry (lowest stacking)
- Overlays and slots interleaved, sorted **descending** by `zIndex`
- **Stable sort**: use the element's original array index as a tie-breaker so that equal-z-index rows never swap unexpectedly after a drag
- Returns a stable sorted array for rendering the panel

**Name fallback helper** (also in `layerList.ts`):

```typescript
export function getLayerName(item: LayerItem, template: LayoutTemplate): string {
  if (item.name) return item.name;
  if (item.kind === 'background') return 'Background';
  if (item.kind === 'slot') return `Slot ${item.index + 1}`;
  // overlay: 1-based index within overlays array
  const overlayIdx = template.overlays.findIndex((o) => o.id === item.id);
  return `Overlay ${overlayIdx + 1}`;
}
```

This is the single source of truth used by the layer panel row, the canvas tooltip, and the properties panel header — no inconsistent labelling.

Testing: ~15 pure-function tests covering sort order, cross-type interleaving, tie-breaking, boundary cases, `getLayerName` fallback for each kind.

#### Step 2 — `LayerPanel` component

New file: `src/components/Admin/LayoutBuilder/LayerPanel.tsx`

**Each row:**
```
[drag handle] [type icon] [name (editable inline)] [eye] [lock] [⋮ menu]
```

- **drag handle**: Native HTML5 Drag and Drop API (`draggable=true` + `onDragStart`/`onDragOver`/`onDrop` — ~40 lines in `LayerRow.tsx`). **Not** `react-rnd` (purpose-built for 2D free-form canvas positioning, has no concept of vertical list ordering) and **not** a third-party list library (zero additional deps). Native DnD handles keyboard accessibility natively and is sufficient for simple row reordering. Cross-type dragging is supported: a slot may be dragged above/below an overlay and vice versa — when dropped, `normalizeZIndices()` runs across the merged list and writes new z-index values back to the respective `slots` and `overlays` arrays.
- **type icon**: `IconPhoto` (slot), `IconLayersIntersect` (overlay), `IconBackground` (background)
- **name**: inline `contentEditable` or `TextInput` (calls `onRenameLayer`)
- **eye**: toggle `visible` flag per element. When `visible: false` in the builder canvas, the element renders at **10% opacity** (ghost mode — already implemented for overlays; extended to slots). **Important: the `visible` flag is builder-only in Phase 16a.** A slot with `visible: false` still renders normally in the finalized gallery — this is a "draft / hide while designing" toggle, not a public visibility control. This avoids non-trivial side effects on lightbox indexing and thumbnail-strip behaviour.
- **lock**: boolean on slot/overlay; when locked, `react-rnd` disables drag/resize (pass `disableDragging` + `enableResizing={false}`)
- **⋮ menu**: Delete, Duplicate, Bring to Front, Send to Back

**Panel replaces the left-side Slots + Overlays + BG tabs entirely** in `LayoutBuilderModal.tsx`.

#### Step 3 — State changes in `useLayoutBuilderState`

New actions required:

```typescript
renameSlot(id: string, name: string): void;
renameOverlay(id: string, name: string): void;
toggleSlotVisible(id: string): void;     // slot.visible?: boolean
toggleOverlayVisible(id: string): void;  // now per-item (was per-global)
toggleSlotLocked(id: string): void;      // slot.locked?: boolean
toggleOverlayLocked(id: string): void;
reorderLayers(draggedId: string, targetId: string): void; // cross-type reorder via z-index normalisation
```

All new actions **must go through the existing `dispatch` + Immer history stack** so that `Ctrl+Z` / `Ctrl+Y` undo/redo works for layer renames, visibility toggles, lock toggles, and layer reordering — exactly as it does for slot drag/resize in Phase 15.

New fields on `LayoutSlot` and `LayoutOverlay`:
```typescript
name?: string;    // falls back to "Slot N" / "Overlay N" if absent
visible?: boolean; // default true
locked?: boolean;  // default false
```

These are optional with safe defaults — full backward compat with existing saved templates.

**z-index reordering via drag**: `reorderLayers(draggedId, targetId)` builds a merged list of all slots + overlays sorted by z-index, moves the dragged item above/below the target in the merged list, then calls a cross-array `normalizeZIndices()` that assigns sequential z-index values (1, 2, 3…) back to each element in its respective array. Background always stays at z-index 0 and is never reordered.

#### Step 4 — `LayoutCanvas` locked-slot support

When a slot/overlay has `locked: true`:
- Pass `disableDragging={true}` and `enableResizing={false}` to its `Rnd`
- Show a `IconLock` indicator in the corner (small, 14px)
- Cursor changes to `default` instead of `move`
- **No effect on the finalized gallery renderer** (`LayoutBuilderGallery.tsx` ignores `locked`). The flag is purely a builder-time interaction guard.

#### Step 5 — `LayoutBuilderModal` restructure

- Remove `leftTab` state and the Tabs component for Slots/Overlays/BG
- Replace left panel with `<LayerPanel>` (scrollable, fixed width 220px)
- Add a media picker as a **separate sidebar** (collapsible, opens to the right of the layer panel or as a slide-over) — media assignment doesn't need to compete for left-panel space once layer management moves there
- Background controls (color, image, fit, opacity) move to the right-side **Properties Panel** — shown when the background layer is selected in the panel (same pattern as slot/overlay selection)
- Background row in the layer panel is always present and selectable; clicking it shows BG properties in the right panel

##### Regression Checklist (required before merging the modal restructure)

- [ ] Slot selection highlight renders correctly (selected slot border/ring visible on canvas)
- [ ] Panel widths: layer panel 220px, properties panel correct width, canvas fills remaining space
- [ ] Media picker opens/closes without layout shift on the canvas
- [ ] Right panel transitions smoothly between slot props, overlay props, and background props on selection change
- [ ] Responsive modal behaviour: at narrow widths layer panel collapses or scrolls correctly
- [ ] Keyboard focus: Tab order through layer panel rows, then canvas, then properties panel
- [ ] All existing Phase 15 builder tests still pass after restructure

#### Step 6 — Keyboard shortcuts for the layer panel

Add to the layer panel's `onKeyDown` handler (row-level focus):

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate to previous/next layer row |
| `Space` | Toggle visibility of focused row |
| `L` | Toggle lock of focused row |
| `F` | Bring to front |
| `B` | Send to back |
| `Delete` / `Backspace` | Delete focused layer (with confirmation for slots that have media) |

Consistent with Phase 15's z-index keyboard shortcuts (`[` / `]` on canvas).

---

### Phase 16b — Data Model Consolidation (optional, deferred)

**Goal:** Merge `slots` and `overlays` into a single `elements: LayoutElement[]` discriminated union. Update PHP serialization, add schema migration from v1 → v2.

This is a breaking data-model change requiring:
- `schemaVersion` bump: `1 → 2`
- Migration function in both TS and PHP: expand existing `migrateTemplate()` in `class-wpsg-layout-templates.php`
- All 32 test files touching `LayoutTemplate` updated to new shape

**Recommendation:** Only pursue Phase 16b if the Layer Panel (16a) is heavily used and cross-type z-index conflicts become a real administrative burden. The 16a projection approach handles 95% of the UX benefit without the migration cost.

---

## File Inventory

### New files (Phase 16a)

| File | Purpose |
|------|---------|
| `src/utils/layerList.ts` | `buildLayerList()` pure function |
| `src/utils/layerList.test.ts` | ~15 pure-function tests |
| `src/components/Admin/LayoutBuilder/LayerPanel.tsx` | Unified layer panel UI |
| `src/components/Admin/LayoutBuilder/LayerRow.tsx` | Single-row sub-component |

### Modified files (Phase 16a)

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `name?`, `visible?`, `locked?` to `LayoutSlot` and `LayoutOverlay` |
| `src/hooks/useLayoutBuilderState.ts` | Add `renameSlot`, `renameOverlay`, `toggleSlotVisible`, `toggleSlotLocked`, `toggleOverlayVisible`, `toggleOverlayLocked`. Update `normalizeZIndices()` to operate cross-type. |
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | Replace left Tabs with `<LayerPanel>`. Move BG controls to Properties Panel. |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | Respect `slot.locked` / `overlay.locked` in Rnd props |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | Accept `locked` prop; pass to Rnd; show lock icon |
| `wp-plugin/.../class-wpsg-layout-templates.php` | Sanitize `name`, `visible`, `locked` in `build_template()` |

---

## Effort Estimate

| Phase | Estimated Effort | Risk |
|-------|-----------------|------|
| 16a — LayerPanel UI | 3–4 days | Low — UI projection only, no data change |
| 16a — State actions | 0.5 day | Low — extends existing Immer actions pattern |
| 16a — LayoutCanvas locked support | 0.5 day | Low |
| 16a — Modal restructure | 1 day | Medium — UI reshuffle, visual regression risk |
| Total 16a | **~5–6 days** | Low-Medium |
| 16b — Data model consolidation | 2–3 days | High — migration breadth |

---

## Testing Strategy

Building on Phase 15's test foundation:

- **`layerList.test.ts`**: ~15 tests — sort order, background always last, tie-breaking, empty arrays, visible/locked flags
- **`LayerPanel.test.tsx`**: ~12 UI render tests — row count matches layer count, eye/lock toggles fire callbacks, rename fires callback, drag-to-reorder fires z-index actions
- **`useLayoutBuilderState` additions**: ~10 new tests for each new action
- **`LayoutSlotComponent` locked prop**: 2 new tests — locked slot shows lock icon, Rnd receives `disableDragging`

Target: maintain ≥75% coverage across layout builder files.

---

## Resolved Decisions

All open questions resolved during the February 25, 2026 review.

| # | Question | Decision |
|---|----------|----------|
| OQ-1 | Cross-type drag reorder in 16a? | **Yes.** `reorderLayers()` operates on a merged cross-array list; `normalizeZIndices()` writes back to `slots` and `overlays` separately. Restricting to within-type would defeat the core value proposition. |
| OQ-2 | Background as a selectable layer? | **Yes.** Clicking the background row opens its properties in the right panel. No onboarding tooltip or transition banner needed — app is pre-release, no existing users. |
| OQ-3 | `visible` flag in finalized gallery? | **Builder-only in 16a.** `visible: false` = ghost at 10% opacity in the canvas editor only. The finalized gallery renders all slots regardless of `visible`. Lightbox indexing and thumbnail strip are unaffected. Expose to gallery in Phase 16b/17 if needed. |
| OQ-4 | Name persistence? | **`name?: string` added to `LayoutSlot` and `LayoutOverlay`.** Falls back to `getLayerName()` in `layerList.ts` which returns "Slot N", "Overlay N", or "Background" deterministically. Names persist with the saved template. |

---

*Document created: February 25, 2026 — Approved February 25, 2026*
