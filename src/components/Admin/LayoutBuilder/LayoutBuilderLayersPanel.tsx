import { useCallback } from 'react';
import { Group, Tooltip, ActionIcon, Divider } from '@mantine/core';
import {
  IconPlus, IconTrash, IconCopy, IconMask,
  IconAlignBoxLeftMiddle, IconAlignBoxCenterMiddle, IconAlignBoxRightMiddle,
  IconAlignBoxTopCenter, IconAlignBoxBottomCenter,
  IconLayoutDistributeHorizontal, IconLayoutDistributeVertical,
  IconAlignBoxCenterTop,
} from '@tabler/icons-react';
import {
  alignSlotsLeft, alignSlotsRight, alignSlotsTop, alignSlotsBottom,
  centerSlotsHorizontally, centerSlotsVertically,
  distributeSlotsHorizontally, distributeSlotsVertically,
} from '@/utils/alignSlots';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { LayerPanel } from './LayerPanel';
import { DEFAULT_MASK_LAYER } from '@/types';
import { buildLayerList } from '@/utils/layerList';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export function LayoutBuilderLayersPanel(_props: IDockviewPanelProps) {
  const {
    builder,
    selectedOverlayId,
    setSelectedOverlayId,
    isBackgroundSelected,
    setIsBackgroundSelected,
    selectedMaskSlotId,
    setSelectedMaskSlotId,
    designAssetsOpen: _designAssetsOpen,
    setDesignAssetsOpen,
    bgSectionRef,
    dockApiRef,
    handleDeleteSelected,
    handleDuplicateSelected,
  } = useBuilderDock();

  /** Delete a single layer by ID (slot, overlay, or mask). */
  const handleDeleteLayer = useCallback(
    (id: string, kind: 'slot' | 'graphic' | 'mask') => {
      if (kind === 'graphic') {
        builder.removeOverlay(id);
      } else if (kind === 'mask') {
        // id is the parent slot id for mask deletions
        builder.updateSlot(id, { maskLayer: undefined, maskUrl: undefined, maskMode: undefined });
        if (selectedMaskSlotId === id) setSelectedMaskSlotId(null);
      } else {
        builder.removeSlots([id]);
      }
    },
    [builder, selectedMaskSlotId, setSelectedMaskSlotId],
  );

  /** Toggle mask visibility for a given slot. */
  const handleToggleMaskVisible = useCallback(
    (parentSlotId: string) => {
      const slot = builder.template.slots.find((s) => s.id === parentSlotId);
      if (!slot?.maskLayer) return;
      const current = slot.maskLayer.visible !== false;
      builder.updateSlot(parentSlotId, {
        maskLayer: { ...slot.maskLayer, visible: !current },
      });
    },
    [builder],
  );

  // Derive the currently-selected single slot (if any)
  const singleSelectedSlotId =
    builder.selectedSlotIds.size === 1 ? [...builder.selectedSlotIds][0] : null;
  const singleSelectedSlot = singleSelectedSlotId
    ? builder.template.slots.find((s) => s.id === singleSelectedSlotId)
    : null;
  const canAddMask =
    !!singleSelectedSlot && !singleSelectedSlot.maskLayer && !singleSelectedSlot.maskUrl;

  /** Add an empty mask sublayer to the selected slot (no file picker). */
  const handleAddMask = useCallback(() => {
    if (!singleSelectedSlot) return;
    builder.updateSlot(singleSelectedSlot.id, {
      maskLayer: { ...DEFAULT_MASK_LAYER, url: '' },
    });
    // Auto-select the new mask sublayer so properties panel opens
    setSelectedMaskSlotId(singleSelectedSlot.id);
  }, [singleSelectedSlot, builder, setSelectedMaskSlotId]);

  // Resolve the selected slots for alignment operations
  const selectedSlots = builder.template.slots.filter((s) =>
    builder.selectedSlotIds.has(s.id)
  );

  const applyAlignment = useCallback(
    (updates: Record<string, Partial<import('@/types').LayoutSlot>>) => {
      Object.entries(updates).forEach(([id, patch]) => builder.updateSlot(id, patch));
    },
    [builder],
  );

  /** Add an empty mask sublayer to an arbitrary slot by ID — used from the layer row context menu. */
  const handleAddMaskForSlot = useCallback(
    (slotId: string) => {
      const slot = builder.template.slots.find((s) => s.id === slotId);
      if (!slot || slot.maskLayer || slot.maskUrl) return;
      builder.updateSlot(slotId, {
        maskLayer: { ...DEFAULT_MASK_LAYER, url: '' },
      });
      setSelectedMaskSlotId(slotId);
    },
    [builder, setSelectedMaskSlotId],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Slot toolbar */}
      {!builder.isPreview && (
        <Group
          gap={4}
          px={6}
          py={4}
          style={{
            borderBottom: '1px solid var(--mantine-color-default-border)',
            flexShrink: 0,
          }}
        >
          <Tooltip label="Add slot">
            <ActionIcon
              size="sm"
              variant="light"
              onClick={() => builder.addSlot()}
              aria-label="Add slot"
            >
              <IconPlus size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Add mask to selected slot">
            <ActionIcon
              size="sm"
              variant="light"
              onClick={handleAddMask}
              disabled={!canAddMask}
              aria-label="Add mask to selected slot"
            >
              <IconMask size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete selected">
            <ActionIcon
              size="sm"
              variant="light"
              color="red"
              onClick={handleDeleteSelected}
              disabled={builder.selectedSlotIds.size === 0}
              aria-label="Delete selected slots"
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Duplicate selected">
            <ActionIcon
              size="sm"
              variant="light"
              onClick={handleDuplicateSelected}
              disabled={builder.selectedSlotIds.size === 0}
              aria-label="Duplicate selected slots"
            >
              <IconCopy size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}

      {/* Alignment toolbar — shown when 2+ slots selected */}
      {!builder.isPreview && builder.selectedSlotIds.size >= 2 && (
        <Group
          gap={2}
          px={6}
          py={3}
          style={{
            borderBottom: '1px solid var(--mantine-color-default-border)',
            flexShrink: 0,
          }}
        >
          <Tooltip label="Align left edges">
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignment(alignSlotsLeft(selectedSlots))} aria-label="Align left edges">
              <IconAlignBoxLeftMiddle size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Center horizontally">
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignment(centerSlotsHorizontally(selectedSlots))} aria-label="Center horizontally">
              <IconAlignBoxCenterMiddle size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Align right edges">
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignment(alignSlotsRight(selectedSlots))} aria-label="Align right edges">
              <IconAlignBoxRightMiddle size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Distribute horizontally">
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignment(distributeSlotsHorizontally(selectedSlots))} aria-label="Distribute horizontally">
              <IconLayoutDistributeHorizontal size={13} />
            </ActionIcon>
          </Tooltip>
          <Divider orientation="vertical" />
          <Tooltip label="Align top edges">
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignment(alignSlotsTop(selectedSlots))} aria-label="Align top edges">
              <IconAlignBoxTopCenter size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Center vertically">
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignment(centerSlotsVertically(selectedSlots))} aria-label="Center vertically">
              <IconAlignBoxCenterTop size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Align bottom edges">
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignment(alignSlotsBottom(selectedSlots))} aria-label="Align bottom edges">
              <IconAlignBoxBottomCenter size={13} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Distribute vertically">
            <ActionIcon size="xs" variant="subtle" onClick={() => applyAlignment(distributeSlotsVertically(selectedSlots))} aria-label="Distribute vertically">
              <IconLayoutDistributeVertical size={13} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}

      {/* Unified layer list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <LayerPanel
          template={builder.template}
          selectedSlotIds={builder.selectedSlotIds}
          selectedOverlayId={selectedOverlayId}
          isBackgroundSelected={isBackgroundSelected}
          selectedMaskSlotId={selectedMaskSlotId}
          onSelectSlot={(id) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            builder.selectSlot(id);
          }}
          onToggleSelectSlot={(id) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            builder.toggleSlotSelection(id);
          }}
          onRangeSelectSlot={(id) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            const slotLayers = buildLayerList(builder.template).filter((l) => l.kind === 'slot');
            const clickedIdx = slotLayers.findIndex((l) => l.id === id);
            const selectedArr = [...builder.selectedSlotIds];
            const anchorId = selectedArr.length > 0 ? selectedArr[selectedArr.length - 1] : undefined;
            const anchorIdx = anchorId ? slotLayers.findIndex((l) => l.id === anchorId) : -1;
            if (anchorIdx >= 0 && clickedIdx >= 0) {
              const [from, to] = [Math.min(anchorIdx, clickedIdx), Math.max(anchorIdx, clickedIdx)];
              builder.selectSlotsInRange(slotLayers.slice(from, to + 1).map((l) => l.id));
            } else {
              builder.selectSlot(id);
            }
          }}
          onSelectOverlay={(id) => {
            setSelectedOverlayId(id);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            builder.clearSelection();
          }}
          onSelectBackground={() => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(true);
            setSelectedMaskSlotId(null);
            builder.clearSelection();
            // Focus media panel in dockview and expand Design Assets accordion
            dockApiRef.current?.getPanel('media')?.api.setActive();
            setDesignAssetsOpen(true);
            try {
              localStorage.setItem('wpsg_builder_design_assets_open', 'true');
            } catch { /* ignore */ }
            requestAnimationFrame(() =>
              bgSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
            );
          }}
          onClearSelection={() => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            builder.clearSelection();
          }}
          onSelectMask={(parentSlotId) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(parentSlotId);
            // Also select the parent slot so properties panel shows slot props
            builder.selectSlot(parentSlotId);
          }}
          onToggleMaskVisible={handleToggleMaskVisible}
          onRenameSlot={builder.renameSlot}
          onRenameOverlay={builder.renameOverlay}
          onToggleSlotVisible={builder.toggleSlotVisible}
          onToggleOverlayVisible={builder.toggleOverlayVisible}
          onToggleSlotLocked={builder.toggleSlotLocked}
          onToggleOverlayLocked={builder.toggleOverlayLocked}
          onReorderLayers={builder.reorderLayers}
          onBringToFront={(id) => {
            if (
              builder.template.slots.some((s) => s.id === id) ||
              builder.template.overlays.some((o) => o.id === id)
            )
              builder.bringToFront([id]);
          }}
          onSendToBack={(id) => {
            if (
              builder.template.slots.some((s) => s.id === id) ||
              builder.template.overlays.some((o) => o.id === id)
            )
              builder.sendToBack([id]);
          }}
          onBringForward={(id) => {
            if (
              builder.template.slots.some((s) => s.id === id) ||
              builder.template.overlays.some((o) => o.id === id)
            )
              builder.bringForward([id]);
          }}
          onSendBackward={(id) => {
            if (
              builder.template.slots.some((s) => s.id === id) ||
              builder.template.overlays.some((o) => o.id === id)
            )
              builder.sendBackward([id]);
          }}
          onDeleteLayer={handleDeleteLayer}
          onAddMask={handleAddMaskForSlot}
          onSelectGroup={(groupId) => {
            builder.selectGroup(groupId);
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
          }}
          onDissolveGroup={builder.dissolveGroup}
          onToggleGroupCollapsed={(groupId, collapsed) =>
            builder.updateGroup(groupId, { collapsed })
          }
        />
      </div>
    </div>
  );
}

setWpsgDebugDisplayName(LayoutBuilderLayersPanel, 'LayoutBuilder:LayoutBuilderLayersPanel');
