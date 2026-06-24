import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { LayoutTemplate, LayoutGroup } from '@/types';
import {
  buildGroupMap,
  collectDescendantSlotIds,
  migrateGroupsToP30G,
  refreshGroupRects,
  reparentGroup as reparentGroupInHierarchy,
  dissolveGroupInHierarchy,
  computeGroupMoveDelta,
} from '@wp-super-gallery/shared-utils';
import type { MutateFn } from './useLayoutBuilderHistory';

export function useLayoutBuilderGroups({
  mutate,
  template,
  setSelectedSlotIds,
}: {
  mutate: MutateFn;
  template: LayoutTemplate;
  setSelectedSlotIds: Dispatch<SetStateAction<Set<string>>>;
}) {
  const migrateGroupsIfNeeded = useCallback(() => {
    const groups = template.groups ?? [];
    const needsMigration = groups.some((g) => g.childGroupIds === undefined);
    if (!needsMigration) return;
    mutate((draft) => {
      draft.groups = migrateGroupsToP30G(draft.groups ?? [], draft.slots);
    }, 'Migrate groups to P30-G');
  }, [mutate, template.groups]);

  const createGroup = useCallback((memberIds: string[]): string => {
    const id = crypto.randomUUID?.() ?? `group-${Date.now()}`;
    const uniqueIds = [...new Set(memberIds)];
    mutate((draft) => {
      const groups = draft.groups ?? [];
      // Remove these slot IDs from any existing group's leaf members
      for (const g of groups) {
        g.memberIds = g.memberIds.filter((mid) => !uniqueIds.includes(mid));
      }
      // New group is always a top-level group (P30-G flat default)
      const newGroup: LayoutGroup = {
        id,
        memberIds: uniqueIds,
        childGroupIds: [],
        parentGroupId: null,
      };
      // Remove empty groups; prune any dangling childGroupIds that reference
      // a group that was just removed (P30-G: parent groups must not hold
      // stale child references or traversal/selection will break).
      draft.groups = groups.filter((g) => g.memberIds.length > 0 || (g.childGroupIds ?? []).length > 0);
      const survivingIds = new Set(draft.groups.map((g) => g.id));
      for (const g of draft.groups) {
        if (g.childGroupIds?.length) {
          g.childGroupIds = g.childGroupIds.filter((cid) => survivingIds.has(cid));
        }
      }
      draft.groups.push(newGroup);
      // Refresh all group rects: covers the new group AND any existing groups
      // that had members removed above (their cached union rects are now stale).
      refreshGroupRects(draft.groups, draft.slots);
    }, `Group (${uniqueIds.length} layers)`);
    return id;
  }, [mutate]);

  const wrapInGroup = useCallback((slotAndGroupIds: string[]): string => {
    const id = crypto.randomUUID?.() ?? `group-${Date.now()}`;
    mutate((draft) => {
      const groups = draft.groups ?? [];
      const groupMap = buildGroupMap(groups);

      // Separate passed IDs into group IDs and slot IDs
      const selectedGroupIds = slotAndGroupIds.filter((i) => groupMap.has(i));
      const selectedSlotIds = slotAndGroupIds.filter((i) => !groupMap.has(i));

      // Remove selected slots from existing leaf member lists
      for (const g of groups) {
        g.memberIds = g.memberIds.filter((mid) => !selectedSlotIds.includes(mid));
      }

      // Create new parent group
      const newGroup: LayoutGroup = {
        id,
        memberIds: selectedSlotIds,
        childGroupIds: selectedGroupIds,
        parentGroupId: null,
      };

      // Reparent selected groups under the new parent
      for (const gid of selectedGroupIds) {
        const g = groups.find((g) => g.id === gid);
        if (g) {
          // Remove from old parent's childGroupIds
          const oldParentId = g.parentGroupId ?? null;
          if (oldParentId) {
            const oldParent = groups.find((p) => p.id === oldParentId);
            if (oldParent) {
              oldParent.childGroupIds = (oldParent.childGroupIds ?? []).filter((c) => c !== gid);
            }
          }
          g.parentGroupId = id;
        }
      }

      // Remove empty groups; prune dangling childGroupIds references (same
      // invariant as createGroup — parent groups must not reference removed IDs).
      draft.groups = groups.filter((g) => g.memberIds.length > 0 || (g.childGroupIds ?? []).length > 0);
      const survivingIds = new Set(draft.groups.map((g) => g.id));
      for (const g of draft.groups) {
        if (g.childGroupIds?.length) {
          g.childGroupIds = g.childGroupIds.filter((cid) => survivingIds.has(cid));
        }
      }
      draft.groups.push(newGroup);
      refreshGroupRects(draft.groups, draft.slots);
    }, `Wrap in group`);
    return id;
  }, [mutate]);

  const dissolveGroup = useCallback((groupId: string) => {
    mutate((draft) => {
      draft.groups = dissolveGroupInHierarchy(groupId, draft.groups ?? []);
      // Remove empty groups after promotion
      draft.groups = draft.groups.filter(
        (g) => g.memberIds.length > 0 || (g.childGroupIds ?? []).length > 0,
      );
      // Refresh cached group rects: parent groups that absorbed promoted children
      // have a new membership set and their cached union rects are now stale.
      refreshGroupRects(draft.groups, draft.slots);
    }, 'Ungroup');
  }, [mutate]);

  const updateGroup = useCallback((groupId: string, updates: Partial<LayoutGroup>) => {
    mutate((draft) => {
      const g = (draft.groups ?? []).find((g) => g.id === groupId);
      if (g) Object.assign(g, updates);
    }, 'Update group');
  }, [mutate]);

  const selectGroup = useCallback((groupId: string) => {
    const groups = template.groups ?? [];
    const groupMap = buildGroupMap(groups);
    const slotIds = collectDescendantSlotIds(groupId, groupMap);
    const validIds = slotIds.filter((id) => template.slots.some((s) => s.id === id));
    setSelectedSlotIds(new Set(validIds));
  }, [template, setSelectedSlotIds]);

  const moveGroup = useCallback((groupId: string, dx: number, dy: number) => {
    mutate((draft) => {
      const groups = draft.groups ?? [];
      const slotMap = new Map(draft.slots.map((s) => [s.id, s]));
      const groupMap = buildGroupMap(groups);
      const delta = computeGroupMoveDelta(groupId, dx, dy, groupMap, slotMap);
      for (const slot of draft.slots) {
        const upd = delta.get(slot.id);
        if (upd) { slot.x = upd.x; slot.y = upd.y; }
      }
      refreshGroupRects(groups, draft.slots);
    }, 'Move group');
  }, [mutate]);

  const reparentGroup = useCallback((groupId: string, newParentId: string | null) => {
    mutate((draft) => {
      draft.groups = reparentGroupInHierarchy(groupId, newParentId, draft.groups ?? []);
      refreshGroupRects(draft.groups, draft.slots);
    }, 'Reparent group');
  }, [mutate]);

  return {
    migrateGroupsIfNeeded,
    createGroup,
    wrapInGroup,
    dissolveGroup,
    updateGroup,
    selectGroup,
    moveGroup,
    reparentGroup,
  };
}
