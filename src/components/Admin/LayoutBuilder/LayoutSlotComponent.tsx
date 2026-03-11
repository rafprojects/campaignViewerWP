import { useCallback, useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { Text } from '@mantine/core';
import type { LayoutSlot, MaskLayer, MediaItem } from '@/types';
import { getClipPath } from '@/utils/clipPath';
import { useCanvasTransform } from '@/contexts/CanvasTransformContext';
import { buildFilterCss, getBlendModeCss, buildOverlayBg } from '@/utils/slotEffects';
import { useFeatheredMask } from '@/hooks/useFeatheredMask';

// ── MaskDragOverlay: draggable mask position/size on canvas ──

interface MaskDragOverlayProps {
  maskLayer: MaskLayer;
  maskUrl: string;
  slotWidth: number;
  slotHeight: number;
  onUpdate: (patch: Partial<MaskLayer>) => void;
}

/**
 * Semi-transparent overlay that visualises the mask image within the slot
 * and allows dragging to adjust mask position (maskLayer.x / y).
 */
function MaskDragOverlay({ maskLayer, maskUrl, slotWidth, slotHeight, onUpdate }: MaskDragOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const liveRef = useRef<{ x: number; y: number } | null>(null);
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: maskLayer.x,
        origY: maskLayer.y,
      };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        const dxPct = slotWidth > 0 ? (dx / slotWidth) * 100 : 0;
        const dyPct = slotHeight > 0 ? (dy / slotHeight) * 100 : 0;
        const pos = {
          x: dragRef.current.origX + dxPct,
          y: dragRef.current.origY + dyPct,
        };
        liveRef.current = pos;
        setLive(pos);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        const pos = liveRef.current;
        if (pos) {
          onUpdate({ x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10 });
        }
        dragRef.current = null;
        liveRef.current = null;
        setLive(null);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [maskLayer.x, maskLayer.y, slotWidth, slotHeight, onUpdate],
  );

  // ── Resize via corner handles ────────────────────────────
  const resizeRef = useRef<{
    startX: number; startY: number;
    origW: number; origH: number; origMX: number; origMY: number;
    corner: string;
  } | null>(null);
  const liveResizeRef = useRef<{ w: number; h: number; x: number; y: number } | null>(null);
  const [liveResize, setLiveResize] = useState<{ w: number; h: number; x: number; y: number } | null>(null);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, corner: string) => {
      e.stopPropagation();
      e.preventDefault();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: maskLayer.width,
        origH: maskLayer.height,
        origMX: maskLayer.x,
        origMY: maskLayer.y,
        corner,
      };

      const onMouseMove = (ev: MouseEvent) => {
        const r = resizeRef.current;
        if (!r) return;
        const dxPct = slotWidth > 0 ? ((ev.clientX - r.startX) / slotWidth) * 100 : 0;
        const dyPct = slotHeight > 0 ? ((ev.clientY - r.startY) / slotHeight) * 100 : 0;

        let newW = r.origW;
        let newH = r.origH;
        let newX = r.origMX;
        let newY = r.origMY;

        if (r.corner.includes('right')) newW = Math.max(5, r.origW + dxPct);
        if (r.corner.includes('left')) { newW = Math.max(5, r.origW - dxPct); newX = r.origMX + dxPct; }
        if (r.corner.includes('bottom')) newH = Math.max(5, r.origH + dyPct);
        if (r.corner.includes('top')) { newH = Math.max(5, r.origH - dyPct); newY = r.origMY + dyPct; }

        const pos = { w: newW, h: newH, x: newX, y: newY };
        liveResizeRef.current = pos;
        setLiveResize(pos);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        const pos = liveResizeRef.current;
        if (pos) {
          onUpdate({
            width: Math.round(pos.w * 10) / 10,
            height: Math.round(pos.h * 10) / 10,
            x: Math.round(pos.x * 10) / 10,
            y: Math.round(pos.y * 10) / 10,
          });
        }
        resizeRef.current = null;
        liveResizeRef.current = null;
        setLiveResize(null);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [maskLayer.width, maskLayer.height, maskLayer.x, maskLayer.y, slotWidth, slotHeight, onUpdate],
  );

  useEffect(() => {
    return () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
  }, []);

  const posX = liveResize?.x ?? live?.x ?? maskLayer.x;
  const posY = liveResize?.y ?? live?.y ?? maskLayer.y;
  const dispW = liveResize?.w ?? maskLayer.width;
  const dispH = liveResize?.h ?? maskLayer.height;

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: 8,
    height: 8,
    background: 'var(--mantine-color-violet-5)',
    border: '1.5px solid #fff',
    borderRadius: '50%',
    zIndex: 6,
    pointerEvents: 'auto',
  };

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: `${posX}%`,
        top: `${posY}%`,
        width: `${dispW}%`,
        height: `${dispH}%`,
        backgroundImage: `url(${maskUrl})`,
        backgroundSize: '100% 100%',
        opacity: 0.4,
        border: '1.5px dashed var(--mantine-color-violet-5)',
        cursor: 'grab',
        zIndex: 5,
        pointerEvents: 'auto',
        boxSizing: 'border-box',
      }}
      title="Drag to reposition mask"
    >
      {/* Corner resize handles */}
      <div onMouseDown={(e) => handleResizeMouseDown(e, 'top-left')} style={{ ...handleStyle, top: -4, left: -4, cursor: 'nwse-resize' }} />
      <div onMouseDown={(e) => handleResizeMouseDown(e, 'top-right')} style={{ ...handleStyle, top: -4, right: -4, cursor: 'nesw-resize' }} />
      <div onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-left')} style={{ ...handleStyle, bottom: -4, left: -4, cursor: 'nesw-resize' }} />
      <div onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-right')} style={{ ...handleStyle, bottom: -4, right: -4, cursor: 'nwse-resize' }} />
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────

