import { useCallback, useMemo, useRef, useState } from 'react';
import { Text } from '@mantine/core';
import { Rnd } from 'react-rnd';
import type { LayoutTemplate, MediaItem, PersistentGuide, ResponsiveBreakpoint } from '@/types';
import { assignMediaToSlots, resolveSlotForBreakpoint } from '@/utils/layoutSlotAssignment';
import { computeGuides, type GuideLine, type SlotRect } from '@wp-super-gallery/shared-utils';
import {
  type SnapMode,
  snapToGrid,
  gridSizeToPct,
  selectionUnionRect,
  normalizeDragRect,
  pctRectsIntersect,
  type PctRect,
} from '@wp-super-gallery/shared-utils';
import { useCanvasTransform } from '@wp-super-gallery/shared-ui';
import { useViewportHeight } from '@wp-super-gallery/shared-utils';
import { LayoutSlotComponent } from './LayoutSlotComponent';
import { SmartGuides } from './SmartGuides';
import { ContextualToolbar, type ContextualToolbarCallbacks } from './ContextualToolbar';
import { CanvasGrid } from './CanvasGrid';
import { CanvasRulers } from './CanvasRulers';
import { MeasurementOverlay } from './MeasurementOverlay';
import { GraphicLayerContent } from './GraphicLayerContent';
import { PersistentGuidesOverlay } from './PersistentGuidesOverlay';
import { buildGradientCss, templateToGradientOpts } from '@wp-super-gallery/shared-utils';
import { sanitizeCssUrl } from '@wp-super-gallery/shared-utils';
import { ASSET_MIME } from './DesignAssetsGrid';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ── Props ────────────────────────────────────────────────────

export interface LayoutCanvasProps {
  template: LayoutTemplate;
  selectedSlotIds: Set<string>;
  isPreview: boolean;
  media: MediaItem[];
  /** Snap mode: 'off' | 'guides' | 'grid' | 'grid+guides' (P30-B). */
  snapMode: SnapMode;
  onSlotMove: (id: string, x: number, y: number) => void;
  onSlotResize: (id: string, x: number, y: number, w: number, h: number) => void;
  onSlotSelect: (id: string) => void;
  onSlotToggleSelect: (id: string) => void;
  onCanvasClick: () => void;
  /** Marquee (rubber-band) selection committed on drag end. `additive` = union with current selection. */
  onMarqueeSelect?: (ids: string[], additive: boolean) => void;
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
  // ── P30-B overlays ──────────────────────────────────────────
  /** Show the grid overlay (P30-B). */
  showGrid?: boolean;
  /** Grid cell size in canvas pixels (P30-B). */
  gridSizePx?: number;
  /** Show ruler strips at top and left edges (P30-B). */
  showRulers?: boolean;
  /** Show edge-distance measurement lines on selection (P30-B). */
  showMeasurements?: boolean;
  // ── P57-E: Persistent guides ────────────────────────────────
  guides?: PersistentGuide[];
  onMoveGuide?: (id: string, position: number) => void;
  onRemoveGuide?: (id: string) => void;
  onToggleGuideLock?: (id: string) => void;
  // ── P58-B: Per-breakpoint slot overrides ────────────────────
  /** Active breakpoint being edited. Slots resolve to their breakpoint-overridden geometry. */
  activeBreakpoint?: ResponsiveBreakpoint;
}

// ── Minimum canvas render width ──────────────────────────────

const MIN_CANVAS_PX = 400;
const MAX_CANVAS_PX = 1200;

