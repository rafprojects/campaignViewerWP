import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getHotkeyHandler } from '@mantine/hooks';
import {
  Box, Group, Text, NumberInput, Switch, Slider,
  Button, Divider, ActionIcon, Tooltip, SegmentedControl, Alert,
} from '@mantine/core';
import type { ResponsiveBreakpoint } from '@/types';
import { IconHandGrab, IconArrowsMaximize, IconSeparatorVertical, IconSeparatorHorizontal } from '@tabler/icons-react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { IDockviewPanelProps } from 'dockview';
import { useBuilderDock } from './BuilderDockContext';
import { LayoutCanvas } from './LayoutCanvas';
import type { ContextualToolbarCallbacks } from './ContextualToolbar';
import { CanvasTransformContext, useRootId } from '@wp-super-gallery/shared-ui';
import { SNAP_MODE_LABELS, type SnapMode } from '@wp-super-gallery/shared-utils';
import { safeLocalStorage, fitRectsIntoBand } from '@wp-super-gallery/shared-utils';
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

// ── P58-B: Breakpoint edit mode ──────────────────────────────────────────────

const BREAKPOINT_EDIT_WIDTHS: Record<ResponsiveBreakpoint, number | null> = {
  desktop: null,
  tablet: 768,
  mobile: 390,
};

const BREAKPOINT_EDIT_DATA: { value: ResponsiveBreakpoint; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Mobile' },
];

