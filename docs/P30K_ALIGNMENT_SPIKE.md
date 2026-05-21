# P30-K — Alignment Model Spike
## Professional Tool Research & Design for Enhanced Alignment

**Status:** Complete  
**Date:** 2026-05-20  
**Scope:** Research + spec only. No code changes in this track. Implementation flows into a follow-on track (P30-L or an increment of P30-A).

---

## 1. Current State

`src/utils/alignSlots.ts` ships 8 operations:

| # | Function | Behaviour |
|---|----------|-----------|
| 1 | `alignSlotsLeft` | Snap all left edges to the minimum left edge in selection |
| 2 | `alignSlotsRight` | Snap all right edges to the maximum right edge |
| 3 | `alignSlotsTop` | Snap all top edges to the minimum top edge |
| 4 | `alignSlotsBottom` | Snap all bottom edges to the maximum bottom edge |
| 5 | `centerSlotsHorizontally` | Move all to share the horizontal center of the selection bbox |
| 6 | `centerSlotsVertically` | Move all to share the vertical center of the selection bbox |
| 7 | `distributeSlotsHorizontally` | Equalize the **centers** of sorted slots along X |
| 8 | `distributeSlotsVertically` | Equalize the **centers** of sorted slots along Y |

All functions operate on `LayoutSlot[]` and return a `Record<slotId, Partial<LayoutSlot>>` delta — a clean pattern to build on.

**Known gaps (from P29-G-C delivery):**

- `distributeSlotsHorizontally/Vertically` equalize centers, not gaps. Mixed-size slots can
  overlap after distribute-by-center if a narrow slot lands inside a wide neighbour.
- No canvas-relative alignment (e.g., "center on canvas").
- Groups are not alignment entities: when a persisted group and an individual slot are both
  selected, the group's members are treated as independent slots rather than as one bbox unit.
- No key-object / anchor-slot mode.
- Alignment UI lives only in the Layers panel toolbar; no access from the canvas.

---

## 2. Research Notes

### 2.1 Figma

**Reference frame**: Three modes selected via a toggle in the alignment panel:
- **Selection** (default): all items align/distribute relative to the bounding box of the whole
  selection.
- **Key object**: click an item a second time while it is already selected; a thick blue ring
  marks it as the anchor. Everything else moves; the key object stays fixed.
- **Canvas / Frame**: items align to the canvas edge or, when inside a frame, the frame's
  edge/centre.

**Distribute operations — two distinct sets**:
- *Horizontal/Vertical spacing* (gap-equalise): sets equal pixel gaps between item edges.
  Available via the distribute icons when 3+ items are selected. Minimum gap can be set to 0
  to pack items tightly.
- Figma does NOT expose distribute-by-center as a first-class UI button; space-evenly is the
  only distribute mode shown.

**Group alignment**: A group is a single entity. Alignment and spacing use the group's union
bounding box. You cannot accidentally distribute individual members of a group while the group
is selected.

**Tidy up / Smart distribute**: Auto-layout frames have a "tidy up" action that converts loose
elements to uniform spacing. Not available for ungrouped free-form selections.

**Mixed-size distribute**: Space-evenly handles mixed widths/heights correctly because it
equalizes gaps, not centers. No overlap is possible.

### 2.2 Canva

**Reference frame**: Two modes:
- **Page** (align to page edge or centre — accessible via "Position" panel).
- **Selection** (default for multi-select).

No key-object mode; anchor is implicit (leftmost/topmost item is unchanged, or the furthest
item defines the boundary, depending on operation).

**Tidy up**: Single button. Simultaneously equalizes both horizontal and vertical spacing for
all selected elements, choosing gaps that fill the selection bounding box evenly. This is a
combined 2-axis operation — gap-equalize H and gap-equalize V in one shot.

**Group alignment**: Groups are treated as single bbox entities, consistent with Figma.

**Simplicity tradeoff**: Canva deliberately hides the distinguish between distribute-centers
and distribute-gaps; "tidy up" is always gap-equalize and is the only distribute affordance.

### 2.3 Photoshop

**Reference frame**: Three modes available in the options bar:
- **Selection** (default).
- **Canvas**: align/distribute relative to the full document canvas.
- **Artboard** (when artboards are in use).

**Distribute — two distinct buttons exposed** since PS CC 2019:
- *Distribute horizontal centers* / *Distribute vertical centers*: equalizes center-to-center
  spacing (legacy, still present).
- *Distribute horizontal spacing* / *Distribute vertical spacing*: equalizes gap between item
  edges ("space evenly"). Available when 3+ layers are selected.

Both distribute types are exposed as separate icons in the options bar — this is the only
professional tool that presents both side-by-side.

