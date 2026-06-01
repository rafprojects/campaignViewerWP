/**
 * P30-B — CanvasRulers
 *
 * Horizontal and vertical ruler strips rendered as absolute SVG overlays
 * at the top and left edges of the layout canvas. Tick density adapts to
 * the current zoom level so labels remain readable at any zoom.
 *
 * The rulers live INSIDE the canvas transform (inside TransformComponent),
 * so they zoom and pan with the canvas. Canvas-pixel coordinates shown on
 * the ruler always reflect true canvas dimensions.
 */
import { useMemo } from 'react';
import { useCanvasTransform } from '@/contexts/CanvasTransformContext';
import { rulerTickIntervals } from '@/utils/canvasMeasurement';
import type { PctRect } from '@/utils/canvasMeasurement';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { useBuilderOverlayColors } from '@/hooks/useBuilderOverlayColors';

// ── Constants ─────────────────────────────────────────────────────────────────

const RULER_SIZE = 16; // px — ruler strip height (H) or width (V)
const MAJOR_TICK_HEIGHT = 8;
const MINOR_TICK_HEIGHT = 4;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CanvasRulersProps {
  /** Canvas pixel width (same coordinate space as LayoutCanvas). */
  canvasWidth: number;
  /** Canvas pixel height. */
  canvasHeight: number;
  /**
   * Current selection bounding rect in canvas-% space.
   * When provided, a highlight span is drawn on each ruler showing the
   * selection extent.
   */
  selectionPct?: PctRect | null;
}

// ── Helper: generate ruler ticks ──────────────────────────────────────────────

interface Tick {
  pos: number;    // canvas-px position along the ruler axis
  major: boolean; // major ticks get labels
}

function buildTicks(canvasPx: number, scale: number): Tick[] {
  const { major, minor } = rulerTickIntervals(scale);
  const ticks: Tick[] = [];
  // Start at 0, include ticks up to and including canvasPx
  for (let p = 0; p <= canvasPx; p += minor) {
    ticks.push({ pos: p, major: p % major === 0 });
  }
  return ticks;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CanvasRulers({ canvasWidth, canvasHeight, selectionPct }: CanvasRulersProps) {
  const { scale } = useCanvasTransform();
  const colors = useBuilderOverlayColors();

  const hTicks = useMemo(() => buildTicks(canvasWidth, scale), [canvasWidth, scale]);
  const vTicks = useMemo(() => buildTicks(canvasHeight, scale), [canvasHeight, scale]);

  // Selection highlight spans in canvas-pixel space
  const selHL = useMemo(() => {
    if (!selectionPct) return null;
    return {
      hStart: (selectionPct.x / 100) * canvasWidth,
      hEnd: ((selectionPct.x + selectionPct.width) / 100) * canvasWidth,
      vStart: (selectionPct.y / 100) * canvasHeight,
      vEnd: ((selectionPct.y + selectionPct.height) / 100) * canvasHeight,
    };
  }, [selectionPct, canvasWidth, canvasHeight]);

  return (
    <>
      {/* ── Horizontal ruler (top edge) ───────────── */}
      <svg
        width={canvasWidth}
        height={RULER_SIZE}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 50,
        }}
        aria-hidden="true"
        data-testid="canvas-ruler-horizontal"
      >
        {/* Background */}
        <rect x={0} y={0} width={canvasWidth} height={RULER_SIZE} fill={colors.rulerBg} />

        {/* Selection highlight */}
        {selHL && (
          <rect
            x={selHL.hStart}
            y={0}
            width={selHL.hEnd - selHL.hStart}
            height={RULER_SIZE}
            fill={colors.rulerSelection}
          />
        )}

        {/* Tick marks and labels */}
        {hTicks.map(({ pos, major }) => (
          <g key={`ht${pos}`}>
            <line
              x1={pos}
              y1={RULER_SIZE - (major ? MAJOR_TICK_HEIGHT : MINOR_TICK_HEIGHT)}
              x2={pos}
              y2={RULER_SIZE}
              stroke={colors.rulerTick}
              strokeWidth={1}
            />
            {major && pos > 0 && (
              <text
                x={pos + 2}
                y={RULER_SIZE - MAJOR_TICK_HEIGHT - 1}
                fill={colors.rulerLabel}
                fontSize={8}
                fontFamily="monospace"
              >
                {pos}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* ── Vertical ruler (left edge) ────────────── */}
      <svg
        width={RULER_SIZE}
        height={canvasHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 50,
        }}
        aria-hidden="true"
        data-testid="canvas-ruler-vertical"
      >
        {/* Background */}
        <rect x={0} y={0} width={RULER_SIZE} height={canvasHeight} fill={colors.rulerBg} />

        {/* Selection highlight */}
        {selHL && (
          <rect
            x={0}
            y={selHL.vStart}
            width={RULER_SIZE}
            height={selHL.vEnd - selHL.vStart}
            fill={colors.rulerSelection}
          />
        )}

        {/* Tick marks and labels */}
        {vTicks.map(({ pos, major }) => (
          <g key={`vt${pos}`} transform={`translate(0,${pos})`}>
            <line
              x1={RULER_SIZE - (major ? MAJOR_TICK_HEIGHT : MINOR_TICK_HEIGHT)}
              y1={0}
              x2={RULER_SIZE}
              y2={0}
              stroke={colors.rulerTick}
              strokeWidth={1}
            />
            {major && pos > 0 && (
              <text
                x={1}
                y={-2}
                fill={colors.rulerLabel}
                fontSize={8}
                fontFamily="monospace"
                transform={`rotate(-90, 1, -2)`}
              >
                {pos}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* ── Corner square (covers the overlap of H+V rulers) ── */}
      <svg
        width={RULER_SIZE}
        height={RULER_SIZE}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 51,
        }}
        aria-hidden="true"
      >
        <rect x={0} y={0} width={RULER_SIZE} height={RULER_SIZE} fill={colors.rulerBg} />
      </svg>
    </>
  );
}

setWpsgDebugDisplayName(CanvasRulers, 'LayoutBuilder:CanvasRulers');
