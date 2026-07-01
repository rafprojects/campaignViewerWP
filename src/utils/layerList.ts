/**
 * P16-A.1 — Layer list utilities for the unified Layer Panel.
 *
 * Provides a pure function `buildLayerList()` that projects the separate
 * `slots`, `overlays`, and background fields of a LayoutTemplate into a
 * single sorted layer array — identical to how Figma/Photoshop render a
 * layers panel. Also exports `getLayerName()` as the single source of truth
 * for display names throughout the builder UI.
 *
 * P30-G update: the function is now tree-aware. When `template.groups`
 * contains a nested hierarchy (via `childGroupIds` / `parentGroupId`), the
 * output reflects the full group tree — each group header is followed
 * immediately by its child groups and leaf-member slots (indented by depth),
 * then ungrouped items follow at depth 0. Every item carries a `depth` field
 * (0 = top-level) and `ancestorGroupIds` so the panel can collapse entire
 * subtrees without rescanning the tree on every render.
 */
import type { LayoutTemplate, LayoutSlot, LayoutGraphicLayer, LayoutTextLayer, LayoutGroup } from '@/types';
import { buildGroupMap, collectDescendantSlotIds } from '@wp-super-gallery/shared-utils';

// ── Types ──────────────────────────────────────────────────────────────

export type LayerKind = 'slot' | 'graphic' | 'text' | 'background' | 'mask' | 'group';

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
  /** Nesting depth (0 = top-level / ungrouped, 1 = inside a group, …). P30-G */
  depth: number;
  /** IDs of ancestor groups from immediate parent up to root. P30-G */
  ancestorGroupIds: string[];
};

export type GraphicLayerItem = {
  kind: 'graphic';
  id: string;
  zIndex: number;
  /** 0-based position in template.overlays[] */
  arrayIndex: number;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  /** Nesting depth. Overlays are not yet group-aware so this is always 0. P30-G */
  depth: number;
  /** Always empty for overlays. P30-G */
  ancestorGroupIds: string[];
};

export type TextLayerItem = {
  kind: 'text';
  id: string;
  zIndex: number;
  /** 0-based position in template.texts[] */
  arrayIndex: number;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  /** Text layers are not group-aware (P59-B), so this is always 0. */
  depth: number;
  /** Always empty for text layers. */
  ancestorGroupIds: string[];
};

export type BackgroundLayerItem = {
  kind: 'background';
  id: 'background';
  zIndex: 0;
  arrayIndex: -1;
  name: string;
  visible: boolean;
  /** Always 0. P30-G */
  depth: number;
  /** Always empty. P30-G */
  ancestorGroupIds: string[];
};

export type MaskLayerItem = {
  kind: 'mask';
  /** Synthetic id: `mask-{parentSlotId}` */
  id: string;
  /** The slot that owns this mask. */
  parentSlotId: string;
  /** Inherits the parent slot's zIndex for ordering purposes (sublayer). */
  zIndex: number;
  arrayIndex: -1;
  name: string;
  visible: boolean;
  /** depth of parent slot + 1. P30-G */
  depth: number;
  /** Ancestors of the parent slot. P30-G */
  ancestorGroupIds: string[];
};

export type GroupLayerItem = {
  kind: 'group';
  id: string;
  /** The group data object. */
  group: LayoutGroup;
  zIndex: number;
  arrayIndex: number;
  name: string;
  visible: boolean;
  locked: boolean;
  /** Nesting depth (0 = top-level group). P30-G */
  depth: number;
  /** IDs of ancestor groups (empty for top-level groups). P30-G */
  ancestorGroupIds: string[];
  /**
   * Total count of all descendant SLOT members (direct + via child groups). P30-G
   * Use this instead of `group.memberIds.length` for display labels.
   */
  totalDescendantCount: number;
  /**
   * All descendant slot IDs (direct + via child groups). P30-G
   * Used by LayerPanel to compute `isGroupSelected` without re-traversing.
   */
  descendantSlotIds: string[];
};

export type LayerItem = SlotLayerItem | GraphicLayerItem | TextLayerItem | BackgroundLayerItem | MaskLayerItem | GroupLayerItem;

