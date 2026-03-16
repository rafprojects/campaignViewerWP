import { Box, Text } from '@mantine/core';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { SlotPropertiesPanel } from './SlotPropertiesPanel';
import { GraphicLayerPropertiesPanel } from './GraphicLayerPropertiesPanel';
import { MaskPropertiesPanel } from './MaskPropertiesPanel';
import { BackgroundPropertiesPanel } from './BackgroundPropertiesPanel';

export function LayoutBuilderPropertiesPanel(_props: IDockviewPanelProps) {
  const {
    builder,
    selectedSlot,
    selectedOverlay,
    selectedOverlayIndex,
    setSelectedOverlayId,
    selectedMaskSlotId,
    handleUploadMask,
    overlayLibrary,
    isBackgroundSelected,
  } = useBuilderDock();

  if (builder.isPreview) {
    return (
      <Box p="sm">
        <Text size="sm" c="dimmed">Properties are unavailable in preview mode.</Text>
      </Box>
    );
  }

  // Background selected — show dedicated background properties
  if (isBackgroundSelected) {
    return (
      <Box p="sm" style={{ overflowY: 'auto', height: '100%' }}>
        <Text size="xs" fw={600} c="dimmed" mb="xs">BACKGROUND</Text>
        <BackgroundPropertiesPanel />
      </Box>
    );
  }

  // Mask sublayer selected — show dedicated mask properties panel
  if (selectedMaskSlotId && selectedSlot) {
    return (
      <Box p="sm" style={{ overflowY: 'auto', height: '100%' }}>
        <Text size="xs" fw={600} c="dimmed" mb="xs">MASK PROPERTIES</Text>
        <MaskPropertiesPanel
          slot={selectedSlot}
          onUpdate={(updates) => builder.updateSlot(selectedSlot.id, updates)}
          onUploadMask={handleUploadMask}
          overlayLibrary={overlayLibrary}
        />
      </Box>
    );
  }

  if (selectedSlot) {
    return (
      <Box p="sm" style={{ overflowY: 'auto', height: '100%' }}>
        <Text size="xs" fw={600} c="dimmed" mb="xs">SLOT PROPERTIES</Text>
        <SlotPropertiesPanel
          slot={selectedSlot}
          onUpdate={(updates) => builder.updateSlot(selectedSlot.id, updates)}
          onBringToFront={() => builder.bringToFront([selectedSlot.id])}
          onSendToBack={() => builder.sendToBack([selectedSlot.id])}
          onBringForward={() => builder.bringForward([selectedSlot.id])}
          onSendBackward={() => builder.sendBackward([selectedSlot.id])}
        />
      </Box>
    );
  }

  if (selectedOverlay) {
    return (
      <Box style={{ overflowY: 'auto', height: '100%' }}>
        <Text size="xs" fw={600} c="dimmed" p="sm" pb={0}>GRAPHIC LAYER</Text>
        <GraphicLayerPropertiesPanel
          key={selectedOverlay.id}
          overlay={selectedOverlay}
          overlayIndex={selectedOverlayIndex + 1}
          onUpdate={builder.updateOverlay}
          onRename={builder.renameOverlay}
          onRemove={(id) => {
            builder.removeOverlay(id);
            setSelectedOverlayId(null);
          }}
          onBringToFront={(id) => builder.bringToFront([id])}
          onSendToBack={(id) => builder.sendToBack([id])}
          onBringForward={(id) => builder.bringForward([id])}
          onSendBackward={(id) => builder.sendBackward([id])}
        />
      </Box>
    );
  }

  return (
    <Box p="sm">
      <Text size="sm" c="dimmed">Select a layer to edit its properties.</Text>
    </Box>
  );
}
