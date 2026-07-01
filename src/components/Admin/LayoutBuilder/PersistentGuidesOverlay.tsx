import { type RefObject } from 'react';
import type { PersistentGuide } from '@/types';

export interface PersistentGuidesOverlayProps {
  guides: PersistentGuide[];
  canvasWidth: number;
  canvasHeight: number;
  canvasRef: RefObject<HTMLDivElement | null>;
  selectedGuideId: string | null;
  onMoveGuide: (id: string, position: number) => void;
  onRemoveGuide: (id: string) => void;
  onToggleGuideLock: (id: string) => void;
  onSelectGuide: (id: string) => void;
}

const GUIDE_COLOR = 'var(--mantine-color-teal-5)';
const DELETE_COLOR = 'var(--mantine-color-red-5)';
const GUIDE_HIT_WIDTH = 12;
// Pointer must move past this before a mousedown is treated as a drag rather
// than a click-to-select (mirrors the marquee click threshold in LayoutCanvas).
const GUIDE_DRAG_THRESHOLD_PX = 3;

export function PersistentGuidesOverlay({
  guides,
  canvasWidth,
  canvasHeight,
  canvasRef,
  selectedGuideId,
  onMoveGuide,
  onRemoveGuide,
  onToggleGuideLock,
  onSelectGuide,
}: PersistentGuidesOverlayProps) {
  function startGuideDrag(e: React.MouseEvent, guide: PersistentGuide) {
    e.stopPropagation();

    // Locked guides can't be dragged, but they can still be selected (e.g. for
    // keyboard delete) — deletion has no lock check, so selection shouldn't either.
    if (guide.locked) {
      onSelectGuide(guide.id);
      return;
    }
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    let hasMoved = false;

    function onMove(ev: MouseEvent) {
      if (!hasMoved) {
        if (
          Math.abs(ev.clientX - startX) < GUIDE_DRAG_THRESHOLD_PX &&
          Math.abs(ev.clientY - startY) < GUIDE_DRAG_THRESHOLD_PX
        ) {
          return;
        }
        hasMoved = true;
      }
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
      // Mouse never crossed the drag threshold — treat it as a click-to-select.
      if (!hasMoved) {
        onSelectGuide(guide.id);
      }
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
        // Delete icon stacks along the guide's own axis, right next to the lock
        // icon — vertical guides stack the two icons vertically (hugging the
        // line), horizontal guides stack them horizontally — rather than always
        // offsetting sideways, which made vertical guides' icon pair stick out
        // perpendicular to the line and look cluttered.
        const deleteIconX = isVertical ? iconX : iconX + 20;
        const deleteIconY = isVertical ? iconY + 20 : iconY;

        const isSelected = guide.id === selectedGuideId;

        return (
          <g key={guide.id}>
            {/* Guide line */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={GUIDE_COLOR}
              strokeWidth={isSelected ? 2.5 : 1}
              strokeDasharray={guide.locked ? '6 4' : undefined}
              opacity={isSelected ? 1 : 0.85}
            />

            {/* Transparent hit area for drag / click-to-select. Double-click-to-delete
                was removed (P59-F): now that a plain click selects the guide, a double
                click is a routine byproduct of clicking to select twice in a row, and
                deleting on it risked silent, confirm-less data loss. */}
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
            />

            {/* Lock/unlock + delete icons — only shown once the guide is selected
                (a click on the line selects it first), so an idle canvas with
                several guides doesn't get cluttered with always-on icon pairs. */}
            {isSelected && (
              <>
                {/* Lock / unlock icon — click to toggle */}
                <g
                  role="button"
                  aria-label="Toggle guide lock"
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

                {/* Delete icon — the discoverable way to remove a guide, once selected. */}
                <g
                  role="button"
                  aria-label="Delete guide"
                  transform={`translate(${deleteIconX}, ${deleteIconY})`}
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveGuide(guide.id);
                  }}
                >
                  <title>Delete guide</title>
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
                  {/* Trash-can glyph. The lid is a <path> (not <line>) so it doesn't
                      collide with the guide-line count in querySelectorAll('line'). */}
                  <path d="M2 4 H10" stroke={DELETE_COLOR} strokeWidth={1.4} strokeLinecap="round" />
                  <path
                    d="M3 4 L3.6 11.5 a1 1 0 0 0 1 0.9 h2.8 a1 1 0 0 0 1 -0.9 L9 4"
                    fill="none"
                    stroke={DELETE_COLOR}
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 4 V2.6 a1 1 0 0 1 1 -1 a1 1 0 0 1 1 1 V4"
                    fill="none"
                    stroke={DELETE_COLOR}
                    strokeWidth={1.3}
                  />
                </g>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
