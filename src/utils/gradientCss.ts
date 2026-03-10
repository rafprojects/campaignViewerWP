import type {
  GradientDirection,
  GradientStop,
  GradientType,
  RadialShape,
  RadialSize,
} from '@/types';

/** Options bag for fine-grained gradient control. */
export interface GradientOptions {
  type?: GradientType;
  direction?: GradientDirection;
  /** Custom angle in degrees (overrides direction preset for linear/conic). */
  angle?: number;
  stops?: GradientStop[];
  /** Radial shape: circle | ellipse. */
  radialShape?: RadialShape;
  /** Radial size keyword. */
  radialSize?: RadialSize;
  /** Radial / conic center X %. */
  centerX?: number;
  /** Radial / conic center Y %. */
  centerY?: number;
}

/** Direction preset → angle (degrees) for linear gradients. */
const DIRECTION_ANGLE: Record<string, number> = {
  horizontal: 90,
  vertical: 180,
  'diagonal-right': 45,
  'diagonal-left': 135,
};

/**
 * Build a CSS color stop string list from GradientStop[].
 */
function buildColorList(stops: GradientStop[]): string {
  return stops
    .map((s) => {
      const pos = s.position != null ? ` ${s.position}%` : '';
      return `${s.color}${pos}`;
    })
    .join(', ');
}

/**
 * Convert gradient settings into a CSS `background` value.
 *
 * Supports linear-gradient, radial-gradient, and conic-gradient.
 *
 * @param directionOrOpts  Legacy direction string OR a full GradientOptions bag.
 * @param stops            Array of 2–3 color stops (ignored when opts is used).
 * @returns A valid CSS `background` value or `undefined` if inputs are insufficient.
 */
export function buildGradientCss(
  directionOrOpts: GradientDirection | GradientOptions | undefined,
  stops?: GradientStop[] | undefined,
): string | undefined {
  // Normalise arguments into options bag
  let opts: GradientOptions;
  if (typeof directionOrOpts === 'string') {
    opts = { direction: directionOrOpts, stops };
  } else if (directionOrOpts && typeof directionOrOpts === 'object') {
    opts = directionOrOpts;
  } else {
    opts = { stops };
  }

  const s = opts.stops;
  if (!s || s.length < 2) return undefined;

  const colorList = buildColorList(s);
  const gradType = opts.type ?? 'linear';
  const cx = opts.centerX ?? 50;
  const cy = opts.centerY ?? 50;

  switch (gradType) {
    case 'radial': {
      const shape = opts.radialShape ?? 'ellipse';
      const size = opts.radialSize ?? 'farthest-corner';
      return `radial-gradient(${shape} ${size} at ${cx}% ${cy}%, ${colorList})`;
    }

    case 'conic': {
      const angle = opts.angle ?? (opts.direction ? DIRECTION_ANGLE[opts.direction] ?? 0 : 0);
      return `conic-gradient(from ${angle}deg at ${cx}% ${cy}%, ${colorList})`;
    }

    case 'linear':
    default: {
      const angle =
        opts.angle ??
        (opts.direction
          ? (DIRECTION_ANGLE[opts.direction] ?? 90)
          : 90);
      // Legacy 'radial' direction still maps to radial-gradient for backward compat
      if (opts.direction === 'radial') {
        const shape = opts.radialShape ?? 'ellipse';
        const size = opts.radialSize ?? 'farthest-corner';
        return `radial-gradient(${shape} ${size} at ${cx}% ${cy}%, ${colorList})`;
      }
      return `linear-gradient(${angle}deg, ${colorList})`;
    }
  }
}

/** Build a GradientOptions bag from a LayoutTemplate's background* fields. */
export function templateToGradientOpts(tpl: {
  backgroundGradientType?: GradientType;
  backgroundGradientDirection?: GradientDirection;
  backgroundGradientAngle?: number;
  backgroundGradientStops?: GradientStop[];
  backgroundRadialShape?: RadialShape;
  backgroundRadialSize?: RadialSize;
  backgroundGradientCenterX?: number;
  backgroundGradientCenterY?: number;
}): GradientOptions {
  return {
    type: tpl.backgroundGradientType,
    direction: tpl.backgroundGradientDirection,
    angle: tpl.backgroundGradientAngle,
    stops: tpl.backgroundGradientStops,
    radialShape: tpl.backgroundRadialShape,
    radialSize: tpl.backgroundRadialSize,
    centerX: tpl.backgroundGradientCenterX,
    centerY: tpl.backgroundGradientCenterY,
  };
}

/** Default 2-stop gradient: semi-transparent black to transparent. */
export const DEFAULT_GRADIENT_STOPS: GradientStop[] = [
  { color: 'rgba(0, 0, 0, 1)', position: 0 },
  { color: 'rgba(0, 0, 0, 0)', position: 100 },
];
