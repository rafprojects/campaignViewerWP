/**
 * Unit tests for groupGeometry.ts — group hierarchy and geometry utilities.
 * Covers tree traversal, bounding-box computation, migrations, and hierarchy mutation.
 */
import { describe, it, expect } from 'vitest';
import type { GeoSlot, GeoGroup } from './groupGeometry';
import {
  buildGroupMap,
  collectDescendantSlotIds,
  collectDescendantGroupIds,
  getAncestorChain,
  computeGroupRect,
  refreshGroupRects,
  migrateGroupsToP30G,
  computeGroupMoveDelta,
  computeGroupResizeDelta,
  reparentGroup,
  dissolveGroupInHierarchy,
} from './groupGeometry';

// ── Test helpers ────────────────────────────────────────────────────────

function makeSlot(id: string, x: number, y: number, width: number, height: number): GeoSlot {
  return { id, x, y, width, height };
}

function makeGroup(id: string, memberIds: string[] = [], childGroupIds?: string[], parentGroupId?: string | null): GeoGroup {
  return {
    id,
    memberIds,
    ...(childGroupIds !== undefined && { childGroupIds }),
    ...(parentGroupId !== undefined && { parentGroupId }),
  };
}

// ── buildGroupMap ──────────────────────────────────────────────────────

describe('buildGroupMap', () => {
  it('creates an empty map from an empty groups array', () => {
    const result = buildGroupMap([]);
    expect(result.size).toBe(0);
  });

  it('creates a map with all groups keyed by id', () => {
    const groups = [makeGroup('g1'), makeGroup('g2'), makeGroup('g3')];
    const result = buildGroupMap(groups);
    expect(result.size).toBe(3);
    expect(result.get('g1')).toEqual(groups[0]);
    expect(result.get('g2')).toEqual(groups[1]);
    expect(result.get('g3')).toEqual(groups[2]);
  });

  it('handles groups with the same id (last one wins)', () => {
    const groups = [makeGroup('g1', ['s1']), makeGroup('g1', ['s2'])];
    const result = buildGroupMap(groups);
    expect(result.size).toBe(1);
    expect(result.get('g1')?.memberIds).toEqual(['s2']);
  });
});

// ── collectDescendantSlotIds ────────────────────────────────────────────

describe('collectDescendantSlotIds', () => {
  it('returns direct member IDs from a flat group', () => {
    const groups = [makeGroup('g1', ['s1', 's2', 's3'])];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantSlotIds('g1', groupMap);
    expect(result).toEqual(['s1', 's2', 's3']);
  });

  it('returns empty array for a nonexistent group', () => {
    const groups = [makeGroup('g1', ['s1'])];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantSlotIds('nonexistent', groupMap);
    expect(result).toEqual([]);
  });

  it('returns empty array for a group with no members and no child groups', () => {
    const groups = [makeGroup('g1', [])];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantSlotIds('g1', groupMap);
    expect(result).toEqual([]);
  });

  it('recursively collects slots from child groups', () => {
    const groups = [
      makeGroup('g1', ['s1'], ['g2']),
      makeGroup('g2', ['s2', 's3'], []),
    ];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantSlotIds('g1', groupMap);
    expect(result).toEqual(['s1', 's2', 's3']);
  });

  it('handles multiple levels of nested child groups', () => {
    const groups = [
      makeGroup('g1', ['s1'], ['g2']),
      makeGroup('g2', ['s2'], ['g3']),
      makeGroup('g3', ['s3'], []),
    ];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantSlotIds('g1', groupMap);
    expect(result).toEqual(['s1', 's2', 's3']);
  });

  it('handles multiple child groups at the same level', () => {
    const groups = [
      makeGroup('g1', ['s1'], ['g2', 'g3']),
      makeGroup('g2', ['s2'], []),
      makeGroup('g3', ['s3'], []),
    ];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantSlotIds('g1', groupMap);
    expect(new Set(result)).toEqual(new Set(['s1', 's2', 's3']));
  });

  it('guards against cycles in child group references', () => {
    // Create a cycle: g1 -> g2 -> g1
    const groups = [
      { ...makeGroup('g1', ['s1'], ['g2']) },
      { ...makeGroup('g2', ['s2'], ['g1']) },
    ];
    const groupMap = buildGroupMap(groups);
    // Should not infinite loop; visited set should prevent revisiting g1
    const result = collectDescendantSlotIds('g1', groupMap);
    expect(new Set(result)).toEqual(new Set(['s1', 's2']));
  });

  it('handles missing child group in groupMap', () => {
    const groups = [makeGroup('g1', ['s1'], ['g2'])]; // g2 not in groups
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantSlotIds('g1', groupMap);
    expect(result).toEqual(['s1']);
  });
});

