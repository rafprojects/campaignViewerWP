# P30-K V2 - Alignment Model Spike
## Review Draft for Enhanced Alignment, Distribution, and Size Normalization

**Status:** Proposed  
**Date:** 2026-05-20  
**Audience:** Human reviewers and AI agents preparing the follow-on implementation track  
**Supersedes for planning:** `docs/P30K_ALIGNMENT_SPIKE.md`  
**Scope:** Research + implementation-ready spec only. No code changes in this track.

---

## 1. V2 Summary

This V2 keeps the original direction, but corrects stale repo assumptions and resolves the
2026-05-20 review choices.

- `P30-G` is already present in the repo: nested `LayoutGroup` geometry, cached group union
  bounds, descendant traversal, and group move/resize helpers already exist.
- The remaining blocker for true group-as-entity alignment is selection modeling, not raw group
  geometry math.
- `selection` and `canvas` become first-class reference frames for both align and distribute.
- Gap-based spacing remains the primary visible distribution mode; center-distribute stays
  available as a secondary/power-user mode.
- Size normalization expands from one action to a small family: average size, average width,
  average height, and match-to-key size.
- Locked items are skipped, not blocked, and the UI announces how many were ignored.
- The original spike remains useful as research history; this V2 is the working review draft.

---

## 2. Current Repo Reality

Current code already provides the following building blocks:

- `src/utils/alignSlots.ts` exports 8 slot-only align/distribute utilities that return a
  `Record<slotId, Partial<LayoutSlot>>` update map.
- `src/utils/alignSlots.test.ts` already covers the current 8 operations.
- `src/components/Admin/LayoutBuilder/LayoutBuilderLayersPanel.tsx` already ships a Layers-panel
  alignment toolbar.
- `src/components/Admin/LayoutBuilder/ContextualToolbar.tsx` already exists as a floating canvas
  toolbar, but currently has no alignment actions.
- `src/types/index.ts`, `src/utils/groupGeometry.ts`, and `src/hooks/useLayoutBuilderState.ts`
  already contain the nested-group model introduced by `P30-G`.

Important constraints that still matter:

- Selection is still modeled primarily as a flat set of slot IDs. Group identity is not preserved
  as a first-class selected entity in mixed selections.
- `updateSlot` / `updateSlots` do not automatically refresh cached group bounding boxes after
  arbitrary geometry changes.
- The current Layers-panel alignment toolbar only appears for `2+` selected slots, which excludes
  the high-value single-item `align to canvas` use case.

Implication: the repo is already far enough along that group-aware alignment is feasible, but the
follow-on track must solve entity selection and bbox freshness explicitly instead of pretending the
system is still flat.

---

## 3. External Reference Check

The following findings were cross-checked against official documentation or official help-center
material and are the only external claims this V2 relies on.

| Tool | High-confidence findings used by V2 | Impact on this spec |
|------|------------------------------------|---------------------|
| Figma | Alignment is relative to parent or selection; distribute horizontal/vertical spacing and tidy-up are first-class; one-dimensional tidy/distribute preserves the outer objects | Supports gap-based spacing as the primary visible distribution model |
| Canva | Single-object alignment uses the page as reference; multi-select alignment uses the selected elements as reference; grouping/layering/alignment all live under the Position surface | Supports a clear `selection` vs `canvas/page` frame model |
| Sketch | Multi-layer alignment uses selection bounds; Option-align to frame exists; reference-layer alignment exists; distribute, tidy, and make-grid are first-class | Supports future reference-object behavior and a later tidy/grid evolution |
| Photoshop | Official help clearly documents the align family, and Adobe help/search material documents a separate distribute family; distribute-by-centers remains a legitimate professional-tool pattern | Supports keeping center-distribute while adding gap-distribute |

Reference confidence notes:

