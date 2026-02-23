import { useCallback, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { Text } from '@mantine/core';
import type { LayoutSlot, MediaItem } from '@/types';

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
}

// ── Minimum slot size (px) ───────────────────────────────────

const MIN_SLOT_PX = 30;

// ── Shape clip-paths ─────────────────────────────────────────

function getClipPath(slot: LayoutSlot): string | undefined {
  switch (slot.shape) {
    case 'circle':
      return 'circle(50% at 50% 50%)';
    case 'ellipse':
      return 'ellipse(50% 50% at 50% 50%)';
    case 'hexagon':
      return 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
    case 'diamond':
      return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
    case 'custom':
      return slot.clipPath || undefined;
    case 'rectangle':
    default:
      return undefined;
  }
}

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

  // ── Selection border style ──
  const selectionBorder = isSelected
    ? '2px solid var(--mantine-color-blue-5)'
    : slot.borderWidth > 0
      ? `${slot.borderWidth}px solid ${slot.borderColor}`
      : '1px dashed var(--mantine-color-dark-3)';

  // ── Preview mode: no chrome ──
  if (isPreview) {
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
          overflow: 'hidden',
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
        style={{
          width: '100%',
          height: '100%',
          borderRadius: slot.shape === 'rectangle' ? slot.borderRadius : 0,
          clipPath,
          overflow: 'hidden',
          border: selectionBorder,
          boxSizing: 'border-box',
          position: 'relative',
          cursor: 'move',
        }}
        role="img"
        aria-label={`Slot ${index + 1}: ${mediaItem?.url ? 'assigned' : 'empty'}`}
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
