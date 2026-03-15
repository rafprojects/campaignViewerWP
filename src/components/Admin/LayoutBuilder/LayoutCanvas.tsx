import { useCallback, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { Text } from '@mantine/core';
import type { LayoutTemplate, MediaItem } from '@/types';
import { assignMediaToSlots } from '@/utils/layoutSlotAssignment';
import { computeGuides, type GuideLine, type SlotRect } from '@/utils/smartGuides';
import { useCanvasTransform } from '@/contexts/CanvasTransformContext';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { LayoutSlotComponent } from './LayoutSlotComponent';
import { SmartGuides } from './SmartGuides';
import { buildGradientCss, templateToGradientOpts } from '@/utils/gradientCss';
import { ASSET_MIME } from './DesignAssetsGrid';

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
  onMediaDrop?: (slotId: string, mediaId: string, meta?: { attachmentId?: number; url?: string }) => void;
  /** Announce a11y messages. */
  onAnnounce?: (msg: string) => void;
  /** Overlay move callback (P15-H). */
  onOverlayMove?: (id: string, x: number, y: number) => void;
  /** Overlay resize callback (P15-H). */
  onOverlayResize?: (id: string, x: number, y: number, w: number, h: number) => void;
  /** Snap detection distance in canvas pixels (default: 5). Higher = snaps from further away. */
  snapThresholdPx?: number;
  /** Called on double-click on canvas background — used to reset zoom. */
  onCanvasBgDoubleClick?: () => void;
  /** Generic slot property update callback (e.g. mask layer drag). */
  onSlotUpdate?: (slotId: string, updates: Partial<import('@/types').LayoutSlot>) => void;
  /** Slot ID whose mask sublayer is currently selected (for mask drag overlay). */
  selectedMaskSlotId?: string | null;
  /** Called when a Design Asset is dropped on the canvas background. x,y are canvas %. */
  onAssetCanvasDrop?: (assetUrl: string, x: number, y: number) => void;
  /** Called when campaign media is dropped on the canvas background. x,y are canvas %. */
  onMediaCanvasDrop?: (mediaId: string, meta: { attachmentId?: number; url?: string }, x: number, y: number) => void;
}

// ── Minimum canvas render width ──────────────────────────────

const MIN_CANVAS_PX = 400;
const MAX_CANVAS_PX = 1200;

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

  // ── Smart guides state ─────────────────────────────────────

  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);
  const lastGuideResultRef = useRef<{ snapX?: number; snapY?: number }>({});

  /** Called on every drag frame from a slot. */
  const handleDragFrame = useCallback(
    (slotId: string, pxX: number, pxY: number) => {
      if (!snapEnabled || isPreview) {
        setActiveGuides([]);
        return;
      }

      const slot = template.slots.find((s) => s.id === slotId);
      if (!slot) return;

      const pct = pxToPct(pxX, pxY);
      const dragging: SlotRect = {
        id: slotId,
        x: pct.x,
        y: pct.y,
        width: slot.width,
        height: slot.height,
      };
      const others: SlotRect[] = template.slots
        .filter((s) => s.id !== slotId)
        .map((s) => ({ id: s.id, x: s.x, y: s.y, width: s.width, height: s.height }));

      const result = computeGuides(dragging, others, { width: canvasWidth, height: canvasHeight }, snapThresholdPx);
      lastGuideResultRef.current = { snapX: result.snapX, snapY: result.snapY };
      setActiveGuides(result.guides);
    },
    [snapEnabled, isPreview, template.slots, pxToPct, canvasWidth, canvasHeight, snapThresholdPx],
  );

  /** On drag stop: apply snapping then commit. */
  const handleSlotDragStop = useCallback(
    (slotId: string, pxX: number, pxY: number) => {
      setActiveGuides([]);
      const snap = lastGuideResultRef.current;
      const pct = pxToPct(pxX, pxY);
      const finalX = snap.snapX !== undefined ? snap.snapX : pct.x;
      const finalY = snap.snapY !== undefined ? snap.snapY : pct.y;
      onSlotMove(slotId, finalX, finalY);
      lastGuideResultRef.current = {};

      // Announce for a11y
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
        onCanvasBgDoubleClick?.();
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
        let meta: { attachmentId?: number; url?: string } = {};
        try { meta = metaRaw ? JSON.parse(metaRaw) : {}; } catch { /* ignore */ }
        onMediaCanvasDrop(mediaId, meta, pctX, pctY);
      }
    },
    [onAssetCanvasDrop, onMediaCanvasDrop],
  );

  return (
    <div style={{ position: 'relative' }}>
      {/* Canvas dimensions label */}
      {!isPreview && (
        <Text
          size="xs"
          c="dimmed"
          ta="center"
          mb={4}
          style={{ userSelect: 'none' }}
        >
          {canvasWidth} × {canvasHeight}px
          {' · '}
          {template.slots.length} slot{template.slots.length !== 1 ? 's' : ''}
        </Text>
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
          background:
            (template.backgroundMode ?? 'color') === 'gradient'
              ? buildGradientCss(templateToGradientOpts(template)) ?? 'transparent'
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
        {template.backgroundImage && (
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
              src={template.backgroundImage}
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

          return (
            <LayoutSlotComponent
              key={slot.id}
              slot={slot}
              index={index}
              pixelX={pos.x}
              pixelY={pos.y}
              pixelWidth={pos.width!}
              pixelHeight={pos.height!}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              isSelected={selectedSlotIds.has(slot.id)}
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
      </div>
    </div>
  );
}
