/**
 * SmartGuides — SVG overlay that renders alignment and spacing guide lines
 * on top of the layout builder canvas during drag operations.
 */

import type { GuideLine } from '@/utils/smartGuides';

// ── Props ────────────────────────────────────────────────────

export interface SmartGuidesProps {
  /** Guide lines to render (from computeGuides). */
  guides: GuideLine[];
  /** Canvas pixel width. */
  canvasWidth: number;
  /** Canvas pixel height. */
  canvasHeight: number;
}

// ── Colours ──────────────────────────────────────────────────

const EDGE_COLOR = '#ff6b6b';
const CENTER_COLOR = '#4dabf7';
const SPACING_COLOR = '#69db7c';

function guideColor(type: GuideLine['type']): string {
  switch (type) {
    case 'edge':
      return EDGE_COLOR;
    case 'center':
      return CENTER_COLOR;
    case 'spacing':
      return SPACING_COLOR;
  }
}

function guideDash(type: GuideLine['type']): string {
  switch (type) {
    case 'edge':
      return 'none';
    case 'center':
      return '6 3';
    case 'spacing':
      return '4 2';
  }
}

// ── Component ────────────────────────────────────────────────

export function SmartGuides({
  guides,
  canvasWidth,
  canvasHeight,
}: SmartGuidesProps) {
  if (guides.length === 0) return null;

  return (
    <svg
      width={canvasWidth}
      height={canvasHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'visible',
      }}
      aria-hidden="true"
    >
      {guides.map((guide, i) => {
        const color = guideColor(guide.type);
        const dash = guideDash(guide.type);

        if (guide.axis === 'x') {
          // Vertical line at x = guide.position%
          const px = (guide.position / 100) * canvasWidth;
          return (
            <g key={`g-${i}`}>
              <line
                x1={px}
                y1={0}
                x2={px}
                y2={canvasHeight}
                stroke={color}
                strokeWidth={1}
                strokeDasharray={dash}
              />
              {guide.label && (
                <text
                  x={px + 4}
                  y={14}
                  fill={color}
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="sans-serif"
                >
                  {guide.label}
                </text>
              )}
            </g>
          );
        }

        // Horizontal line at y = guide.position%
        const py = (guide.position / 100) * canvasHeight;
        return (
          <g key={`g-${i}`}>
            <line
              x1={0}
              y1={py}
              x2={canvasWidth}
              y2={py}
              stroke={color}
              strokeWidth={1}
              strokeDasharray={dash}
            />
            {guide.label && (
              <text
                x={4}
                y={py - 4}
                fill={color}
                fontSize={10}
                fontWeight={600}
                fontFamily="sans-serif"
              >
                {guide.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
