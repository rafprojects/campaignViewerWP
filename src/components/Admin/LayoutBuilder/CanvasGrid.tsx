/**
 * P30-B — CanvasGrid
 *
 * An SVG grid overlay rendered inside the layout canvas. Non-interactive,
 * purely decorative. Lines are intentionally subtle so they support rather
 * than dominate the canvas.
 */
import { useMemo } from 'react';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CanvasGridProps {
  /** Canvas pixel width (same coordinate space as LayoutCanvas). */
  canvasWidth: number;
  /** Canvas pixel height. */
  canvasHeight: number;
  /** Grid cell size in canvas pixels (e.g. 20). */
  gridSizePx: number;
}

// ── Colours ───────────────────────────────────────────────────────────────────

// Grid line colours — intentionally muted. Chosen to be visible on both light
// and dark canvas backgrounds without dominating the composition.
const MAJOR_STROKE = 'rgba(128,128,128,0.25)'; // every 5 cells
const MINOR_STROKE = 'rgba(128,128,128,0.12)'; // every 1 cell

// ── Component ─────────────────────────────────────────────────────────────────

export function CanvasGrid({ canvasWidth, canvasHeight, gridSizePx }: CanvasGridProps) {
  const { verticals, horizontals } = useMemo(() => {
    if (gridSizePx <= 0) return { verticals: [], horizontals: [] };

    const verts: Array<{ x: number; major: boolean }> = [];
    const horz: Array<{ y: number; major: boolean }> = [];
    const majorInterval = gridSizePx * 5;

    for (let x = gridSizePx; x < canvasWidth; x += gridSizePx) {
      verts.push({ x, major: x % majorInterval === 0 });
    }
    for (let y = gridSizePx; y < canvasHeight; y += gridSizePx) {
      horz.push({ y, major: y % majorInterval === 0 });
    }
    return { verticals: verts, horizontals: horz };
  }, [canvasWidth, canvasHeight, gridSizePx]);

  return (
    <svg
      width={canvasWidth}
      height={canvasHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'visible',
      }}
      aria-hidden="true"
      data-testid="canvas-grid"
    >
      {verticals.map(({ x, major }) => (
        <line
          key={`v${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={canvasHeight}
          stroke={major ? MAJOR_STROKE : MINOR_STROKE}
          strokeWidth={1}
        />
      ))}
      {horizontals.map(({ y, major }) => (
        <line
          key={`h${y}`}
          x1={0}
          y1={y}
          x2={canvasWidth}
          y2={y}
          stroke={major ? MAJOR_STROKE : MINOR_STROKE}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

setWpsgDebugDisplayName(CanvasGrid, 'LayoutBuilder:CanvasGrid');
