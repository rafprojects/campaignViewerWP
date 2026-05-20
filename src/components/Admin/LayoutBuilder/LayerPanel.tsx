import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Stack, Text, ScrollArea, ActionIcon, Tooltip } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconLayersLinked, IconLayersOff } from '@tabler/icons-react';
import { buildLayerList, type GroupLayerItem } from '@/utils/layerList';
import { LayerRow } from './LayerRow';
import type { LayoutTemplate } from '@/types';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ── Props ────────────────────────────────────────────────────

export interface LayerPanelProps {
  template: LayoutTemplate;
  /** Set of currently-selected slot IDs (from builder state). */
  selectedSlotIds?: Set<string> | null | undefined;
  /** ID of the currently-selected graphic layer / overlay (local modal state). */
  selectedOverlayId?: string | null | undefined;
  /** Whether the Background row is currently selected. */
  isBackgroundSelected?: boolean | undefined;
  /** Slot ID whose mask sublayer is currently selected. */
  selectedMaskSlotId?: string | null | undefined;
  onSelectSlot: (id: string) => void;
  /** Called on Ctrl/Cmd+click for multi-select toggle. */
  onToggleSelectSlot?: ((id: string) => void) | undefined;
  /** Called on Shift+click with the target ID; consumer computes and applies range. */
  onRangeSelectSlot?: ((id: string) => void) | undefined;
  onSelectOverlay: (id: string) => void;
  /** Called when the user clicks the Background row. */
  onSelectBackground?: () => void;
  /** Called when the user clicks a mask sublayer row. */
  onSelectMask?: (parentSlotId: string) => void;
  onClearSelection: () => void;
  onRenameSlot: (id: string, name: string) => void;
  onRenameOverlay: (id: string, name: string) => void;
  onToggleSlotVisible: (id: string) => void;
  onToggleOverlayVisible: (id: string) => void;
  onToggleSlotLocked: (id: string) => void;
  onToggleOverlayLocked: (id: string) => void;
  /** Toggle mask sublayer visibility (parentSlotId). */
  onToggleMaskVisible?: (parentSlotId: string) => void;
  onReorderLayers: (draggedId: string, targetId: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  /** Delete a specific layer by ID. */
  onDeleteLayer?: (id: string, kind: 'slot' | 'graphic' | 'mask') => void;
  /** Add an empty mask sublayer to a slot. */
  onAddMask?: (slotId: string) => void;
  /** Called when the user clicks a group row — should select all group slot members. */
  onSelectGroup?: (groupId: string) => void;
  /** Called to dissolve a group by ID. */
  onDissolveGroup?: (groupId: string) => void;
  /** Called to toggle a group's collapsed state. */
  onToggleGroupCollapsed?: (groupId: string, collapsed: boolean) => void;
}

// ── Component ────────────────────────────────────────────────

export function LayerPanel({
  template,
  selectedSlotIds,
  selectedOverlayId,
  isBackgroundSelected,
  selectedMaskSlotId,
  onSelectSlot,
  onToggleSelectSlot,
  onRangeSelectSlot,
  onSelectOverlay,
  onSelectBackground,
  onSelectMask,
  onClearSelection,
  onRenameSlot,
  onRenameOverlay,
  onToggleSlotVisible,
  onToggleOverlayVisible,
  onToggleSlotLocked,
  onToggleOverlayLocked,
  onToggleMaskVisible,
  onReorderLayers,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onDeleteLayer,
  onAddMask,
  onSelectGroup,
  onDissolveGroup,
  onToggleGroupCollapsed,
}: LayerPanelProps) {
  const layers = buildLayerList(template);
  const dragIdRef = useRef<string | null>(null);
  // Local collapsed state for groups (mirrors group.collapsed but tracked here for instant UI)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // ── Drag handlers ─────────────────────────────────────────

  function handleDragStart(e: DragEvent<HTMLDivElement>, id: string) {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // Minimal ghost data so DnD works in all browsers
    e.dataTransfer.setData('text/plain', id);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, _targetId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    const draggedId = dragIdRef.current;
    if (draggedId && draggedId !== targetId) {
      onReorderLayers(draggedId, targetId);
    }
    dragIdRef.current = null;
  }

  // ── Keyboard navigation ───────────────────────────────────
  // For keyboard nav use the first selected slot as the anchor.
  const firstSelectedSlotId = selectedSlotIds && selectedSlotIds.size > 0 ? [...selectedSlotIds][0] : null;
  const activeLayerId = selectedMaskSlotId ? `mask-${selectedMaskSlotId}` : firstSelectedSlotId ?? selectedOverlayId ?? (isBackgroundSelected ? 'background' : null);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const selectedIndex = layers.findIndex((l) => l.id === activeLayerId);
    if (selectedIndex < 0) return;

    function selectLayer(item: (typeof layers)[0]) {
      if (item.kind === 'slot') onSelectSlot(item.id);
      else if (item.kind === 'graphic') onSelectOverlay(item.id);
      else if (item.kind === 'mask') onSelectMask?.(item.parentSlotId);
      else onSelectBackground?.();
    }

    switch (e.key) {
      case 'ArrowUp': {
        e.preventDefault();
        const prev = layers[selectedIndex - 1];
        if (prev) selectLayer(prev);
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        const next = layers[selectedIndex + 1];
        if (next) selectLayer(next);
        break;
      }
      case ' ':
      case 'Space': {
        e.preventDefault();
        const cur = layers[selectedIndex]!;
        if (cur.kind === 'slot') onToggleSlotVisible(cur.id);
        else if (cur.kind === 'graphic') onToggleOverlayVisible(cur.id);
        else if (cur.kind === 'mask') onToggleMaskVisible?.(cur.parentSlotId);
        break;
      }
      case 'l':
      case 'L': {
        e.preventDefault();
        const cur = layers[selectedIndex]!;
        if (cur.kind === 'slot') onToggleSlotLocked(cur.id);
        else if (cur.kind === 'graphic') onToggleOverlayLocked(cur.id);
        break;
      }
      case 'f':
      case 'F': {
        e.preventDefault();
        const cur = layers[selectedIndex]!;
        if (cur.kind === 'background') break;
        onBringToFront(cur.id);
        break;
      }
      case 'b':
      case 'B': {
        e.preventDefault();
        const cur = layers[selectedIndex]!;
        if (cur.kind === 'background') break;
        onSendToBack(cur.id);
        break;
      }
      case 'Delete':
      case 'Backspace':
        // Deletion handled by parent — just clear selection signal
        onClearSelection();
        break;
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <Stack gap={0} style={{ width: 220, minWidth: 220 }}>
      <Text
        size="xs"
        fw={600}
        px={6}
        py={4}
        style={{
          borderBottom: '1px solid var(--mantine-color-gray-2)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--mantine-color-gray-6)',
        }}
      >
        Layers
      </Text>

      <ScrollArea.Autosize
        mah={460}
        scrollbarSize={4}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{ outline: 'none' }}
      >
        <Stack gap={0} py={4}>
          {layers.map((item) => {
            // ── Group header row ─────────────────────────────
            if (item.kind === 'group') {
              const groupItem = item as GroupLayerItem;
              const isCollapsed = collapsedGroups.has(groupItem.id);
              const allSlotIds = groupItem.group.memberIds.filter(
                (id) => template.slots.some((s) => s.id === id)
              );
              const isGroupSelected = allSlotIds.length > 0 && allSlotIds.every((id) => selectedSlotIds?.has(id));
              return (
                <div
                  key={groupItem.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 6px 2px 4px',
                    background: isGroupSelected
                      ? 'var(--mantine-color-blue-light)'
                      : 'var(--mantine-color-default-hover)',
                    borderLeft: '3px solid var(--mantine-color-blue-5)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={() => onSelectGroup?.(groupItem.id)}
                >
                  <ActionIcon
                    size="xs"
                    variant="transparent"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(groupItem.id)) next.delete(groupItem.id);
                        else next.add(groupItem.id);
                        return next;
                      });
                      onToggleGroupCollapsed?.(groupItem.id, !isCollapsed);
                    }}
                    aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                  >
                    {isCollapsed ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
                  </ActionIcon>
                  <IconLayersLinked size={13} style={{ flexShrink: 0, color: 'var(--mantine-color-blue-5)' }} />
                  <Text size="xs" fw={500} style={{ flex: 1 }} truncate>
                    {groupItem.name || 'Group'}
                  </Text>
                  <Text size="xs" c="dimmed">{groupItem.group.memberIds.length}</Text>
                  {onDissolveGroup && (
                    <Tooltip label="Ungroup">
                      <ActionIcon
                        size="xs"
                        variant="transparent"
                        c="dimmed"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDissolveGroup(groupItem.id);
                        }}
                        aria-label="Ungroup"
                      >
                        <IconLayersOff size={12} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </div>
              );
            }

            // ── Normal layer rows ────────────────────────────
            const isBackground = item.kind === 'background';
            const isMask = item.kind === 'mask';

            // Hide members of collapsed groups
            const memberGroup = (template.groups ?? []).find((g) => g.memberIds.includes(item.id));
            if (memberGroup && collapsedGroups.has(memberGroup.id)) return null;

            // Indent members of any group
            const indented = !!memberGroup;

            const isSelected =
              (item.kind === 'slot' && (selectedSlotIds?.has(item.id) ?? false) && !selectedMaskSlotId) ||
              (item.kind === 'graphic' && item.id === selectedOverlayId) ||
              (item.kind === 'background' && !!isBackgroundSelected) ||
              (item.kind === 'mask' && item.parentSlotId === selectedMaskSlotId);
            return (
              <div key={item.id} style={indented ? { paddingLeft: 12 } : undefined}>
                <LayerRow
                  item={item}
                  template={template}
                  isSelected={isSelected}
                  onSelect={(_id) => {
                    if (isBackground) onSelectBackground?.();
                    else if (isMask) onSelectMask?.(item.parentSlotId);
                    else if (item.kind === 'graphic') onSelectOverlay(item.id);
                    else onSelectSlot(item.id);
                  }}
                  onToggleSelect={item.kind === 'slot' ? onToggleSelectSlot : undefined}
                  onRangeSelect={item.kind === 'slot' ? onRangeSelectSlot : undefined}
                  onRename={(id, name) => {
                    if (item.kind === 'slot') onRenameSlot(id, name);
                    else if (item.kind === 'graphic') onRenameOverlay(id, name);
                  }}
                  onToggleVisible={(id) => {
                    if (item.kind === 'slot') onToggleSlotVisible(id);
                    else if (item.kind === 'graphic') onToggleOverlayVisible(id);
                    else if (item.kind === 'mask') onToggleMaskVisible?.(item.parentSlotId);
                  }}
                  onToggleLocked={(id) => {
                    if (item.kind === 'slot') onToggleSlotLocked(id);
                    else if (item.kind === 'graphic') onToggleOverlayLocked(id);
                  }}
                  onBringToFront={onBringToFront}
                  onSendToBack={onSendToBack}
                  onBringForward={onBringForward}
                  onSendBackward={onSendBackward}
                  onDelete={onDeleteLayer ? (id) => {
                    if (item.kind === 'mask') onDeleteLayer(item.parentSlotId, 'mask');
                    else onDeleteLayer(id, item.kind === 'graphic' ? 'graphic' : 'slot');
                  } : undefined}
                  onAddMask={onAddMask}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              </div>
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}

setWpsgDebugDisplayName(LayerPanel, 'LayoutBuilder:LayerPanel');