// ── collectDescendantGroupIds ──────────────────────────────────────────

describe('collectDescendantGroupIds', () => {
  it('returns empty array for a group with no child groups', () => {
    const groups = [makeGroup('g1', ['s1'], [])];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantGroupIds('g1', groupMap);
    expect(result).toEqual([]);
  });

  it('returns direct child group IDs', () => {
    const groups = [
      makeGroup('g1', [], ['g2', 'g3']),
      makeGroup('g2', []),
      makeGroup('g3', []),
    ];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantGroupIds('g1', groupMap);
    expect(new Set(result)).toEqual(new Set(['g2', 'g3']));
  });

  it('recursively collects all descendant group IDs', () => {
    const groups = [
      makeGroup('g1', [], ['g2']),
      makeGroup('g2', [], ['g3']),
      makeGroup('g3', [], []),
    ];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantGroupIds('g1', groupMap);
    expect(result).toEqual(['g2', 'g3']);
  });

  it('does not include the group itself in descendants', () => {
    const groups = [
      makeGroup('g1', [], ['g2']),
      makeGroup('g2', []),
    ];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantGroupIds('g1', groupMap);
    expect(result).not.toContain('g1');
  });

  it('guards against cycles in child group references', () => {
    const groups = [
      { ...makeGroup('g1', [], ['g2']) },
      { ...makeGroup('g2', [], ['g1']) },
    ];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantGroupIds('g1', groupMap);
    // Should not infinite loop; includes g2 and g1 but processes each only once
    expect(result).toContain('g2');
    expect(result).toContain('g1');
    expect(result.filter((id) => id === 'g1').length).toBe(1);
    expect(result.filter((id) => id === 'g2').length).toBe(1);
  });

  it('returns empty array for nonexistent group', () => {
    const groups = [makeGroup('g1', [], ['g2']), makeGroup('g2', [])];
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantGroupIds('nonexistent', groupMap);
    expect(result).toEqual([]);
  });

  it('handles missing child group in groupMap', () => {
    const groups = [makeGroup('g1', [], ['g2'])]; // g2 not in map
    const groupMap = buildGroupMap(groups);
    const result = collectDescendantGroupIds('g1', groupMap);
    expect(result).toEqual(['g2']);
  });
});

// ── getAncestorChain ───────────────────────────────────────────────────

