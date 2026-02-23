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
  onMediaDrop?: (slotId: string, mediaId: string) => void;
}

// ── Minimum slot size (px) ───────────────────────────────────

const MIN_SLOT_PX = 30;

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
        onMediaDrop(slot.id, mediaId);
      }
    },
    [slot.id, onMediaDrop],
  );

  // ── Selection border style ──
  const selectionBorder = isSelected
    ? '2px solid var(--mantine-color-blue-5)'
    : slot.borderWidth > 0
      ? `${slot.borderWidth}px solid ${slot.borderColor}`
      : '1px dashed var(--mantine-color-dark-3)';

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
          border:
            slot.borderWidth > 0
              ? `${slot.borderWidth}px solid ${slot.borderColor}`
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
      onDrag={handleDrag}
      onDragStop={(_e, data) => {
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
        topLeft: handleStyle,
        topRight: handleStyle,
        bottomLeft: handleStyle,
        bottomRight: handleStyle,
        top: barHandleHorizontal,
        bottom: barHandleHorizontal,
        left: barHandleVertical,
        right: barHandleVertical,
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
            : selectionBorder,
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

// ── Resize handle styles ─────────────────────────────────────

const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: 'var(--mantine-color-blue-5)',
  borderRadius: '50%',
  border: '1.5px solid #fff',
  zIndex: 10,
};

const barHandleHorizontal: React.CSSProperties = {
  height: 4,
  cursor: 'ns-resize',
};

const barHandleVertical: React.CSSProperties = {
  width: 4,
  cursor: 'ew-resize',
};
