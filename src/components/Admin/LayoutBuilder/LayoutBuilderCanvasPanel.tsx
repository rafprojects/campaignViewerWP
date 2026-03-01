import { useCallback, useRef, useState } from 'react';
import { Box, Group, Text, NumberInput, Switch, Slider, Button, Divider, ActionIcon, Tooltip } from '@mantine/core';
import { IconHandGrab } from '@tabler/icons-react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { LayoutCanvas } from './LayoutCanvas';
import { CanvasTransformContext } from '@/contexts/CanvasTransformContext';

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

  // ── Zoom / pan state ──────────────────────────────────────
  const [scale, setScale] = useState(1);
  const [isHandTool, setIsHandTool] = useState(false);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  const handleResetZoom = useCallback(() => {
    transformRef.current?.resetTransform();
  }, []);

  return (
    <CanvasTransformContext.Provider value={{ scale, isHandTool }}>
      <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Canvas */}
        <Box
          style={{
            flex: 1,
            overflow: 'hidden',
            background: 'var(--mantine-color-dark-8)',
          }}
        >
          <TransformWrapper
            ref={transformRef}
            minScale={0.25}
            maxScale={4}
            wheel={{ step: 0.1 }}
            panning={{ disabled: !isHandTool }}
            onTransformed={(_ref, state) => setScale(state.scale)}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
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
                onCanvasBgDoubleClick={handleResetZoom}
              />
            </TransformComponent>
          </TransformWrapper>
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
              <Divider orientation="vertical" />
              {/* ── Zoom controls ───────────────────────────── */}
              <Group gap={4} wrap="nowrap">
                <Tooltip label={isHandTool ? 'Switch to select tool' : 'Hand tool — pan canvas (H)'}>
                  <ActionIcon
                    variant={isHandTool ? 'filled' : 'subtle'}
                    size="sm"
                    onClick={() => setIsHandTool((v) => !v)}
                    aria-label={isHandTool ? 'Switch to select tool' : 'Hand tool'}
                    aria-pressed={isHandTool}
                  >
                    <IconHandGrab size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Reset zoom to 100%">
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={handleResetZoom}
                    style={{ minWidth: 52, fontVariantNumeric: 'tabular-nums' }}
                    aria-label={`Zoom ${Math.round(scale * 100)}%, click to reset`}
                  >
                    {Math.round(scale * 100)}%
                  </Button>
                </Tooltip>
              </Group>
            </Group>
          </Box>
        )}
      </Box>
    </CanvasTransformContext.Provider>
  );
}
