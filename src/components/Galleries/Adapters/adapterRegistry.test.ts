import { describe, expect, it } from 'vitest';

import {
  getActiveSettingGroupDefinitions,
  anyAdapterUsesSettingGroup,
  getAdapterSelectOptions,
  getSettingGroupFieldDefinitions,
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

  it('exposes schema-driven field definitions for adapter setting groups', () => {
    expect(getSettingGroupFieldDefinitions('carousel').map((field) => field.key)).toEqual(expect.arrayContaining([
      'imageViewportHeight',
      'videoViewportHeight',
      'imageShadowPreset',
      'imageShadowCustom',
      'videoShadowPreset',
      'videoShadowCustom',
      'carouselVisibleCards',
      'carouselGap',
      'carouselLoop',
      'carouselDragEnabled',
      'carouselAutoplay',
      'carouselAutoplaySpeed',
      'carouselAutoplayPauseOnHover',
      'carouselAutoplayDirection',
      'carouselDarkenUnfocused',
      'carouselDarkenOpacity',
      'carouselEdgeFade',
      'navArrowPosition',
      'navArrowSize',
      'navArrowColor',
      'navArrowBgColor',
      'navArrowBorderWidth',
      'navArrowHoverScale',
      'navArrowAutoHideMs',
      'navArrowEdgeInset',
      'navArrowMinHitTarget',
      'navArrowFadeDurationMs',
      'navArrowScaleTransitionMs',
      'dotNavEnabled',
      'dotNavPosition',
      'dotNavSize',
      'dotNavMaxVisibleDots',
      'dotNavActiveColor',
      'dotNavInactiveColor',
      'dotNavShape',
      'dotNavSpacing',
      'dotNavActiveScale',
      'viewportHeightMobileRatio',
      'viewportHeightTabletRatio',
    ]));
    expect(getSettingGroupFieldDefinitions('compact-grid').map((field) => field.key)).toEqual([
      'gridCardWidth',
      'gridCardAspectRatio',
      'gridCardMaxColumns',
      'gridCardMinHeight',
    ]);
    expect(getSettingGroupFieldDefinitions('justified').map((field) => field.key)).toEqual([
      'mosaicTargetRowHeight',
      'photoNormalizeHeight',
    ]);
    expect(getSettingGroupFieldDefinitions('masonry').map((field) => field.key)).toEqual([
      'masonryColumns',
      'masonryAutoColumnBreakpoints',
      'masonryEntranceAnimation',
      'masonryEntranceStagger',
    ]);
    expect(getSettingGroupFieldDefinitions('shape').map((field) => field.key)).toEqual([
      'tileSize',
      'imageTileSize',
      'videoTileSize',
      'tileGapX',
      'tileGapY',
    ]);
    expect(getSettingGroupFieldDefinitions('layout-builder').map((field) => field.key)).toEqual([
      'layoutBuilderScope',
      'tileGlowColor',
      'tileGlowSpread',
    ]);
  });

  it('returns active setting groups with registry-defined placement and scope metadata', () => {
    expect(getActiveSettingGroupDefinitions(['classic', 'compact-grid', 'layout-builder', 'hexagonal'])).toEqual(expect.arrayContaining([
      expect.objectContaining({
        group: 'carousel',
        layout: 'stack',
      }),
      expect.objectContaining({
        group: 'media-frame',
        layout: 'stack',
      }),
      expect.objectContaining({
        group: 'compact-grid',
        layout: 'stack',
      }),
      expect.objectContaining({
        group: 'shape',
        scopeMode: 'contextual',
      }),
      expect.objectContaining({
        group: 'tile-appearance',
        layout: 'stack',
      }),
      expect.objectContaining({
        group: 'layout-builder',
        placement: 'inline',
      }),
    ]));
  });

  it('falls back to the classic adapter component for unknown ids', () => {
    expect(resolveAdapter('unknown-adapter')).toBe(resolveAdapter('classic'));
  });

  // P31-E: Spotlight adapter registry coverage
  it('registers the spotlight adapter with correct capabilities and setting groups', () => {
    const options = getAdapterSelectOptions({ context: 'unified-gallery' });
    const spotlight = options.find((o) => o.value === 'spotlight');
    expect(spotlight).toBeDefined();
    expect(spotlight?.label).toBe('Spotlight (Hero + Strip)');
  });

  it('exposes schema-driven field definitions for the spotlight setting group', () => {
    const fieldKeys = getSettingGroupFieldDefinitions('spotlight').map((f) => f.key);
    expect(fieldKeys).toEqual([
      'spotlightHeroAspectRatio',
      'spotlightThumbnailSize',
      'spotlightTransitionDuration',
      'spotlightStripPosition',
    ]);
  });

  it('reports spotlight in active setting groups when the adapter is selected', () => {
    const groups = getActiveSettingGroupDefinitions(['spotlight']);
    expect(groups.map((g) => g.group)).toContain('spotlight');
    expect(groups.map((g) => g.group)).toContain('media-frame');
  });

  it('spotlight is not disabled at mobile breakpoint', () => {
    const mobileOptions = getAdapterSelectOptions({ context: 'per-breakpoint-gallery', breakpoint: 'mobile' });
    const spotlight = mobileOptions.find((o) => o.value === 'spotlight');
    expect(spotlight?.disabled).toBeFalsy();
  });

  // P31-F: Scroll Snap adapter registry coverage
  it('registers the scroll-snap adapter with correct option labels', () => {
    const options = getAdapterSelectOptions({ context: 'unified-gallery' });
    const snap = options.find((o) => o.value === 'scroll-snap');
    expect(snap).toBeDefined();
    expect(snap?.label).toBe('Scroll Snap (vertical)');
  });

  it('exposes schema-driven field definitions for the scroll-snap setting group', () => {
    const fieldKeys = getSettingGroupFieldDefinitions('scroll-snap').map((f) => f.key);
    expect(fieldKeys).toEqual(['scrollSnapAlignment', 'scrollSnapPageIndicator']);
  });

  it('scroll-snap adapter is not disabled at mobile breakpoint', () => {
    const mobileOptions = getAdapterSelectOptions({ context: 'per-breakpoint-gallery', breakpoint: 'mobile' });
    const snap = mobileOptions.find((o) => o.value === 'scroll-snap');
    expect(snap?.disabled).toBeFalsy();
  });
});