import { describe, expect, it } from 'vitest';

import {
  getActiveSettingGroupDefinitions,
  anyAdapterUsesSettingGroup,
  getAdapterSelectOptions,
  getPerTypeAdapterSelectionUpdates,
  getSettingGroupFieldDefinitions,
  normalizeAdapterId,
  resolveAdapter,
} from './adapterRegistry';

import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';

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
    expect(getSettingGroupFieldDefinitions('compact-grid').map((field) => field.key)).toEqual([
      'gridCardWidth',
      'gridCardHeight',
    ]);
    expect(getSettingGroupFieldDefinitions('justified').map((field) => field.key)).toEqual([
      'mosaicTargetRowHeight',
      'photoNormalizeHeight',
    ]);
    expect(getSettingGroupFieldDefinitions('shape').map((field) => field.key)).toEqual([
      'tileSize',
      'imageTileSize',
      'videoTileSize',
    ]);
    expect(getSettingGroupFieldDefinitions('layout-builder')).toEqual([
      expect.objectContaining({
        control: 'select',
        key: 'layoutBuilderScope',
      }),
    ]);
  });

  it('returns active setting groups with registry-defined placement and scope metadata', () => {
    expect(getActiveSettingGroupDefinitions(['compact-grid', 'layout-builder', 'hexagonal'])).toEqual([
      expect.objectContaining({
        group: 'compact-grid',
        layout: 'group',
      }),
      expect.objectContaining({
        group: 'shape',
        scopeMode: 'contextual',
      }),
      expect.objectContaining({
        group: 'layout-builder',
        placement: 'inline',
      }),
    ]);
  });

  it('returns direct per-type adapter updates for standard adapter changes', () => {
    expect(getPerTypeAdapterSelectionUpdates(DEFAULT_GALLERY_BEHAVIOR_SETTINGS, 'image', 'masonry')).toEqual([
      {
        key: 'imageGalleryAdapterId',
        value: 'masonry',
      },
    ]);
  });

  it('returns per-breakpoint coercion updates when layout builder is selected for images', () => {
    expect(
      getPerTypeAdapterSelectionUpdates(
        {
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          imageGalleryAdapterId: 'justified',
          videoGalleryAdapterId: 'compact-grid',
        },
        'image',
        'layout-builder',
      ),
    ).toEqual([
      { key: 'gallerySelectionMode', value: 'per-breakpoint' },
      { key: 'desktopImageAdapterId', value: 'layout-builder' },
      { key: 'tabletImageAdapterId', value: 'layout-builder' },
      { key: 'mobileImageAdapterId', value: 'justified' },
      { key: 'desktopVideoAdapterId', value: 'compact-grid' },
      { key: 'tabletVideoAdapterId', value: 'compact-grid' },
      { key: 'mobileVideoAdapterId', value: 'compact-grid' },
    ]);
  });

  it('returns per-breakpoint coercion updates when layout builder is selected for videos', () => {
    expect(
      getPerTypeAdapterSelectionUpdates(
        {
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          imageGalleryAdapterId: 'masonry',
          videoGalleryAdapterId: 'justified',
        },
        'video',
        'layout-builder',
      ),
    ).toEqual([
      { key: 'gallerySelectionMode', value: 'per-breakpoint' },
      { key: 'desktopVideoAdapterId', value: 'layout-builder' },
      { key: 'tabletVideoAdapterId', value: 'layout-builder' },
      { key: 'mobileVideoAdapterId', value: 'justified' },
      { key: 'desktopImageAdapterId', value: 'masonry' },
      { key: 'tabletImageAdapterId', value: 'masonry' },
      { key: 'mobileImageAdapterId', value: 'masonry' },
    ]);
  });

  it('falls back to the classic adapter component for unknown ids', () => {
    expect(resolveAdapter('unknown-adapter')).toBe(resolveAdapter('classic'));
  });
});