describe('getAncestorChain', () => {
  it('returns empty array for a top-level group', () => {
    const groups = [makeGroup('g1', [], [], null)];
    const groupMap = buildGroupMap(groups);
    const result = getAncestorChain('g1', groupMap);
    expect(result).toEqual([]);
  });

  it('returns immediate parent for a child group', () => {
    const groups = [
      makeGroup('g1', [], ['g2'], null),
      makeGroup('g2', [], [], 'g1'),
    ];
    const groupMap = buildGroupMap(groups);
    const result = getAncestorChain('g2', groupMap);
    expect(result).toEqual(['g1']);
  });

  it('returns full ancestor chain from bottom to root', () => {
    const groups = [
      makeGroup('g1', [], ['g2'], null),
      makeGroup('g2', [], ['g3'], 'g1'),
      makeGroup('g3', [], [], 'g2'),
    ];
    const groupMap = buildGroupMap(groups);
    const result = getAncestorChain('g3', groupMap);
    expect(result).toEqual(['g2', 'g1']);
  });

  it('returns empty array for nonexistent group', () => {
    const groups = [makeGroup('g1', [], [], null)];
    const groupMap = buildGroupMap(groups);
    const result = getAncestorChain('nonexistent', groupMap);
    expect(result).toEqual([]);
  });

  it('guards against cycles in parent references', () => {
    // Create a cycle: g1 -> g2 -> g1
    const groups = [
      { ...makeGroup('g1', [], [], 'g2') },
      { ...makeGroup('g2', [], [], 'g1') },
    ];
    const groupMap = buildGroupMap(groups);
    // Should not infinite loop; visited set prevents revisiting
    const result = getAncestorChain('g1', groupMap);
    expect(result).toContain('g2');
  });

  it('handles undefined parentGroupId', () => {
    const groups = [makeGroup('g1', [], [])];
    const groupMap = buildGroupMap(groups);
    const result = getAncestorChain('g1', groupMap);
    expect(result).toEqual([]);
  });
});

// ── computeGroupRect ───────────────────────────────────────────────────

