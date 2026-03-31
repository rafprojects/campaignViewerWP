import { describe, expect, it } from 'vitest';

import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';

import { getLegacyActiveAdapterIds, getLegacyFlatAdapterId, getLegacyPerTypeAdapterId, getLegacyScopeAdapterIds } from './galleryAdapterSelection';

describe('galleryAdapterSelection', () => {
  it('returns the flat legacy adapter for the requested scope', () => {
    expect(
      getLegacyFlatAdapterId(
        {
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          imageGalleryAdapterId: 'masonry',
          videoGalleryAdapterId: 'justified',
        },
        'image',
      ),
    ).toBe('masonry');

    expect(
      getLegacyFlatAdapterId(
        {
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          imageGalleryAdapterId: 'masonry',
          videoGalleryAdapterId: 'justified',
        },
        'video',
      ),
    ).toBe('justified');
  });

  it('returns the flat adapter when selection mode is not per-breakpoint', () => {
    expect(
      getLegacyPerTypeAdapterId(
        {
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          gallerySelectionMode: 'unified',
          imageGalleryAdapterId: 'hexagonal',
          desktopImageAdapterId: 'layout-builder',
        },
        'desktop',
        'image',
      ),
    ).toBe('hexagonal');
  });

  it('returns the breakpoint-specific adapter when present', () => {
    expect(
      getLegacyPerTypeAdapterId(
        {
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          gallerySelectionMode: 'per-breakpoint',
          imageGalleryAdapterId: 'classic',
          tabletImageAdapterId: 'masonry',
        },
        'tablet',
        'image',
      ),
    ).toBe('masonry');
  });

  it('falls back to the flat adapter when the breakpoint slot is empty', () => {
    expect(
      getLegacyPerTypeAdapterId(
        {
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          gallerySelectionMode: 'per-breakpoint',
          videoGalleryAdapterId: 'diamond',
          mobileVideoAdapterId: '',
        },
        'mobile',
        'video',
      ),
    ).toBe('diamond');
  });

  it('returns unified adapter ids for both scope and active lookups when unified mode is enabled', () => {
    const settings = {
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      unifiedGalleryEnabled: true,
      unifiedGalleryAdapterId: 'masonry',
      imageGalleryAdapterId: 'classic',
      videoGalleryAdapterId: 'justified',
    };

    expect(getLegacyScopeAdapterIds(settings, 'image')).toEqual(['masonry']);
    expect(getLegacyScopeAdapterIds(settings, 'video')).toEqual(['masonry']);
    expect(getLegacyActiveAdapterIds(settings)).toEqual(['masonry']);
  });

  it('returns per-breakpoint scope adapter ids when per-breakpoint mode is enabled', () => {
    const settings = {
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      unifiedGalleryEnabled: false,
      gallerySelectionMode: 'per-breakpoint' as const,
      desktopImageAdapterId: 'masonry',
      tabletImageAdapterId: 'justified',
      mobileImageAdapterId: 'classic',
      desktopVideoAdapterId: 'diamond',
      tabletVideoAdapterId: 'hexagonal',
      mobileVideoAdapterId: 'compact-grid',
    };

    expect(getLegacyScopeAdapterIds(settings, 'image')).toEqual(['masonry', 'justified', 'classic']);
    expect(getLegacyScopeAdapterIds(settings, 'video')).toEqual(['diamond', 'hexagonal', 'compact-grid']);
    expect(getLegacyActiveAdapterIds(settings)).toEqual([
      'masonry',
      'justified',
      'classic',
      'diamond',
      'hexagonal',
      'compact-grid',
    ]);
  });

  it('returns flat per-type adapter ids when per-breakpoint mode is disabled', () => {
    const settings = {
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      unifiedGalleryEnabled: false,
      gallerySelectionMode: 'unified' as const,
      imageGalleryAdapterId: 'circular',
      videoGalleryAdapterId: 'diamond',
    };

    expect(getLegacyScopeAdapterIds(settings, 'image')).toEqual(['circular']);
    expect(getLegacyScopeAdapterIds(settings, 'video')).toEqual(['diamond']);
    expect(getLegacyActiveAdapterIds(settings)).toEqual(['circular', 'diamond']);
  });
});