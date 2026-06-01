/**
 * P30-B — MeasurementOverlay
 *
 * SVG overlay that shows the distances from the current selection bounding
 * box to each canvas edge — both in canvas pixels and percentages.
 *
 * Rendered inside the canvas (inside the zoom/pan transform), so coordinates
 * are in canvas-pixel space. Non-interactive; pointerEvents: none.
 */
import { useMemo } from 'react';
import type { PctRect } from '@/utils/canvasMeasurement';
import { computeEdgeDistances, formatMeasurement } from '@/utils/canvasMeasurement';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { useBuilderOverlayColors, type BuilderOverlayColors } from '@/hooks/useBuilderOverlayColors';

// ── Constants ─────────────────────────────────────────────────────────────────

const LINE_DASH = '4 3';
const ARROW_SIZE = 4;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MeasurementOverlayProps {
  /** Selection bounding rect in canvas-% space. */
  selectionPct: PctRect;
  /** Canvas pixel width. */
  canvasWidth: number;
  /** Canvas pixel height. */
  canvasHeight: number;
}

// ── Helper: labelled measurement line ─────────────────────────────────────────

interface MeasureLineData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  label: string;
  axis: 'h' | 'v';
}

interface MeasureLineProps extends MeasureLineData {
  colors: BuilderOverlayColors;
}

function MeasureLine({ x1, y1, x2, y2, labelX, labelY, label, colors }: MeasureLineProps) {
  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={colors.measureLine}
        strokeWidth={1}
        strokeDasharray={LINE_DASH}
      />
      {/* Arrow at start */}
      <circle cx={x1} cy={y1} r={ARROW_SIZE / 2} fill={colors.measureLine} />
      {/* Arrow at end */}
      <circle cx={x2} cy={y2} r={ARROW_SIZE / 2} fill={colors.measureLine} />
      {/* Label background */}
      <rect
        x={labelX - 2}
        y={labelY - 9}
        width={label.length * 5.5 + 4}
        height={12}
        rx={2}
        fill={colors.measureLabelBg}
      />
      <text
        x={labelX}
        y={labelY}
        fill={colors.measureLabelFg}
        fontSize={9}
        fontFamily="monospace"
      >
        {label}
      </text>
    </g>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MeasurementOverlay({ selectionPct, canvasWidth, canvasHeight }: MeasurementOverlayProps) {
  const colors = useBuilderOverlayColors();
  const lines = useMemo<MeasureLineData[]>(() => {
    const d = computeEdgeDistances(selectionPct);

    // Convert % distances to canvas-px
    const slotLeft   = (selectionPct.x / 100) * canvasWidth;
    const slotRight  = ((selectionPct.x + selectionPct.width) / 100) * canvasWidth;
    const slotTop    = (selectionPct.y / 100) * canvasHeight;
    const slotBottom = ((selectionPct.y + selectionPct.height) / 100) * canvasHeight;
    const midX = (slotLeft + slotRight) / 2;
    const midY = (slotTop + slotBottom) / 2;

    const result: MeasureLineData[] = [];

    // Left measurement (canvas edge → slot left edge)
    if (d.left > 0.5) {
      const lx = slotLeft / 2;
      result.push({
        x1: 0, y1: midY, x2: slotLeft, y2: midY,
        labelX: Math.max(2, lx - 20), labelY: midY - 4,
        label: formatMeasurement(d.left, canvasWidth),
        axis: 'h',
      });
    }

    // Right measurement (slot right edge → canvas edge)
    if (d.right > 0.5) {
      const rx = slotRight + (canvasWidth - slotRight) / 2;
      result.push({
        x1: slotRight, y1: midY, x2: canvasWidth, y2: midY,
        labelX: Math.min(rx - 20, canvasWidth - 80), labelY: midY - 4,
        label: formatMeasurement(d.right, canvasWidth),
        axis: 'h',
      });
    }

    // Top measurement (canvas edge → slot top edge)
    if (d.top > 0.5) {
      const ty = slotTop / 2;
      result.push({
        x1: midX, y1: 0, x2: midX, y2: slotTop,
        labelX: midX + 3, labelY: Math.max(10, ty),
        label: formatMeasurement(d.top, canvasHeight),
        axis: 'v',
      });
    }

    // Bottom measurement (slot bottom edge → canvas edge)
    if (d.bottom > 0.5) {
      const by = slotBottom + (canvasHeight - slotBottom) / 2;
      result.push({
        x1: midX, y1: slotBottom, x2: midX, y2: canvasHeight,
        labelX: midX + 3, labelY: Math.min(by, canvasHeight - 4),
        label: formatMeasurement(d.bottom, canvasHeight),
        axis: 'v',
      });
    }

    return result;
  }, [selectionPct, canvasWidth, canvasHeight]);

  if (lines.length === 0) return null;

  return (
    <svg
      width={canvasWidth}
      height={canvasHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 100,
        overflow: 'visible',
      }}
      aria-hidden="true"
      data-testid="measurement-overlay"
    >
      {lines.map((line, i) => (
        <MeasureLine key={i} {...line} colors={colors} />
      ))}
    </svg>
  );
}

setWpsgDebugDisplayName(MeasurementOverlay, 'LayoutBuilder:MeasurementOverlay');
