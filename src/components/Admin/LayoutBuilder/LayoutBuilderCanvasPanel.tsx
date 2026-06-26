import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getHotkeyHandler } from '@mantine/hooks';
import {
  Box, Group, Text, NumberInput, Switch, Slider,
  Button, Divider, ActionIcon, Tooltip, SegmentedControl,
} from '@mantine/core';
import { IconHandGrab, IconPlus, IconArrowsMaximize, IconSeparatorVertical, IconSeparatorHorizontal } from '@tabler/icons-react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { LayoutCanvas } from './LayoutCanvas';
import type { ContextualToolbarCallbacks } from './ContextualToolbar';
import { CanvasTransformContext, useRootId } from '@wp-super-gallery/shared-ui';
import { SNAP_MODE_LABELS, type SnapMode } from '@wp-super-gallery/shared-utils';
import { safeLocalStorage } from '@wp-super-gallery/shared-utils';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ── P30-C: Device preview presets ────────────────────────────────────────────

export type PreviewPreset = 'none' | 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'custom';

interface PresetDef {
  label: string;
  width: number | null; // null = unconstrained
}

const PRESET_DEFS: Record<PreviewPreset, PresetDef> = {
  none: { label: 'Full', width: null },
  desktop: { label: 'Desktop', width: 1280 },
  laptop: { label: 'Laptop', width: 1024 },
  tablet: { label: 'Tablet', width: 768 },
  mobile: { label: 'Mobile', width: 390 },
  custom: { label: 'Custom', width: null }, // width set by customPreviewWidth
};

const PRESET_SEGMENTED_DATA = (Object.entries(PRESET_DEFS) as [PreviewPreset, PresetDef][]).map(
  ([value, { label }]) => ({ value, label }),
);

// ── P30-B: Snap mode ─────────────────────────────────────────────────────────

const SNAP_MODE_DATA = (Object.entries(SNAP_MODE_LABELS) as [SnapMode, string][]).map(
  ([value, label]) => ({ value, label }),
);

// ── Component ─────────────────────────────────────────────────────────────────

