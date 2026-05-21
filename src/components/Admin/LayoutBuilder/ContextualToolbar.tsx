import { useRef } from 'react';
import { ActionIcon, Button, Group, TextInput, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconLayersLinked,
  IconLayersOff,
  IconLock,
  IconLockOpen,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import type { LayoutGroup } from '@/types';
import { buildGroupMap, collectDescendantSlotIds } from '@/utils/groupGeometry';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ── Types ────────────────────────────────────────────────────

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContextualToolbarCallbacks {
  onDuplicate: () => void;
  onDelete: () => void;
  onCreateGroup: () => void;
  onUngroup: (groupId: string) => void;
  onGroupLockToggle: (groupId: string, locked: boolean) => void;
  onGroupVisibilityToggle: (groupId: string, visible: boolean) => void;
  onGroupRename: (groupId: string, name: string) => void;
  onBringForward: (ids: string[]) => void;
  onSendBackward: (ids: string[]) => void;
  announce: (msg: string) => void;
}

export interface ContextualToolbarProps {
  selectionRect: SelectionRect | null;
  selectedSlotIds: ReadonlySet<string>;
  groups: LayoutGroup[];
  canvasWidth: number;
  canvasHeight: number;
  callbacks: ContextualToolbarCallbacks;
}

// ── Placement constants ──────────────────────────────────────

const TOOLBAR_HEIGHT = 36;
const TOOLBAR_GAP = 8;
// Minimum toolbar width estimate used for initial X-clamp before DOM measurement.
const TOOLBAR_MIN_WIDTH = 180;

// ── Helpers ──────────────────────────────────────────────────

/**
 * Returns the group whose full descendant slot set exactly matches
 * `selectedSlotIds`. Works correctly with the P30-G nested group model where
 * `selectGroup()` expands selection to ALL descendant slots, not just direct
 * `memberIds` — so a plain memberIds equality check would always miss
 * parent groups.
 */
function getSelectedGroup(
  selectedSlotIds: ReadonlySet<string>,
  groups: LayoutGroup[],
): LayoutGroup | undefined {
  if (selectedSlotIds.size === 0 || groups.length === 0) return undefined;
  const groupMap = buildGroupMap(groups);
  return groups.find((g) => {
    const descIds = collectDescendantSlotIds(g.id, groupMap);
    return (
      descIds.length > 0 &&
      descIds.length === selectedSlotIds.size &&
      descIds.every((id) => selectedSlotIds.has(id))
    );
  });
}

// ── Toolbar divider ──────────────────────────────────────────

function ToolbarDivider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        height: 18,
        background: 'var(--mantine-color-dark-4)',
        margin: '0 2px',
        flexShrink: 0,
      }}
    />
  );
}

// ── Component ────────────────────────────────────────────────

