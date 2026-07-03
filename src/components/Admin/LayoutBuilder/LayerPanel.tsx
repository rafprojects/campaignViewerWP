import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, Text, ScrollArea, ActionIcon, Tooltip } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconLayersLinked, IconLayersOff } from '@tabler/icons-react';
import { buildLayerList, getLayerName, type GroupLayerItem } from '@/utils/layerList';
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
  /** ID of the currently-selected text layer (P59-B). */
  selectedTextId?: string | null | undefined;
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
  /** Text layer callbacks (P59-B). */
  onSelectText?: (id: string) => void;
  onRenameText?: (id: string, name: string) => void;
  onToggleTextVisible?: (id: string) => void;
  onToggleTextLocked?: (id: string) => void;
  /** Toggle mask sublayer visibility (parentSlotId). */
  onToggleMaskVisible?: (parentSlotId: string) => void;
  onReorderLayers: (draggedId: string, targetId: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  /** Delete a specific layer by ID. */
  onDeleteLayer?: (id: string, kind: 'slot' | 'graphic' | 'text' | 'mask') => void;
  /** Add an empty mask sublayer to a slot. */
  onAddMask?: (slotId: string) => void;
  /** Called when the user clicks a group row — should select all group slot members. */
  onSelectGroup?: (groupId: string) => void;
  /** Called to dissolve a group by ID. */
  onDissolveGroup?: (groupId: string) => void;
  /** Called to toggle a group's collapsed state. */
  onToggleGroupCollapsed?: (groupId: string, collapsed: boolean) => void;
  /**
   * Called when a group is dragged onto another group row to reparent it.
   * Dragging groupA onto groupB calls onReparentGroup(groupA, groupB).
   * P30-G: drag-reparent in the layer panel.
   */
  onReparentGroup?: (groupId: string, newParentId: string) => void;
  /** When non-empty, narrows the list to matching layers; ancestor groups of matches stay visible. */
  filterText?: string;
}

// ── Indent per nesting depth (px) ────────────────────────────
const INDENT_PX = 12;

// ── Component ────────────────────────────────────────────────