describe('computeGroupRect', () => {
  it('returns null for a nonexistent group', () => {
    const groups: GeoGroup[] = [];
    const slots: GeoSlot[] = [];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupRect('nonexistent', slotMap, groupMap);
    expect(result).toBeNull();
  });

  it('returns null for a group with no resolvable members', () => {
    const groups = [makeGroup('g1', ['s1'])];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map<string, GeoSlot>(); // no slots
    const result = computeGroupRect('g1', slotMap, groupMap);
    expect(result).toBeNull();
  });

  it('computes bounding box of a single slot', () => {
    const groups = [makeGroup('g1', ['s1'])];
    const slots = [makeSlot('s1', 10, 20, 30, 40)];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupRect('g1', slotMap, groupMap);
    expect(result).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('computes bounding box of multiple slots', () => {
    const groups = [makeGroup('g1', ['s1', 's2'])];
    const slots = [
      makeSlot('s1', 0, 0, 10, 10),
      makeSlot('s2', 5, 5, 20, 20),
    ];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupRect('g1', slotMap, groupMap);
    // min = (0,0), max = (5+20, 5+20) = (25,25), size = (25,25)
    expect(result).toEqual({ x: 0, y: 0, width: 25, height: 25 });
  });

  it('computes bounding box including child groups recursively', () => {
    const groups = [
      makeGroup('g1', ['s1'], ['g2']),
      makeGroup('g2', ['s2'], []),
    ];
    const slots = [
      makeSlot('s1', 0, 0, 10, 10),
      makeSlot('s2', 20, 20, 10, 10),
    ];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupRect('g1', slotMap, groupMap);
    expect(result).toEqual({ x: 0, y: 0, width: 30, height: 30 });
  });

  it('ignores members that do not exist in slotMap', () => {
    const groups = [makeGroup('g1', ['s1', 's2', 's99'])];
    const slots = [
      makeSlot('s1', 0, 0, 10, 10),
      makeSlot('s2', 5, 5, 20, 20),
    ];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupRect('g1', slotMap, groupMap);
    expect(result).toEqual({ x: 0, y: 0, width: 25, height: 25 });
  });
});

// ── refreshGroupRects ──────────────────────────────────────────────────

describe('refreshGroupRects', () => {
  it('mutates groups in-place with computed bounding boxes', () => {
    const groups = [makeGroup('g1', ['s1'])];
    const slots = [makeSlot('s1', 10, 20, 30, 40)];
    refreshGroupRects(groups, slots);
    expect(groups[0]!.x).toBe(10);
    expect(groups[0]!.y).toBe(20);
    expect(groups[0]!.width).toBe(30);
    expect(groups[0]!.height).toBe(40);
  });

  it('does not set x/y/width/height for groups with no resolvable members', () => {
    const groups = [makeGroup('g1', ['s99'])]; // s99 doesn't exist
    const slots: GeoSlot[] = [];
    refreshGroupRects(groups, slots);
    expect(groups[0]!.x).toBeUndefined();
    expect(groups[0]!.y).toBeUndefined();
    expect(groups[0]!.width).toBeUndefined();
    expect(groups[0]!.height).toBeUndefined();
  });

  it('updates all groups in the array', () => {
    const groups = [
      makeGroup('g1', ['s1']),
      makeGroup('g2', ['s2']),
    ];
    const slots = [
      makeSlot('s1', 0, 0, 10, 10),
      makeSlot('s2', 20, 20, 30, 30),
    ];
    refreshGroupRects(groups, slots);
    expect(groups[0]).toEqual({ id: 'g1', memberIds: ['s1'], x: 0, y: 0, width: 10, height: 10 });
    expect(groups[1]).toEqual({ id: 'g2', memberIds: ['s2'], x: 20, y: 20, width: 30, height: 30 });
  });
});

// ── migrateGroupsToP30G ────────────────────────────────────────────────

describe('migrateGroupsToP30G', () => {
  it('converts flat groups to P30G format with hierarchy fields', () => {
    const groups = [makeGroup('g1', ['s1'])];
    const slots = [makeSlot('s1', 0, 0, 10, 10)];
    const result = migrateGroupsToP30G(groups, slots);
    expect(result).toHaveLength(1);
    expect(result[0]!.childGroupIds).toEqual([]);
    expect(result[0]!.parentGroupId).toBeNull();
  });

  it('is idempotent — does not re-migrate already-migrated groups', () => {
    const groups = [makeGroup('g1', ['s1'], [], null)];
    const slots = [makeSlot('s1', 0, 0, 10, 10)];
    const result = migrateGroupsToP30G(groups, slots);
    expect(result[0]!.childGroupIds).toEqual([]);
    expect(result[0]!.parentGroupId).toBeNull();
  });

  it('computes bounding boxes for migrated groups without existing bounds', () => {
    const groups = [{ id: 'g1', memberIds: ['s1'] }];
    const slots = [makeSlot('s1', 5, 5, 20, 20)];
    const result = migrateGroupsToP30G(groups as GeoGroup[], slots);
    expect(result[0]!.x).toBe(5);
    expect(result[0]!.y).toBe(5);
    expect(result[0]!.width).toBe(20);
    expect(result[0]!.height).toBe(20);
  });

  it('skips bounding-box computation for groups that already have bounds', () => {
    const groups = [{ id: 'g1', memberIds: ['s1'], x: 100, y: 100, width: 50, height: 50 }];
    const slots = [makeSlot('s1', 5, 5, 20, 20)];
    const result = migrateGroupsToP30G(groups as GeoGroup[], slots);
    expect(result[0]!.x).toBe(100);
    expect(result[0]!.y).toBe(100);
    expect(result[0]!.width).toBe(50);
    expect(result[0]!.height).toBe(50);
  });

  it('does not modify slot positions', () => {
    const groups = [{ id: 'g1', memberIds: ['s1'] }];
    const slots = [makeSlot('s1', 5, 5, 20, 20)];
    migrateGroupsToP30G(groups as GeoGroup[], slots);
    expect(slots[0]).toEqual({ id: 's1', x: 5, y: 5, width: 20, height: 20 });
  });
});

// ── computeGroupMoveDelta ──────────────────────────────────────────────

describe('computeGroupMoveDelta', () => {
  it('returns empty map for nonexistent group', () => {
    const groupMap = buildGroupMap([]);
    const slotMap = new Map<string, GeoSlot>();
    const result = computeGroupMoveDelta('nonexistent', 10, 20, groupMap, slotMap);
    expect(result.size).toBe(0);
  });

  it('computes position delta for direct members', () => {
    const groups = [makeGroup('g1', ['s1', 's2'])];
    const slots = [
      makeSlot('s1', 0, 0, 10, 10),
      makeSlot('s2', 20, 20, 10, 10),
    ];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupMoveDelta('g1', 5, 10, groupMap, slotMap);
    expect(result.get('s1')).toEqual({ x: 5, y: 10 });
    expect(result.get('s2')).toEqual({ x: 25, y: 30 });
  });

  it('computes deltas for descendant slots via child groups', () => {
    const groups = [
      makeGroup('g1', ['s1'], ['g2']),
      makeGroup('g2', ['s2'], []),
    ];
    const slots = [
      makeSlot('s1', 0, 0, 10, 10),
      makeSlot('s2', 20, 20, 10, 10),
    ];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupMoveDelta('g1', 5, 10, groupMap, slotMap);
    expect(result.size).toBe(2);
    expect(result.get('s1')).toEqual({ x: 5, y: 10 });
    expect(result.get('s2')).toEqual({ x: 25, y: 30 });
  });

  it('ignores missing slots', () => {
    const groups = [makeGroup('g1', ['s1', 's99'])];
    const slots = [makeSlot('s1', 0, 0, 10, 10)];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupMoveDelta('g1', 5, 10, groupMap, slotMap);
    expect(result.size).toBe(1);
    expect(result.get('s1')).toEqual({ x: 5, y: 10 });
  });

  it('handles negative deltas', () => {
    const groups = [makeGroup('g1', ['s1'])];
    const slots = [makeSlot('s1', 50, 50, 10, 10)];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupMoveDelta('g1', -10, -20, groupMap, slotMap);
    expect(result.get('s1')).toEqual({ x: 40, y: 30 });
  });
});

// ── computeGroupResizeDelta ────────────────────────────────────────────

describe('computeGroupResizeDelta', () => {
  it('returns empty map if group does not exist', () => {
    const groupMap = buildGroupMap([]);
    const slotMap = new Map<string, GeoSlot>();
    const result = computeGroupResizeDelta('nonexistent', 100, 100, groupMap, slotMap);
    expect(result.size).toBe(0);
  });

  it('returns empty map if group has no x/y/width/height', () => {
    const groups = [makeGroup('g1', ['s1'])];
    const slots = [makeSlot('s1', 0, 0, 10, 10)];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    // group has no x/y/width/height set
    const result = computeGroupResizeDelta('g1', 100, 100, groupMap, slotMap);
    expect(result.size).toBe(0);
  });

  it('returns empty map if group width or height is 0', () => {
    const groups = [{ ...makeGroup('g1', ['s1']), x: 0, y: 0, width: 0, height: 10 }];
    const slots = [makeSlot('s1', 0, 0, 10, 10)];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupResizeDelta('g1', 100, 100, groupMap, slotMap);
    expect(result.size).toBe(0);
  });

  it('scales slots relative to group origin', () => {
    const groups = [{ ...makeGroup('g1', ['s1']), x: 0, y: 0, width: 10, height: 10 }];
    const slots = [makeSlot('s1', 2, 2, 6, 6)];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    // newWidth=20, newHeight=20 → scaleX=2, scaleY=2
    const result = computeGroupResizeDelta('g1', 20, 20, groupMap, slotMap);
    expect(result.get('s1')).toEqual({
      x: 4, // (2 - 0) * 2 + 0
      y: 4, // (2 - 0) * 2 + 0
      width: 12, // 6 * 2
      height: 12, // 6 * 2
    });
  });

  it('scales with non-zero group origin', () => {
    const groups = [{ ...makeGroup('g1', ['s1']), x: 10, y: 10, width: 10, height: 10 }];
    const slots = [makeSlot('s1', 12, 12, 6, 6)];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    // scaleX=2, scaleY=2; localX = 12-10=2, localY = 12-10=2
    const result = computeGroupResizeDelta('g1', 20, 20, groupMap, slotMap);
    expect(result.get('s1')).toEqual({
      x: 14, // 10 + 2*2
      y: 14, // 10 + 2*2
      width: 12, // 6*2
      height: 12, // 6*2
    });
  });

  it('handles shrinking (scale < 1)', () => {
    const groups = [{ ...makeGroup('g1', ['s1']), x: 0, y: 0, width: 100, height: 100 }];
    const slots = [makeSlot('s1', 10, 10, 80, 80)];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    // newWidth=50, newHeight=50 → scaleX=0.5, scaleY=0.5
    const result = computeGroupResizeDelta('g1', 50, 50, groupMap, slotMap);
    expect(result.get('s1')).toEqual({
      x: 5, // 10 * 0.5
      y: 5, // 10 * 0.5
      width: 40, // 80 * 0.5
      height: 40, // 80 * 0.5
    });
  });

  it('scales descendant slots via child groups', () => {
    const groups = [
      { ...makeGroup('g1', ['s1'], ['g2']), x: 0, y: 0, width: 10, height: 10 },
      makeGroup('g2', ['s2'], []),
    ];
    const slots = [
      makeSlot('s1', 0, 0, 5, 5),
      makeSlot('s2', 5, 5, 5, 5),
    ];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupResizeDelta('g1', 20, 20, groupMap, slotMap);
    expect(result.size).toBe(2);
    expect(result.get('s1')).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(result.get('s2')).toEqual({ x: 10, y: 10, width: 10, height: 10 });
  });

  it('ignores missing slots', () => {
    const groups = [{ ...makeGroup('g1', ['s1', 's99']), x: 0, y: 0, width: 10, height: 10 }];
    const slots = [makeSlot('s1', 0, 0, 5, 5)];
    const groupMap = buildGroupMap(groups);
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const result = computeGroupResizeDelta('g1', 20, 20, groupMap, slotMap);
    expect(result.size).toBe(1);
    expect(result.get('s1')).toBeDefined();
  });
});

// ── reparentGroup ──────────────────────────────────────────────────────

describe('reparentGroup', () => {
  it('returns input unchanged if group does not exist', () => {
    const groups = [makeGroup('g1', [], [])];
    const result = reparentGroup('nonexistent', 'g1', groups);
    expect(result).toEqual(groups);
  });

  it('returns input unchanged if reparenting to same parent', () => {
    const groups = [
      makeGroup('g1', [], ['g2'], null),
      makeGroup('g2', [], [], 'g1'),
    ];
    const result = reparentGroup('g2', 'g1', groups);
    expect(result).toBe(groups);
  });

  it('reparents a group from one parent to another', () => {
    const groups = [
      makeGroup('g1', [], ['g2'], null),
      makeGroup('g2', [], [], 'g1'),
      makeGroup('g3', [], [], null),
    ];
    const result = reparentGroup('g2', 'g3', groups);
    expect(result[0]!.childGroupIds).toEqual([]);
    expect(result[1]!.parentGroupId).toBe('g3');
    expect(result[2]!.childGroupIds).toContain('g2');
  });

  it('reparents a group to top-level (null parent)', () => {
    const groups = [
      makeGroup('g1', [], ['g2'], null),
      makeGroup('g2', [], [], 'g1'),
    ];
    const result = reparentGroup('g2', null, groups);
    expect(result[0]!.childGroupIds).toEqual([]);
    expect(result[1]!.parentGroupId).toBeNull();
  });

  it('guards against cycles (cannot reparent to a descendant)', () => {
    const groups = [
      makeGroup('g1', [], ['g2'], null),
      makeGroup('g2', [], ['g3'], 'g1'),
      makeGroup('g3', [], [], 'g2'),
    ];
    const result = reparentGroup('g1', 'g3', groups);
    expect(result).toEqual(groups); // rejected
  });

  it('guards against self-cycle (cannot reparent to self)', () => {
    const groups = [makeGroup('g1', [], [], null)];
    const result = reparentGroup('g1', 'g1', groups);
    expect(result).toEqual(groups); // rejected
  });

  it('handles adding group to new parent that has no childGroupIds yet', () => {
    const groups = [
      makeGroup('g1', [], [], null),
      makeGroup('g2', [], [], null),
    ];
    const result = reparentGroup('g2', 'g1', groups);
    expect(result[0]!.childGroupIds).toContain('g2');
    expect(result[1]!.parentGroupId).toBe('g1');
  });

  it('avoids adding duplicate child IDs', () => {
    const groups = [
      makeGroup('g1', [], ['g2'], null),
      makeGroup('g2', [], [], 'g1'),
    ];
    const result = reparentGroup('g2', 'g1', groups);
    // g2 is already in g1's childGroupIds, so no change
    expect(result).toEqual(groups);
  });
});

// ── dissolveGroupInHierarchy ───────────────────────────────────────────

describe('dissolveGroupInHierarchy', () => {
  it('returns input unchanged if group does not exist', () => {
    const groups = [makeGroup('g1', ['s1'])];
    const result = dissolveGroupInHierarchy('nonexistent', groups);
    expect(result).toEqual(groups);
  });

  it('removes the group from the list', () => {
    const groups = [makeGroup('g1', ['s1']), makeGroup('g2', ['s2'])];
    const result = dissolveGroupInHierarchy('g1', groups);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('g2');
  });

  it('reparents child groups to the dissolved group\'s parent', () => {
    const groups = [
      makeGroup('g1', [], ['g2'], null),
      makeGroup('g2', ['s1'], ['g3'], 'g1'),
      makeGroup('g3', ['s2'], [], 'g2'),
    ];
    const result = dissolveGroupInHierarchy('g2', groups);
    // g2 is removed; g3 becomes child of g1
    expect(result.find((g) => g.id === 'g3')?.parentGroupId).toBe('g1');
    expect(result.find((g) => g.id === 'g1')?.childGroupIds).toContain('g3');
  });

  it('does not reassign leaf members to any group', () => {
    const groups = [
      makeGroup('g1', [], ['g2'], null),
      makeGroup('g2', ['s1', 's2'], [], 'g1'),
    ];
    const result = dissolveGroupInHierarchy('g2', groups);
    // Direct members of g2 stay unassigned
    expect(result).toHaveLength(1);
    expect(result[0]!.memberIds).toEqual([]);
  });

  it('handles dissolving a top-level group', () => {
    const groups = [
      makeGroup('g1', ['s1'], ['g2'], null),
      makeGroup('g2', ['s2'], [], 'g1'),
    ];
    const result = dissolveGroupInHierarchy('g1', groups);
    // g1 is removed; g2 becomes top-level
    expect(result.find((g) => g.id === 'g2')?.parentGroupId).toBeNull();
    expect(result).toHaveLength(1);
  });

  it('preserves multiple child groups when dissolving', () => {
    const groups = [
      makeGroup('g1', [], ['g2', 'g3'], null),
      makeGroup('g2', [], [], 'g1'),
      makeGroup('g3', [], [], 'g1'),
    ];
    const result = dissolveGroupInHierarchy('g1', groups);
    // Both g2 and g3 remain
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.id)).toContain('g2');
    expect(result.map((g) => g.id)).toContain('g3');
  });

  it('updates parent\'s childGroupIds correctly', () => {
    const groups = [
      makeGroup('g1', [], ['g2'], null),
      makeGroup('g2', ['s1'], ['g3', 'g4'], 'g1'),
      makeGroup('g3', [], [], 'g2'),
      makeGroup('g4', [], [], 'g2'),
    ];
    const result = dissolveGroupInHierarchy('g2', groups);
    const parent = result.find((g) => g.id === 'g1');
    // Parent should have g3 and g4 instead of g2
    expect(parent?.childGroupIds).toContain('g3');
    expect(parent?.childGroupIds).toContain('g4');
    expect(parent?.childGroupIds).not.toContain('g2');
  });

  it('avoids adding duplicate child IDs to new parent', () => {
    const groups = [
      makeGroup('g1', [], ['g2', 'g3'], null),
      makeGroup('g2', [], ['g3'], 'g1'),
      makeGroup('g3', [], [], 'g2'),
    ];
    const result = dissolveGroupInHierarchy('g2', groups);
    // g3 should appear exactly once in g1's children
    const parent = result.find((g) => g.id === 'g1');
    expect(parent?.childGroupIds?.filter((id) => id === 'g3')).toHaveLength(1);
  });
});
