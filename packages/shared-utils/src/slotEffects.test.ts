import { describe, it, expect } from 'vitest';
import {
  buildFilterCss,
  getBlendModeCss,
  buildOverlayBg,
  type SlotFilterEffects,
  type SlotShadow,
} from './slotEffects';

describe('buildFilterCss', () => {
  it('returns undefined with no effects and no shadow', () => {
    expect(buildFilterCss()).toBeUndefined();
    expect(buildFilterCss(undefined, undefined)).toBeUndefined();
  });

  it('returns undefined when every effect is absent (all keys undefined)', () => {
    expect(buildFilterCss({})).toBeUndefined();
  });

  it('returns undefined when every effect is at its neutral default', () => {
    const neutral: SlotFilterEffects = {
      brightness: 100,
      contrast: 100,
      saturate: 100,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      hueRotate: 0,
      invert: 0,
    };
    expect(buildFilterCss(neutral)).toBeUndefined();
  });

  it('emits every filter function when all effects are non-neutral', () => {
    const fx: SlotFilterEffects = {
      brightness: 50,
      contrast: 120,
      saturate: 80,
      blur: 2,
      grayscale: 10,
      sepia: 5,
      hueRotate: 45,
      invert: 20,
    };
    const css = buildFilterCss(fx);
    expect(css).toBe(
      'brightness(50%) contrast(120%) saturate(80%) blur(2px) grayscale(10%) sepia(5%) hue-rotate(45deg) invert(20%)',
    );
  });

  it('appends a drop-shadow with a sanitized color', () => {
    const shadow: SlotShadow = { offsetX: 1, offsetY: 2, blur: 3, color: '#000' };
    expect(buildFilterCss(undefined, shadow)).toBe('drop-shadow(1px 2px 3px #000)');
  });

  it('falls back to a default color when the shadow color is unsafe', () => {
    const shadow: SlotShadow = { offsetX: 1, offsetY: 0, blur: 0, color: '!!nope!!' };
    expect(buildFilterCss(undefined, shadow)).toBe('drop-shadow(1px 0px 0px rgba(0,0,0,0.5))');
  });

  it('ignores a zeroed shadow (no offset and no blur)', () => {
    const shadow: SlotShadow = { offsetX: 0, offsetY: 0, blur: 0, color: '#000' };
    expect(buildFilterCss({ blur: 4 }, shadow)).toBe('blur(4px)');
  });
});

describe('getBlendModeCss', () => {
  it('returns undefined for absent or normal', () => {
    expect(getBlendModeCss()).toBeUndefined();
    expect(getBlendModeCss('normal')).toBeUndefined();
  });

  it('returns the blend mode verbatim otherwise', () => {
    expect(getBlendModeCss('multiply')).toBe('multiply');
    expect(getBlendModeCss('soft-light')).toBe('soft-light');
  });
});

describe('buildOverlayBg', () => {
  it('returns undefined for absent overlay, none mode, or non-positive intensity', () => {
    expect(buildOverlayBg()).toBeUndefined();
    expect(buildOverlayBg({ mode: 'none', intensity: 50, onHoverOnly: false })).toBeUndefined();
    expect(buildOverlayBg({ mode: 'darken', intensity: 0, onHoverOnly: false })).toBeUndefined();
  });

  it('builds a black rgba for darken', () => {
    expect(buildOverlayBg({ mode: 'darken', intensity: 40, onHoverOnly: false })).toBe(
      'rgba(0, 0, 0, 0.40)',
    );
  });

  it('builds a white rgba for lighten', () => {
    expect(buildOverlayBg({ mode: 'lighten', intensity: 25, onHoverOnly: true })).toBe(
      'rgba(255, 255, 255, 0.25)',
    );
  });
});
