import { useCallback, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import type { LayoutTemplate, MediaItem } from '@/types';
import { assignMediaToSlots } from '@/utils/layoutSlotAssignment';
import { computeGuides, type GuideLine, type SlotRect } from '@/utils/smartGuides';
import { useCanvasTransform } from '@/contexts/CanvasTransformContext';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { LayoutSlotComponent } from './LayoutSlotComponent';
import { SmartGuides } from './SmartGuides';
import { ContextualToolbar, type ContextualToolbarCallbacks } from './ContextualToolbar';
import { buildGradientCss, templateToGradientOpts } from '@/utils/gradientCss';
import { sanitizeCssUrl } from '@/utils/sanitizeCss';
import { ASSET_MIME } from './DesignAssetsGrid';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ── Props ────────────────────────────────────────────────────

export interface LayoutCanvasProps {
  template: LayoutTemplate;
  selectedSlotIds: Set<string>;
  isPreview: boolean;
  media: MediaItem[];
  snapEnabled: boolean;
  onSlotMove: (id: string, x: number, y: number) => void;
  onSlotResize: (id: string, x: number, y: number, w: number, h: number) => void;
  onSlotSelect: (id: string) => void;
  onSlotToggleSelect: (id: string) => void;
  onCanvasClick: () => void;
  onMediaDrop?: (slotId: string, mediaId: string, meta?: { attachmentId?: number | undefined; url?: string | undefined }) => void;
  /** Announce a11y messages. */
  onAnnounce?: (msg: string) => void;
  /** Overlay move callback (P15-H). */
  onOverlayMove?: (id: string, x: number, y: number) => void;
  /** Overlay resize callback (P15-H). */
  onOverlayResize?: (id: string, x: number, y: number, w: number, h: number) => void;
  /** Snap detection distance in canvas pixels (default: 5). Higher = snaps from further away. */
  snapThresholdPx?: number;
  /** Called on double-click on canvas background with click position as canvas %. */
  onCanvasBgDoubleClick?: (pctX: number, pctY: number) => void;
  /** Generic slot property update callback (e.g. mask layer drag). */
  onSlotUpdate?: (slotId: string, updates: Partial<import('@/types').LayoutSlot>) => void;
  /** Slot ID whose mask sublayer is currently selected (for mask drag overlay). */
  selectedMaskSlotId?: string | null;
  /** Called when a Design Asset is dropped on the canvas background. x,y are canvas %. */
  onAssetCanvasDrop?: (assetUrl: string, x: number, y: number) => void;
  /** Called when campaign media is dropped on the canvas background. x,y are canvas %. */
  onMediaCanvasDrop?: (mediaId: string, meta: { attachmentId?: number | undefined; url?: string | undefined }, x: number, y: number) => void;
  /** Whether to render slot index badges (default: true). */
  showSlotIndices?: boolean;
  /** When provided, renders the contextual floating toolbar on selection. */
  contextualToolbarCallbacks?: ContextualToolbarCallbacks | undefined;
}

// ── Minimum canvas render width ──────────────────────────────

const MIN_CANVAS_PX = 400;
const MAX_CANVAS_PX = 1200;

// ── Helpers ──────────────────────────────────────────────────

function formatAspectRatio(ratio: number): string {
  let bestN = 1, bestD = 1, bestErr = Infinity;
  for (let d = 1; d <= 99; d++) {
    const n = Math.round(ratio * d);
    const err = Math.abs(ratio - n / d);
    if (err < bestErr) { bestErr = err; bestN = n; bestD = d; }
  }
  return `${bestN}:${bestD}`;
}

// ── Component ────────────────────────────────────────────────

export function LayoutCanvas({
  template,
  selectedSlotIds,
  isPreview,
  media,
  snapEnabled,
  onSlotMove,
  onSlotResize,
  onSlotSelect,
  onSlotToggleSelect,
  onCanvasClick,
  onMediaDrop,
  onAnnounce,
  onOverlayMove,
  onOverlayResize,
  snapThresholdPx = 5,
  onCanvasBgDoubleClick,
  onSlotUpdate,
  selectedMaskSlotId,
  onAssetCanvasDrop,
  onMediaCanvasDrop,
  showSlotIndices = true,
  contextualToolbarCallbacks,
}: LayoutCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { scale, isHandTool } = useCanvasTransform();
  const viewportHeight = useViewportHeight();

  // Compute canvas pixel dimensions from aspect ratio
  const canvasWidth = Math.max(
    MIN_CANVAS_PX,
    Math.min(MAX_CANVAS_PX, template.canvasMaxWidth || MAX_CANVAS_PX),
  );
  const canvasHeight =
    template.canvasHeightMode === 'fixed-vh'
      ? Math.round(
        viewportHeight *
        ((template.canvasHeightVh || 50) / 100),
      )
      : Math.round(canvasWidth / template.canvasAspectRatio);

  // Auto-assign media to slots for preview
  const { assignments: mediaAssignments } = useMemo(
    () => assignMediaToSlots(template, media),
    [template, media],
  );

  // Convert % position to px for react-rnd, and back
  const pctToPx = useCallback(
    (pctX: number, pctY: number, pctW?: number, pctH?: number) => ({
      x: (pctX / 100) * canvasWidth,
      y: (pctY / 100) * canvasHeight,
      width: pctW !== undefined ? (pctW / 100) * canvasWidth : undefined,
      height: pctH !== undefined ? (pctH / 100) * canvasHeight : undefined,
    }),
    [canvasWidth, canvasHeight],
  );

  const pxToPct = useCallback(
    (pxX: number, pxY: number, pxW?: number, pxH?: number) => ({
      x: Math.round(((pxX / canvasWidth) * 100) * 100) / 100,
      y: Math.round(((pxY / canvasHeight) * 100) * 100) / 100,
      width:
        pxW !== undefined
          ? Math.round(((pxW / canvasWidth) * 100) * 100) / 100
          : undefined,
      height:
        pxH !== undefined
          ? Math.round(((pxH / canvasHeight) * 100) * 100) / 100
          : undefined,
    }),
    [canvasWidth, canvasHeight],
  );

  // ── Contextual toolbar: union bounding rect of selected slots ─

  const selectionRect = useMemo(() => {
    if (isPreview || selectedSlotIds.size === 0 || !contextualToolbarCallbacks) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const slot of template.slots) {
      if (!selectedSlotIds.has(slot.id)) continue;
      const px = pctToPx(slot.x, slot.y, slot.width, slot.height);
      minX = Math.min(minX, px.x);
      minY = Math.min(minY, px.y);
      maxX = Math.max(maxX, px.x + (px.width ?? 0));
      maxY = Math.max(maxY, px.y + (px.height ?? 0));
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [isPreview, selectedSlotIds, template.slots, pctToPx, contextualToolbarCallbacks]);

  // ── Smart guides state ─────────────────────────────────────

  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);
  const lastGuideResultRef = useRef<{ snapX?: number | undefined; snapY?: number | undefined }>({});

  // ── Multi-select drag state ────────────────────────────────
  // Live pixel delta applied to co-selected slots while the primary slot is dragged.
  const [liveDragDelta, setLiveDragDelta] = useState<{ dx: number; dy: number } | null>(null);
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  // Refs so drag-stop callback reads latest values without recreating on every selection change.
  const selectedSlotIdsRef = useRef(selectedSlotIds);
  selectedSlotIdsRef.current = selectedSlotIds;
  const templateSlotsRef = useRef(template.slots);
  templateSlotsRef.current = template.slots;

  /** Called on every drag frame from a slot. */
  const handleDragFrame = useCallback(
    (slotId: string, pxX: number, pxY: number) => {
      // Track live delta for co-selected slots in multi-drag.
      if (selectedSlotIdsRef.current.size > 1 && selectedSlotIdsRef.current.has(slotId)) {
        const draggedSlot = templateSlotsRef.current.find((s) => s.id === slotId);
        if (draggedSlot) {
          const origPx = pctToPx(draggedSlot.x, draggedSlot.y);
          setLiveDragDelta({ dx: pxX - origPx.x, dy: pxY - origPx.y });
          setDraggingSlotId(slotId);
        }
      }

      if (!snapEnabled || isPreview) {
        setActiveGuides([]);
        return;
      }

      const slot = templateSlotsRef.current.find((s) => s.id === slotId);
      if (!slot) return;

      const pct = pxToPct(pxX, pxY);
      const dragging: SlotRect = {
        id: slotId,
        x: pct.x,
        y: pct.y,
        width: slot.width,
        height: slot.height,
      };
      const others: SlotRect[] = templateSlotsRef.current
        .filter((s) => s.id !== slotId)
        .map((s) => ({ id: s.id, x: s.x, y: s.y, width: s.width, height: s.height }));

      const result = computeGuides(dragging, others, { width: canvasWidth, height: canvasHeight }, snapThresholdPx);
      lastGuideResultRef.current = { snapX: result.snapX, snapY: result.snapY };
      setActiveGuides(result.guides);
    },
    [snapEnabled, isPreview, pxToPct, pctToPx, canvasWidth, canvasHeight, snapThresholdPx],
  );

  /** On drag stop: apply snapping, commit dragged slot, then move all co-selected slots by the same delta. */
  const handleSlotDragStop = useCallback(
    (slotId: string, pxX: number, pxY: number) => {
      setActiveGuides([]);
      setLiveDragDelta(null);
      setDraggingSlotId(null);

      const snap = lastGuideResultRef.current;
      const pct = pxToPct(pxX, pxY);
      const finalX = snap.snapX !== undefined ? snap.snapX : pct.x;
      const finalY = snap.snapY !== undefined ? snap.snapY : pct.y;
      onSlotMove(slotId, finalX, finalY);
      lastGuideResultRef.current = {};

      // Move co-selected slots by the same % delta.
      const ids = selectedSlotIdsRef.current;
      const slots = templateSlotsRef.current;
      if (ids.size > 1) {
        const draggedSlot = slots.find((s) => s.id === slotId);
        if (draggedSlot) {
          const dxPct = finalX - draggedSlot.x;
          const dyPct = finalY - draggedSlot.y;
          ids.forEach((id) => {
            if (id === slotId) return;
            const s = slots.find((ts) => ts.id === id);
            if (!s) return;
            onSlotMove(id, s.x + dxPct, s.y + dyPct);
          });
        }
      }

      onAnnounce?.(`Slot moved to ${finalX.toFixed(1)}%, ${finalY.toFixed(1)}%`);
    },
    [pxToPct, onSlotMove, onAnnounce],
  );

  /** On resize stop: commit and announce. */
  const handleSlotResizeStop = useCallback(
    (slotId: string, pxX: number, pxY: number, pxW: number, pxH: number) => {
      const pct = pxToPct(pxX, pxY, pxW, pxH);
      onSlotResize(slotId, pct.x, pct.y, pct.width!, pct.height!);
      onAnnounce?.(
        `Slot resized to ${pct.width!.toFixed(1)}% × ${pct.height!.toFixed(1)}%`,
      );
    },
    [pxToPct, onSlotResize, onAnnounce],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Clear selection only when the pointer-down lands directly on the canvas
      // background — not on a child slot.  Using mousedown instead of click
      // prevents accidental deselection after a drag/resize where the mouseup
      // lands on the canvas background (click fires on the common ancestor of
      // mousedown/mouseup targets, but mousedown only on the actual target).
      if (e.button === 0 && e.target === e.currentTarget) {
        onCanvasClick();
      }
    },
    [onCanvasClick],
  );

  const handleCanvasDblClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) { onCanvasBgDoubleClick?.(50, 50); return; }
        const pctX = Math.max(0, Math.min(90, ((e.clientX - rect.left) / rect.width) * 100));
        const pctY = Math.max(0, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100));
        onCanvasBgDoubleClick?.(pctX, pctY);
      }
    },
    [onCanvasBgDoubleClick],
  );

  // ── Canvas background drop handler (Design Assets + media) ──
  const handleCanvasDragOver = useCallback(
    (e: React.DragEvent) => {
      if (
        e.dataTransfer.types.includes(ASSET_MIME) ||
        e.dataTransfer.types.includes('application/x-wpsg-media-id')
      ) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    [],
  );

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pctX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const pctY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      // Design Asset drop → new graphic layer
      const assetUrl = e.dataTransfer.getData(ASSET_MIME);
      if (assetUrl && onAssetCanvasDrop) {
        onAssetCanvasDrop(assetUrl, pctX, pctY);
        return;
      }

      // Campaign media drop → new slot
      const mediaId = e.dataTransfer.getData('application/x-wpsg-media-id');
      if (mediaId && onMediaCanvasDrop) {
        const metaRaw = e.dataTransfer.getData('application/x-wpsg-media-meta');
        let meta: { attachmentId?: number | undefined; url?: string | undefined } = {};
        try { meta = metaRaw ? JSON.parse(metaRaw) : {}; } catch { /* ignore */ }
        onMediaCanvasDrop(mediaId, meta, pctX, pctY);
      }
    },
    [onAssetCanvasDrop, onMediaCanvasDrop],
  );

  // Memoize derived background values to avoid recomputation during drag/resize renders.
  const safeBackgroundUrl = useMemo(
    () => template.backgroundImage ? sanitizeCssUrl(template.backgroundImage) : undefined,
    [template.backgroundImage],
  );
  const gradientBackground = useMemo(
    () => buildGradientCss(templateToGradientOpts(template)) ?? 'transparent',
    // templateToGradientOpts reads 7+ fields; template is replaced on any field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template.backgroundGradientType, template.backgroundGradientDirection,
    template.backgroundGradientAngle, template.backgroundGradientStops,
    template.backgroundRadialShape, template.backgroundRadialSize,
    template.backgroundGradientCenterX, template.backgroundGradientCenterY],
  );

  return (
    <div style={{ position: 'relative' }}>
      {/* Canvas dimensions badge */}
      {!isPreview && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 10px',
              borderRadius: 99,
              background: 'var(--mantine-color-default-hover)',
              border: '1px solid var(--mantine-color-default-border)',
              userSelect: 'none',
              fontSize: 'var(--mantine-font-size-xs)',
              color: 'var(--mantine-color-dimmed)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{canvasWidth} × {canvasHeight}px</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{formatAspectRatio(template.canvasAspectRatio)}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{template.slots.length} slot{template.slots.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* The canvas itself */}
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onDoubleClick={handleCanvasDblClick}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
        role="application"
        aria-label="Layout canvas"
        style={{
          position: 'relative',
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor:
            (template.backgroundMode ?? 'color') === 'color'
              ? template.backgroundColor
              : template.backgroundMode === 'image'
                ? (template.backgroundColor || '#ffffff')
                : (template.backgroundMode === 'none' ? 'transparent' : undefined),
          backgroundImage: undefined,
          backgroundSize: undefined,
          backgroundPosition: undefined,
          background:
            (template.backgroundMode ?? 'color') === 'gradient'
              ? gradientBackground
              : undefined,
          border: isPreview
            ? 'none'
            : '2px solid var(--mantine-color-default-border)',
          borderRadius: 4,
          overflow: isPreview ? 'hidden' : 'visible',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          clipPath: isPreview ? undefined : 'none',
        }}
      >
        {/* Background image layer (below slots) */}
        {template.backgroundMode === 'image' && safeBackgroundUrl && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              pointerEvents: 'none',
              borderRadius: isPreview ? 0 : 2,
              overflow: 'hidden',
            }}
          >
            <img
              src={safeBackgroundUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: template.backgroundImageFit ?? 'cover',
                objectPosition: 'center',
                opacity: template.backgroundImageOpacity ?? 1,
                display: 'block',
              }}
              draggable={false}
            />
          </div>
        )}
        {template.slots.map((slot, index) => {
          const pos = pctToPx(slot.x, slot.y, slot.width, slot.height);
          const assignedMedia = mediaAssignments.get(slot.id);

          // Apply live drag delta to co-selected (non-dragging) slots so they move in sync.
          const isCoSelectedDrag =
            liveDragDelta !== null &&
            draggingSlotId !== null &&
            slot.id !== draggingSlotId &&
            selectedSlotIds.has(slot.id);
          const effectivePxX = isCoSelectedDrag ? pos.x + liveDragDelta!.dx : pos.x;
          const effectivePxY = isCoSelectedDrag ? pos.y + liveDragDelta!.dy : pos.y;

          const isSlotSelected = selectedSlotIds.has(slot.id);

          return (
            <LayoutSlotComponent
              key={slot.id}
              slot={slot}
              index={index}
              pixelX={effectivePxX}
              pixelY={effectivePxY}
              pixelWidth={pos.width!}
              pixelHeight={pos.height!}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              isSelected={isSlotSelected}
              isInMultiSelect={isSlotSelected && selectedSlotIds.size > 1}
              isPreview={isPreview}
              mediaItem={assignedMedia}
              onDragStop={handleSlotDragStop}
              onResizeStop={handleSlotResizeStop}
              onSelect={onSlotSelect}
              onToggleSelect={onSlotToggleSelect}
              onDragFrame={handleDragFrame}
              onMediaDrop={onMediaDrop}
              onSlotUpdate={onSlotUpdate}
              isMaskSelected={selectedMaskSlotId === slot.id}
              showSlotIndices={showSlotIndices}
            />
          );
        })}

        {/* Overlay layers (P15-H) */}
        {template.overlays.map((overlay) => {
          const oPos = pctToPx(overlay.x, overlay.y, overlay.width, overlay.height);

          if (isPreview) {
            return (
              <div
                key={overlay.id}
                style={{
                  position: 'absolute',
                  left: oPos.x,
                  top: oPos.y,
                  width: oPos.width,
                  height: oPos.height,
                  zIndex: overlay.zIndex,
                  opacity: overlay.opacity,
                  pointerEvents: overlay.pointerEvents ? 'auto' : 'none',
                }}
              >
                <img
                  src={overlay.imageUrl}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill',
                    display: 'block',
                  }}
                  draggable={false}
                />
              </div>
            );
          }

          return (
            <Rnd
              key={overlay.id}
              position={{ x: oPos.x, y: oPos.y }}
              size={{ width: oPos.width!, height: oPos.height! }}
              bounds="parent"
              minWidth={20}
              minHeight={20}
              maxWidth={canvasWidth}
              maxHeight={canvasHeight}
              scale={scale}
              onDragStop={(_e, data) => {
                const pct = pxToPct(data.x, data.y);
                onOverlayMove?.(overlay.id, pct.x, pct.y);
              }}
              onResizeStop={(_e, _dir, ref, _delta, position) => {
                const pct = pxToPct(
                  position.x,
                  position.y,
                  ref.offsetWidth,
                  ref.offsetHeight,
                );
                onOverlayResize?.(
                  overlay.id,
                  pct.x,
                  pct.y,
                  pct.width!,
                  pct.height!,
                );
              }}
              style={{
                zIndex: overlay.zIndex,
                // Ghost effect when overlay visibility is toggled off in builder.
                opacity: !(overlay.visible ?? true) ? 0.1 : overlay.opacity,
                outline: '1px dashed rgba(138, 43, 226, 0.6)',
                pointerEvents: !(overlay.visible ?? true) || isHandTool ? 'none' : undefined,
              }}
              enableResizing={!(overlay.locked ?? false) && !isHandTool}
              disableDragging={(overlay.locked ?? false) || isHandTool}
            >
              <img
                src={overlay.imageUrl}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  // 'fill' ensures the image covers its bounding box exactly,
                  // so the dashed outline matches the visual content area.
                  objectFit: 'fill',
                  display: 'block',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />
            </Rnd>
          );
        })}

        {/* Smart guide overlay */}
        {!isPreview && activeGuides.length > 0 && (
          <SmartGuides
            guides={activeGuides}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
          />
        )}

        {/* Contextual floating toolbar */}
        {!isPreview && contextualToolbarCallbacks && (
          <ContextualToolbar
            selectionRect={selectionRect}
            selectedSlotIds={selectedSlotIds}
            groups={template.groups ?? []}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            callbacks={contextualToolbarCallbacks}
          />
        )}
      </div>
    </div>
  );
}

setWpsgDebugDisplayName(LayoutCanvas, 'LayoutBuilder:LayoutCanvas');