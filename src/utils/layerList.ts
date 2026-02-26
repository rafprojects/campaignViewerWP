/**
 * P16-A.1 — Layer list utilities for the unified Layer Panel.
 *
 * Provides a pure function `buildLayerList()` that projects the separate
 * `slots`, `overlays`, and background fields of a LayoutTemplate into a
 * single sorted layer array — identical to how Figma/Photoshop render a
 * layers panel. Also exports `getLayerName()` as the single source of truth
 * for display names throughout the builder UI.
 */
import type { LayoutTemplate, LayoutSlot, LayoutOverlay } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

export type LayerKind = 'slot' | 'overlay' | 'background';

export type SlotLayerItem = {
  kind: 'slot';
  id: string;
  zIndex: number;
  /** 0-based position in template.slots[] — used for stable sort tie-breaking */
  arrayIndex: number;
  /** 0-based visual index (for display as "Slot N") */
  index: number;
  name: string;
  visible: boolean;
  locked: boolean;
};

export type OverlayLayerItem = {
  kind: 'overlay';
  id: string;
  zIndex: number;
  /** 0-based position in template.overlays[] */
  arrayIndex: number;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
};

export type BackgroundLayerItem = {
  kind: 'background';
  id: 'background';
  zIndex: 0;
  arrayIndex: -1;
  name: string;
  visible: boolean;
};

export type LayerItem = SlotLayerItem | OverlayLayerItem | BackgroundLayerItem;

// ── Name helper ──────────────────────────────────────────────────────────────

/**
 * Returns the human-readable display name for a layer item.
 *
 * Priority: explicit `name` field → computed fallback.
 * Fallbacks:
 *  - slot     → "Slot N"     (1-based)
 *  - overlay  → "Overlay N"  (1-based position in template.overlays[])
 *  - background → "Background"
 *
 * This is the **single source of truth** used by the layer panel row, the
 * canvas tooltip, and the properties panel header.
 */
export function getLayerName(item: LayerItem, template: LayoutTemplate): string {
  if (item.kind === 'background') {
    return item.name || 'Background';
  }
  if (item.name) return item.name;
  if (item.kind === 'slot') {
    return `Media Layer ${item.index + 1}`;
  }
  // graphic layer — find position in overlays array for 1-based label
  const overlayIdx = template.overlays.findIndex((o) => o.id === item.id);
  return `Graphic Layer ${overlayIdx >= 0 ? overlayIdx + 1 : item.arrayIndex + 1}`;
}

// ── buildLayerList ───────────────────────────────────────────────────────────

/**
 * Builds a unified, sorted layer list from a `LayoutTemplate`.
 *
 * Sort order: **descending by zIndex** (highest z-index = top of panel = in
 * front visually), matching the Photoshop/Figma convention. The background
 * row is always appended last regardless of z-index values.
 *
 * **Stable sort**: when two elements have equal zIndex, the one that appears
 * later in its source array is placed higher (secondary sort: arrayIndex
 * descending). This prevents unexpected row swaps after a drag that produces
 * equal z-index values.
 */
export function buildLayerList(template: LayoutTemplate): LayerItem[] {
  const items: LayerItem[] = [];

  template.slots.forEach((slot: LayoutSlot, arrayIndex: number) => {
    items.push({
      kind: 'slot',
      id: slot.id,
      zIndex: slot.zIndex,
      arrayIndex,
      index: arrayIndex,
      name: slot.name ?? '',
      visible: slot.visible ?? true,
      locked: slot.locked ?? false,
    });
  });

  template.overlays.forEach((overlay: LayoutOverlay, arrayIndex: number) => {
    items.push({
      kind: 'overlay',
      id: overlay.id,
      zIndex: overlay.zIndex,
      arrayIndex,
      name: overlay.name ?? '',
      visible: overlay.visible ?? true,
      locked: overlay.locked ?? false,
      opacity: overlay.opacity,
    });
  });

  // Sort descending by zIndex; use arrayIndex descending as stable tie-breaker.
  items.sort((a, b) => {
    const zDiff = b.zIndex - a.zIndex;
    if (zDiff !== 0) return zDiff;
    return b.arrayIndex - a.arrayIndex;
  });

  // Background is always the bottom-most row.
  const bgItem: BackgroundLayerItem = {
    kind: 'background',
    id: 'background',
    zIndex: 0,
    arrayIndex: -1,
    name: 'Background',
    visible: true,
  };
  items.push(bgItem);

  return items;
}

// ── Reorder helper ───────────────────────────────────────────────────────────

/**
 * Returns new z-index values for all slots and overlays after a layer drag.
 *
 * Takes the current `buildLayerList()` output, moves `draggedId` to be
 * directly above `targetId` in the list, then assigns sequential z-index
 * values (top of list = highest z-index).
 *
 * Returns a map of `{ id → newZIndex }` for all non-background items.
 * The caller (useLayoutBuilderState) applies these back to the respective
 * slots[] and overlays[] arrays.
 *
 * The background layer cannot be dragged and is excluded entirely.
 */
export function computeReorderedZIndices(
  layers: LayerItem[],
  draggedId: string,
  targetId: string,
): Map<string, number> {
  // Work only with non-background items
  const movable = layers.filter((l): l is SlotLayerItem | OverlayLayerItem =>
    l.kind !== 'background',
  );

  const draggedIdx = movable.findIndex((l) => l.id === draggedId);
  const targetIdx = movable.findIndex((l) => l.id === targetId);

  if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) {
    // Nothing to do — return current z-indices unchanged
    return new Map(movable.map((l) => [l.id, l.zIndex]));
  }

  // Remove dragged item, insert above target
  const reordered = [...movable];
  const [dragged] = reordered.splice(draggedIdx, 1);
  const insertAt = reordered.findIndex((l) => l.id === targetId);
  // "Above" target in the visual panel = higher z-index = insert before target
  reordered.splice(insertAt, 0, dragged);

  // Assign sequential z-indices: top of list (index 0) gets the highest value.
  const total = reordered.length;
  const result = new Map<string, number>();
  reordered.forEach((item, i) => {
    result.set(item.id, total - i);
  });
  return result;
}
