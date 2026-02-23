import { useCallback, useMemo, useRef } from 'react';
import { Text } from '@mantine/core';
import type { LayoutTemplate, MediaItem } from '@/types';
import { assignMediaToSlots } from '@/utils/layoutSlotAssignment';
import { LayoutSlotComponent } from './LayoutSlotComponent';

// ── Props ────────────────────────────────────────────────────

export interface LayoutCanvasProps {
  template: LayoutTemplate;
  selectedSlotIds: Set<string>;
  isPreview: boolean;
  media: MediaItem[];
  onSlotMove: (id: string, x: number, y: number) => void;
  onSlotResize: (id: string, x: number, y: number, w: number, h: number) => void;
  onSlotSelect: (id: string) => void;
  onSlotToggleSelect: (id: string) => void;
  onCanvasClick: () => void;
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
  onSlotMove,
  onSlotResize,
  onSlotSelect,
  onSlotToggleSelect,
  onCanvasClick,
}: LayoutCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Compute canvas pixel dimensions from aspect ratio
  const canvasWidth = Math.max(
    MIN_CANVAS_PX,
    Math.min(MAX_CANVAS_PX, template.canvasMaxWidth || MAX_CANVAS_PX),
  );
  const canvasHeight = Math.round(canvasWidth / template.canvasAspectRatio);

  // Auto-assign media to slots for preview
  const mediaAssignments = useMemo(
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

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Only clear selection if clicking the canvas itself, not a slot
      if (e.target === e.currentTarget) {
        onCanvasClick();
      }
    },
    [onCanvasClick],
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
        onClick={handleCanvasClick}
        role="application"
        aria-label="Layout canvas"
        style={{
          position: 'relative',
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor: template.backgroundColor,
          border: isPreview
            ? 'none'
            : '2px solid var(--mantine-color-default-border)',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
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
              onDragStop={(id, pxX, pxY) => {
                const pct = pxToPct(pxX, pxY);
                onSlotMove(id, pct.x, pct.y);
              }}
              onResizeStop={(id, pxX, pxY, pxW, pxH) => {
                const pct = pxToPct(pxX, pxY, pxW, pxH);
                onSlotResize(id, pct.x, pct.y, pct.width!, pct.height!);
              }}
              onSelect={onSlotSelect}
              onToggleSelect={onSlotToggleSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
