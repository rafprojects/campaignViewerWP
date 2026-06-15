/**
 * P51-E: unit tests for the shared bounded-section-height helper used by the
 * scroll-snap, coverflow and stacked adapters to avoid the measurement
 * feedback loop ("infinite growth") in `auto` height mode.
 */
import { describe, it, expect } from 'vitest';
import { resolveBoundedSectionHeight } from './sectionHeight';

describe('resolveBoundedSectionHeight', () => {
  it('falls back to the fixed default in auto mode even with a large measurement', () => {
    expect(resolveBoundedSectionHeight('auto', 99999, 500)).toBe(500);
  });

  it('falls back when the height mode is undefined', () => {
    expect(resolveBoundedSectionHeight(undefined, 800, 480)).toBe(480);
  });

  it('adopts the measured height in viewport mode', () => {
    expect(resolveBoundedSectionHeight('viewport', 600, 500)).toBe(600);
  });

  it('adopts the measured height in manual mode', () => {
    expect(resolveBoundedSectionHeight('manual', 720, 500)).toBe(720);
  });

  it('falls back in a bounded mode when there is no usable measurement yet', () => {
    expect(resolveBoundedSectionHeight('viewport', 0, 500)).toBe(500);
    expect(resolveBoundedSectionHeight('manual', undefined, 500)).toBe(500);
  });
});