export function LayerPanel({
  template,
  selectedSlotIds,
  selectedOverlayId,
  selectedTextId,
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
  onSelectText,
  onRenameText,
  onToggleTextVisible,
  onToggleTextLocked,
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
  onReparentGroup,
  filterText,
}: LayerPanelProps) {
  const { t } = useTranslation('wpsg');
  const layers = buildLayerList(template);

  // ── Filter layers ─────────────────────────────────────────
  const needle = filterText?.trim().toLowerCase() ?? '';
  const displayedLayers = needle
    ? (() => {
        const matchingIds = new Set(
          layers
            .filter(
              (l) =>
                l.kind !== 'group' &&
                getLayerName(l, template).toLowerCase().includes(needle),
            )
            .map((l) => l.id),
        );
        const ancestorGroupIds = new Set<string>();
        for (const l of layers) {
          if (matchingIds.has(l.id)) {
            for (const gid of l.ancestorGroupIds) ancestorGroupIds.add(gid);
          }
        }
        return layers.filter(
          (l) => matchingIds.has(l.id) || (l.kind === 'group' && ancestorGroupIds.has(l.id)),
        );
      })()
    : layers;
  const dragIdRef = useRef<string | null>(null);
  // Local collapsed state for groups (mirrors group.collapsed but tracked here for instant UI)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCollapsedGroups(new Set(
      (template.groups ?? [])
        .filter((group) => group.collapsed)
        .map((group) => group.id),
    ));
  }, [template.groups]);

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
      // P30-G: group → group drop = reparent; slot → slot = z-index reorder.
      // Cross-type drops (group→slot or slot→group) are a no-op: computeReorderedZIndices
      // ignores group IDs, so falling through would record a phantom history entry.
      const draggedIsGroup = layers.some((l) => l.kind === 'group' && l.id === draggedId);
      const targetIsGroup = layers.some((l) => l.kind === 'group' && l.id === targetId);
      if (draggedIsGroup && targetIsGroup && onReparentGroup) {
        onReparentGroup(draggedId, targetId);
      } else if (!draggedIsGroup && !targetIsGroup) {
        onReorderLayers(draggedId, targetId);
      }
      // else: cross-type drop — no-op
    }
    dragIdRef.current = null;
  }

  function handleGroupHeaderKeyDown(event: KeyboardEvent<HTMLDivElement>, groupId: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelectGroup?.(groupId);
  }

  // ── Keyboard navigation ───────────────────────────────────
  // For keyboard nav use the first selected slot as the anchor.
  const firstSelectedSlotId = selectedSlotIds && selectedSlotIds.size > 0 ? [...selectedSlotIds][0] : null;
  const activeLayerId = selectedMaskSlotId ? `mask-${selectedMaskSlotId}` : firstSelectedSlotId ?? selectedOverlayId ?? selectedTextId ?? (isBackgroundSelected ? 'background' : null);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const selectedIndex = displayedLayers.findIndex((l) => l.id === activeLayerId);
    if (selectedIndex < 0) return;

    function selectLayer(item: (typeof displayedLayers)[0]) {
      if (item.kind === 'slot') onSelectSlot(item.id);
      else if (item.kind === 'graphic') onSelectOverlay(item.id);
      else if (item.kind === 'text') onSelectText?.(item.id);
      else if (item.kind === 'mask') onSelectMask?.(item.parentSlotId);
      else onSelectBackground?.();
    }

    switch (e.key) {
      case 'ArrowUp': {
        e.preventDefault();
        const prev = displayedLayers[selectedIndex - 1];
        if (prev) selectLayer(prev);
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        const next = displayedLayers[selectedIndex + 1];
        if (next) selectLayer(next);
        break;
      }
      case ' ':
      case 'Space': {
        e.preventDefault();
        const cur = displayedLayers[selectedIndex]!;
        if (cur.kind === 'slot') onToggleSlotVisible(cur.id);
        else if (cur.kind === 'graphic') onToggleOverlayVisible(cur.id);
        else if (cur.kind === 'text') onToggleTextVisible?.(cur.id);
        else if (cur.kind === 'mask') onToggleMaskVisible?.(cur.parentSlotId);
        break;
      }
      case 'l':
      case 'L': {
        e.preventDefault();
        const cur = displayedLayers[selectedIndex]!;
        if (cur.kind === 'slot') onToggleSlotLocked(cur.id);
        else if (cur.kind === 'graphic') onToggleOverlayLocked(cur.id);
        else if (cur.kind === 'text') onToggleTextLocked?.(cur.id);
        break;
      }
      case 'f':
      case 'F': {
        e.preventDefault();
        const cur = displayedLayers[selectedIndex]!;
        if (cur.kind === 'background') break;
        onBringToFront(cur.id);
        break;
      }
      case 'b':
      case 'B': {
        e.preventDefault();
        const cur = displayedLayers[selectedIndex]!;
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
    <Stack
      gap={0}
      style={{
        width: 220,
        minWidth: 220,
        height: '100%',
        background: 'var(--wpsg-builder-surface)',
        color: 'var(--wpsg-builder-text)',
      }}
    >
      <Text
        size="xs"
        fw={600}
        px={6}
        py={4}
        style={{
          borderBottom: '1px solid var(--wpsg-builder-border)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--wpsg-builder-text-muted)',
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
          {displayedLayers.map((item) => {
            // ── Hide items whose ancestor group is collapsed ──────────
            // (skip collapse-hide when a filter is active — matches should always show)
            const isHiddenByCollapse =
              !needle &&
              item.ancestorGroupIds.some((gid) => collapsedGroups.has(gid));
            if (isHiddenByCollapse) return null;

            // ── Indentation based on depth ────────────────────────────
            const indentLeft = item.depth * INDENT_PX;

            // ── Group header row ──────────────────────────────────────
            if (item.kind === 'group') {
              const groupItem = item as GroupLayerItem;
              const isCollapsed = collapsedGroups.has(groupItem.id);
              // P30-G: use descendantSlotIds for selection check
              const isGroupSelected =
                groupItem.descendantSlotIds.length > 0 &&
                groupItem.descendantSlotIds.every((id) => selectedSlotIds?.has(id));

              return (
                <div
                  key={groupItem.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e as DragEvent<HTMLDivElement>, groupItem.id)}
                  onDragOver={(e) => handleDragOver(e as DragEvent<HTMLDivElement>, groupItem.id)}
                  onDrop={(e) => handleDrop(e as DragEvent<HTMLDivElement>, groupItem.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 6px 2px 4px',
                    paddingLeft: 4 + indentLeft,
                    background: isGroupSelected
                      ? 'var(--mantine-color-blue-light)'
                      : 'var(--mantine-color-default-hover)',
                    borderLeft: '3px solid var(--mantine-color-blue-5)',
                    cursor: 'grab',
                    userSelect: 'none',
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select group ${groupItem.name || 'Group'}`}
                  onClick={() => onSelectGroup?.(groupItem.id)}
                  onKeyDown={(event) => handleGroupHeaderKeyDown(event, groupItem.id)}
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
                    aria-label={isCollapsed ? t('lb_lp_expand_group', 'Expand group') : t('lb_lp_collapse_group', 'Collapse group')}
                  >
                    {isCollapsed ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
                  </ActionIcon>
                  <IconLayersLinked size={13} style={{ flexShrink: 0, color: 'var(--mantine-color-blue-5)' }} />
                  <Text size="xs" fw={500} style={{ flex: 1 }} truncate>
                    {groupItem.name || t('lb_lp_group', 'Group')}
                  </Text>
                  {/* P30-G: show total descendant count (not just direct members) */}
                  <Text size="xs" c="dimmed">{groupItem.totalDescendantCount}</Text>
                  {onDissolveGroup && (
                    <Tooltip label={t('lb_lp_ungroup', 'Ungroup')}>
                      <ActionIcon
                        size="xs"
                        variant="transparent"
                        c="dimmed"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDissolveGroup(groupItem.id);
                        }}
                        aria-label={t('lb_lp_ungroup', 'Ungroup')}
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

            const isSelected =
              (item.kind === 'slot' && (selectedSlotIds?.has(item.id) ?? false) && !selectedMaskSlotId) ||
              (item.kind === 'graphic' && item.id === selectedOverlayId) ||
              (item.kind === 'text' && item.id === selectedTextId) ||
              (item.kind === 'background' && !!isBackgroundSelected) ||
              (item.kind === 'mask' && item.parentSlotId === selectedMaskSlotId);

            return (
              <div
                key={item.id}
                style={
                  // Mask sublayers get an extra fixed indent on top of depth-based indent
                  isMask
                    ? { paddingLeft: indentLeft + INDENT_PX }
                    : indentLeft > 0
                      ? { paddingLeft: indentLeft }
                      : undefined
                }
              >
                <LayerRow
                  item={item}
                  template={template}
                  isSelected={isSelected}
                  onSelect={(_id) => {
                    if (isBackground) onSelectBackground?.();
                    else if (isMask) onSelectMask?.(item.parentSlotId);
                    else if (item.kind === 'graphic') onSelectOverlay(item.id);
                    else if (item.kind === 'text') onSelectText?.(item.id);
                    else onSelectSlot(item.id);
                  }}
                  onToggleSelect={item.kind === 'slot' ? onToggleSelectSlot : undefined}
                  onRangeSelect={item.kind === 'slot' ? onRangeSelectSlot : undefined}
                  onRename={(id, name) => {
                    if (item.kind === 'slot') onRenameSlot(id, name);
                    else if (item.kind === 'graphic') onRenameOverlay(id, name);
                    else if (item.kind === 'text') onRenameText?.(id, name);
                  }}
                  onToggleVisible={(id) => {
                    if (item.kind === 'slot') onToggleSlotVisible(id);
                    else if (item.kind === 'graphic') onToggleOverlayVisible(id);
                    else if (item.kind === 'text') onToggleTextVisible?.(id);
                    else if (item.kind === 'mask') onToggleMaskVisible?.(item.parentSlotId);
                  }}
                  onToggleLocked={(id) => {
                    if (item.kind === 'slot') onToggleSlotLocked(id);
                    else if (item.kind === 'graphic') onToggleOverlayLocked(id);
                    else if (item.kind === 'text') onToggleTextLocked?.(id);
                  }}
                  onBringToFront={onBringToFront}
                  onSendToBack={onSendToBack}
                  onBringForward={onBringForward}
                  onSendBackward={onSendBackward}
                  onDelete={onDeleteLayer ? (id) => {
                    if (item.kind === 'mask') onDeleteLayer(item.parentSlotId, 'mask');
                    else if (item.kind === 'graphic') onDeleteLayer(id, 'graphic');
                    else if (item.kind === 'text') onDeleteLayer(id, 'text');
                    else onDeleteLayer(id, 'slot');
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
