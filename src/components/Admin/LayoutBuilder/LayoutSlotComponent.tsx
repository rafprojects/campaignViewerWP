import { useCallback, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { Text } from '@mantine/core';
import type { LayoutSlot, MediaItem } from '@/types';
import { getClipPath } from '@/utils/clipPath';

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
}: LayoutSlotComponentProps) {
  const rndRef = useRef<Rnd>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const clipPath = getClipPath(slot);

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
    if (e.dataTransfer.types.includes('application/x-wpsg-media-id')) {
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
    [slot.id, onMediaDrop],
  );

  const hasClipOrMask = Boolean(clipPath || slot.maskUrl);

  // CSS props for mask-image shapes (applied identically to all mask layers).
  const maskCssProps: React.CSSProperties = slot.maskUrl
    ? {
        WebkitMaskImage: `url(${slot.maskUrl})`,
        maskImage: `url(${slot.maskUrl})`,
        WebkitMaskSize: 'cover' as const,
        maskSize: 'cover' as const,
      }
    : {};

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
        alt=""
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
        }}
        role="img"
        aria-label={ariaLabel}
      >
        {imageEl}
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
      onDrag={handleDrag}
      onDragStop={(_e, data) => {
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
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        onResizeStop(
          slot.id,
          position.x,
          position.y,
          ref.offsetWidth,
          ref.offsetHeight,
        );
      }}
      onMouseDown={handleMouseDown}
      enableResizing={!isPreview}
      disableDragging={isPreview}
      style={{
        zIndex: slot.zIndex,
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
                alt=""
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

          {/* 3. Index badge – at bounding-box level so always visible */}
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
          }}
          role="img"
          aria-label={`Slot ${index + 1}: ${mediaItem?.url ? 'assigned' : 'empty'}`}
          tabIndex={0}
        >
          {mediaItem ? (
            <img
              src={mediaItem.url}
              alt=""
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
        </div>
      )}
    </Rnd>
  );
}