export interface LayoutSlotComponentProps {
  slot: LayoutSlot;
  index: number;
  pixelX: number;
  pixelY: number;
  pixelWidth: number;
  pixelHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  isPreview: boolean;
  mediaItem?: MediaItem;
  onDragStop: (id: string, x: number, y: number) => void;
  onResizeStop: (id: string, x: number, y: number, w: number, h: number) => void;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  /** Called on every drag frame (for smart guides). */
  onDragFrame?: (id: string, pxX: number, pxY: number) => void;
  /** Called when a media item is dropped onto this slot. */
  onMediaDrop?: (slotId: string, mediaId: string, meta?: { attachmentId?: number; url?: string }) => void;
  /** Generic slot property update (e.g. mask layer drag). */
  onSlotUpdate?: (slotId: string, updates: Partial<LayoutSlot>) => void;
  /** Whether this slot's mask sublayer is selected in the Layers panel. */
  isMaskSelected?: boolean;
}

// ── Minimum slot size (px) ───────────────────────────────────

const MIN_SLOT_PX = 30;
const DRAG_COMMIT_THRESHOLD_PX = 5;

// ── Component ────────────────────────────────────────────────

export function LayoutSlotComponent({
  slot,
  index,
  pixelX,
  pixelY,
  pixelWidth,
  pixelHeight,
  canvasWidth,
  canvasHeight,
  isSelected,
  isPreview,
  mediaItem,
  onDragStop,
  onResizeStop,
  onSelect,
  onToggleSelect,
  onDragFrame,
  onMediaDrop,
  onSlotUpdate,
  isMaskSelected,
}: LayoutSlotComponentProps) {
  const rndRef = useRef<Rnd>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const clipPath = getClipPath(slot);
  const { scale, isHandTool } = useCanvasTransform();

  // ── Live info overlay during drag / resize ──
  const [liveInfo, setLiveInfo] = useState<{
    kind: 'drag' | 'resize';
    x: number; y: number; w: number; h: number;
  } | null>(null);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (e.shiftKey) {
        onToggleSelect(slot.id);
      } else {
        onSelect(slot.id);
      }
    },
    [slot.id, onSelect, onToggleSelect],
  );

  // ── Drag frame handler (for smart guides) ──
  const handleDrag = useCallback(
    (_e: unknown, data: { x: number; y: number }) => {
      onDragFrame?.(slot.id, data.x, data.y);
    },
    [slot.id, onDragFrame],
  );

  // ── HTML5 Drop handlers (media assignment) ──
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (
      e.dataTransfer.types.includes('application/x-wpsg-media-id') ||
      e.dataTransfer.types.includes('application/x-wpsg-asset-url')
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      // Design Asset drop → apply as mask image if slot has a mask layer
      const assetUrl = e.dataTransfer.getData('application/x-wpsg-asset-url');
      if (assetUrl && slot.maskLayer && onSlotUpdate) {
        onSlotUpdate(slot.id, {
          maskLayer: { ...slot.maskLayer, url: assetUrl },
          maskUrl: assetUrl,
        });
        return;
      }

      // Media drop → assign media to slot
      if (!e.dataTransfer.types.includes('application/x-wpsg-media-id')) return;
      const mediaId = e.dataTransfer.getData('application/x-wpsg-media-id');
      if (mediaId && onMediaDrop) {
        let meta: { attachmentId?: number; url?: string } | undefined;
        try {
          const raw = e.dataTransfer.getData('application/x-wpsg-media-meta');
          if (raw) meta = JSON.parse(raw);
        } catch { /* ignore parse errors */ }
        onMediaDrop(slot.id, mediaId, meta);
      }
    },
    [slot.id, slot.maskLayer, onMediaDrop, onSlotUpdate],
  );

  const hasClipOrMask = Boolean(clipPath || slot.maskUrl || slot.maskLayer);

  // CSS props for mask-image.  When a maskLayer exists, use its position/size/mode.
  const ml = slot.maskLayer;
  const maskVisible = ml?.visible !== false;
  const rawMaskUrl = maskVisible ? (ml?.url ?? slot.maskUrl) : undefined;
  const featherPx = maskVisible ? (ml?.feather ?? 0) : 0;
  const maskUrl = useFeatheredMask(rawMaskUrl, featherPx);
  const resolvedMaskMode = ml?.mode ?? slot.maskMode ?? 'luminance';

  // ── Mask drag handler ─────────────────────────────────────────
  const handleMaskDrag = useCallback(
    (patch: Partial<MaskLayer>) => {
      if (!onSlotUpdate || !ml) return;
      onSlotUpdate(slot.id, {
        maskLayer: { ...ml, ...patch },
        // Keep legacy fields in sync
        maskUrl: patch.url ?? ml.url,
        maskMode: patch.mode ?? ml.mode,
      });
    },
    [slot.id, ml, onSlotUpdate],
  );
  const showMaskOverlay = isSelected && !!ml?.url && !!onSlotUpdate && !isPreview && !!isMaskSelected;

  // Compute mask-position as pixel offsets so moving the mask at 100% size works correctly.
  // CSS %-based mask-position has special alignment semantics that make it useless at size=100%.
  const maskPosX = ml ? `${(ml.x / 100) * pixelWidth}px` : 'center';
  const maskPosY = ml ? `${(ml.y / 100) * pixelHeight}px` : 'center';
  const maskPosValue = ml ? `${maskPosX} ${maskPosY}` : 'center';

  const maskCssProps: React.CSSProperties = maskUrl
    ? ({
        WebkitMaskImage: `url(${maskUrl})`,
        maskImage: `url(${maskUrl})`,
        WebkitMaskSize: ml ? `${ml.width}% ${ml.height}%` : ('cover' as const),
        maskSize: ml ? `${ml.width}% ${ml.height}%` : ('cover' as const),
        WebkitMaskPosition: maskPosValue,
        maskPosition: maskPosValue,
        WebkitMaskRepeat: 'no-repeat' as const,
        maskRepeat: 'no-repeat' as const,
        WebkitMaskMode: resolvedMaskMode,
        maskMode: resolvedMaskMode,
      } as React.CSSProperties)
    : {};

  // ── Slot effects (filters, shadow, blend, overlay) ──────────────────
  const filterCss = buildFilterCss(slot.filterEffects, slot.shadow);
  const blendCss = getBlendModeCss(slot.blendMode);
  const overlayBg = buildOverlayBg(slot.overlayEffect);

  // ── Rectangle: standard CSS border + selection box-shadow ─────────────
  const rectBorder =
    slot.borderWidth > 0
      ? `${slot.borderWidth}px solid ${slot.borderColor}`
      : '1px dashed var(--mantine-color-dark-3)';
  const rectBoxShadow = isSelected ? '0 0 0 2px var(--mantine-color-blue-5)' : undefined;

  // ── Dynamic handle styles: dim on non-focused slots ─────────────────────
  const cornerHandle: React.CSSProperties = {
    width: 8,
    height: 8,
    background: isSelected ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-dark-4)',
    borderRadius: '50%',
    border: isSelected ? '1.5px solid #fff' : '1px solid rgba(255,255,255,0.35)',
    zIndex: 10,
    opacity: isSelected ? 1 : 0.3,
    transition: 'opacity 0.15s',
  };
  const barHandleH: React.CSSProperties = { height: 4, cursor: 'ns-resize', opacity: isSelected ? 1 : 0.2 };
  const barHandleV: React.CSSProperties = { width: 4, cursor: 'ew-resize', opacity: isSelected ? 1 : 0.2 };

  // ── Preview mode: no chrome ──
  if (isPreview) {
    const cursor = slot.clickAction === 'lightbox' ? 'pointer' : 'default';
    const ariaLabel = `Slot ${index + 1}: ${mediaItem?.url ? 'assigned' : 'empty'}`;
    const imageEl = mediaItem ? (
      <img
        src={mediaItem.url}
        alt={mediaItem.caption || mediaItem.title || ''}
        style={{
          width: '100%',
          height: '100%',
          objectFit: slot.objectFit,
          objectPosition: slot.objectPosition,
          display: 'block',
        }}
        draggable={false}
      />
    ) : (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'rgba(128,128,128,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text size="xs" c="dimmed">
          Empty
        </Text>
      </div>
    );

    if (hasClipOrMask) {
      // ── Double-container border for clip-path / mask shapes ──────────
      return (
        <div
          style={{
            position: 'absolute',
            left: pixelX,
            top: pixelY,
            width: pixelWidth,
            height: pixelHeight,
            zIndex: slot.zIndex,
            cursor,
            filter: filterCss || undefined,
            mixBlendMode: (blendCss as React.CSSProperties['mixBlendMode']) || undefined,
          }}
          role="img"
          aria-label={ariaLabel}
        >
          {slot.borderWidth > 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                clipPath,
                ...maskCssProps,
                backgroundColor: slot.borderColor,
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              inset: slot.borderWidth > 0 ? `${slot.borderWidth}px` : 0,
              clipPath,
              ...maskCssProps,
              overflow: 'hidden',
            }}
          >
            {imageEl}
          </div>
          {overlayBg && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                clipPath,
                ...maskCssProps,
                background: overlayBg,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          )}
        </div>
      );
    }

    // ── Rectangle preview slot ────────────────────────────────────────
    return (
      <div
        style={{
          position: 'absolute',
          left: pixelX,
          top: pixelY,
          width: pixelWidth,
          height: pixelHeight,
          zIndex: slot.zIndex,
          borderRadius: slot.borderRadius,
          overflow: 'hidden',
          border: slot.borderWidth > 0
            ? `${slot.borderWidth}px solid ${slot.borderColor}`
            : undefined,
          cursor,
          filter: filterCss || undefined,
          mixBlendMode: (blendCss as React.CSSProperties['mixBlendMode']) || undefined,
        }}
        role="img"
        aria-label={ariaLabel}
      >
        {imageEl}
        {overlayBg && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: overlayBg,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        )}
      </div>
    );
  }

  // ── Edit mode: draggable + resizable via react-rnd ──
  return (
    <Rnd
      ref={rndRef}
      position={{ x: pixelX, y: pixelY }}
      size={{ width: pixelWidth, height: pixelHeight }}
      bounds="parent"
      minWidth={MIN_SLOT_PX}
      minHeight={MIN_SLOT_PX}
      maxWidth={canvasWidth}
      maxHeight={canvasHeight}
      onDragStart={(_e, data) => {
        dragStartRef.current = { x: data.x, y: data.y };
      }}
      onDrag={(_e, data) => {
        handleDrag(_e, data);
        // Show live position as % of canvas during drag.
        const pctX = canvasWidth > 0 ? (data.x / canvasWidth) * 100 : 0;
        const pctY = canvasHeight > 0 ? (data.y / canvasHeight) * 100 : 0;
        const pctW = canvasWidth > 0 ? (pixelWidth / canvasWidth) * 100 : 0;
        const pctH = canvasHeight > 0 ? (pixelHeight / canvasHeight) * 100 : 0;
        setLiveInfo({ kind: 'drag', x: pctX, y: pctY, w: pctW, h: pctH });
      }}
      onDragStop={(_e, data) => {
        setLiveInfo(null);
        const start = dragStartRef.current;
        dragStartRef.current = null;
        if (start) {
          const dx = data.x - start.x;
          const dy = data.y - start.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < DRAG_COMMIT_THRESHOLD_PX) {
            // Treat tiny movement as a click/focus, not a committed reposition.
            return;
          }
        }
        onDragStop(slot.id, data.x, data.y);
      }}
      onResize={(_e, _dir, ref, _delta, position) => {
        const pctX = canvasWidth > 0 ? (position.x / canvasWidth) * 100 : 0;
        const pctY = canvasHeight > 0 ? (position.y / canvasHeight) * 100 : 0;
        const pctW = canvasWidth > 0 ? (ref.offsetWidth / canvasWidth) * 100 : 0;
        const pctH = canvasHeight > 0 ? (ref.offsetHeight / canvasHeight) * 100 : 0;
        setLiveInfo({ kind: 'resize', x: pctX, y: pctY, w: pctW, h: pctH });
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        setLiveInfo(null);
        onResizeStop(
          slot.id,
          position.x,
          position.y,
          ref.offsetWidth,
          ref.offsetHeight,
        );
      }}
      onMouseDown={handleMouseDown}
      scale={scale}
      lockAspectRatio={slot.lockAspectRatio ?? false}
      enableResizing={!isPreview && !(slot.locked ?? false) && !isHandTool}
      disableDragging={isPreview || (slot.locked ?? false) || isHandTool}
      style={{
        zIndex: slot.zIndex,
        // Ghost effect when layer is hidden in builder; 10 % opacity so designer
        // can still see its position while editing other layers.
        opacity: !isPreview && !(slot.visible ?? true) ? 0.1 : undefined,
        pointerEvents: (!isPreview && !(slot.visible ?? true)) || isHandTool ? 'none' : undefined,
      }}
      resizeHandleStyles={{
        topLeft: cornerHandle,
        topRight: cornerHandle,
        bottomLeft: cornerHandle,
        bottomRight: cornerHandle,
        top: barHandleH,
        bottom: barHandleH,
        left: barHandleV,
        right: barHandleV,
      }}
    >
      {hasClipOrMask ? (
        /* ── Clip-path / mask: double-container border technique ──────────────
         * Outer: full bounding box, clipped to shape, background = borderColor
         * Inner: inset by borderWidth, same clip-path, overflow:hidden, image
         * This is the only reliable CSS approach for borders on arbitrary shapes.
         * Selection ring is shown as a rectangular bounding-box glow outside Rnd
         * (standard design-tool pattern; shape-following is SVG-only territory). */
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            cursor: 'move',
            filter: filterCss || undefined,
            mixBlendMode: (blendCss as React.CSSProperties['mixBlendMode']) || undefined,
            // Rectangular selection ring outside the bounding box (standard UX pattern)
            boxShadow: isSelected
              ? '0 0 0 2px var(--mantine-color-blue-5), 0 0 8px rgba(51,154,240,0.35)'
              : undefined,
          }}
        >
          {/* 1. Border fill: full size, clipped, shows borderColor as background */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath,
              ...maskCssProps,
              backgroundColor: slot.borderWidth > 0 && !isDragOver ? slot.borderColor : 'transparent',
            }}
          />

          {/* 2. Image layer: inset by borderWidth, same clip, contains media */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              position: 'absolute',
              inset: slot.borderWidth > 0 ? `${slot.borderWidth}px` : 0,
              clipPath,
              ...maskCssProps,
              overflow: 'hidden',
              outline: isDragOver ? '3px dashed var(--mantine-color-green-5)' : undefined,
            }}
            role="img"
            aria-label={`Slot ${index + 1}: ${mediaItem?.url ? 'assigned' : 'empty'}`}
            tabIndex={0}
          >
            {mediaItem ? (
              <img
                src={mediaItem.url}
                alt={mediaItem.caption || mediaItem.title || ''}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: slot.objectFit,
                  objectPosition: slot.objectPosition,
                  display: 'block',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background:
                    'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(128,128,128,0.08) 8px, rgba(128,128,128,0.08) 16px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text size="xs" c="dimmed" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  {index + 1}
                </Text>
              </div>
            )}
          </div>

          {/* 3. Overlay layer */}
          {overlayBg && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                clipPath,
                ...maskCssProps,
                background: overlayBg,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          )}

          {/* 3b. Mask drag overlay (canvas-draggable mask positioning) */}
          {showMaskOverlay && rawMaskUrl && (
            <MaskDragOverlay
              maskLayer={ml!}
              maskUrl={rawMaskUrl}
              slotWidth={pixelWidth}
              slotHeight={pixelHeight}
              onUpdate={handleMaskDrag}
            />
          )}

          {/* 4. Index badge – at bounding-box level so always visible */}
          <div
            style={{
              position: 'absolute',
              top: 4,
              left: 4,
              background: isSelected ? 'var(--mantine-color-blue-6)' : 'rgba(0,0,0,0.6)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              width: 18,
              height: 18,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 3,
            }}
          >
            {index + 1}
          </div>
        </div>
      ) : (
        /* ── Rectangle: CSS border + overflow ────────────────────────────── */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: slot.borderRadius,
            overflow: 'hidden',
            border: isDragOver ? '2px dashed var(--mantine-color-green-5)' : rectBorder,
            boxShadow: rectBoxShadow,
            boxSizing: 'border-box',
            position: 'relative',
            cursor: 'move',
            filter: filterCss || undefined,
            mixBlendMode: (blendCss as React.CSSProperties['mixBlendMode']) || undefined,
          }}
          role="img"
          aria-label={`Slot ${index + 1}: ${mediaItem?.url ? 'assigned' : 'empty'}`}
          tabIndex={0}
        >
          {mediaItem ? (
            <img
              src={mediaItem.url}
              alt={mediaItem.caption || mediaItem.title || ''}
              style={{
                width: '100%',
                height: '100%',
                objectFit: slot.objectFit,
                objectPosition: slot.objectPosition,
                display: 'block',
                pointerEvents: 'none',
              }}
              draggable={false}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background:
                  'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(128,128,128,0.08) 8px, rgba(128,128,128,0.08) 16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text size="xs" c="dimmed" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {index + 1}
              </Text>
            </div>
          )}

          {/* Overlay layer */}
          {overlayBg && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: slot.borderRadius,
                background: overlayBg,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          )}

          {/* Mask drag overlay (canvas-draggable mask positioning) */}
          {showMaskOverlay && rawMaskUrl && (
            <MaskDragOverlay
              maskLayer={ml!}
              maskUrl={rawMaskUrl}
              slotWidth={pixelWidth}
              slotHeight={pixelHeight}
              onUpdate={handleMaskDrag}
            />
          )}

          {/* Index badge */}
          <div
            style={{
              position: 'absolute',
              top: 4,
              left: 4,
              background: isSelected ? 'var(--mantine-color-blue-6)' : 'rgba(0,0,0,0.6)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              width: 18,
              height: 18,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {index + 1}
          </div>

          {/* Live dimensions overlay during drag / resize */}
          {liveInfo && (
            <div
              style={{
                position: 'absolute',
                bottom: -22,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.82)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 9999,
                letterSpacing: 0.3,
              }}
            >
              {liveInfo.kind === 'resize'
                ? `${liveInfo.w.toFixed(1)}% × ${liveInfo.h.toFixed(1)}%`
                : `X ${liveInfo.x.toFixed(1)}%  Y ${liveInfo.y.toFixed(1)}%`}
            </div>
          )}
        </div>
      )}
    </Rnd>
  );
}