export function LayoutBuilderCanvasPanel(_props: IDockviewPanelProps) {
  const {
    builder,
    media,
    snapMode,
    setSnapMode,
    snapThreshold,
    setSnapThreshold,
    showGrid,
    setShowGrid,
    gridSizePx,
    setGridSizePx,
    showRulers,
    setShowRulers,
    showMeasurements,
    setShowMeasurements,
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
    guides,
    addGuide,
    moveGuide,
    removeGuide,
    toggleGuideLock,
  } = useBuilderDock();

  const rootId = useRootId();

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

  // ── Canvas drop handlers ──────────────────────────────────────────────────
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

  // ── Zoom / pan state ──────────────────────────────────────────────────────
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

  // ── P30-C: Device preview presets (root-scoped per P37-KS1) ─────────────
  const [previewPreset, setPreviewPreset] = useState<PreviewPreset>(() =>
    (safeLocalStorage.getItem(`wpsg_builder_${rootId}_preview_preset`) as PreviewPreset | null) ?? 'none',
  );
  const [customPreviewWidth, setCustomPreviewWidth] = useState<number>(() =>
    Number(safeLocalStorage.getItem(`wpsg_builder_${rootId}_custom_preview_width`)) || 800,
  );
  const [showPreviewFrame, setShowPreviewFrame] = useState<boolean>(
    () => safeLocalStorage.getItem(`wpsg_builder_${rootId}_show_preview_frame`) === 'true',
  );

  useEffect(() => { safeLocalStorage.setItem(`wpsg_builder_${rootId}_preview_preset`, previewPreset); }, [rootId, previewPreset]);
  useEffect(() => { safeLocalStorage.setItem(`wpsg_builder_${rootId}_custom_preview_width`, String(customPreviewWidth)); }, [rootId, customPreviewWidth]);
  useEffect(() => { safeLocalStorage.setItem(`wpsg_builder_${rootId}_show_preview_frame`, String(showPreviewFrame)); }, [rootId, showPreviewFrame]);

  // P37-KS1: one-time migration of legacy global preview keys to root-scoped keys.
  useEffect(() => {
    const migrations: [string, string][] = [
      ['wpsg_builder_preview_preset', `wpsg_builder_${rootId}_preview_preset`],
      ['wpsg_builder_custom_preview_width', `wpsg_builder_${rootId}_custom_preview_width`],
      ['wpsg_builder_show_preview_frame', `wpsg_builder_${rootId}_show_preview_frame`],
    ];
    for (const [oldKey, newKey] of migrations) {
      try {
        const v = localStorage.getItem(oldKey);
        if (v !== null) {
          safeLocalStorage.setItem(newKey, v);
          localStorage.removeItem(oldKey);
        }
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Resolved pixel width of the active device preset (null = unconstrained). */
  const activePresetWidth = useMemo<number | null>(() => {
    if (!builder.isPreview) return null;
    if (previewPreset === 'custom') return Math.max(200, Math.min(3840, customPreviewWidth));
    return PRESET_DEFS[previewPreset].width;
  }, [builder.isPreview, previewPreset, customPreviewWidth]);

  return (
    <CanvasTransformContext.Provider value={{ scale, isHandTool }}>
      <Box
        tabIndex={-1}
        onKeyDown={handleCanvasHotkeys}
        style={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}
      >
        {/* Canvas area */}
        <Box
          ref={canvasAreaRef}
          style={{
            flex: 1,
            overflow: 'hidden',
            background: 'var(--mantine-color-dark-8)',
            // Centre the preview frame when a preset constrains width
            display: 'flex',
            flexDirection: 'column',
            alignItems: activePresetWidth ? 'center' : undefined,
          }}
        >
          {/* P30-C: Device frame wrapper — only rendered when a preset is active in preview mode */}
          <Box
            style={{
              flex: 1,
              width: activePresetWidth ? Math.min(activePresetWidth, canvasAreaRef.current?.clientWidth ?? activePresetWidth) : '100%',
              maxWidth: activePresetWidth ?? undefined,
              overflow: 'hidden',
              // Device chrome frame
              ...(activePresetWidth && showPreviewFrame ? {
                border: '8px solid var(--mantine-color-default-border)',
                borderRadius: 12,
                boxShadow: '0 0 0 2px var(--mantine-color-default-border), 0 8px 32px rgba(0,0,0,0.5)',
                margin: '12px 0',
              } : {}),
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
                  snapMode={snapMode}
                  snapThresholdPx={snapThreshold}
                  showGrid={showGrid}
                  gridSizePx={gridSizePx}
                  showRulers={showRulers}
                  showMeasurements={showMeasurements}
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
                  onMarqueeSelect={(ids, additive) => {
                    setSelectedOverlayId(null);
                    setIsBackgroundSelected(false);
                    if (additive) builder.addSlotsToSelection(ids);
                    else builder.selectSlotsInRange(ids);
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
                  guides={guides}
                  onMoveGuide={moveGuide}
                  onRemoveGuide={removeGuide}
                  onToggleGuideLock={toggleGuideLock}
                />
              </TransformComponent>
            </TransformWrapper>
          </Box>
        </Box>

        {/* ── Edit-mode footer ─────────────────────────────────── */}
        {!builder.isPreview && (
          <Box
            px="md"
            py={6}
            style={{
              borderTop: '1px solid var(--wpsg-builder-border)',
              background: 'var(--wpsg-builder-surface)',
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

              {/* ── Snap mode selector ──────────────────────────── */}
              <Group gap={6} wrap="nowrap" align="center">
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>Snap:</Text>
                <SegmentedControl
                  data={SNAP_MODE_DATA}
                  value={snapMode}
                  onChange={(v) => setSnapMode(v as SnapMode)}
                  size="xs"
                  aria-label="Snap mode"
                />
                {snapMode !== 'off' && (
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

              {/* ── Grid overlay ────────────────────────────────── */}
              <Group gap={6} wrap="nowrap" align="center">
                <Switch
                  label="Grid"
                  size="xs"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.currentTarget.checked)}
                  aria-label="Toggle grid overlay"
                />
                {showGrid && (
                  <NumberInput
                    value={gridSizePx}
                    onChange={(val) => setGridSizePx(Number(val) || 20)}
                    min={4}
                    max={200}
                    step={4}
                    size="xs"
                    w={68}
                    suffix="px"
                    aria-label="Grid cell size"
                  />
                )}
              </Group>
              <Divider orientation="vertical" />

              {/* ── Rulers & measurements ───────────────────────── */}
              <Group gap={6} wrap="nowrap">
                <Switch
                  label="Rulers"
                  size="xs"
                  checked={showRulers}
                  onChange={(e) => setShowRulers(e.currentTarget.checked)}
                  aria-label="Toggle canvas rulers"
                />
                <Switch
                  label="Measure"
                  size="xs"
                  checked={showMeasurements}
                  onChange={(e) => setShowMeasurements(e.currentTarget.checked)}
                  aria-label="Toggle measurement overlay"
                />
              </Group>
              <Divider orientation="vertical" />

              {/* ── Persistent guides (P57-E) ──────────────────── */}
              <Group gap={4} wrap="nowrap" align="center">
                <Text size="xs" c="dimmed">Guides:</Text>
                <Tooltip label="Add vertical guide">
                  <ActionIcon size="sm" variant="subtle" onClick={() => addGuide('x')} aria-label="Add vertical guide">
                    <IconSeparatorVertical size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Add horizontal guide">
                  <ActionIcon size="sm" variant="subtle" onClick={() => addGuide('y')} aria-label="Add horizontal guide">
                    <IconSeparatorHorizontal size={14} />
                  </ActionIcon>
                </Tooltip>
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
              {/* ── Zoom controls ────────────────────────────────── */}
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

        {/* ── P30-C: Preview-mode device preset controls ───────── */}
        {builder.isPreview && (
          <Box
            px="md"
            py={6}
            data-testid="preview-preset-bar"
            style={{
              borderTop: '1px solid var(--wpsg-builder-border)',
              background: 'var(--wpsg-builder-surface)',
              flexShrink: 0,
            }}
          >
            <Group gap="md" justify="center" wrap="nowrap">
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>Preview:</Text>
              <SegmentedControl
                data={PRESET_SEGMENTED_DATA}
                value={previewPreset}
                onChange={(v) => setPreviewPreset(v as PreviewPreset)}
                size="xs"
                aria-label="Device preview preset"
                data-testid="preview-preset-selector"
              />
              {previewPreset === 'custom' && (
                <NumberInput
                  value={customPreviewWidth}
                  onChange={(val) => setCustomPreviewWidth(Math.max(200, Math.min(3840, Number(val) || 800)))}
                  min={200}
                  max={3840}
                  step={10}
                  size="xs"
                  w={90}
                  suffix="px"
                  aria-label="Custom preview width"
                  data-testid="custom-preview-width-input"
                />
              )}
              {previewPreset !== 'none' && (
                <>
                  <Divider orientation="vertical" />
                  <Switch
                    label="Device frame"
                    size="xs"
                    checked={showPreviewFrame}
                    onChange={(e) => setShowPreviewFrame(e.currentTarget.checked)}
                    aria-label="Toggle device frame chrome"
                    data-testid="preview-frame-toggle"
                  />
                </>
              )}
              <Divider orientation="vertical" />
              {/* Zoom controls visible in preview mode too */}
              <Group gap={4} wrap="nowrap">
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