**Linked-layer behavior**: Linked layers move together as a logical unit during alignment
operations, functionally equivalent to Figma's group-as-entity model.

**Minimum spacing**: PS lets the designer type a pixel value for "distribute spacing" rather
than always using the current gap. Useful for tight compositions.

### 2.4 Sketch

**Reference frame**: Selection or canvas via the alignment toolbar.

**Smart distribute**: Sketch's "Make Grid" distributes both axes simultaneously with
configurable row/column counts and gap values — more powerful than single-axis distribute but
aimed at repeated-element grids rather than arbitrary selections.

**Group alignment**: Groups align as single entities. The group's bounding box is the unit,
consistent with the other tools.

---

## 3. Q&A — Decisions

### Q1: Distribute-centers vs. distribute-gaps — one mode or both?

**Analysis:**
- Figma exposes only gap-equalize (space evenly), hiding distribute-centers entirely.
- Photoshop exposes both.
- Canva exposes only tidy-up (gap-equalize), no distribute-centers.
- The existing codebase already ships distribute-centers as `distributeSlotsH/V`. Gallery
  designers working with mixed-size images will hit overlap with the current implementation;
  gap-equalize is the more universally useful default.

**Decision: Add gap-equalize as two new operations; keep the existing distribute-centers.**

Rationale: Renaming or replacing the existing operations would be a behaviour change for users
who have internalized them. The two modes serve genuinely different use cases:
- Distribute-centers: enforces rhythmic beat spacing regardless of item size (useful for
  caption grids where the label text matters more than the blank space between cells).
- Distribute-gaps (space evenly): enforces equal breathing room between items regardless of
  size (useful for image mosaics and magazine-style layouts).

Expose space-evenly as the primary/recommended distribution path. Keep distribute-centers as a
secondary option.

**New operations to add:**
- `spaceSlotsSlotsEvenlyHorizontal` — equalises horizontal gaps between slot edges
- `spaceSlotsEvenlyVertical` — equalises vertical gaps between slot edges

### Q2: Alignment with mixed slots + groups

**Candidate models:**
| Model | Behaviour |
|-------|-----------|
| A — union-bbox-per-group | Each persisted group is treated as one alignment entity using its union bounding box; all members move together by the same delta. |
| B — flatten-all-members | Group membership is ignored; all slots (including group members) are treated as independent entities. |
| C — error/disable | Alignment is disabled when the selection mixes individual slots with one or more groups. |

**Decision: Model A (union-bbox-per-group).**

Rationale: This is the behaviour in Figma, Photoshop (linked layers), and Sketch. It is also
the behaviour users will expect because it is consistent with the visual representation: if a
group visually acts as a single unit in the canvas (moves together, has a unified selection
ring), it should align as a single unit too.

**Dependency:** Model A cannot be cleanly implemented until P30-G establishes the group
coordinate model and a canonical bounding-box resolver for groups. The implementation track
should be gated on P30-G.

**Interim behaviour** (Phase 30 before P30-G lands): Keep current behaviour (Model B — flatten
members). Add a visual indicator in the alignment toolbar tooltip noting "group members align
individually until nested-group coordinate model lands."

### Q3: Reference frame toggle

**Analysis:**
- Every professional tool surveyed provides at least two reference frames: selection and
  canvas.
- Key-object / anchor is available in Figma and is the most powerful but least discoverable
  mode.
- "Align to canvas" is the highest-value addition for gallery designers: centering an element
  or selection on the whole canvas is a very common operation (logo placement, title card).

**Decision: Add three reference frames; implement Selection + Canvas in Phase 30; defer
Key Object to a later pass.**

| Mode | Label | Behaviour | Phase |
|------|-------|-----------|-------|
| `selection` | Selection | Current default — align/distribute relative to the selection bbox | Now (already works) |
| `canvas` | Canvas | Align edges/centres relative to the 100% × 100% canvas | Phase 30 |
| `key-object` | Key Object | Click a slot twice to pin it as anchor; others align to it | Defer |

**UI surface**: A compact segmented-control or toggle group in the Layers panel alignment toolbar
(e.g., two icons: a selection-box icon and a canvas-frame icon). State is builder-session-local
(not persisted to template).

**Required change to `alignSlots.ts`**: Each function must accept an optional `frame` parameter
of type `{ x: number; y: number; width: number; height: number }` representing the reference
bounds. For `canvas` mode this is `{ x: 0, y: 0, width: 100, height: 100 }`.

### Q4: Novel gallery-specific alignment operations

**Candidates evaluated:**

