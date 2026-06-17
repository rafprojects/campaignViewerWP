import { describe, it, expect } from 'vitest';

import type { GalleryConfig } from '@/types';
import {
  getScopeAdapterId,
  hasConfiguredAdapterId,
  getEditableScopes,
  formatScopeLabel,
  getScopeViewportBackgroundFallbacks,
  getRepresentativeCommonValue,
  getRepresentativeNumberCommonValue,
  getRepresentativeStringCommonValue,
  getRepresentativeBooleanCommonValue,
  getScopeCommonValue,
  pruneConfig,
  setConfigMode,
  setScopeAdapterId,
  setCommonSettingForEditableScopes,
  setCommonSettingForScope,
  formatSettingGroupLabel,
  resetBreakpointToBaseline,
  resetScopeToBaseline,
} from './galleryConfigUtils';

const cfg = (c: Partial<GalleryConfig>): GalleryConfig =>
  ({ mode: 'per-type', breakpoints: {}, ...c }) as GalleryConfig;

describe('getScopeAdapterId', () => {
  it('returns the configured adapterId', () => {
    const config = cfg({ breakpoints: { desktop: { image: { adapterId: 'masonry' } } } });
    expect(getScopeAdapterId(config, 'desktop', 'image')).toBe('masonry');
  });
  it('falls back to empty string when absent (incl. undefined config)', () => {
    expect(getScopeAdapterId(undefined, 'desktop', 'image')).toBe('');
    expect(getScopeAdapterId(cfg({}), 'mobile', 'video')).toBe('');
  });
});

describe('hasConfiguredAdapterId', () => {
  it('is true only for a non-empty string', () => {
    expect(hasConfiguredAdapterId('x')).toBe(true);
    expect(hasConfiguredAdapterId('   ')).toBe(false);
    expect(hasConfiguredAdapterId('')).toBe(false);
    expect(hasConfiguredAdapterId(null)).toBe(false);
    expect(hasConfiguredAdapterId(undefined)).toBe(false);
  });
});

describe('getEditableScopes / formatScopeLabel', () => {
  it('maps mode to scopes', () => {
    expect(getEditableScopes('unified')).toEqual(['unified']);
    expect(getEditableScopes('per-type')).toEqual(['image', 'video']);
  });
  it('labels each scope', () => {
    expect(formatScopeLabel('unified')).toBe('Unified Gallery');
    expect(formatScopeLabel('image')).toBe('Image Gallery');
    expect(formatScopeLabel('video')).toBe('Video Gallery');
  });
});

describe('getScopeViewportBackgroundFallbacks', () => {
  it('returns the four viewport-bg defaults for a scope', () => {
    const fb = getScopeViewportBackgroundFallbacks('image');
    expect(fb).toHaveProperty('viewportBgType');
    expect(fb).toHaveProperty('viewportBgColor');
    expect(fb).toHaveProperty('viewportBgGradient');
    expect(fb).toHaveProperty('viewportBgImageUrl');
  });
});

describe('getRepresentativeCommonValue and typed variants', () => {
  const config = cfg({
    mode: 'per-type',
    breakpoints: {
      desktop: {
        image: { common: { sectionMaxWidth: 800, adapterSizingMode: 'fit', showGalleryLabelIcon: true } as never },
        video: { common: {} as never },
      },
    },
  });

  it('returns the first scope value of the right primitive type', () => {
    expect(getRepresentativeCommonValue(config, 'desktop', 'sectionMaxWidth')).toBe(800);
  });
  it('returns undefined when no scope has the key', () => {
    expect(getRepresentativeCommonValue(cfg({}), 'desktop', 'sectionMaxWidth')).toBeUndefined();
  });
  it('number/string/boolean variants filter by type', () => {
    expect(getRepresentativeNumberCommonValue(config, 'desktop', 'sectionMaxWidth')).toBe(800);
    expect(getRepresentativeNumberCommonValue(config, 'desktop', 'sectionMaxHeight')).toBeUndefined();
    expect(getRepresentativeStringCommonValue(config, 'desktop', 'adapterSizingMode')).toBe('fit');
    expect(getRepresentativeStringCommonValue(config, 'desktop', 'gallerySizingMode')).toBeUndefined();
    expect(getRepresentativeBooleanCommonValue(config, 'desktop', 'showGalleryLabelIcon')).toBe(true);
    expect(getRepresentativeBooleanCommonValue(config, 'desktop', 'showCampaignGalleryLabels')).toBeUndefined();
  });
});

describe('getScopeCommonValue', () => {
  it('returns a string scope-specific value or undefined', () => {
    const config = cfg({ breakpoints: { desktop: { image: { common: { viewportBgColor: '#fff' } as never } } } });
    expect(getScopeCommonValue(config, 'desktop', 'image', 'viewportBgColor')).toBe('#fff');
    expect(getScopeCommonValue(config, 'desktop', 'image', 'viewportBgType')).toBeUndefined();
  });
});