// ── Name helper ──────────────────────────────────────────────────────────────

/**
 * Returns the human-readable display name for a layer item.
 *
 * Priority: explicit `name` field → computed fallback.
 * Fallbacks:
 *  - slot     → "Media Layer N"   (1-based)
 *  - graphic    → "Graphic Layer N" (1-based position in template.overlays[])
 *  - background → "Background"
 *
 * This is the **single source of truth** used by the layer panel row, the
 * canvas tooltip, and the properties panel header.
 */
export function getLayerName(item: LayerItem, _template: LayoutTemplate): string {
  if (item.kind === 'background') {
    return item.name || 'Background';
  }
  if (item.kind === 'mask') {
    return item.name || 'Mask';
  }
  if (item.kind === 'group') {
    return item.name || `Group`;
  }
  if (item.name) return item.name;
  if (item.kind === 'slot') {
    return `Media Layer ${item.index + 1}`;
  }
  if (item.kind === 'text') {
    return `Text Layer ${item.arrayIndex + 1}`;
  }
  // graphic layer — use stored 0-based arrayIndex for 1-based label
  return `Graphic Layer ${item.arrayIndex + 1}`;
}

// ── buildLayerList ───────────────────────────────────────────────────────────

/**
 * Builds a unified, tree-ordered layer list from a `LayoutTemplate`.
 *
 * **Tree order:** Group headers appear first, immediately followed by their
 * child groups and leaf-member slots in descending z-index order (same as
 * Figma). Ungrouped slots and overlays are sorted into the flat list by
 * z-index alongside top-level group positions.
 *
 * **Sort within a level:** descending by zIndex; array-index descending as a
 * stable tie-breaker (later in the source array = higher in the panel).
 *
 * **Backward-compatible:** templates without `groups` (or with flat P29-G-C
 * groups that lack `childGroupIds`) behave identically to the pre-P30-G
 * implementation: groups are emitted with depth=0 and empty ancestorGroupIds.
 */
