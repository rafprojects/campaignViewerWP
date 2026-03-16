import { useCallback } from 'react';
import { Group, Tooltip, ActionIcon } from '@mantine/core';
import { IconPlus, IconTrash, IconCopy, IconMask } from '@tabler/icons-react';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { LayerPanel } from './LayerPanel';
import { DEFAULT_MASK_LAYER } from '@/types';

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

      {/* Unified layer list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <LayerPanel
          template={builder.template}
          selectedSlotId={
            builder.selectedSlotIds.size === 1
              ? [...builder.selectedSlotIds][0]
              : null
          }
          selectedOverlayId={selectedOverlayId}
          isBackgroundSelected={isBackgroundSelected}
          selectedMaskSlotId={selectedMaskSlotId}
          onSelectSlot={(id) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            setSelectedMaskSlotId(null);
            builder.selectSlot(id);
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
        />
      </div>
    </div>
  );
}