- Figma, Canva, and Sketch are strong enough to support the main product choices in this spec.
- Photoshop fully supports the keep-both distribute decision, but the exact `selection/canvas/artboard`
  wording should still be re-verified live before final UI copy is locked.
- This V2 does **not** depend on undocumented Canva tidy behavior or on a hard implementation claim
  about Figma key-object UX; both are deferred from scope-sensitive decisions here.

---

## 4. V2 Product Decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Center-distribute vs gap-distribute | Keep both. Make gap-distribute the primary visible path. Keep center-distribute as a secondary/overflow action. |
| 2 | Groups in mixed selections | Treat groups as alignment entities. A selected group moves as one bbox unit and fans its delta to all descendant slots. |
| 3 | Reference frames | `selection` and `canvas` apply to both align and distribute. `key-object` is deferred. |
| 4 | Selection model | Add explicit selected-entity state. Do not try to infer all alignment intent from `selectedSlotIds` alone. |
| 5 | Size normalization scope | Include average size, average width, average height, and match-to-key size. |
| 6 | Locked items | Skip locked entities, continue with the unlocked subset, and announce the skip count. |
| 7 | Surface strategy | Layers panel remains the primary surface. Contextual toolbar gets a compact subset plus overflow. |
| 8 | Right-click menu and new shortcuts | Defer. Existing Layers and contextual-toolbar surfaces are sufficient for this phase. |

Availability rules:

- Selection-frame align: `2+` unlocked entities.
- Canvas-frame align: `1+` unlocked entities.
- Distribute / space evenly: `3+` unlocked entities.
- Size normalization: `2+` unlocked slot entities.
- Match-to-key size: `2+` unlocked slot entities with one implicit key slot.

---

## 5. Reference Frames and Axis Semantics

### 5.1 Modes

| Mode | Frame | Applies to | Notes |
|------|-------|------------|-------|
| `selection` | Bounding box of selected alignment entities | Align + distribute | Current slot behavior, extended to entities |
| `canvas` | `{ x: 0, y: 0, width: 100, height: 100 }` | Align + distribute | Session-local, not persisted |
| `key-object` | Deferred | Future | Separate interaction model |

### 5.2 Align semantics

- Left/top align uses `frame.x` / `frame.y`.
- Right/bottom align uses `frame.x + frame.width` / `frame.y + frame.height`.
- Horizontal/vertical center align uses the midpoint of the active frame.
- Canvas-frame align is available for a single unlocked entity, since centering or edge-aligning a
  single item to the full canvas is one of the highest-value use cases.

### 5.3 Distribute semantics

Selection mode:

- `distributeSlotsHorizontally` / `distributeSlotsVertically` preserve the outermost selected
  entities and equalize center spacing within the current selection bounds.
- `spaceSlotsEvenlyHorizontal` / `spaceSlotsEvenlyVertical` preserve the outermost selected
  entities and equalize edge-to-edge gaps within the current selection bounds.

Canvas mode:

- `distributeSlotsHorizontally` / `distributeSlotsVertically` sort the selected entities on the
  active axis and spread their centers across the full canvas frame.
- `spaceSlotsEvenlyHorizontal` / `spaceSlotsEvenlyVertical` sort the selected entities on the
  active axis, place the first entity flush to the frame start, place the last entity flush to the
  frame end, and equalize the interior gaps.

Edge-case rule:

- If a canvas spacing operation cannot fit the selected entity widths/heights within the frame on
  the active axis, disable the action and announce why.
- Selection-relative spacing may still yield negative gaps if the current outer span already forces
  overlap. That is mathematically valid, but it is not overlap-safe. The implementation track
  should document and test this explicitly.

---

## 6. Alignment Entity Model

The follow-on implementation should not try to treat groups as fake slots. It should resolve the
active selection into alignment entities.

```ts
type LayoutSelectionEntity =
  | { kind: 'slot'; id: string }
  | { kind: 'group'; id: string };

interface AlignmentEntity {
  id: string;
  kind: 'slot' | 'group';
  x: number;
  y: number;
  width: number;
  height: number;
  memberSlotIds: string[];
}
```

