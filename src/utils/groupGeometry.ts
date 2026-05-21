/**
 * P30-G — Group geometry utilities: coordinate resolver, bounding-box
 * computation, migration, and tree-traversal helpers.
 *
 * Design note on position semantics
 * ----------------------------------
 * All LayoutSlot positions (slot.x, slot.y, slot.width, slot.height) remain
 * canvas-absolute 0–100% coordinates throughout the P30-G model. The group
 * frame fields (group.x/y/width/height) are the *union bounding box* of all
 * descendants in that same canvas space — maintained by group operations so
 * callers can position group chrome without scanning every slot.
 *
 * This means "moving a group" still updates every descendant slot by the same
 * delta. The efficiency gain from a fully parent-relative coordinate space
 * (where only group.x/y need updating) is deferred; the user-visible nesting
 * feature is complete.
 */
import type { LayoutGroup, LayoutSlot } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Tree traversal ───────────────────────────────────────────────────────────

/** Map from groupId → LayoutGroup for O(1) lookup. */
export function buildGroupMap(groups: LayoutGroup[]): Map<string, LayoutGroup> {
  return new Map(groups.map((g) => [g.id, g]));
}

/**
 * Returns all LEAF slot IDs that belong to `groupId` or any of its
 * descendants, walking the child group tree recursively.
 */
export function collectDescendantSlotIds(
  groupId: string,
  groupMap: Map<string, LayoutGroup>,
): string[] {
  const result: string[] = [];
  const stack = [groupId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const gid = stack.pop()!;
    if (visited.has(gid)) continue;
    visited.add(gid);
    const g = groupMap.get(gid);
    if (!g) continue;
    // Collect leaf members
    result.push(...g.memberIds);
    // Recurse into child groups
    for (const childId of g.childGroupIds ?? []) {
      stack.push(childId);
    }
  }
  return result;
}

/**
 * Returns the IDs of all groups that are descendants of `groupId`
 * (direct and indirect child groups), not including `groupId` itself.
 */
export function collectDescendantGroupIds(
  groupId: string,
  groupMap: Map<string, LayoutGroup>,
): string[] {
  const result: string[] = [];
  const stack = [...(groupMap.get(groupId)?.childGroupIds ?? [])];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const gid = stack.pop()!;
    if (visited.has(gid)) continue;
    visited.add(gid);
    result.push(gid);
    const g = groupMap.get(gid);
    if (g) stack.push(...(g.childGroupIds ?? []));
  }
  return result;
}

/**
 * Returns the ancestor chain for `groupId` from immediate parent up to the
 * root, as an ordered array [ parentId, grandParentId, … ].
 * Returns an empty array for top-level groups.
 */
export function getAncestorChain(
  groupId: string,
  groupMap: Map<string, LayoutGroup>,
): string[] {
  const chain: string[] = [];
  let current = groupMap.get(groupId);
  const visited = new Set<string>();

  while (current?.parentGroupId) {
    if (visited.has(current.parentGroupId)) break; // guard against cycles
    visited.add(current.parentGroupId);
    chain.push(current.parentGroupId);
    current = groupMap.get(current.parentGroupId);
  }
  return chain;
}

// ── Bounding-box computation ─────────────────────────────────────────────────

/**
 * Computes the canvas-absolute union bounding box of all DIRECT member slots
 * and child groups within `groupId`, one level deep only. Used internally to
 * seed `computeGroupRect`.
 *
 * Returns null if the group has no resolvable members.
 */
