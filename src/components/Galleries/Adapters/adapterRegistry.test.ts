import { describe, expect, it } from 'vitest';

import {
  anyAdapterUsesSettingGroup,
  getAdapterSelectOptions,
  normalizeAdapterId,
  resolveAdapter,
} from './adapterRegistry';

describe('adapterRegistry', () => {
  it('normalizes legacy aliases to canonical ids', () => {
    expect(normalizeAdapterId('carousel')).toBe('classic');
    expect(normalizeAdapterId('mosaic')).toBe('justified');
    expect(normalizeAdapterId('unknown-adapter')).toBe('unknown-adapter');
  });

  it('disables layout builder in mobile per-breakpoint options', () => {
    const mobileOptions = getAdapterSelectOptions({
      context: 'per-breakpoint-gallery',
      breakpoint: 'mobile',
    });

    expect(mobileOptions.find((option) => option.value === 'layout-builder')).toEqual({
      value: 'layout-builder',
      label: 'Layout Builder (desktop/tablet only)',
      disabled: true,
    });
  });

  it('provides the campaign-specific classic label', () => {
    const campaignOptions = getAdapterSelectOptions({ context: 'campaign-override' });
    expect(campaignOptions.find((option) => option.value === 'classic')?.label).toBe('Classic Carousel');
  });

  it('matches setting groups through canonical ids and aliases', () => {
    expect(anyAdapterUsesSettingGroup(['mosaic'], 'justified')).toBe(true);
    expect(anyAdapterUsesSettingGroup(['diamond'], 'shape')).toBe(true);
    expect(anyAdapterUsesSettingGroup(['classic'], 'masonry')).toBe(false);
  });

  it('falls back to the classic adapter component for unknown ids', () => {
    expect(resolveAdapter('unknown-adapter')).toBe(resolveAdapter('classic'));
  });
});