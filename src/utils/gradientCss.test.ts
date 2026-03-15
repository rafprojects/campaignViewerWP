import { describe, it, expect } from 'vitest';
import { buildGradientCss, templateToGradientOpts, DEFAULT_GRADIENT_STOPS } from './gradientCss';
import type { GradientStop } from '@/types';

const twoStops: GradientStop[] = [
  { color: '#ff0000', position: 0 },
  { color: '#0000ff', position: 100 },
];

const threeStops: GradientStop[] = [
  { color: 'red', position: 0 },
  { color: 'green', position: 50 },
  { color: 'blue', position: 100 },
];

describe('buildGradientCss', () => {
  it('returns undefined when stops are missing or < 2', () => {
    expect(buildGradientCss(undefined)).toBeUndefined();
    expect(buildGradientCss('horizontal', [])).toBeUndefined();
    expect(buildGradientCss('horizontal', [{ color: 'red', position: 0 }])).toBeUndefined();
  });

  // ── Linear gradients ──────────────────────────────────────────────────

  it('builds a linear gradient with default 90deg angle', () => {
    expect(buildGradientCss(undefined, twoStops)).toBe(
      'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)',
    );
  });

  it('maps direction presets to correct angles', () => {
    expect(buildGradientCss('horizontal', twoStops)).toBe(
      'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)',
    );
    expect(buildGradientCss('vertical', twoStops)).toBe(
      'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)',
    );
    expect(buildGradientCss('diagonal-right', twoStops)).toBe(
      'linear-gradient(45deg, #ff0000 0%, #0000ff 100%)',
    );
    expect(buildGradientCss('diagonal-left', twoStops)).toBe(
      'linear-gradient(135deg, #ff0000 0%, #0000ff 100%)',
    );
  });

  it('supports custom angle via options bag', () => {
    expect(buildGradientCss({ angle: 270, stops: twoStops })).toBe(
      'linear-gradient(270deg, #ff0000 0%, #0000ff 100%)',
    );
  });

  it('handles 3 color stops', () => {
    const result = buildGradientCss('horizontal', threeStops);
    expect(result).toBe('linear-gradient(90deg, red 0%, green 50%, blue 100%)');
  });

  // ── Radial gradients ──────────────────────────────────────────────────

  it('builds a radial gradient with defaults', () => {
    expect(buildGradientCss({ type: 'radial', stops: twoStops })).toBe(
      'radial-gradient(ellipse farthest-corner at 50% 50%, #ff0000 0%, #0000ff 100%)',
    );
  });

  it('supports custom radial shape/size/center', () => {
    expect(
      buildGradientCss({
        type: 'radial',
        radialShape: 'circle',
        radialSize: 'closest-side',
        centerX: 30,
        centerY: 70,
        stops: twoStops,
      }),
    ).toBe('radial-gradient(circle closest-side at 30% 70%, #ff0000 0%, #0000ff 100%)');
  });

  // ── Conic gradients ───────────────────────────────────────────────────

  it('builds a conic gradient', () => {
    expect(buildGradientCss({ type: 'conic', stops: twoStops })).toBe(
      'conic-gradient(from 0deg at 50% 50%, #ff0000 0%, #0000ff 100%)',
    );
  });

  it('conic gradient respects angle and center', () => {
    expect(
      buildGradientCss({ type: 'conic', angle: 45, centerX: 25, centerY: 75, stops: twoStops }),
    ).toBe('conic-gradient(from 45deg at 25% 75%, #ff0000 0%, #0000ff 100%)');
  });

  // ── Legacy 'radial' direction ─────────────────────────────────────────

  it('legacy direction "radial" produces radial-gradient', () => {
    expect(buildGradientCss('radial', twoStops)).toBe(
      'radial-gradient(ellipse farthest-corner at 50% 50%, #ff0000 0%, #0000ff 100%)',
    );
  });

  // ── Stop position omission ────────────────────────────────────────────

  it('omits position when stop.position is null/undefined', () => {
    const stops: GradientStop[] = [
      { color: 'red' } as GradientStop,
      { color: 'blue' } as GradientStop,
    ];
    expect(buildGradientCss('horizontal', stops)).toBe(
      'linear-gradient(90deg, red, blue)',
    );
  });
});

describe('templateToGradientOpts', () => {
  it('maps template fields to GradientOptions', () => {
    const opts = templateToGradientOpts({
      backgroundGradientType: 'radial',
      backgroundGradientDirection: 'horizontal',
      backgroundGradientAngle: 45,
      backgroundGradientStops: twoStops,
      backgroundRadialShape: 'circle',
      backgroundRadialSize: 'closest-side',
      backgroundGradientCenterX: 10,
      backgroundGradientCenterY: 90,
    });
    expect(opts.type).toBe('radial');
    expect(opts.direction).toBe('horizontal');
    expect(opts.angle).toBe(45);
    expect(opts.stops).toEqual(twoStops);
    expect(opts.radialShape).toBe('circle');
    expect(opts.radialSize).toBe('closest-side');
    expect(opts.centerX).toBe(10);
    expect(opts.centerY).toBe(90);
  });

  it('handles empty template', () => {
    const opts = templateToGradientOpts({});
    expect(opts.type).toBeUndefined();
    expect(opts.stops).toBeUndefined();
  });
});

describe('DEFAULT_GRADIENT_STOPS', () => {
  it('has exactly 2 stops', () => {
    expect(DEFAULT_GRADIENT_STOPS).toHaveLength(2);
    expect(DEFAULT_GRADIENT_STOPS[0].position).toBe(0);
    expect(DEFAULT_GRADIENT_STOPS[1].position).toBe(100);
  });
});