Rules:

- Slot entity: current slot rect, `memberSlotIds = [slot.id]`.
- Group entity: union bbox from `computeGroupRect()` or the cached group rect when known-fresh,
  `memberSlotIds = all descendant slot ids`.
- Alignment math runs on `AlignmentEntity[]`, not raw `LayoutSlot[]`.
- Returned entity deltas fan out to descendant slots as uniform movement on the relevant axis.
- `selectedSlotIds` can remain as a derived convenience for existing editor behavior, but alignment
  must read `selectedEntities` so group identity survives mixed selections.

Scope note:

- Group-as-entity is required for align and distribute.
- Size-normalization operations remain slot-only in this phase. If a persisted group entity is
  selected, size-normalization actions should be disabled rather than silently scaling descendants.

---

## 7. Operation Set

### 7.1 Align operations

| # | Name | Function | Available when |
|---|------|----------|----------------|
| 1 | Align left | `alignSlotsLeft` | Selection frame: `2+` unlocked entities; canvas frame: `1+` |
| 2 | Center horizontally | `centerSlotsHorizontally` | Selection frame: `2+` unlocked entities; canvas frame: `1+` |
| 3 | Align right | `alignSlotsRight` | Selection frame: `2+` unlocked entities; canvas frame: `1+` |
| 4 | Align top | `alignSlotsTop` | Selection frame: `2+` unlocked entities; canvas frame: `1+` |
| 5 | Center vertically | `centerSlotsVertically` | Selection frame: `2+` unlocked entities; canvas frame: `1+` |
| 6 | Align bottom | `alignSlotsBottom` | Selection frame: `2+` unlocked entities; canvas frame: `1+` |

All six accept an optional `frame` parameter. In `canvas` mode the frame is always the full
percentage canvas.

### 7.2 Distribute operations

| # | Name | Function | Available when |
|---|------|----------|----------------|
| 7 | Distribute centers H | `distributeSlotsHorizontally` | `3+` unlocked entities |
| 8 | Distribute centers V | `distributeSlotsVertically` | `3+` unlocked entities |
| 9 | Space evenly H | `spaceSlotsEvenlyHorizontal` | `3+` unlocked entities |
| 10 | Space evenly V | `spaceSlotsEvenlyVertical` | `3+` unlocked entities |

UI priority:

- `Space evenly H/V` should be the primary visible distribution affordance.
- `Distribute centers H/V` should remain available, but can move to overflow or secondary grouping.

### 7.3 Size-normalization operations

| # | Name | Function | Available when |
|---|------|----------|----------------|
| 11 | Equalize size | `equalizeSlotsSize` | `2+` unlocked slot entities |
| 12 | Equalize widths | `equalizeSlotsWidth` | `2+` unlocked slot entities |
| 13 | Equalize heights | `equalizeSlotsHeight` | `2+` unlocked slot entities |
| 14 | Match to key size | `matchSlotsToKeySize` | `2+` unlocked slot entities |

Size-normalization rules:

- These actions are slot-only in this phase.
- Each operation preserves the current center point of every affected slot unless explicitly noted.
- `matchSlotsToKeySize` uses the last-selected unlocked slot as the temporary key in V1. The key
  slot itself does not move or resize.
- Dedicated key-object interaction remains deferred; this action only borrows a deterministic key
  rule for the size-match family.

---

## 8. Utility Specs

### 8.1 Frame-aware align functions

The follow-on track can either generalize the current utilities internally or keep the existing
slot-named exports as thin wrappers over a generic entity-math layer. The key requirement is that
frame-aware math runs on alignment entities.

Example generic shape:

```ts
interface AlignFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

function alignEntitiesLeft(
  entities: AlignmentEntity[],
  frame?: AlignFrame,
): SlotUpdate;
```