function computeGroupRectShallow(
  group: LayoutGroup,
  slotMap: Map<string, LayoutSlot>,
  groupMap: Map<string, LayoutGroup>,
): Rect | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const sid of group.memberIds) {
    const slot = slotMap.get(sid);
    if (!slot) continue;
    minX = Math.min(minX, slot.x);
    minY = Math.min(minY, slot.y);
    maxX = Math.max(maxX, slot.x + slot.width);
    maxY = Math.max(maxY, slot.y + slot.height);
  }

  for (const cid of group.childGroupIds ?? []) {
    const childRect = computeGroupRect(cid, slotMap, groupMap);
    if (!childRect) continue;
    minX = Math.min(minX, childRect.x);
    minY = Math.min(minY, childRect.y);
    maxX = Math.max(maxX, childRect.x + childRect.width);
    maxY = Math.max(maxY, childRect.y + childRect.height);
  }

  if (!isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Computes the canvas-absolute union bounding box of all descendants of the
 * group with `groupId` (recursive across the full child tree).
 *
 * Returns null if the group does not exist or has no slot members anywhere
 * in its descendant tree.
 */
export function computeGroupRect(
  groupId: string,
  slotMap: Map<string, LayoutSlot>,
  groupMap: Map<string, LayoutGroup>,
): Rect | null {
  const group = groupMap.get(groupId);
  if (!group) return null;
  return computeGroupRectShallow(group, slotMap, groupMap);
}

/**
 * Recomputes and WRITES `x, y, width, height` on every group in the array
 * using canvas-absolute slot positions. Mutates the group objects in-place.
 *
 * Call this after any operation that changes slot positions or group membership.
 */
export function refreshGroupRects(
  groups: LayoutGroup[],
  slots: LayoutSlot[],
): void {
  const slotMap = new Map(slots.map((s) => [s.id, s]));
  const groupMap = buildGroupMap(groups);
  for (const g of groups) {
    const rect = computeGroupRect(g.id, slotMap, groupMap);
    if (rect) {
      g.x = rect.x;
      g.y = rect.y;
      g.width = rect.width;
      g.height = rect.height;
    }
  }
}

// ── Migration ────────────────────────────────────────────────────────────────

/**
 * Migrates a flat P29-G-C group array to P30-G format by adding the
 * hierarchy fields (parentGroupId, childGroupIds) and computing initial
 * bounding boxes.
 *
 * This function is IDEMPOTENT: if a group already has `childGroupIds` defined
 * it is treated as already-migrated and left unchanged.
 *
 * Slot positions are NOT mutated — they remain canvas-absolute.
 */
export function migrateGroupsToP30G(
  groups: LayoutGroup[],
  slots: LayoutSlot[],
): LayoutGroup[] {
  const migrated = groups.map((g): LayoutGroup => {
    if (g.childGroupIds !== undefined) return g; // already migrated
    return {
      ...g,
      childGroupIds: [],
      parentGroupId: null,
    };
  });

  // Compute initial bounding boxes for migrated groups
  const slotMap = new Map(slots.map((s) => [s.id, s]));
  const groupMap = buildGroupMap(migrated);
  for (const g of migrated) {
    if (g.x !== undefined) continue; // bounding box already set
    const rect = computeGroupRect(g.id, slotMap, groupMap);
    if (rect) {
      g.x = rect.x;
      g.y = rect.y;
      g.width = rect.width;
      g.height = rect.height;
    }
  }
  return migrated;
}

// ── Move helpers ─────────────────────────────────────────────────────────────

/**
 * Applies a canvas-percentage delta to all LEAF slots that are descendants of
 * `groupId` (direct and indirect). Returns a map of slotId → { x, y } updates.
 *
 * Does NOT mutate slots or groups — purely returns the delta map for the
 * caller to commit via builder state.
 */
export function computeGroupMoveDelta(
  groupId: string,
  dx: number,
  dy: number,
  groupMap: Map<string, LayoutGroup>,
  slotMap: Map<string, LayoutSlot>,
): Map<string, { x: number; y: number }> {
  const slotIds = collectDescendantSlotIds(groupId, groupMap);
  const result = new Map<string, { x: number; y: number }>();
  for (const sid of slotIds) {
    const slot = slotMap.get(sid);
    if (!slot) continue;
    result.set(sid, { x: slot.x + dx, y: slot.y + dy });
  }
  return result;
}

/**
 * Applies a proportional scale transform to all descendant slots and child
 * group rects relative to the group's current origin (group.x, group.y).
 *
 * `scaleX` = newWidth / oldWidth, `scaleY` = newHeight / oldHeight.
 *
 * Returns a map of slotId → { x, y, width, height } updates.
 *
 * Does NOT mutate — returns the update map for the caller to commit.
 */
export function computeGroupResizeDelta(
  groupId: string,
  newWidth: number,
  newHeight: number,
  groupMap: Map<string, LayoutGroup>,
  slotMap: Map<string, LayoutSlot>,
): Map<string, { x: number; y: number; width: number; height: number }> {
  const group = groupMap.get(groupId);
  if (!group || group.x === undefined || group.width === undefined || group.height === undefined || group.width === 0 || group.height === 0) {
    return new Map();
  }

  const ox = group.x ?? 0;
  const oy = group.y ?? 0;
  const scaleX = newWidth / group.width;
  const scaleY = newHeight / group.height;

  const slotIds = collectDescendantSlotIds(groupId, groupMap);
  const result = new Map<string, { x: number; y: number; width: number; height: number }>();

  for (const sid of slotIds) {
    const slot = slotMap.get(sid);
    if (!slot) continue;
    const localX = slot.x - ox;
    const localY = slot.y - oy;
    result.set(sid, {
      x: ox + localX * scaleX,
      y: oy + localY * scaleY,
      width: slot.width * scaleX,
      height: slot.height * scaleY,
    });
  }
  return result;
}

// ── Hierarchy mutation helpers ────────────────────────────────────────────────

/**
 * Returns a new groups array after reparenting `groupId` under `newParentId`
 * (or to top-level when `newParentId` is null).
 *
 * Updates `parentGroupId` on the moved group and `childGroupIds` on both the
 * old parent and the new parent. Does NOT modify slot positions.
 *
 * Returns the input array unchanged if the reparent would create a cycle.
 */
export function reparentGroup(
  groupId: string,
  newParentId: string | null,
  groups: LayoutGroup[],
): LayoutGroup[] {
  const groupMap = buildGroupMap(groups);
  const movingGroup = groupMap.get(groupId);
  if (!movingGroup) return groups;

  // Guard: newParentId must not be a descendant of groupId (cycle check)
  if (newParentId !== null) {
    const descendants = collectDescendantGroupIds(groupId, groupMap);
    if (descendants.includes(newParentId) || newParentId === groupId) {
      return groups; // cycle — reject silently
    }
  }

  const oldParentId = movingGroup.parentGroupId ?? null;
  if (oldParentId === newParentId) return groups; // no change

  return groups.map((g): LayoutGroup => {
    if (g.id === groupId) {
      return { ...g, parentGroupId: newParentId };
    }
    if (oldParentId !== null && g.id === oldParentId) {
      return { ...g, childGroupIds: (g.childGroupIds ?? []).filter((id) => id !== groupId) };
    }
    if (newParentId !== null && g.id === newParentId) {
      const already = (g.childGroupIds ?? []).includes(groupId);
      return already ? g : { ...g, childGroupIds: [...(g.childGroupIds ?? []), groupId] };
    }
    return g;
  });
}

/**
 * Returns a new groups array after dissolving `groupId`.
 *
 * Direct leaf members are NOT reassigned to any group (the caller decides
 * whether to add them to the parent group).
 *
 * Child groups are reparented to `groupId`'s parent (or become top-level).
 */
export function dissolveGroupInHierarchy(
  groupId: string,
  groups: LayoutGroup[],
): LayoutGroup[] {
  const groupMap = buildGroupMap(groups);
  const dying = groupMap.get(groupId);
  if (!dying) return groups;

  const newParentId = dying.parentGroupId ?? null;
  const childIds = dying.childGroupIds ?? [];

  // Build new groups list: remove dying group, reparent its children
  let updated = groups.filter((g) => g.id !== groupId);

  // Remove groupId from its parent's childGroupIds
  if (newParentId) {
    updated = updated.map((g) =>
      g.id === newParentId
        ? { ...g, childGroupIds: (g.childGroupIds ?? []).filter((id) => id !== groupId) }
        : g,
    );
  }

  // Reparent child groups to dying group's parent
  updated = updated.map((g) =>
    childIds.includes(g.id)
      ? { ...g, parentGroupId: newParentId }
      : g,
  );

  // Add newly promoted children to parent's childGroupIds
  if (newParentId && childIds.length > 0) {
    updated = updated.map((g) => {
      if (g.id !== newParentId) return g;
      const existing = g.childGroupIds ?? [];
      const toAdd = childIds.filter((id) => !existing.includes(id));
      return toAdd.length > 0 ? { ...g, childGroupIds: [...existing, ...toAdd] } : g;
    });
  }

  return updated;
}