/** Map a device preview preset to the breakpoint whose overrides should render (P58-B fix-up). */
function presetToBreakpoint(preset: PreviewPreset, customWidth: number): ResponsiveBreakpoint {
  switch (preset) {
    case 'tablet': return 'tablet';
    case 'mobile': return 'mobile';
    case 'custom': return customWidth < 768 ? 'mobile' : customWidth < 1200 ? 'tablet' : 'desktop';
    default: return 'desktop'; // 'none' | 'desktop' | 'laptop'
  }
}

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
    setSelectedTextId,
    selectedTextId,
    selectedMaskSlotId,
    setSelectedGuideId,
    selectedGuideId,
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

  const { t: tr } = useTranslation('wpsg');
  const presetSegmentedData = PRESET_SEGMENTED_DATA.map(({ value, label }) => ({ value, label: tr(`lb_canvas_preset_${value}`, label) }));
  const breakpointEditData = BREAKPOINT_EDIT_DATA.map(({ value, label }) => ({ value, label: tr(`admin_bp_${value}`, label) }));

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

  const handleCanvasBgDoubleClick = useCallback(
    (pctX: number, pctY: number) => {
      if (builder.isPreview) return;
      const id = builder.addSlot();
      builder.updateSlot(id, { x: Math.max(0, pctX - 10), y: Math.max(0, pctY - 10) });
      builder.selectSlot(id);
      setSelectedOverlayId(null);
      setIsBackgroundSelected(false);
      setSelectedTextId(null);
      setSelectedGuideId(null);
      announce(tr('lb_canvas_ann_slot_added', 'New slot added at cursor position'));
    },
    [builder, setSelectedOverlayId, setIsBackgroundSelected, setSelectedTextId, setSelectedGuideId, announce, tr],
  );

  // ── Canvas drop handlers ──────────────────────────────────────────────────
  const handleAssetCanvasDrop = useCallback(
    (assetUrl: string, x: number, y: number) => {
      const id = builder.addOverlay(assetUrl);
      builder.moveOverlay(id, x, y);
      setSelectedOverlayId(id);
      setIsBackgroundSelected(false);
      setSelectedTextId(null);
      setSelectedGuideId(null);
      builder.clearSelection();
      announce(tr('lb_canvas_ann_graphic_added', 'Graphic layer added to canvas'));
    },
    [builder, setSelectedOverlayId, setIsBackgroundSelected, setSelectedTextId, setSelectedGuideId, announce, tr],
  );

  const handleMediaCanvasDrop = useCallback(
    (mediaId: string, meta: { attachmentId?: number | undefined; url?: string | undefined }, x: number, y: number) => {
      const slotId = builder.addSlot();
      builder.updateSlot(slotId, { x, y });
      builder.assignMediaToSlot(slotId, mediaId, meta);
      setIsBackgroundSelected(false);
      setSelectedTextId(null);
      setSelectedGuideId(null);
      announce(tr('lb_canvas_ann_media_slot', 'New slot created with assigned media'));
    },
    [builder, setIsBackgroundSelected, setSelectedTextId, setSelectedGuideId, announce, tr],
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

  /**
   * Width that physically constrains/clips the canvas frame — PREVIEW mode only.
   * In edit mode we no longer clip to the breakpoint (P58-B fix-up): the full canvas
   * stays visible so inherited slots beyond the device width remain accessible, and
   * the breakpoint width is shown as a non-clipping in-canvas guide instead.
   */
  const activePresetWidth = useMemo<number | null>(() => {
    if (!builder.isPreview) return null;
    if (previewPreset === 'custom') return Math.max(200, Math.min(3840, customPreviewWidth));
    return PRESET_DEFS[previewPreset].width;
  }, [builder.isPreview, previewPreset, customPreviewWidth]);

  /**
   * Device width (px) of the breakpoint being edited, drawn as a centered guide band
   * on the canvas in edit mode for non-desktop breakpoints so the editor can see the
   * breakpoint's visible area and place slots within it. null = no guide (desktop/preview).
   */
  const breakpointViewportPx = useMemo<number | null>(() => {
    if (builder.isPreview) return null;
    return BREAKPOINT_EDIT_WIDTHS[builder.activeBreakpoint];
  }, [builder.isPreview, builder.activeBreakpoint]);

  // P58-B: scale+center the selection (or all slots) into the active breakpoint's target
  // band, writing per-breakpoint overrides (via breakpoint-aware updateSlots). For a
  // non-desktop breakpoint the band is the centered device viewport; for desktop it is the
  // full canvas (pulls stray/overflowing slots back into bounds).
  const handleFitToViewport = useCallback(() => {
    let leftPct = 0;
    let widthPct = 100;
    if (breakpointViewportPx) {
      const canvasW = Math.max(400, Math.min(1200, builder.template.canvasMaxWidth || 1200));
      widthPct = Math.min(100, (breakpointViewportPx / canvasW) * 100);
      leftPct = (100 - widthPct) / 2;
    }
    const selected = builder.template.slots.filter((s) => builder.selectedSlotIds.has(s.id));
    const target = selected.length > 0 ? selected : builder.template.slots;
    if (target.length === 0) return;
    const updates = fitRectsIntoBand(target, leftPct, widthPct);
    const where = breakpointViewportPx
      ? tr('lb_canvas_where_vp', '{{bp}} viewport', { bp: tr(`admin_bp_${builder.activeBreakpoint}`, builder.activeBreakpoint) })
      : tr('lb_canvas_where_canvas', 'canvas');
    if (Object.keys(updates).length > 0) {
      builder.updateSlots(updates, breakpointViewportPx ? tr('lb_canvas_fit_viewport', 'Fit to viewport') : tr('lb_canvas_fit_canvas', 'Fit to canvas'));
      announce(tr('lb_canvas_ann_fit', 'Fit {{count}} slot into the {{where}}', { count: target.length, where }));
    } else {
      announce(tr('lb_canvas_ann_already_fit', 'Slots already fit the {{where}}', { where }));
    }
  }, [breakpointViewportPx, builder, announce, tr]);

  /**
   * Breakpoint whose slot overrides the canvas should render. In edit mode this
   * is the breakpoint being edited; in preview mode it follows the device preset
   * so previewing a device shows that device's layout (P58-B fix-up).
   */
  const canvasBreakpoint = builder.isPreview
    ? presetToBreakpoint(previewPreset, customPreviewWidth)
    : builder.activeBreakpoint;

  return (
    <CanvasTransformContext.Provider value={{ scale, isHandTool }}>
      <Box
        tabIndex={-1}
        onKeyDown={handleCanvasHotkeys}
        style={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}
      >
        {/* P58-B: Breakpoint edit mode banner */}
        {!builder.isPreview && builder.activeBreakpoint !== 'desktop' && (
          <Alert
            color="blue"
            variant="light"
            p="xs"
            radius={0}
            style={{ flexShrink: 0, borderBottom: '1px solid var(--wpsg-builder-border)' }}
          >
            <Text size="xs" ta="center">
              {tr('lb_canvas_editing_pre', 'Editing ')}
              <strong>
                {tr(`admin_bp_${builder.activeBreakpoint}`, builder.activeBreakpoint.charAt(0).toUpperCase() + builder.activeBreakpoint.slice(1))}
              </strong>
              {tr('lb_canvas_editing_post', ' layout — moves and resizes apply to this breakpoint only')}
            </Text>
          </Alert>
        )}

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
                  activeBreakpoint={canvasBreakpoint}
                  breakpointViewportPx={breakpointViewportPx}
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
                    setSelectedTextId(null);
                    setSelectedGuideId(null);
                    builder.selectSlot(id);
                  }}
                  onSlotToggleSelect={builder.toggleSlotSelection}
                  onCanvasClick={() => {
                    setSelectedOverlayId(null);
                    setIsBackgroundSelected(false);
                    setSelectedTextId(null);
                    setSelectedGuideId(null);
                    builder.clearSelection();
                  }}
                  onMarqueeSelect={(ids, additive) => {
                    setSelectedOverlayId(null);
                    setIsBackgroundSelected(false);
                    setSelectedTextId(null);
                    setSelectedGuideId(null);
                    if (additive) builder.addSlotsToSelection(ids);
                    else builder.selectSlotsInRange(ids);
                  }}
                  onMediaDrop={builder.assignMediaToSlot}
                  onAnnounce={announce}
                  onOverlayMove={builder.moveOverlay}
                  onOverlayResize={builder.resizeOverlay}
                  selectedTextId={selectedTextId}
                  onTextMove={builder.moveText}
                  onTextResize={builder.resizeText}
                  onTextSelect={(id) => {
                    setSelectedOverlayId(null);
                    setIsBackgroundSelected(false);
                    setSelectedGuideId(null);
                    builder.clearSelection();
                    setSelectedTextId(id);
                  }}
                  onTextUpdate={builder.updateText}
                  onCanvasBgDoubleClick={handleCanvasBgDoubleClick}
                  onSlotUpdate={(id, updates) => builder.updateSlot(id, updates)}
                  selectedMaskSlotId={selectedMaskSlotId}
                  onAssetCanvasDrop={handleAssetCanvasDrop}
                  onMediaCanvasDrop={handleMediaCanvasDrop}
                  contextualToolbarCallbacks={contextualToolbarCallbacks}
                  guides={guides}
                  selectedGuideId={selectedGuideId}
                  onMoveGuide={moveGuide}
                  onRemoveGuide={removeGuide}
                  onToggleGuideLock={toggleGuideLock}
                  onSelectGuide={(id) => {
                    setSelectedOverlayId(null);
                    setIsBackgroundSelected(false);
                    setSelectedTextId(null);
                    builder.clearSelection();
                    setSelectedGuideId(id);
                  }}
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
                <Text size="xs" c="dimmed">{tr('lb_canvas_max_width', 'Max width:')}</Text>
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
                  aria-label={tr('lb_canvas_max_width_aria', 'Canvas max width')}
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
                {tr('lb_canvas_fit_container', 'Fit to container')}
              </Button>
              <Divider orientation="vertical" />

              {/* ── Snap mode selector ──────────────────────────── */}
              <Group gap={6} wrap="nowrap" align="center">
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{tr('lb_canvas_snap', 'Snap:')}</Text>
                <SegmentedControl
                  data={SNAP_MODE_DATA}
                  value={snapMode}
                  onChange={(v) => setSnapMode(v as SnapMode)}
                  size="xs"
                  aria-label={tr('lb_canvas_snap_mode', 'Snap mode')}
                />
                {snapMode !== 'off' && (
                  <>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {tr('lb_canvas_sensitivity', 'Sensitivity:')}
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
                      aria-label={tr('lb_canvas_snap_sens', 'Snap sensitivity')}
                    />
                  </>
                )}
              </Group>
              <Divider orientation="vertical" />

              {/* ── Grid overlay ────────────────────────────────── */}
              <Group gap={6} wrap="nowrap" align="center">
                <Switch
                  label={tr('lb_canvas_grid', 'Grid')}
                  size="xs"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.currentTarget.checked)}
                  aria-label={tr('lb_canvas_grid_aria', 'Toggle grid overlay')}
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
                    aria-label={tr('lb_canvas_grid_size_aria', 'Grid cell size')}
                  />
                )}
              </Group>
              <Divider orientation="vertical" />

              {/* ── Rulers & measurements ───────────────────────── */}
              <Group gap={6} wrap="nowrap">
                <Switch
                  label={tr('lb_canvas_rulers', 'Rulers')}
                  size="xs"
                  checked={showRulers}
                  onChange={(e) => setShowRulers(e.currentTarget.checked)}
                  aria-label={tr('lb_canvas_rulers_aria', 'Toggle canvas rulers')}
                />
                <Switch
                  label={tr('lb_canvas_measure', 'Measure')}
                  size="xs"
                  checked={showMeasurements}
                  onChange={(e) => setShowMeasurements(e.currentTarget.checked)}
                  aria-label={tr('lb_canvas_measure_aria', 'Toggle measurement overlay')}
                />
              </Group>
              <Divider orientation="vertical" />

              {/* ── Persistent guides (P57-E) ──────────────────── */}
              <Group gap={4} wrap="nowrap" align="center">
                <Text size="xs" c="dimmed">{tr('lb_canvas_guides', 'Guides:')}</Text>
                <Tooltip label={tr('lb_canvas_add_vguide', 'Add vertical guide')}>
                  <ActionIcon size="sm" variant="subtle" onClick={() => addGuide('x')} aria-label={tr('lb_canvas_add_vguide', 'Add vertical guide')}>
                    <IconSeparatorVertical size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={tr('lb_canvas_add_hguide', 'Add horizontal guide')}>
                  <ActionIcon size="sm" variant="subtle" onClick={() => addGuide('y')} aria-label={tr('lb_canvas_add_hguide', 'Add horizontal guide')}>
                    <IconSeparatorHorizontal size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Divider orientation="vertical" />

              {/* ── P58-B: Breakpoint edit mode ─────────────────── */}
              <Group gap={6} wrap="nowrap" align="center">
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{tr('lb_canvas_breakpoint', 'Breakpoint:')}</Text>
                <SegmentedControl
                  data={breakpointEditData}
                  value={builder.activeBreakpoint}
                  onChange={(v) => builder.setActiveBreakpoint(v as ResponsiveBreakpoint)}
                  size="xs"
                  aria-label={tr('lb_canvas_bp_edit_aria', 'Breakpoint edit mode')}
                  data-testid="breakpoint-edit-selector"
                />
                <Tooltip
                  label={
                    breakpointViewportPx
                      ? tr('lb_canvas_fit_vp_tt', "Move/scale the selected slots (or all slots) to fit this device's viewport — applies to this breakpoint only")
                      : tr('lb_canvas_fit_cv_tt', 'Move/scale the selected slots (or all slots) back inside the canvas bounds')
                  }
                >
                  <Button
                    size="xs"
                    variant="light"
                    onClick={handleFitToViewport}
                    aria-label={breakpointViewportPx ? tr('lb_canvas_fit_slots_vp', 'Fit slots to viewport') : tr('lb_canvas_fit_slots_cv', 'Fit slots to canvas')}
                    data-testid="fit-to-viewport"
                  >
                    {breakpointViewportPx ? tr('lb_canvas_fit_viewport', 'Fit to viewport') : tr('lb_canvas_fit_canvas', 'Fit to canvas')}
                  </Button>
                </Tooltip>
              </Group>
              <Divider orientation="vertical" />

              <Switch
                label={tr('lb_canvas_indices', 'Indices')}
                size="xs"
                checked={showSlotIndices}
                onChange={(e) => setShowSlotIndices(e.currentTarget.checked)}
                aria-label={tr('lb_canvas_indices_aria', 'Toggle slot index badges')}
              />
              <Divider orientation="vertical" />
              {/* ── Zoom controls ────────────────────────────────── */}
              <Group gap={4} wrap="nowrap">
                <Tooltip label={isHandTool ? tr('lb_canvas_select_tool', 'Switch to select tool') : tr('lb_canvas_hand_tool_tt', 'Hand tool — pan canvas (H)')}>
                  <ActionIcon
                    variant={isHandTool ? 'filled' : 'subtle'}
                    size="sm"
                    onClick={() => setIsHandTool((v) => !v)}
                    aria-label={isHandTool ? tr('lb_canvas_select_tool', 'Switch to select tool') : tr('lb_canvas_hand_tool', 'Hand tool')}
                    aria-pressed={isHandTool}
                  >
                    <IconHandGrab size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={tr('lb_canvas_fit_cv_f', 'Fit canvas to viewport (F)')}>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={handleFitCanvas}
                    aria-label={tr('lb_canvas_fit_cv_aria', 'Fit canvas to viewport')}
                  >
                    <IconArrowsMaximize size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={tr('lb_canvas_reset_zoom', 'Reset zoom to 100%')}>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={handleResetZoom}
                    style={{ minWidth: 52, fontVariantNumeric: 'tabular-nums' }}
                    aria-label={tr('lb_canvas_zoom_aria', 'Zoom {{pct}}%, click to reset', { pct: Math.round(scale * 100) })}
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
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{tr('lb_canvas_preview', 'Preview:')}</Text>
              <SegmentedControl
                data={presetSegmentedData}
                value={previewPreset}
                onChange={(v) => setPreviewPreset(v as PreviewPreset)}
                size="xs"
                aria-label={tr('lb_canvas_preview_preset_aria', 'Device preview preset')}
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
                  aria-label={tr('lb_canvas_custom_width_aria', 'Custom preview width')}
                  data-testid="custom-preview-width-input"
                />
              )}
              {previewPreset !== 'none' && (
                <>
                  <Divider orientation="vertical" />
                  <Switch
                    label={tr('lb_canvas_device_frame', 'Device frame')}
                    size="xs"
                    checked={showPreviewFrame}
                    onChange={(e) => setShowPreviewFrame(e.currentTarget.checked)}
                    aria-label={tr('lb_canvas_device_frame_aria', 'Toggle device frame chrome')}
                    data-testid="preview-frame-toggle"
                  />
                </>
              )}
              <Divider orientation="vertical" />
              {/* Zoom controls visible in preview mode too */}
              <Group gap={4} wrap="nowrap">
                <Tooltip label={tr('lb_canvas_fit_cv_f', 'Fit canvas to viewport (F)')}>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={handleFitCanvas}
                    aria-label={tr('lb_canvas_fit_cv_aria', 'Fit canvas to viewport')}
                  >
                    <IconArrowsMaximize size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={tr('lb_canvas_reset_zoom', 'Reset zoom to 100%')}>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={handleResetZoom}
                    style={{ minWidth: 52, fontVariantNumeric: 'tabular-nums' }}
                    aria-label={tr('lb_canvas_zoom_aria', 'Zoom {{pct}}%, click to reset', { pct: Math.round(scale * 100) })}
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
