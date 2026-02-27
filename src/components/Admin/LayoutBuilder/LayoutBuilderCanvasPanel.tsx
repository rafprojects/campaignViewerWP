import { Box, Group, Text, NumberInput, Switch, Slider, Button, Divider } from '@mantine/core';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { LayoutCanvas } from './LayoutCanvas';

export function LayoutBuilderCanvasPanel(_props: IDockviewPanelProps) {
  const {
    builder,
    media,
    snapEnabled,
    setSnapEnabled,
    snapThreshold,
    setSnapThreshold,
    setSelectedOverlayId,
    setIsBackgroundSelected,
    announce,
  } = useBuilderDock();

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Canvas */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--mantine-color-dark-8)',
          overflow: 'auto',
          padding: 24,
        }}
      >
        <LayoutCanvas
          template={builder.template}
          selectedSlotIds={builder.selectedSlotIds}
          isPreview={builder.isPreview}
          media={media}
          snapEnabled={snapEnabled}
          snapThresholdPx={snapThreshold}
          onSlotMove={builder.moveSlot}
          onSlotResize={builder.resizeSlot}
          onSlotSelect={(id) => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            builder.selectSlot(id);
          }}
          onSlotToggleSelect={builder.toggleSlotSelection}
          onCanvasClick={() => {
            setSelectedOverlayId(null);
            setIsBackgroundSelected(false);
            builder.clearSelection();
          }}
          onMediaDrop={builder.assignMediaToSlot}
          onAnnounce={announce}
          onOverlayMove={builder.moveOverlay}
          onOverlayResize={builder.resizeOverlay}
        />
      </Box>

      {/* Footer: canvas size controls */}
      {!builder.isPreview && (
        <Box
          px="md"
          py={6}
          style={{
            borderTop: '1px solid var(--mantine-color-default-border)',
            background: 'var(--mantine-color-body)',
            flexShrink: 0,
          }}
        >
          <Group gap="md" justify="center" wrap="nowrap">
            <Group gap={4} wrap="nowrap">
              <Text size="xs" c="dimmed">Max width:</Text>
              <NumberInput
                value={builder.template.canvasMaxWidth || 0}
                onChange={(val) => {
                  const n = Number(val) || 0;
                  builder.setTemplate({
                    ...builder.template,
                    canvasMaxWidth: n,
                    updatedAt: new Date().toISOString(),
                  });
                }}
                min={0}
                max={3840}
                step={10}
                size="xs"
                w={80}
                suffix="px"
                aria-label="Canvas max width"
              />
            </Group>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => {
                builder.setTemplate({
                  ...builder.template,
                  canvasMaxWidth: 0,
                  updatedAt: new Date().toISOString(),
                });
              }}
            >
              Fit to container
            </Button>
            <Divider orientation="vertical" />
            {/* Snap toggle + sensitivity */}
            <Group gap={6} wrap="nowrap">
              <Switch
                label="Snap"
                size="xs"
                checked={snapEnabled}
                onChange={(e) => setSnapEnabled(e.currentTarget.checked)}
                aria-label="Toggle snap guides"
              />
              {snapEnabled && (
                <>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    Sensitivity:
                  </Text>
                  <Slider
                    value={snapThreshold}
                    onChange={setSnapThreshold}
                    min={2}
                    max={30}
                    step={1}
                    size="xs"
                    w={80}
                    label={(v) => `${v}px`}
                    aria-label="Snap sensitivity"
                  />
                </>
              )}
            </Group>
          </Group>
        </Box>
      )}
    </Box>
  );
}
