import { type RefObject } from 'react';
import type { PersistentGuide } from '@/types';

export interface PersistentGuidesOverlayProps {
  guides: PersistentGuide[];
  canvasWidth: number;
  canvasHeight: number;
  canvasRef: RefObject<HTMLDivElement | null>;
  onMoveGuide: (id: string, position: number) => void;
  onRemoveGuide: (id: string) => void;
  onToggleGuideLock: (id: string) => void;
}

const GUIDE_COLOR = 'var(--mantine-color-teal-5)';
const GUIDE_HIT_WIDTH = 12;

export function PersistentGuidesOverlay({
  guides,
  canvasWidth,
  canvasHeight,
  canvasRef,
  onMoveGuide,
  onRemoveGuide,
  onToggleGuideLock,
}: PersistentGuidesOverlayProps) {
  function startGuideDrag(e: React.MouseEvent, guide: PersistentGuide) {
    if (guide.locked) return;
    e.preventDefault();
    e.stopPropagation();

    function onMove(ev: MouseEvent) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const pct =
        guide.axis === 'x'
          ? ((ev.clientX - rect.left) / rect.width) * 100
          : ((ev.clientY - rect.top) / rect.height) * 100;
      onMoveGuide(guide.id, Math.max(0, Math.min(100, pct)));
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 200,
        overflow: 'visible',
      }}
    >
      {guides.map((guide) => {
        const isVertical = guide.axis === 'x';
        const px = isVertical
          ? (guide.position / 100) * canvasWidth
          : (guide.position / 100) * canvasHeight;

        const x1 = isVertical ? px : 0;
        const y1 = isVertical ? 0 : px;
        const x2 = isVertical ? px : canvasWidth;
        const y2 = isVertical ? canvasHeight : px;

        // Hit rect: centered on the guide line
        const hitX = isVertical ? px - GUIDE_HIT_WIDTH / 2 : 0;
        const hitY = isVertical ? 0 : px - GUIDE_HIT_WIDTH / 2;
        const hitW = isVertical ? GUIDE_HIT_WIDTH : canvasWidth;
        const hitH = isVertical ? canvasHeight : GUIDE_HIT_WIDTH;

        // Lock icon position: midpoint of the guide
        const iconX = isVertical ? px + 4 : canvasWidth / 2 + 4;
        const iconY = isVertical ? canvasHeight / 2 - 8 : px + 4;

        return (
          <g key={guide.id}>
            {/* Guide line */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={GUIDE_COLOR}
              strokeWidth={1}
              strokeDasharray={guide.locked ? '6 4' : undefined}
              opacity={0.85}
            />

            {/* Transparent hit area for drag + double-click delete */}
            <rect
              x={hitX}
              y={hitY}
              width={hitW}
              height={hitH}
              fill="transparent"
              style={{
                pointerEvents: 'all',
                cursor: guide.locked ? 'default' : (isVertical ? 'ew-resize' : 'ns-resize'),
              }}
              onMouseDown={(e) => startGuideDrag(e, guide)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onRemoveGuide(guide.id);
              }}
            />

            {/* Lock / unlock icon — click to toggle */}
            <g
              transform={`translate(${iconX}, ${iconY})`}
              style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleGuideLock(guide.id);
              }}
            >
              {/* Background pill for readability */}
              <rect
                x={-2}
                y={-2}
                width={16}
                height={16}
                rx={3}
                fill="rgba(0,0,0,0.55)"
                opacity={0.9}
              />
              {guide.locked ? (
                // Closed lock icon
                <>
                  <rect x={2} y={6} width={8} height={6} rx={1} fill={GUIDE_COLOR} />
                  <path
                    d="M4 6 V4 a2 2 0 0 1 4 0 V6"
                    fill="none"
                    stroke={GUIDE_COLOR}
                    strokeWidth={1.5}
                  />
                </>
              ) : (
                // Open lock icon
                <>
                  <rect x={2} y={6} width={8} height={6} rx={1} fill="rgba(255,255,255,0.6)" />
                  <path
                    d="M4 6 V4 a2 2 0 0 1 4 0"
                    fill="none"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth={1.5}
                  />
                </>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
