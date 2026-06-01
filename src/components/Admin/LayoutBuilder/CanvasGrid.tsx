/**
 * P30-B — CanvasGrid
 *
 * An SVG grid overlay rendered inside the layout canvas. Non-interactive,
 * purely decorative. Lines are intentionally subtle so they support rather
 * than dominate the canvas.
 */
import { useMemo } from 'react';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { useBuilderOverlayColors } from '@/hooks/useBuilderOverlayColors';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CanvasGridProps {
  /** Canvas pixel width (same coordinate space as LayoutCanvas). */
  canvasWidth: number;
  /** Canvas pixel height. */
  canvasHeight: number;
  /** Grid cell size in canvas pixels (e.g. 20). */
  gridSizePx: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CanvasGrid({ canvasWidth, canvasHeight, gridSizePx }: CanvasGridProps) {
  const colors = useBuilderOverlayColors();
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
          stroke={major ? colors.gridMajor : colors.gridMinor}
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
          stroke={major ? colors.gridMajor : colors.gridMinor}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

setWpsgDebugDisplayName(CanvasGrid, 'LayoutBuilder:CanvasGrid');