describe('pruneConfig', () => {
  it('drops empty scopes and empty breakpoints, normalizes mode', () => {
    const config = cfg({
      mode: undefined as never,
      breakpoints: {
        desktop: { image: {}, video: { adapterId: 'm' } },
        mobile: { unified: {} },
      },
    });
    const pruned = pruneConfig(config);
    expect(pruned.mode).toBe('per-type');
    expect(pruned.breakpoints.desktop?.image).toBeUndefined();
    expect(pruned.breakpoints.desktop?.video?.adapterId).toBe('m');
    expect(pruned.breakpoints.mobile).toBeUndefined();
  });
});

describe('setConfigMode', () => {
  it('updates mode and prunes', () => {
    expect(setConfigMode(cfg({}), 'unified').mode).toBe('unified');
  });
});

describe('setScopeAdapterId', () => {
  it('sets an adapterId', () => {
    const out = setScopeAdapterId(cfg({}), 'desktop', 'image', 'masonry');
    expect(out.breakpoints.desktop?.image?.adapterId).toBe('masonry');
  });
  it('clears the adapterId when empty (and prunes the now-empty scope)', () => {
    const start = cfg({ breakpoints: { desktop: { image: { adapterId: 'masonry' } } } });
    const out = setScopeAdapterId(start, 'desktop', 'image', '');
    expect(out.breakpoints.desktop?.image).toBeUndefined();
  });
});

describe('setCommonSettingForEditableScopes', () => {
  it('writes to both per-type scopes', () => {
    const out = setCommonSettingForEditableScopes(cfg({ mode: 'per-type' }), 'desktop', 'sectionMaxWidth', 640);
    expect(out.breakpoints.desktop?.image?.common?.sectionMaxWidth).toBe(640);
    expect(out.breakpoints.desktop?.video?.common?.sectionMaxWidth).toBe(640);
  });
  it('writes only to the unified scope in unified mode', () => {
    const out = setCommonSettingForEditableScopes(cfg({ mode: 'unified' }), 'desktop', 'sectionMaxWidth', 640);
    expect(out.breakpoints.desktop?.unified?.common?.sectionMaxWidth).toBe(640);
    expect(out.breakpoints.desktop?.image).toBeUndefined();
  });
});

describe('setCommonSettingForScope', () => {
  it('writes a scope-specific value', () => {
    const out = setCommonSettingForScope(cfg({}), 'desktop', 'image', 'viewportBgColor', '#abc');
    expect(out.breakpoints.desktop?.image?.common?.viewportBgColor).toBe('#abc');
  });
});

describe('formatSettingGroupLabel', () => {
  it('maps known groups', () => {
    expect(formatSettingGroupLabel('media-frame')).toBe('Media Frame');
    expect(formatSettingGroupLabel('photo-grid')).toBe('Photo Grid');
    expect(formatSettingGroupLabel('tile-appearance')).toBe('Tile Appearance');
    expect(formatSettingGroupLabel('compact-grid')).toBe('Compact Grid');
    expect(formatSettingGroupLabel('layout-builder')).toBe('Layout Builder');
    expect(formatSettingGroupLabel('shape')).toBe('Shape Layout');
  });
  it('title-cases unknown groups', () => {
    expect(formatSettingGroupLabel('mystery' as never)).toBe('Mystery');
  });
});

describe('resetBreakpointToBaseline', () => {
  it('copies the baseline breakpoint when present', () => {
    const draft = cfg({ breakpoints: { desktop: { image: { adapterId: 'draft' } } } });
    const baseline = cfg({ breakpoints: { desktop: { image: { adapterId: 'base' } } } });
    const out = resetBreakpointToBaseline(draft, baseline, 'desktop');
    expect(out.breakpoints.desktop?.image?.adapterId).toBe('base');
  });
  it('removes the breakpoint when the baseline lacks it', () => {
    const draft = cfg({ breakpoints: { desktop: { image: { adapterId: 'draft' } } } });
    const out = resetBreakpointToBaseline(draft, cfg({}), 'desktop');
    expect(out.breakpoints.desktop).toBeUndefined();
  });
});

describe('resetScopeToBaseline', () => {
  it('copies a baseline scope where present and removes it elsewhere', () => {
    const draft = cfg({
      breakpoints: {
        desktop: { image: { adapterId: 'draft' }, video: { adapterId: 'keep' } },
        mobile: { image: { adapterId: 'draft-m' } },
      },
    });
    const baseline = cfg({ breakpoints: { desktop: { image: { adapterId: 'base' } } } });
    const out = resetScopeToBaseline(draft, baseline, 'image');
    expect(out.breakpoints.desktop?.image?.adapterId).toBe('base');
    expect(out.breakpoints.desktop?.video?.adapterId).toBe('keep');
    // mobile had only an 'image' scope with no baseline → breakpoint removed
    expect(out.breakpoints.mobile).toBeUndefined();
  });
});
