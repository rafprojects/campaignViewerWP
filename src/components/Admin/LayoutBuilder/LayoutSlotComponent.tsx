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

  // ── Rectangle border + selection ring (box-shadow works for un-clipped elements)
  const regularBorder =
    slot.borderWidth > 0 && !hasClipOrMask
      ? `${slot.borderWidth}px solid ${slot.borderColor}`
      : !isSelected
        ? '1px dashed var(--mantine-color-dark-3)'
        : undefined;

  const regularBoxShadow =
    !hasClipOrMask && isSelected ? '0 0 0 2px var(--mantine-color-blue-5)' : undefined;

  // ── Shape border + selection ring via CSS filter (applied AFTER clip-path)
  // drop-shadow() follows the clipped visual boundary, unlike box-shadow which
  // is clipped along with the element's rendered output.
  const shapeFilterParts: string[] = [];
  if (hasClipOrMask) {
    if (slot.borderWidth > 0) {
      const blur = Math.max(1, Math.ceil(slot.borderWidth / 2));
      shapeFilterParts.push(
        `drop-shadow(0 0 ${blur}px ${slot.borderColor})`,
        `drop-shadow(0 0 ${blur}px ${slot.borderColor})`,
      );
    }
    if (isSelected) {
      shapeFilterParts.push(
        'drop-shadow(0 0 2px var(--mantine-color-blue-5))',
        'drop-shadow(0 0 2px var(--mantine-color-blue-5))',
      );
    }
  }
  const shapeFilter = shapeFilterParts.length > 0 ? shapeFilterParts.join(' ') : undefined;

  // ── Dynamic handle styles: dim on non-focused slots ──────────────────────
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
    const maskStyle = slot.maskUrl
      ? {
          WebkitMaskImage: `url(${slot.maskUrl})`,
          maskImage: `url(${slot.maskUrl})`,
          WebkitMaskSize: 'cover' as const,
          maskSize: 'cover' as const,
        }
      : {};
    return (
      <div
        style={{
          position: 'absolute',
          left: pixelX,
          top: pixelY,
          width: pixelWidth,
          height: pixelHeight,
          zIndex: slot.zIndex,
          borderRadius: slot.shape === 'rectangle' ? slot.borderRadius : 0,
          clipPath,
          ...maskStyle,
          overflow: clipPath ? undefined : 'hidden',
          border: slot.borderWidth > 0 && !hasClipOrMask
            ? `${slot.borderWidth}px solid ${slot.borderColor}`
            : undefined,
          // For clip-path shapes, drop-shadow filter follows the visual shape boundary
          // (it is applied after clip-path in the CSS rendering pipeline).
          filter: hasClipOrMask && slot.borderWidth > 0
            ? (() => {
                const blur = Math.max(1, Math.ceil(slot.borderWidth / 2));
                return `drop-shadow(0 0 ${blur}px ${slot.borderColor}) drop-shadow(0 0 ${blur}px ${slot.borderColor})`;
              })()
            : undefined,
          cursor: slot.clickAction === 'lightbox' ? 'pointer' : 'default',
        }}
        role="img"
        aria-label={`Slot ${index + 1}: ${mediaItem?.url ? 'assigned' : 'empty'}`}
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
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: slot.shape === 'rectangle' ? slot.borderRadius : 0,
          clipPath,
          ...(slot.maskUrl
            ? {
                WebkitMaskImage: `url(${slot.maskUrl})`,
                maskImage: `url(${slot.maskUrl})`,
                WebkitMaskSize: 'cover',
                maskSize: 'cover',
              }
            : {}),
          overflow: clipPath ? undefined : 'hidden',
          border: isDragOver
            ? '2px dashed var(--mantine-color-green-5)'
            : regularBorder,
          boxShadow: regularBoxShadow,
          filter: shapeFilter,
          boxSizing: 'border-box',
          position: 'relative',
          cursor: 'move',
        }}
        role="img"
        aria-label={`Slot ${index + 1}: ${mediaItem?.url ? 'assigned' : 'empty'}`}
        tabIndex={0}
      >
        {/* Media image or placeholder */}
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
            <Text
              size="xs"
              c="dimmed"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {index + 1}
            </Text>
          </div>
        )}

        {/* Slot index badge */}
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            background: isSelected
              ? 'var(--mantine-color-blue-6)'
              : 'rgba(0,0,0,0.6)',
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
    </Rnd>
  );
}

// Handle styles are now computed per-slot inside the component (see cornerHandle / barHandleH / barHandleV).
