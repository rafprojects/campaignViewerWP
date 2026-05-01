import { describe, expect, it } from 'vitest';

import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import {
  collectGalleryAdapterSettingValues,
  mergeGalleryConfig,
  parseGalleryConfig,
  resolveGalleryConfig,
  setGalleryAdapterSetting,
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

  it('writes adapter settings directly into the configured nested adapter scopes', () => {
    const synced = setGalleryAdapterSetting(
      {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'classic',
              adapterSettings: {
                carouselVisibleCards: 1,
              },
            },
            video: {
              adapterId: 'classic',
              adapterSettings: {
                carouselVisibleCards: 2,
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
      'carouselVisibleCards',
      4,
    );

    expect(synced?.breakpoints?.desktop?.image?.adapterSettings?.carouselVisibleCards).toBe(4);
    expect(synced?.breakpoints?.desktop?.video?.adapterSettings?.carouselVisibleCards).toBe(4);
    expect(synced?.breakpoints?.tablet?.image?.adapterSettings?.carouselVisibleCards).toBe(4);
    expect(synced?.breakpoints?.tablet?.video?.adapterSettings?.carouselVisibleCards).toBe(4);
  });

  it('writes adapter setting units directly into nested config', () => {
    const synced = setGalleryAdapterSetting(
      {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'classic',
              common: {
                sectionPaddingUnit: 'px',
              },
              adapterSettings: {
                carouselGapUnit: 'px',
              },
            },
            video: {
              adapterId: 'classic',
              common: {
                sectionPaddingUnit: 'px',
              },
              adapterSettings: {
                carouselGapUnit: 'px',
              },
            },
          },
        },
      },
      'carouselGapUnit',
      '%',
    );

    expect(synced?.breakpoints?.desktop?.image?.common?.sectionPaddingUnit).toBe('px');
    expect(synced?.breakpoints?.desktop?.video?.common?.sectionPaddingUnit).toBe('px');
    expect(synced?.breakpoints?.desktop?.image?.adapterSettings?.carouselGapUnit).toBe('%');
    expect(synced?.breakpoints?.desktop?.video?.adapterSettings?.carouselGapUnit).toBe('%');
  });

  it('starts from the default gallery config when writing without an existing config', () => {
    const synced = setGalleryAdapterSetting(undefined, 'carouselVisibleCards', 4);

    expect(synced?.breakpoints?.desktop?.image?.adapterId).toBe('classic');
    expect(synced?.breakpoints?.desktop?.video?.adapterId).toBe('classic');
    expect(synced?.breakpoints?.desktop?.unified?.adapterId).toBe('compact-grid');
    expect(synced?.breakpoints?.desktop?.image?.adapterSettings?.carouselVisibleCards).toBe(4);
    expect(synced?.breakpoints?.desktop?.video?.adapterSettings?.carouselVisibleCards).toBe(4);
  });
});