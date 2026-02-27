import { Group, Tooltip, ActionIcon } from '@mantine/core';
import { IconPlus, IconTrash, IconCopy } from '@tabler/icons-react';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { LayerPanel } from './LayerPanel';

export function LayoutBuilderLayersPanel(_props: IDockviewPanelProps) {
  const {
    builder,
    selectedOverlayId,
    setSelectedOverlayId,
    isBackgroundSelected,
    setIsBackgroundSelected,
    designAssetsOpen: _designAssetsOpen,
    setDesignAssetsOpen,
    bgSectionRef,
    dockApiRef,
    handleDeleteSelected,
    handleDuplicateSelected,
  } = useBuilderDock();

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
          onSelectSlot={(id) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            builder.selectSlot(id);
          }}
          onSelectOverlay={(id) => {
            setSelectedOverlayId(id);
            setIsBackgroundSelected(false);
            builder.clearSelection();
          }}
          onSelectBackground={() => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(true);
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
            builder.clearSelection();
          }}
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
        />
      </div>
    </div>
  );
}
