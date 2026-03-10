import { useCallback, useRef, useState } from 'react';
import { useHotkeys } from '@mantine/hooks';
import { Box, Group, Text, NumberInput, Switch, Slider, Button, Divider, ActionIcon, Tooltip, SegmentedControl } from '@mantine/core';
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
    selectedMaskSlotId,
    announce,
  } = useBuilderDock();

  // ── Canvas drop handlers ──────────────────────────────────
  const handleAssetCanvasDrop = useCallback(
    (assetUrl: string, x: number, y: number) => {
      const id = builder.addOverlay(assetUrl);
      builder.moveOverlay(id, x, y);
      setSelectedOverlayId(id);
      setIsBackgroundSelected(false);
      builder.clearSelection();
      announce('Graphic layer added to canvas');
    },
    [builder, setSelectedOverlayId, setIsBackgroundSelected, announce],
  );

  const handleMediaCanvasDrop = useCallback(
    (mediaId: string, meta: { attachmentId?: number; url?: string }, x: number, y: number) => {
      const slotId = builder.addSlot();
      builder.updateSlot(slotId, { x, y });
      builder.assignMediaToSlot(slotId, mediaId, meta);
      setIsBackgroundSelected(false);
      announce('New slot created with assigned media');
    },
    [builder, setIsBackgroundSelected, announce],
  );

  // ── Zoom / pan state ──────────────────────────────────────
  const [scale, setScale] = useState(1);
  const [isHandTool, setIsHandTool] = useState(false);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  const handleResetZoom = useCallback(() => {
    transformRef.current?.resetTransform();
  }, []);

  useHotkeys([
    ['h', () => setIsHandTool((v) => !v)],
    ['v', () => setIsHandTool(false)],
    ['0', () => transformRef.current?.resetTransform()],
    ['=', () => transformRef.current?.zoomIn()],
    ['+', () => transformRef.current?.zoomIn()],
    ['-', () => transformRef.current?.zoomOut()],
  ]);

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
                onSlotUpdate={(id, updates) => builder.updateSlot(id, updates)}
                selectedMaskSlotId={selectedMaskSlotId}
                onAssetCanvasDrop={handleAssetCanvasDrop}
                onMediaCanvasDrop={handleMediaCanvasDrop}
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
              {/* Height mode toggle */}
              <Group gap={4} wrap="nowrap">
                <Text size="xs" c="dimmed">Height:</Text>
                <SegmentedControl
                  size="xs"
                  value={builder.template.canvasHeightMode || 'aspect-ratio'}
                  onChange={(val) => {
                    builder.setTemplate({
                      ...builder.template,
                      canvasHeightMode: val as 'aspect-ratio' | 'fixed-vh',
                      updatedAt: new Date().toISOString(),
                    });
                  }}
                  data={[
                    { label: 'Ratio', value: 'aspect-ratio' },
                    { label: 'vh', value: 'fixed-vh' },
                  ]}
                  aria-label="Canvas height mode"
                />
                {(builder.template.canvasHeightMode || 'aspect-ratio') === 'fixed-vh' && (
                  <NumberInput
                    value={builder.template.canvasHeightVh || 50}
                    onChange={(val) => {
                      const n = Number(val) || 50;
                      builder.setTemplate({
                        ...builder.template,
                        canvasHeightVh: Math.max(1, Math.min(100, n)),
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    min={1}
                    max={100}
                    step={5}
                    size="xs"
                    w={64}
                    suffix="vh"
                    aria-label="Canvas height in viewport units"
                  />
                )}
              </Group>
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
