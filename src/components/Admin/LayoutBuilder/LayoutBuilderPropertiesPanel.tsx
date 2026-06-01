import { Box, Text, Button, Stack, Divider, SegmentedControl, NumberInput, Group } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { SlotPropertiesPanel } from './SlotPropertiesPanel';
import { GraphicLayerPropertiesPanel } from './GraphicLayerPropertiesPanel';
import { MaskPropertiesPanel } from './MaskPropertiesPanel';
import { BackgroundPropertiesPanel } from './BackgroundPropertiesPanel';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

const ASPECT_PRESETS = [
  { label: '16:9', value: String(16 / 9) },
  { label: '4:3', value: String(4 / 3) },
  { label: '1:1', value: '1' },
  { label: '3:2', value: String(3 / 2) },
  { label: '21:9', value: String(21 / 9) },
] as const;

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
    listingMode,
  } = useBuilderDock();

  const panelStyle = {
    overflowY: 'auto' as const,
    height: '100%',
    background: 'var(--wpsg-builder-surface)',
    color: 'var(--wpsg-builder-text)',
  };

  if (builder.isPreview) {
    return (
      <Box p="sm" style={{ ...panelStyle }}>
        <Text size="sm" c="dimmed">Properties are unavailable in preview mode.</Text>
      </Box>
    );
  }

  // Background selected — show dedicated background properties
  if (isBackgroundSelected) {
    return (
      <Box p="sm" style={panelStyle}>
        <Text size="xs" fw={600} c="dimmed" mb="xs">BACKGROUND</Text>
        <BackgroundPropertiesPanel />
      </Box>
    );
  }

  // Mask sublayer selected — show dedicated mask properties panel
  if (selectedMaskSlotId && selectedSlot) {
    return (
      <Box p="sm" style={panelStyle}>
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
      <Box p="sm" style={panelStyle}>
        <Text size="xs" fw={600} c="dimmed" mb="xs">SLOT PROPERTIES</Text>
        <SlotPropertiesPanel
          slot={selectedSlot}
          onUpdate={(updates) => builder.updateSlot(selectedSlot.id, updates)}
          onBringToFront={() => builder.bringToFront([selectedSlot.id])}
          onSendToBack={() => builder.sendToBack([selectedSlot.id])}
          onBringForward={() => builder.bringForward([selectedSlot.id])}
          onSendBackward={() => builder.sendBackward([selectedSlot.id])}
          listingMode={listingMode}
        />
      </Box>
    );
  }

  if (selectedOverlay) {
    return (
      <Box style={panelStyle}>
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

  // No selection — show canvas overview / quick actions
  const slotCount = builder.template.slots.length;
  const overlayCount = builder.template.overlays.length;
  const recentActions = builder.historyEntries.slice(-5).reverse();

  return (
    <Box p="sm" style={panelStyle}>
      <Text size="xs" fw={600} c="dimmed" mb="xs">CANVAS</Text>
      <Stack gap="xs">
        <Box>
          <Text size="xs" c="dimmed">Slots</Text>
          <Text size="sm" fw={500}>{slotCount}</Text>
        </Box>
        <Box>
          <Text size="xs" c="dimmed">Graphic layers</Text>
          <Text size="sm" fw={500}>{overlayCount}</Text>
        </Box>
        <Divider />
        <Box>
          <Text size="xs" c="dimmed" mb={4}>Aspect ratio</Text>
          <SegmentedControl
            size="xs"
            value={String(builder.template.canvasAspectRatio)}
            onChange={(val) => builder.setAspectRatio(Number(val))}
            data={ASPECT_PRESETS.map((p) => ({ label: p.label, value: p.value }))}
            fullWidth
          />
        </Box>
        <Box>
          <Text size="xs" c="dimmed" mb={4}>Height mode</Text>
          <Group gap={6} wrap="nowrap">
            <SegmentedControl
              size="xs"
              value={builder.template.canvasHeightMode || 'aspect-ratio'}
              onChange={(val) => builder.setCanvasHeightMode(val as 'aspect-ratio' | 'fixed-vh')}
              data={[
                { label: 'Ratio', value: 'aspect-ratio' },
                { label: 'vh', value: 'fixed-vh' },
              ]}
              aria-label="Canvas height mode"
            />
            {(builder.template.canvasHeightMode || 'aspect-ratio') === 'fixed-vh' && (
              <NumberInput
                value={builder.template.canvasHeightVh || 50}
                onChange={(val) => builder.setCanvasHeightVh(Number(val) || 50)}
                min={1}
                max={100}
                step={5}
                size="xs"
                w={72}
                suffix="vh"
                aria-label="Canvas height in viewport units"
              />
            )}
          </Group>
        </Box>
        <Divider />
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={() => {
            const id = builder.addSlot();
            builder.selectSlot(id);
          }}
          fullWidth
        >
          Add Slot
        </Button>
        {recentActions.length > 0 && (
          <>
            <Divider />
            <Text size="xs" fw={600} c="dimmed">Recent actions</Text>
            {recentActions.map((entry) => (
              <Text key={entry.id} size="xs" c="dimmed" truncate="end">{entry.label}</Text>
            ))}
          </>
        )}
      </Stack>
    </Box>
  );
}

setWpsgDebugDisplayName(LayoutBuilderPropertiesPanel, 'LayoutBuilder:LayoutBuilderPropertiesPanel');