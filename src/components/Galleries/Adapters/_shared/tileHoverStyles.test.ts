import { describe, it, expect } from 'vitest';
import { buildTileStyles, buildBoxShadowStyles } from './tileHoverStyles';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';

describe('tileHoverStyles — rotation-composed bounce (B-7)', () => {
  it('buildTileStyles bounce keyframes compose the slot rotation custom property', () => {
    const css = buildTileStyles({ scope: 'lb', settings: DEFAULT_GALLERY_BEHAVIOR_SETTINGS });
    // The bounce must rotate by the per-slot custom property (default 0deg) AND scale,
    // so a rotated slot keeps its angle while bouncing instead of snapping to 0°.
    expect(css).toContain('@keyframes wpsg-tile-lb-bounce');
    expect(css).toContain('rotate(var(--wpsg-slot-rot, 0deg)) scale(1.07)');
    expect(css).toContain('rotate(var(--wpsg-slot-rot, 0deg)) scale(1)');
    // Must not emit a bare scale() that would clobber rotation.
    expect(css).not.toContain('transform: scale(');
  });

  it('buildBoxShadowStyles bounce keyframes compose the slot rotation custom property', () => {
    const css = buildBoxShadowStyles('lb-rect', DEFAULT_GALLERY_BEHAVIOR_SETTINGS);
    expect(css).toContain('@keyframes wpsg-tile-lb-rect-bounce');
    expect(css).toContain('rotate(var(--wpsg-slot-rot, 0deg)) scale(1.06)');
    expect(css).not.toContain('transform: scale(');
  });
});