// Movement (in screen px) below this on canvas-background mousedown is a click
// (clears selection); at or above it the gesture is a marquee drag-select (P58-D).
const MARQUEE_CLICK_THRESHOLD_PX = 4;

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
  snapMode,
  onSlotMove,
  onSlotResize,
  onSlotSelect,
  onSlotToggleSelect,
  onCanvasClick,
  onMarqueeSelect,
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
  showGrid = false,
  gridSizePx = 20,
  showRulers = false,
  showMeasurements = false,
  guides,
  onMoveGuide,
  onRemoveGuide,
  onToggleGuideLock,
  activeBreakpoint = 'desktop',
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

  // ── P58-B: Effective slots with breakpoint overrides applied ──

  const effectiveSlots = useMemo(
    () => template.slots.map((s) => resolveSlotForBreakpoint(s, template, activeBreakpoint)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template.slots, template.breakpointOverrides, activeBreakpoint],
  );
  const effectiveSlotsRef = useRef(effectiveSlots);
  effectiveSlotsRef.current = effectiveSlots;

  // ── Contextual toolbar: union bounding rect of selected slots ─

  const selectionRect = useMemo(() => {
    if (isPreview || selectedSlotIds.size === 0 || !contextualToolbarCallbacks) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const slot of effectiveSlots) {
      if (!selectedSlotIds.has(slot.id)) continue;
      const px = pctToPx(slot.x, slot.y, slot.width, slot.height);
      minX = Math.min(minX, px.x);
      minY = Math.min(minY, px.y);
      maxX = Math.max(maxX, px.x + (px.width ?? 0));
      maxY = Math.max(maxY, px.y + (px.height ?? 0));
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [isPreview, selectedSlotIds, effectiveSlots, pctToPx, contextualToolbarCallbacks]);

  // ── P30-B: selection bounding rect in canvas-% for rulers & measurements ──
  const selectionPct = useMemo<PctRect | null>(() => {
    if (isPreview || selectedSlotIds.size === 0) return null;
    return selectionUnionRect(selectedSlotIds, effectiveSlots);
  }, [isPreview, selectedSlotIds, effectiveSlots]);

  // ── Smart guides state ─────────────────────────────────────

  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);
  const lastGuideResultRef = useRef<{ snapX?: number | undefined; snapY?: number | undefined }>({});

  // ── Multi-select drag state ────────────────────────────────
  // Live pixel delta applied to co-selected slots while the primary slot is dragged.
  const [liveDragDelta, setLiveDragDelta] = useState<{ dx: number; dy: number } | null>(null);
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);

  // ── Marquee (rubber-band) selection state (P58-D) ──────────
  const [marqueeRect, setMarqueeRect] = useState<PctRect | null>(null);
  // Refs so drag-stop callback reads latest values without recreating on every selection change.
  const selectedSlotIdsRef = useRef(selectedSlotIds);
  selectedSlotIdsRef.current = selectedSlotIds;
  const templateSlotsRef = useRef(template.slots);
  templateSlotsRef.current = template.slots;

  // Pre-compute per-slot "others" arrays so every drag frame avoids O(n) allocations.
  // Rebuilds only when template.slots changes (on committed moves/adds/removes, not drag frames).
  const slotOthersMap = useMemo(() => {
    const allRects = effectiveSlots.map((s): SlotRect => ({ id: s.id, x: s.x, y: s.y, width: s.width, height: s.height }));
    const map = new Map<string, SlotRect[]>();
    for (const { id } of effectiveSlots) {
      map.set(id, allRects.filter((r) => r.id !== id));
    }
    return map;
  }, [effectiveSlots]);
  // Stable ref so handleDragFrame reads the latest map without listing it as a dependency.
  const slotOthersMapRef = useRef(slotOthersMap);
  slotOthersMapRef.current = slotOthersMap;

  // Stable ref for persistent guides so handleDragFrame doesn't re-create on guide changes.
  const guidesRef = useRef(guides);
  guidesRef.current = guides;

  /** Called on every drag frame from a slot. */
  const handleDragFrame = useCallback(
    (slotId: string, pxX: number, pxY: number) => {
      // Track live delta for co-selected slots in multi-drag.
      // Use effectiveSlotsRef so the delta is relative to the breakpoint-overridden position.
      if (selectedSlotIdsRef.current.size > 1 && selectedSlotIdsRef.current.has(slotId)) {
        const draggedSlot = effectiveSlotsRef.current.find((s) => s.id === slotId);
        if (draggedSlot) {
          const origPx = pctToPx(draggedSlot.x, draggedSlot.y);
          setLiveDragDelta({ dx: pxX - origPx.x, dy: pxY - origPx.y });
          setDraggingSlotId(slotId);
        }
      }

      if (snapMode === 'off' || isPreview) {
        setActiveGuides([]);
        lastGuideResultRef.current = {};
        return;
      }

      const slot = effectiveSlotsRef.current.find((s) => s.id === slotId);
      if (!slot) return;

      const pct = pxToPct(pxX, pxY);
      let snapX: number | undefined;
      let snapY: number | undefined;

      // ── Smart guides (modes: 'guides', 'grid+guides') ─────────
      if (snapMode === 'guides' || snapMode === 'grid+guides') {
        const dragging: SlotRect = {
          id: slotId,
          x: pct.x,
          y: pct.y,
          width: slot.width,
          height: slot.height,
        };
        const others = slotOthersMapRef.current.get(slotId) ?? [];

        const result = computeGuides(dragging, others, { width: canvasWidth, height: canvasHeight }, snapThresholdPx);
        snapX = result.snapX;
        snapY = result.snapY;
        setActiveGuides(result.guides);
      } else {
        setActiveGuides([]);
      }

      // ── Grid snap (modes: 'grid', 'grid+guides') ──────────────
      // Grid applies to axes where guide snap found nothing — guides win on ties.
      if (snapMode === 'grid' || snapMode === 'grid+guides') {
        const gridPctX = gridSizeToPct(gridSizePx, canvasWidth);
        const gridPctY = gridSizeToPct(gridSizePx, canvasHeight);
        if (snapX === undefined) snapX = snapToGrid(pct.x, gridPctX);
        if (snapY === undefined) snapY = snapToGrid(pct.y, gridPctY);
      }

      // ── Persistent guide snap (all non-off modes) ──────────────
      // Snaps slot left/center/right or top/center/bottom edge to guide lines.
      const persistentGuides = guidesRef.current;
      if (persistentGuides?.length) {
        const thresholdPct = (snapThresholdPx / canvasWidth) * 100;
        for (const pg of persistentGuides) {
          if (pg.axis === 'x' && snapX === undefined) {
            const gPct = pg.position;
            const edges = [pct.x, pct.x + slot.width / 2, pct.x + slot.width];
            for (const edge of edges) {
              if (Math.abs(edge - gPct) <= thresholdPct) {
                snapX = gPct - (edge - pct.x);
                break;
              }
            }
          } else if (pg.axis === 'y' && snapY === undefined) {
            const gPct = pg.position;
            const thresholdPctY = (snapThresholdPx / canvasHeight) * 100;
            const edges = [pct.y, pct.y + slot.height / 2, pct.y + slot.height];
            for (const edge of edges) {
              if (Math.abs(edge - gPct) <= thresholdPctY) {
                snapY = gPct - (edge - pct.y);
                break;
              }
            }
          }
        }
      }

      lastGuideResultRef.current = { snapX, snapY };
    },
    [snapMode, isPreview, pxToPct, pctToPx, canvasWidth, canvasHeight, snapThresholdPx, gridSizePx],
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
      // Use effectiveSlotsRef so delta is relative to breakpoint-overridden positions (P58-B).
      const ids = selectedSlotIdsRef.current;
      const slots = effectiveSlotsRef.current;
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
      // Only act when the pointer-down lands directly on the canvas background —
      // not on a child slot (slots are Rnd children, so a slot press has
      // e.target !== e.currentTarget and never starts a marquee).
      if (e.button !== 0 || e.target !== e.currentTarget) return;

      // Hand-tool / preview: keep the prior behavior (clear selection on bg press).
      const canvasEl = canvasRef.current;
      if (isPreview || isHandTool || !canvasEl) {
        onCanvasClick();
        return;
      }

      // ── Marquee (rubber-band) drag-select (P58-D) ──
      // Coords come straight from the scaled bounding rect, matching the
      // drop/double-click handlers, so react-zoom-pan-pinch scale is handled.
      const rect = canvasEl.getBoundingClientRect();
      const toPct = (clientX: number, clientY: number) => ({
        x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
        y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
      });
      const start = toPct(e.clientX, e.clientY);
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      let moved = false;

      const onMove = (me: MouseEvent) => {
        if (!moved && Math.hypot(me.clientX - startClientX, me.clientY - startClientY) >= MARQUEE_CLICK_THRESHOLD_PX) {
          moved = true;
        }
        if (moved) {
          const cur = toPct(me.clientX, me.clientY);
          setMarqueeRect(normalizeDragRect(start.x, start.y, cur.x, cur.y));
        }
      };

      const onUp = (ue: MouseEvent) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setMarqueeRect(null);

        // Sub-threshold movement = a plain click on empty canvas → clear selection.
        if (Math.hypot(ue.clientX - startClientX, ue.clientY - startClientY) < MARQUEE_CLICK_THRESHOLD_PX) {
          onCanvasClick();
          return;
        }

        const cur = toPct(ue.clientX, ue.clientY);
        const dragRect = normalizeDragRect(start.x, start.y, cur.x, cur.y);
        // Use effective (breakpoint-resolved) positions for marquee hit testing (P58-B).
        const hits = effectiveSlotsRef.current
          .filter(
            (s) =>
              (s.visible ?? true) &&
              !(s.locked ?? false) &&
              pctRectsIntersect(dragRect, { x: s.x, y: s.y, width: s.width, height: s.height }),
          )
          .map((s) => s.id);
        onMarqueeSelect?.(hits, additive);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [isPreview, isHandTool, onCanvasClick, onMarqueeSelect],
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
        {/* Empty-canvas affordance — only shown in edit mode with no slots */}
        {!isPreview && template.slots.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              gap: 6,
            }}
          >
            <Text size="sm" c="dimmed" ta="center" style={{ opacity: 0.55 }}>
              Double-click to add a slot
            </Text>
            <Text size="xs" c="dimmed" ta="center" style={{ opacity: 0.35 }}>
              or drag media from the panel
            </Text>
          </div>
        )}

        {effectiveSlots.map((slot, index) => {
          // slot is the breakpoint-resolved slot (P58-B); invisible in the active breakpoint → skip.
          if (slot.visible === false) return null;

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
                <GraphicLayerContent
                  layer={overlay}
                  pixelWidth={oPos.width}
                  pixelHeight={oPos.height}
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
              <GraphicLayerContent
                layer={overlay}
                pixelWidth={oPos.width}
                pixelHeight={oPos.height}
              />
            </Rnd>
          );
        })}

        {/* P30-B: Grid overlay */}
        {!isPreview && showGrid && gridSizePx > 0 && (
          <CanvasGrid
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            gridSizePx={gridSizePx}
          />
        )}

        {/* P30-B: Ruler strips */}
        {!isPreview && showRulers && (
          <CanvasRulers
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            selectionPct={selectionPct}
          />
        )}

        {/* P30-B: Edge-distance measurement overlay */}
        {!isPreview && showMeasurements && selectionPct && (
          <MeasurementOverlay
            selectionPct={selectionPct}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
          />
        )}

        {/* P57-E: Persistent guides overlay */}
        {!isPreview && (guides?.length ?? 0) > 0 && onMoveGuide && onRemoveGuide && onToggleGuideLock && (
          <PersistentGuidesOverlay
            guides={guides!}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            canvasRef={canvasRef}
            onMoveGuide={onMoveGuide}
            onRemoveGuide={onRemoveGuide}
            onToggleGuideLock={onToggleGuideLock}
          />
        )}

        {/* Smart guide overlay */}
        {!isPreview && activeGuides.length > 0 && (
          <SmartGuides
            guides={activeGuides}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
          />
        )}

        {/* P58-D: Marquee (rubber-band) selection box */}
        {!isPreview && marqueeRect && (
          <div
            style={{
              position: 'absolute',
              left: `${marqueeRect.x}%`,
              top: `${marqueeRect.y}%`,
              width: `${marqueeRect.width}%`,
              height: `${marqueeRect.height}%`,
              border: '1px dashed var(--mantine-color-blue-5)',
              background: 'rgba(51,154,240,0.12)',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
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