If no frame is provided, the implementation derives one from the selected alignment entities.

### 8.2 Gap-based spacing

`spaceSlotsEvenlyHorizontal(entities, frame?)`

- Sort entities by `x`.
- Compute `totalWidth = sum(width)`.
- In selection mode, use the current selection frame.
- In canvas mode, use the full canvas frame.
- Compute `gap = (frame.width - totalWidth) / (entities.length - 1)`.
- Place the first entity at `frame.x`, the last at `frame.x + frame.width - last.width`, and all
  interior entities using `previousRight + gap`.

`spaceSlotsEvenlyVertical(entities, frame?)` is symmetric on `y` / `height`.

### 8.3 Center-distribute with frame

`distributeSlotsHorizontally(entities, frame?)`

- Sort entities by center `cx`.
- Selection mode preserves the current outermost centers.
- Canvas mode sets the first center to `frame.x + first.width / 2` and the last center to
  `frame.x + frame.width - last.width / 2`.
- Interior entities are stepped evenly between those two centers.

`distributeSlotsVertically(entities, frame?)` is symmetric on `cy`.

### 8.4 Size normalization

`equalizeSlotsSize(slots)`

- `avgWidth = average(width)`
- `avgHeight = average(height)`
- For each slot: preserve center, write `{ x, y, width: avgWidth, height: avgHeight }`

`equalizeSlotsWidth(slots)`

- `avgWidth = average(width)`
- Preserve each slot's center and current height
- Write `{ x, width: avgWidth }`

`equalizeSlotsHeight(slots)`

- `avgHeight = average(height)`
- Preserve each slot's center and current width
- Write `{ y, height: avgHeight }`

`matchSlotsToKeySize(slots, keySlotId)`

- Resolve the key slot from the current unlocked selection
- Copy the key slot's `width` and `height` to every other selected slot
- Preserve each target slot's center
- Do not modify the key slot itself

---

## 9. Locked-Item Behavior

Locked behavior is explicit in V2:

- Locked slot entities are skipped.
- Locked group entities are skipped as whole entities.
- If skipping locked items leaves too few unlocked entities for the chosen action, the action is
  disabled or exits early with a clear announcement.
- UI copy should announce the skip count, for example: `Skipped 2 locked items`.

This keeps the action predictable without turning one locked item into a full-blocking failure.

---

## 10. UI Surface Model

### 10.1 Layers panel

The Layers panel remains the primary home for the full operation set.

Required additions:

- Shared `selection` / `canvas` frame toggle.
- Primary align row.
- Primary spacing row or grouped distribution area.
- Size-normalization group.
- Clear disabled states for locked-item and insufficient-selection cases.

### 10.2 Contextual toolbar

The contextual toolbar gets the compact, high-frequency subset.

Recommended visible actions:

- Align left
- Center horizontally
- Align right
- Align top
- Center vertically
- Align bottom

Overflow contents:

- Space evenly H
- Space evenly V
- Equalize size

Implementation note:

- The contextual toolbar currently assumes a relatively narrow width. The wider action set needs
  revised clamping/overflow behavior instead of simply adding more buttons to the existing row.

### 10.3 Shared state placement

If both the Layers panel and the contextual toolbar expose alignment actions, the frame mode must
live above both surfaces. Do not store `alignFrame` only inside `LayoutBuilderLayersPanel`.

Recommended owner: builder-session state shared through the existing Layout Builder shell or dock
context.

---

## 11. Implementation Guidance

### 11.1 Recommended order

1. Add an alignment-entity resolver layer above the current slot-only math.
2. Extend the align/distribute utility surface with optional `frame` support.
3. Add `spaceSlotsEvenlyHorizontal` and `spaceSlotsEvenlyVertical`.
4. Add `equalizeSlotsSize`, `equalizeSlotsWidth`, `equalizeSlotsHeight`, and
   `matchSlotsToKeySize`.