export function buildLayerList(template: LayoutTemplate): LayerItem[] {
  const groups = template.groups ?? [];
  const groupMap = buildGroupMap(groups);

  // Stable index lookups for slots
  const slotMap = new Map<string, LayoutSlot>(template.slots.map((s) => [s.id, s]));
  const slotIndexMap = new Map<string, number>(template.slots.map((s, i) => [s.id, i]));

  // ── Compute representative z-index for a group ────────────────────────────
  // = max zIndex of all descendant slots (0 if group has no resolvable slots).
  const groupRepZCache = new Map<string, number>();
  function groupRepZ(groupId: string): number {
    const cached = groupRepZCache.get(groupId);
    if (cached !== undefined) return cached;
    const slotIds = collectDescendantSlotIds(groupId, groupMap);
    let maxZ = 0;
    for (const sid of slotIds) {
      const slot = slotMap.get(sid);
      if (slot && slot.zIndex > maxZ) maxZ = slot.zIndex;
    }
    groupRepZCache.set(groupId, maxZ);
    return maxZ;
  }

  // ── Find all slot IDs that belong to any group hierarchy ─────────────────
  const allGroupedSlotIds = new Set<string>();
  for (const g of groups) {
    for (const sid of collectDescendantSlotIds(g.id, groupMap)) {
      allGroupedSlotIds.add(sid);
    }
  }

  // ── Top-level groups (no parent) ──────────────────────────────────────────
  const topLevelGroups = groups.filter((g) => !g.parentGroupId);

  // ── Ungrouped items ───────────────────────────────────────────────────────
  const ungroupedSlots = template.slots.filter((s) => !allGroupedSlotIds.has(s.id));

  // ── Result accumulator ────────────────────────────────────────────────────
  const result: LayerItem[] = [];

  // ── DFS group emitter ─────────────────────────────────────────────────────
  function emitGroup(groupId: string, depth: number, ancestorGroupIds: string[]): void {
    const group = groupMap.get(groupId);
    if (!group) return;

    const repZ = groupRepZ(groupId);
    const descendantSlotIds = collectDescendantSlotIds(groupId, groupMap).filter(
      (sid) => slotMap.has(sid),
    );
    // Use the highest slot array-index among all descendants as the tie-breaker,
    // so group rows sort consistently with ungrouped slots (both reference
    // template.slots position — backward-compatible with the pre-P30-G order).
    const repAi = descendantSlotIds.reduce(
      (max, sid) => Math.max(max, slotIndexMap.get(sid) ?? 0),
      0,
    );

    result.push({
      kind: 'group',
      id: groupId,
      group,
      zIndex: repZ,
      arrayIndex: repAi,
      name: group.name ?? '',
      visible: group.visible !== false,
      locked: group.locked ?? false,
      depth,
      ancestorGroupIds,
      totalDescendantCount: descendantSlotIds.length,
      descendantSlotIds,
    });

    const myAncestors = [...ancestorGroupIds, groupId];

    // ── Build interleaved child list (child groups + direct member slots) ───
    type ChildEntry =
      | { kind: 'group'; id: string; z: number; ai: number }
      | { kind: 'slot'; slot: LayoutSlot; ai: number };

    const childGroups: ChildEntry[] = (group.childGroupIds ?? []).map((cid, i) => ({
      kind: 'group' as const,
      id: cid,
      z: groupRepZ(cid),
      ai: i,
    }));

    const memberSlots: ChildEntry[] = group.memberIds
      .map((mid): ChildEntry | null => {
        const slot = slotMap.get(mid);
        if (!slot) return null;
        return { kind: 'slot' as const, slot, ai: slotIndexMap.get(mid) ?? 0 };
      })
      .filter((e): e is ChildEntry => e !== null);

    const children = [...childGroups, ...memberSlots];
    children.sort((a, b) => {
      const za = a.kind === 'group' ? a.z : a.slot.zIndex;
      const zb = b.kind === 'group' ? b.z : b.slot.zIndex;
      if (za !== zb) return zb - za;
      return b.ai - a.ai; // stable: higher array-index wins
    });

    for (const child of children) {
      if (child.kind === 'group') {
        emitGroup(child.id, depth + 1, myAncestors);
      } else {
        const { slot, ai } = child;
        result.push({
          kind: 'slot',
          id: slot.id,
          zIndex: slot.zIndex,
          arrayIndex: ai,
          index: ai,
          name: slot.name ?? '',
          visible: slot.visible ?? true,
          locked: slot.locked ?? false,
          depth: depth + 1,
          ancestorGroupIds: myAncestors,
        });
        if (slot.maskLayer) {
          result.push({
            kind: 'mask',
            id: `mask-${slot.id}`,
            parentSlotId: slot.id,
            zIndex: slot.zIndex,
            arrayIndex: -1,
            name: 'Mask',
            visible: slot.maskLayer.visible !== false,
            depth: depth + 2,
            ancestorGroupIds: myAncestors,
          });
        }
      }
    }
  }

  // ── Build sortable top-level list ─────────────────────────────────────────
  type TopItem =
    | { kind: 'group'; id: string; z: number; ai: number }
    | { kind: 'slot'; slot: LayoutSlot; ai: number; z: number }
    | { kind: 'graphic'; overlay: LayoutGraphicLayer; ai: number; z: number }
    | { kind: 'text'; text: LayoutTextLayer; ai: number; z: number };

  const topItems: TopItem[] = [
    ...topLevelGroups.map((g) => {
      // Tie-breaker = max slot array-index among all descendants (same semantic
      // as ungrouped slots) so zIndex ties resolve consistently across types.
      const descIds = collectDescendantSlotIds(g.id, groupMap);
      const maxAi = descIds.reduce((m, sid) => Math.max(m, slotIndexMap.get(sid) ?? 0), 0);
      return { kind: 'group' as const, id: g.id, z: groupRepZ(g.id), ai: maxAi };
    }),
    ...ungroupedSlots.map((s) => {
      const ai = slotIndexMap.get(s.id) ?? 0;
      return { kind: 'slot' as const, slot: s, ai, z: s.zIndex };
    }),
    ...template.overlays.map((o, ai) => ({
      kind: 'graphic' as const, overlay: o, ai, z: o.zIndex,
    })),
    ...(template.texts ?? []).map((t, ai) => ({
      kind: 'text' as const, text: t, ai, z: t.zIndex,
    })),
  ];

  topItems.sort((a, b) => {
    if (a.z !== b.z) return b.z - a.z;
    return b.ai - a.ai; // stable: higher array-index wins
  });

  for (const item of topItems) {
    if (item.kind === 'group') {
      emitGroup(item.id, 0, []);
    } else if (item.kind === 'slot') {
      const { slot, ai } = item;
      result.push({
        kind: 'slot',
        id: slot.id,
        zIndex: slot.zIndex,
        arrayIndex: ai,
        index: ai,
        name: slot.name ?? '',
        visible: slot.visible ?? true,
        locked: slot.locked ?? false,
        depth: 0,
        ancestorGroupIds: [],
      });
      if (slot.maskLayer) {
        result.push({
          kind: 'mask',
          id: `mask-${slot.id}`,
          parentSlotId: slot.id,
          zIndex: slot.zIndex,
          arrayIndex: -1,
          name: 'Mask',
          visible: slot.maskLayer.visible !== false,
          depth: 1,
          ancestorGroupIds: [],
        });
      }
    } else if (item.kind === 'graphic') {
      const { overlay, ai } = item;
      result.push({
        kind: 'graphic',
        id: overlay.id,
        zIndex: overlay.zIndex,
        arrayIndex: ai,
        name: overlay.name ?? '',
        visible: overlay.visible ?? true,
        locked: overlay.locked ?? false,
        opacity: overlay.opacity,
        depth: 0,
        ancestorGroupIds: [],
      });
    } else {
      const { text, ai } = item;
      result.push({
        kind: 'text',
        id: text.id,
        zIndex: text.zIndex,
        arrayIndex: ai,
        name: text.name ?? '',
        visible: text.visible ?? true,
        locked: text.locked ?? false,
        opacity: text.opacity,
        depth: 0,
        ancestorGroupIds: [],
      });
    }
  }

  // Background is always the bottom-most row.
  result.push({
    kind: 'background',
    id: 'background',
    zIndex: 0,
    arrayIndex: -1,
    name: 'Background',
    visible: true,
    depth: 0,
    ancestorGroupIds: [],
  });

  return result;
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
  // Work only with non-background, non-mask, non-group items
  const movable = layers.filter((l): l is SlotLayerItem | GraphicLayerItem | TextLayerItem =>
    l.kind !== 'background' && l.kind !== 'mask' && l.kind !== 'group',
  );

  const draggedIdx = movable.findIndex((l) => l.id === draggedId);

  if (draggedIdx === -1) {
    // Dragged item not found — return current z-indices unchanged
    return new Map(movable.map((l) => [l.id, l.zIndex]));
  }

  // Remove dragged item first so we can find the correct insertion point
  const reordered = [...movable];
  const [draggedRaw] = reordered.splice(draggedIdx, 1);
  const dragged = draggedRaw!;

  let insertAt: number;
  if (targetId === 'background') {
    // Dropping onto/near the Background row → place the dragged item at the
    // bottom of the movable stack (just above background, lowest z-index).
    insertAt = reordered.length;
  } else {
    const targetIdx = reordered.findIndex((l) => l.id === targetId);
    if (targetIdx === -1) {
      // Target not found — return current z-indices unchanged (re-add dragged)
      reordered.splice(draggedIdx, 0, dragged);
      return new Map(reordered.map((l) => [l.id, l.zIndex]));
    }
    // "Above" target in the visual panel = higher z-index = insert before target
    insertAt = targetIdx;
  }

  // Insert the dragged item at the computed position
  reordered.splice(insertAt, 0, dragged);

  // Assign sequential z-indices: top of list (index 0) gets the highest value.
  const total = reordered.length;
  const result = new Map<string, number>();
  reordered.forEach((item, i) => {
    result.set(item.id, total - i);
  });
  return result;
}
