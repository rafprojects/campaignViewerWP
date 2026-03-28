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
    expect(config.breakpoints?.mobile?.image?.adapterSettings?.imageShadowPreset).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageShadowPreset);
    expect(config.breakpoints?.desktop?.video?.adapterSettings?.videoShadowCustom).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoShadowCustom);
    expect(config.breakpoints?.desktop?.image?.adapterSettings?.imageBorderRadius).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageBorderRadius);
    expect(config.breakpoints?.desktop?.video?.adapterSettings?.videoBorderRadius).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoBorderRadius);
    expect(config.breakpoints?.desktop?.image?.adapterSettings?.thumbnailGap).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.thumbnailGap);
  });

  it('seeds unified classic adapter settings with both viewport heights', () => {
    const config = buildGalleryConfigFromLegacySettings({
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      unifiedGalleryEnabled: true,
      unifiedGalleryAdapterId: 'classic',
      imageViewportHeight: 560,
      videoViewportHeight: 500,
      imageBorderRadius: 14,
      videoBorderRadius: 18,
      imageShadowPreset: 'custom',
      imageShadowCustom: '0 8px 24px rgba(0,0,0,0.35)',
      videoShadowPreset: 'strong',
      videoShadowCustom: '0 6px 18px rgba(0,0,0,0.3)',
    });

    expect(config.breakpoints?.desktop?.unified?.adapterId).toBe('classic');
    expect(config.breakpoints?.desktop?.unified?.adapterSettings?.imageViewportHeight).toBe(560);
    expect(config.breakpoints?.desktop?.unified?.adapterSettings?.videoViewportHeight).toBe(500);
    expect(config.breakpoints?.desktop?.unified?.adapterSettings?.imageBorderRadius).toBe(14);
    expect(config.breakpoints?.desktop?.unified?.adapterSettings?.videoBorderRadius).toBe(18);
    expect(config.breakpoints?.desktop?.unified?.adapterSettings?.imageShadowPreset).toBe('custom');
    expect(config.breakpoints?.desktop?.unified?.adapterSettings?.imageShadowCustom).toBe('0 8px 24px rgba(0,0,0,0.35)');
    expect(config.breakpoints?.desktop?.unified?.adapterSettings?.videoShadowPreset).toBe('strong');
    expect(config.breakpoints?.desktop?.unified?.adapterSettings?.videoShadowCustom).toBe('0 6px 18px rgba(0,0,0,0.3)');
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