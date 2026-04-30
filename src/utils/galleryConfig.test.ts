import { describe, expect, it } from 'vitest';

import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import {
  collectGalleryAdapterSettingValues,
  mergeGalleryConfig,
  parseGalleryConfig,
  resolveGalleryConfig,
  syncLegacyGallerySettingToConfig,
} from './galleryConfig';

describe('galleryConfig helpers', () => {
  it('resolves explicit nested config over the default gallery config only', () => {
    const config = resolveGalleryConfig({
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      gallerySectionPadding: 24,
      imageBgType: 'solid',
      imageBgColor: '#112233',
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          desktop: {
            unified: {
              adapterId: 'masonry',
              common: {
                sectionPadding: 8,
              },
            },
          },
        },
      },
    });

    expect(config.mode).toBe('unified');
    expect(config.breakpoints?.desktop?.unified?.adapterId).toBe('masonry');
    expect(config.breakpoints?.desktop?.unified?.common?.sectionPadding).toBe(8);
    expect(config.breakpoints?.desktop?.image?.common?.viewportBgType).not.toBe('solid');
    expect(config.breakpoints?.desktop?.image?.common?.viewportBgColor).not.toBe('#112233');
  });

  it('parses nested config from JSON and rejects invalid values', () => {
    expect(parseGalleryConfig('{"mode":"per-type"}')?.mode).toBe('per-type');
    expect(parseGalleryConfig('not-json')).toBeUndefined();
    expect(parseGalleryConfig([])).toBeUndefined();
  });

  it('merges nested overrides onto the default gallery config', () => {
    const base = resolveGalleryConfig(DEFAULT_GALLERY_BEHAVIOR_SETTINGS);
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

  it('collects representative adapter settings from scopes relevant to the active mode', () => {
    const collected = collectGalleryAdapterSettingValues({
      mode: 'per-type',
      breakpoints: {
        desktop: {
          unified: {
            adapterSettings: {
              carouselVisibleCards: 1,
            },
          },
          image: {
            adapterSettings: {
              carouselVisibleCards: 3,
            },
          },
        },
        tablet: {
          image: {
            adapterSettings: {
              carouselVisibleCards: 5,
            },
          },
        },
      },
    });

    expect(collected.carouselVisibleCards).toBe(3);
  });

  it('syncs inline legacy gallery settings back into nested config', () => {
    const synced = syncLegacyGallerySettingToConfig(
      {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'classic',
              common: {
                adapterItemGap: 12,
              },
            },
            video: {
              adapterId: 'classic',
              common: {
                adapterItemGap: 18,
              },
            },
          },
          tablet: {
            image: {
              adapterId: 'classic',
            },
            video: {
              adapterId: 'classic',
            },
          },
        },
      },
      'adapterItemGap',
      20,
    );

    expect(synced?.breakpoints?.desktop?.image?.common?.adapterItemGap).toBe(20);
    expect(synced?.breakpoints?.desktop?.video?.common?.adapterItemGap).toBe(20);
    expect(synced?.breakpoints?.tablet?.image?.common?.adapterItemGap).toBe(20);
    expect(synced?.breakpoints?.tablet?.video?.common?.adapterItemGap).toBe(20);
  });

  it('syncs common setting units into nested config', () => {
    const synced = syncLegacyGallerySettingToConfig(
      {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'classic',
              common: {
                sectionPaddingUnit: 'px',
                adapterItemGapUnit: 'px',
              },
            },
            video: {
              adapterId: 'classic',
              common: {
                sectionPaddingUnit: 'px',
                adapterItemGapUnit: 'px',
              },
            },
          },
        },
      },
      'gallerySectionPaddingUnit',
      'rem',
    );

    const gapUnitSynced = syncLegacyGallerySettingToConfig(
      synced,
      'adapterItemGapUnit',
      '%',
    );

    expect(gapUnitSynced?.breakpoints?.desktop?.image?.common?.sectionPaddingUnit).toBe('rem');
    expect(gapUnitSynced?.breakpoints?.desktop?.video?.common?.sectionPaddingUnit).toBe('rem');
    expect(gapUnitSynced?.breakpoints?.desktop?.image?.common?.adapterItemGapUnit).toBe('%');
    expect(gapUnitSynced?.breakpoints?.desktop?.video?.common?.adapterItemGapUnit).toBe('%');
  });

  it('starts from the default gallery config when syncing without an existing config', () => {
    const synced = syncLegacyGallerySettingToConfig(undefined, 'gallerySectionPaddingUnit', 'rem');

    expect(synced?.breakpoints?.desktop?.image?.adapterId).toBe('classic');
    expect(synced?.breakpoints?.desktop?.video?.adapterId).toBe('classic');
    expect(synced?.breakpoints?.desktop?.unified?.adapterId).toBe('compact-grid');
    expect(synced?.breakpoints?.desktop?.image?.common?.sectionPaddingUnit).toBe('rem');
    expect(synced?.breakpoints?.desktop?.video?.common?.sectionPaddingUnit).toBe('rem');
    expect(synced?.breakpoints?.desktop?.unified?.common?.sectionPaddingUnit).toBe('rem');
  });
});