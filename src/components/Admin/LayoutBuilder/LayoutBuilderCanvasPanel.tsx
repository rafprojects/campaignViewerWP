import { useCallback, useMemo, useRef, useState } from 'react';
import { getHotkeyHandler } from '@mantine/hooks';
import { Box, Group, Text, NumberInput, Switch, Slider, Button, Divider, ActionIcon, Tooltip } from '@mantine/core';
import { IconHandGrab, IconPlus, IconArrowsMaximize } from '@tabler/icons-react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { LayoutCanvas } from './LayoutCanvas';
import type { ContextualToolbarCallbacks } from './ContextualToolbar';
import { CanvasTransformContext } from '@/contexts/CanvasTransformContext';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

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
    handleDeleteSelected,
    handleDuplicateSelected,
    handleCreateGroup,
    handleUngroupSelected,
    handleGroupLockToggle,
    handleGroupVisibilityToggle,
    handleGroupRename,
    handleBringForwardSelected,
    handleSendBackwardSelected,
  } = useBuilderDock();

  const contextualToolbarCallbacks = useMemo<ContextualToolbarCallbacks>(
    () => ({
      onDuplicate: handleDuplicateSelected,
      onDelete: handleDeleteSelected,
      onCreateGroup: handleCreateGroup,
      onUngroup: handleUngroupSelected,
      onGroupLockToggle: handleGroupLockToggle,
      onGroupVisibilityToggle: handleGroupVisibilityToggle,
      onGroupRename: handleGroupRename,
      onBringForward: handleBringForwardSelected,
      onSendBackward: handleSendBackwardSelected,
      announce,
    }),
    [
      handleDuplicateSelected, handleDeleteSelected,
      handleCreateGroup, handleUngroupSelected,
      handleGroupLockToggle, handleGroupVisibilityToggle, handleGroupRename,
      handleBringForwardSelected, handleSendBackwardSelected, announce,
    ],
  );

  const handleAddSlot = useCallback(() => {
    const id = builder.addSlot();
    builder.selectSlot(id);
    setSelectedOverlayId(null);
    setIsBackgroundSelected(false);
    announce('New slot added');
  }, [builder, setSelectedOverlayId, setIsBackgroundSelected, announce]);

  const handleCanvasBgDoubleClick = useCallback(
    (pctX: number, pctY: number) => {
      if (builder.isPreview) return;
      const id = builder.addSlot();
      builder.updateSlot(id, { x: Math.max(0, pctX - 10), y: Math.max(0, pctY - 10) });
      builder.selectSlot(id);
      setSelectedOverlayId(null);
      setIsBackgroundSelected(false);
      announce('New slot added at cursor position');
    },
    [builder, setSelectedOverlayId, setIsBackgroundSelected, announce],
  );

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
    (mediaId: string, meta: { attachmentId?: number | undefined; url?: string | undefined }, x: number, y: number) => {
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
  const [showSlotIndices, setShowSlotIndices] = useState(true);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const handleResetZoom = useCallback(() => {
    transformRef.current?.resetTransform();
  }, []);

  const handleFitCanvas = useCallback(() => {
    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const t = builder.template;
    const MIN_PX = 400;
    const MAX_PX = 1200;
    const canvasW = Math.max(MIN_PX, Math.min(MAX_PX, t.canvasMaxWidth || MAX_PX));
    const canvasH = t.canvasHeightMode === 'fixed-vh'
      ? Math.round(window.innerHeight * ((t.canvasHeightVh || 50) / 100))
      : Math.round(canvasW / t.canvasAspectRatio);
    const padding = 48;
    const fitScale = Math.min(
      (rect.width - padding) / canvasW,
      (rect.height - padding) / canvasH,
      2,
    );
    transformRef.current?.centerView(Math.max(0.1, fitScale));
  }, [builder.template]);

  const handleCanvasHotkeys = getHotkeyHandler([
    ['h', () => setIsHandTool((v) => !v)],
    ['v', () => setIsHandTool(false)],
    ['0', () => transformRef.current?.resetTransform()],
    ['f', handleFitCanvas],
    ['=', () => transformRef.current?.zoomIn()],
    ['+', () => transformRef.current?.zoomIn()],
    ['-', () => transformRef.current?.zoomOut()],
  ]);

  return (
    <CanvasTransformContext.Provider value={{ scale, isHandTool }}>
      <Box
        tabIndex={-1}
        onKeyDown={handleCanvasHotkeys}
        style={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}
      >
        {/* Canvas */}
        <Box
          ref={canvasAreaRef}
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
                showSlotIndices={showSlotIndices}
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
                onCanvasBgDoubleClick={handleCanvasBgDoubleClick}
                onSlotUpdate={(id, updates) => builder.updateSlot(id, updates)}
                selectedMaskSlotId={selectedMaskSlotId}
                onAssetCanvasDrop={handleAssetCanvasDrop}
                onMediaCanvasDrop={handleMediaCanvasDrop}
                contextualToolbarCallbacks={contextualToolbarCallbacks}
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
              <Switch
                label="Indices"
                size="xs"
                checked={showSlotIndices}
                onChange={(e) => setShowSlotIndices(e.currentTarget.checked)}
                aria-label="Toggle slot index badges"
              />
              <Divider orientation="vertical" />
              <Tooltip label="Add slot (or double-click canvas)">
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={12} />}
                  onClick={handleAddSlot}
                  aria-label="Add slot"
                >
                  Add Slot
                </Button>
              </Tooltip>
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
                <Tooltip label="Fit canvas to viewport (F)">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={handleFitCanvas}
                    aria-label="Fit canvas to viewport"
                  >
                    <IconArrowsMaximize size={14} />
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

setWpsgDebugDisplayName(LayoutBuilderCanvasPanel, 'LayoutBuilder:LayoutBuilderCanvasPanel');