5. Add explicit selected-entity state so groups are first-class selection targets.
6. Harden group-bbox freshness for geometry-affecting slot updates, or compute group rects on
   demand and refresh caches when alignment commits.
7. Add shared frame-mode state above both toolbar surfaces.
8. Update the Layers panel to expose the full operation set.
9. Update the contextual toolbar to expose the compact subset plus overflow.
10. Add focused tests before broader UI polish.

### 11.2 Recommended file touch points

- `src/utils/alignSlots.ts`
- `src/utils/alignSlots.test.ts`
- `src/utils/groupGeometry.ts`
- `src/hooks/useLayoutBuilderState.ts`
- `src/components/Admin/LayoutBuilder/BuilderDockContext.tsx`
- `src/components/Admin/LayoutBuilder/LayoutBuilderLayersPanel.tsx`
- `src/components/Admin/LayoutBuilder/ContextualToolbar.tsx`
- `src/components/Admin/LayoutBuilder/ContextualToolbar.test.tsx`
- `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx`

### 11.3 Compatibility notes

- Keep the existing `SlotUpdate` return pattern.
- Do not persist frame-mode state into the template.
- Keep each action as a single undo entry.
- Prefer specific history labels over a generic `Align slots` label when practical.

---

## 12. Validation Surface

Utility coverage:

- Frame-aware align against `selection` and `canvas`
- Center-distribute against `selection` and `canvas`
- Gap-distribute with mixed sizes
- Canvas spacing disable when total extent exceeds frame size
- Locked-item skipping
- Average size, width-only, height-only, and key-size match

Entity-model coverage:

- Mixed slot + group selection resolves to distinct alignment entities
- Group entity moves all descendants by one delta on the active axis
- Group bbox freshness is correct after committed alignment updates

UI coverage:

- Layers panel shows correct enable/disable states
- Contextual toolbar shows the compact subset and overflow actions
- Wider contextual toolbar still clamps inside visible canvas bounds
- Canvas-frame align works for a single unlocked entity

Manual QA:

- Single item centered on canvas
- Three mixed-width items spaced evenly on canvas
- Mixed group + slot alignment
- Locked-item skip announcement
- Match-to-key size using last-selected slot as the key

---

## 13. Acceptance Criteria

- [x] V2 reflects current repo reality instead of assuming `P30-G` is still pending.
- [x] `selection` and `canvas` are defined for both align and distribute.
- [x] Group-as-entity behavior is specified through an explicit selection-entity model.
- [x] Gap-distribute and center-distribute both remain available, with clear UI priority.
- [x] Size normalization now includes average size, average width, average height, and
      match-to-key size.
- [x] Locked-item behavior is explicitly defined.
- [x] Layers panel and contextual toolbar responsibilities are clearly split.
- [x] Validation surface is specific enough to guide implementation and review.

---

## 14. Review Focus

This document is intended for further human and AI review before implementation begins.

Reviewers should pay particular attention to:

1. Whether the proposed `selectedEntities` model is the right long-term selection abstraction.
2. Whether disabling canvas spacing when the selected total extent exceeds the frame is the right
   UX, or whether a more permissive fallback is preferable.
3. Whether `last-selected slot = implicit key` is acceptable for `matchSlotsToKeySize` until a
   dedicated key-object interaction exists.
4. Whether the contextual-toolbar subset is small enough to remain usable at common canvas widths.

---

## 15. Official References

- Figma Help: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-and-position
- Canva Help: https://www.canva.com/help/layer-group-align/
- Canva Help: https://www.canva.com/help/moving-elements/
- Canva Help: https://www.canva.com/help/finding-and-arranging-layers/
- Sketch Docs: https://www.sketch.com/docs/designing/layer-basics/aligning-layers/
- Adobe Help: https://helpx.adobe.com/photoshop/using/aligning-layers.html