| Candidate | Description | Value | Feasibility |
|-----------|-------------|-------|-------------|
| Equalize slot sizes | Resize all selected slots to the same width × height (using the average, or a chosen anchor slot's size) | High — very common need when assembling a uniform image grid | Medium — requires resizing, not just repositioning; must not break manual cropping intent |
| Fit to common aspect ratio | Resize all selected slots to share the same aspect ratio (e.g. 4:3) while preserving approximate area | Medium — useful for editorial layouts | Medium |
| Pack tightly | Remove all gaps between selected slots on one axis, using the leftmost/topmost slot as origin | High — produces mosaic-style layouts with zero gap | Low-Medium — requires a greedy packing pass |
| Distribute to fill canvas | Resize and reposition selected slots so they collectively fill the canvas area with equal margins | Medium | High complexity — layout solver territory |
| Align by read order | Reorder slots' z-indices to match their visual left-to-right, top-to-bottom position | Low-Medium — niche | Low |

**Recommended novel enhancement: "Equalize slot sizes"**

This is the gallery-specific operation with the best value-to-feasibility ratio. When a
designer assembles a grid of images with slightly different sizes (common when adding slots
one-by-one to approximate a grid), "equalize sizes" snaps all selected slots to the same
dimensions in one action.

**Behaviour specification:**
- Compute the average width and average height of all selected slots.
- Resize each slot to that average, anchoring from the slot's current centre point so slots
  shift minimally.
- The operation appears alongside the existing alignment row in the Layers panel toolbar.
- Icon: `IconSquaresDiagonal` (or `IconLayout`) from tabler.
- Available only when 2+ slots are selected.

**Feasibility note:** This is a pure `SlotUpdate` map (same pattern as all existing align
functions) operating on percentage coordinates. No breaking changes to the data model or
undo/redo system are needed. Estimated additional effort: 1–2 hours within the implementation
track.

### Q5: Access points for alignment

**Current**: Layers panel alignment toolbar only.

**Analysis of options:**
| Surface | Pro | Con |
|---------|-----|-----|
| Layers panel toolbar | Already exists; discoverable on first open | Requires navigating away from canvas selection |
| Floating canvas toolbar (P30-A) | In-context; no panel switch required | Limited space; only a subset fits |
| Right-click context menu | Familiar to power users | Requires pointer precision; poor keyboard ergonomics |
| Keyboard shortcuts | Fastest for repeat use | Discovery problem; hard to assign 8+ new ops |

**Decision:**

- **Layers panel toolbar**: remains primary home for the full operation set.
- **Contextual toolbar (P30-A)**: expose a compact alignment sub-row on multi-slot and group
  selections. Show the 6 most-used operations: Align Left, Center H, Align Right, Align Top,
  Center V, Align Bottom. Add a "…" overflow button that opens a small popover with Space
  Evenly H, Space Evenly V, and Equalize Sizes.
- **Right-click context menu**: defer to a later pass; low priority for current usage patterns.
- **Keyboard shortcuts**: no new shortcuts for alignment (the set is already dense); rely on
  Layers toolbar and contextual toolbar for mouse-driven use.

---

## 4. Proposed Operation Set (Phase 30)

The complete alignment operation set after Phase 30 implementation:

### 4.1 Align operations (reference-frame aware)

| # | Name | Function | Icon | Available when |
|---|------|----------|------|----------------|
| 1 | Align left edges | `alignSlotsLeft` | `IconAlignBoxLeftMiddle` | 2+ items selected |
| 2 | Center horizontally | `centerSlotsHorizontally` | `IconAlignBoxCenterMiddle` | 2+ items selected |
| 3 | Align right edges | `alignSlotsRight` | `IconAlignBoxRightMiddle` | 2+ items selected |
| 4 | Align top edges | `alignSlotsTop` | `IconAlignBoxTopCenter` | 2+ items selected |
| 5 | Center vertically | `centerSlotsVertically` | `IconAlignBoxCenterTop` | 2+ items selected |
| 6 | Align bottom edges | `alignSlotsBottom` | `IconAlignBoxBottomCenter` | 2+ items selected |

All six gain an optional `frame` parameter (selection bbox or canvas 0–100). When frame =
canvas, the icon and tooltip gain a "to canvas" label so the mode change is visible.

### 4.2 Distribute operations

| # | Name | Function | Icon | Available when |
|---|------|----------|------|----------------|
| 7 | Distribute centers H *(existing)* | `distributeSlotsHorizontally` | `IconArrowsH` (or similar) | 3+ items |
| 8 | Distribute centers V *(existing)* | `distributeSlotsVertically` | `IconArrowsV` | 3+ items |
| 9 | Space evenly H *(new)* | `spaceSlotsEvenlyHorizontal` | `IconSpacingHorizontal` | 3+ items |
| 10 | Space evenly V *(new)* | `spaceSlotsEvenlyVertical` | `IconSpacingVertical` | 3+ items |

### 4.3 Novel gallery operation

| # | Name | Function | Icon | Available when |
|---|------|----------|------|----------------|
| 11 | Equalize slot sizes *(new)* | `equalizeSlotsSize` | `IconLayout` | 2+ items |

### 4.4 Reference frame toggle

| State | Label | Description |
|-------|-------|-------------|
| `selection` | Selection (default) | Existing behaviour — no code change |
| `canvas` | Canvas | `frame = { x: 0, y: 0, width: 100, height: 100 }` |

Defer: `key-object` (anchor slot) mode.

---

## 5. Function Specs for New Utilities

### `spaceSlotsEvenlyHorizontal(slots: LayoutSlot[]): SlotUpdate`

```
Sort slots by left edge (s.x).
totalWidth = sum of all slot widths.
availableGap = (right(last) - first.x) - totalWidth.
gapBetween = availableGap / (slots.length - 1).
Place first slot unchanged.
Each subsequent slot: x = right(previousSlot) + gapBetween.
Return SlotUpdate map.
Falls back to alignSlotsLeft when < 3 slots (consistent with existing distribute functions).
```

### `spaceSlotsEvenlyVertical(slots: LayoutSlot[]): SlotUpdate`

Symmetric to horizontal. Sort by `s.y`. Place first unchanged. Each next: `y = bottom(prev) + gapBetween`.

### `equalizeSlotsSize(slots: LayoutSlot[]): SlotUpdate`

```
avgWidth  = average of all slot.width values.
avgHeight = average of all slot.height values.
For each slot: new x = cx(slot) - avgWidth/2, new y = cy(slot) - avgHeight/2.
Return SlotUpdate { x, y, width: avgWidth, height: avgHeight }.
```

### Reference frame extension

```typescript
// Extend all six align functions to accept an optional frame.
// Default remains the current selection-relative behaviour.

function alignSlotsLeft(
  slots: LayoutSlot[],
  frame?: { x: number; y: number; width: number; height: number },
): SlotUpdate {
  const anchor = frame ? frame.x : Math.min(...slots.map((s) => s.x));
  return Object.fromEntries(slots.map((s) => [s.id, { x: anchor }]));
}
// … and similarly for the other five functions.
```

The canvas frame is always `{ x: 0, y: 0, width: 100, height: 100 }` (since all slot
coordinates are in 0–100% space).

---

## 6. Implementation Guidance for Follow-On Track

### Recommended implementation order

1. Add `spaceSlotsEvenlyHorizontal` and `spaceSlotsEvenlyVertical` to `alignSlots.ts`.
2. Add `equalizeSlotsSize` to `alignSlots.ts`.
3. Add frame-parameter support to all six align functions (backward-compatible — default =
   selection mode = existing behaviour).
4. Add a reference-frame toggle (session-local state) to `LayoutBuilderLayersPanel`.
5. Wire new distribute buttons alongside the existing ones in the Layers panel alignment toolbar.
6. Wire the equalize-sizes button.
7. Add a compact alignment sub-row to `ContextualToolbar` (multi-slot and group selections),
   showing the 6 align operations + a "…" overflow popover for Space Evenly + Equalize.
8. Gate group-as-entity model (Model A from Q2) behind P30-G landing.

### Unit test surface

- `spaceSlotsEvenlyH/V` with 3+ mixed-size slots → verify equal gaps.
- `spaceSlotsEvenlyH/V` with 2 slots → verify falls back to align-left/top.
- `equalizeSlotsSize` → verify all output slots share average dimensions, centres preserved.
- `alignSlotsLeft(slots, canvasFrame)` → verify slots snap to `x = 0`.

### Compatibility notes

- All new functions follow the existing `SlotUpdate` return type — no changes to
  `useLayoutBuilderState`, undo/redo, or persistence schema.
- The reference frame toggle is builder-session state: `const [alignFrame, setAlignFrame] = useState<'selection' | 'canvas'>('selection')`. It does not enter undo history.
- The `equalizeSlotsSize` operation changes both position AND size; it will appear in the
  undo stack as a single compound entry (consistent with how `applyAlignment` already works in
  `LayoutBuilderLayersPanel`).

---

## 7. Acceptance Criteria Sign-Off

- [x] Research notes summarising alignment behaviour in Figma, Canva, Photoshop, and Sketch.
- [x] Q1–Q5 answered with rationale and a recommended direction for each.
- [x] Proposed operation set: 11 operations with names, icons, and behaviour definitions.
- [x] Novel enhancement: "Equalize slot sizes" proposal with feasibility note.
