import { describe, expect, it } from 'vitest';

import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import {
  buildGalleryConfigFromLegacySettings,
  mergeGalleryConfig,
  parseGalleryConfig,
} from './galleryConfig';

describe('galleryConfig helpers', () => {
  it('builds a nested gallery config from legacy settings', () => {
    const config = buildGalleryConfigFromLegacySettings({
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      unifiedGalleryEnabled: true,
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: 'masonry',
      tabletVideoAdapterId: 'diamond',
    });

    expect(config.mode).toBe('unified');
    expect(config.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
    expect(config.breakpoints?.tablet?.video?.adapterId).toBe('diamond');
    expect(config.breakpoints?.mobile?.unified?.adapterId).toBe('compact-grid');
    expect(config.breakpoints?.desktop?.image?.common?.viewportBgType).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageBgType);
    expect(config.breakpoints?.desktop?.video?.common?.viewportBgColor).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoBgColor);
    expect(config.breakpoints?.desktop?.unified?.common?.viewportBgGradient).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.unifiedBgGradient);
    expect(config.breakpoints?.desktop?.video?.adapterSettings?.videoViewportHeight).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoViewportHeight);
    expect(config.breakpoints?.mobile?.image?.adapterSettings?.imageViewportHeight).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageViewportHeight);
  });

  it('seeds unified classic adapter settings with both viewport heights', () => {
    const config = buildGalleryConfigFromLegacySettings({
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      unifiedGalleryEnabled: true,
      unifiedGalleryAdapterId: 'classic',
      imageViewportHeight: 560,
      videoViewportHeight: 500,
    });

    expect(config.breakpoints?.desktop?.unified?.adapterId).toBe('classic');
    expect(config.breakpoints?.desktop?.unified?.adapterSettings?.imageViewportHeight).toBe(560);
    expect(config.breakpoints?.desktop?.unified?.adapterSettings?.videoViewportHeight).toBe(500);
  });

  it('parses nested config from JSON and rejects invalid values', () => {
    expect(parseGalleryConfig('{"mode":"per-type"}')?.mode).toBe('per-type');
    expect(parseGalleryConfig('not-json')).toBeUndefined();
    expect(parseGalleryConfig([])).toBeUndefined();
  });

  it('merges nested overrides onto a legacy-derived base', () => {
    const base = buildGalleryConfigFromLegacySettings(DEFAULT_GALLERY_BEHAVIOR_SETTINGS);
    const merged = mergeGalleryConfig(base, {
      breakpoints: {
        desktop: {
          image: {
            adapterId: 'hexagonal',
            common: {
              sectionPadding: 28,
            },
          },
        },
      },
    });

    expect(merged.breakpoints?.desktop?.image?.adapterId).toBe('hexagonal');
    expect(merged.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(28);
    expect(merged.breakpoints?.mobile?.image?.adapterId).toBe('classic');
  });
});