export function ContextualToolbar({
  selectionRect,
  selectedSlotIds,
  groups,
  canvasWidth,
  canvasHeight,
  callbacks,
}: ContextualToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);

  if (!selectionRect || selectedSlotIds.size === 0) return null;

  const selectedGroup = getSelectedGroup(selectedSlotIds, groups);
  const selectionKind =
    selectedGroup !== undefined ? 'group' :
    selectedSlotIds.size === 1 ? 'single' : 'multi';

  // ── Placement ────────────────────────────────────────────────

  const midX = selectionRect.x + selectionRect.width / 2;
  const placeAbove = selectionRect.y >= TOOLBAR_HEIGHT + TOOLBAR_GAP;
  const rawTop = placeAbove
    ? selectionRect.y - TOOLBAR_HEIGHT - TOOLBAR_GAP
    : selectionRect.y + selectionRect.height + TOOLBAR_GAP;
  const clampedTop = Math.max(0, Math.min(canvasHeight - TOOLBAR_HEIGHT, rawTop));
  const rawLeft = midX - TOOLBAR_MIN_WIDTH / 2;
  const clampedLeft = Math.max(0, Math.min(canvasWidth - TOOLBAR_MIN_WIDTH, rawLeft));

  const ids = [...selectedSlotIds];
  const isGroupLocked = selectedGroup?.locked ?? false;
  const isGroupHidden = selectedGroup?.visible === false;

  // ── Group rename handler (opens modal) ───────────────────────

  const handleRenameGroupClick = () => {
    if (!selectedGroup) return;
    const gid = selectedGroup.id;
    const defaultName = selectedGroup.name ?? '';
    modals.open({
      title: 'Rename group',
      size: 'xs',
      children: (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem('groupName') as HTMLInputElement;
            callbacks.onGroupRename(gid, input.value.trim() || defaultName);
            modals.closeAll();
          }}
        >
          <TextInput
            name="groupName"
            defaultValue={defaultName}
            placeholder="Group name"
            data-autofocus
            mb="sm"
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" size="xs" onClick={() => modals.closeAll()}>
              Cancel
            </Button>
            <Button size="xs" type="submit">
              Rename
            </Button>
          </Group>
        </form>
      ),
    });
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div
      ref={toolbarRef}
      data-testid="contextual-toolbar"
      role="toolbar"
      aria-label="Selection actions"
      style={{
        position: 'absolute',
        left: clampedLeft,
        top: clampedTop,
        height: TOOLBAR_HEIGHT,
        zIndex: 9999,
        background: 'var(--mantine-color-dark-7)',
        border: '1px solid var(--mantine-color-dark-4)',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 6px',
        gap: 2,
        pointerEvents: 'auto',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {selectionKind === 'group' && selectedGroup && (
        <>
          <Tooltip label="Rename group" openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={handleRenameGroupClick}
              aria-label="Rename group"
            >
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Ungroup (Ctrl+Shift+G)" openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => callbacks.onUngroup(selectedGroup.id)}
              aria-label="Ungroup"
            >
              <IconLayersOff size={14} />
            </ActionIcon>
          </Tooltip>
          <ToolbarDivider />
          <Tooltip label={isGroupLocked ? 'Unlock group' : 'Lock group'} openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => callbacks.onGroupLockToggle(selectedGroup.id, !isGroupLocked)}
              aria-label={isGroupLocked ? 'Unlock group' : 'Lock group'}
            >
              {isGroupLocked ? <IconLockOpen size={14} /> : <IconLock size={14} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={isGroupHidden ? 'Show group' : 'Hide group'} openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => callbacks.onGroupVisibilityToggle(selectedGroup.id, isGroupHidden)}
              aria-label={isGroupHidden ? 'Show group' : 'Hide group'}
            >
              {isGroupHidden ? <IconEye size={14} /> : <IconEyeOff size={14} />}
            </ActionIcon>
          </Tooltip>
          <ToolbarDivider />
          <Tooltip label="Bring forward (])" openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => callbacks.onBringForward(ids)}
              aria-label="Bring forward"
            >
              <IconArrowUp size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Send backward ([)" openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => callbacks.onSendBackward(ids)}
              aria-label="Send backward"
            >
              <IconArrowDown size={14} />
            </ActionIcon>
          </Tooltip>
        </>
      )}

      {selectionKind === 'multi' && (
        <>
          <Tooltip label="Group (Ctrl+G)" openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={callbacks.onCreateGroup}
              aria-label="Group selected slots"
            >
              <IconLayersLinked size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Duplicate (Ctrl+D)" openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={callbacks.onDuplicate}
              aria-label="Duplicate selected"
            >
              <IconCopy size={14} />
            </ActionIcon>
          </Tooltip>
          <ToolbarDivider />
          <Tooltip label="Delete (Del)" openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              onClick={callbacks.onDelete}
              aria-label="Delete selected"
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </>
      )}

      {selectionKind === 'single' && (
        <>
          <Tooltip label="Duplicate (Ctrl+D)" openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={callbacks.onDuplicate}
              aria-label="Duplicate slot"
            >
              <IconCopy size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Bring forward (])" openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => callbacks.onBringForward(ids)}
              aria-label="Bring forward"
            >
              <IconArrowUp size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Send backward ([)" openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => callbacks.onSendBackward(ids)}
              aria-label="Send backward"
            >
              <IconArrowDown size={14} />
            </ActionIcon>
          </Tooltip>
          <ToolbarDivider />
          <Tooltip label="Delete (Del)" openDelay={400}>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              onClick={callbacks.onDelete}
              aria-label="Delete slot"
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </>
      )}
    </div>
  );
}

setWpsgDebugDisplayName(ContextualToolbar, 'LayoutBuilder:ContextualToolbar');
