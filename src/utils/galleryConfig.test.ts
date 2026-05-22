import { describe, expect, it } from 'vitest';

import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import {
  collectGalleryAdapterSettingValues,
  mergeGalleryConfig,
  parseGalleryConfig,
  resolveGalleryConfig,
  setGalleryAdapterSetting,
  setRepresentativeGalleryCommonSetting,
  setScopeGalleryCommonSetting,
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

  // P31-C: Structural sharing — identity-sensitive regression tests
  it('setGalleryAdapterSetting preserves reference identity for unchanged breakpoints and scopes', () => {
    const config = {
      mode: 'per-type' as const,
      breakpoints: {
        desktop: {
          image: { adapterId: 'classic' as const, adapterSettings: { carouselVisibleCards: 2 } },
          video: { adapterId: 'masonry' as const },
        },
        tablet: {
          image: { adapterId: 'classic' as const, adapterSettings: { carouselVisibleCards: 3 } },
          video: { adapterId: 'masonry' as const },
        },
      },
    };

    const result = setGalleryAdapterSetting(config, 'carouselVisibleCards', 5);

    // Masonry scopes do not use carouselVisibleCards — their references must be preserved.
    expect(result.breakpoints?.desktop?.video).toBe(config.breakpoints.desktop.video);
    expect(result.breakpoints?.tablet?.video).toBe(config.breakpoints.tablet.video);

    // Changed scopes must produce new objects with the updated value.
    expect(result.breakpoints?.desktop?.image).not.toBe(config.breakpoints.desktop.image);
    expect(result.breakpoints?.desktop?.image?.adapterSettings?.carouselVisibleCards).toBe(5);
    expect(result.breakpoints?.tablet?.image?.adapterSettings?.carouselVisibleCards).toBe(5);
  });

  it('setGalleryAdapterSetting returns the same config reference when the value is already equal', () => {
    const config = {
      mode: 'per-type' as const,
      breakpoints: {
        desktop: {
          image: { adapterId: 'classic' as const, adapterSettings: { carouselVisibleCards: 4 } },
          video: { adapterId: 'classic' as const, adapterSettings: { carouselVisibleCards: 4 } },
        },
      },
    };

    const result = setGalleryAdapterSetting(config, 'carouselVisibleCards', 4);

    expect(result).toBe(config);
  });

  it('setRepresentativeGalleryCommonSetting writes the common key into every breakpoint and scope', () => {
    const config = {
      mode: 'unified' as const,
      breakpoints: {
        desktop: {
          unified: { adapterId: 'classic' as const },
          image: { adapterId: 'classic' as const },
        },
      },
    };

    const result = setRepresentativeGalleryCommonSetting(config, 'sectionPadding', 16);

    expect(result.breakpoints?.desktop?.unified?.common?.sectionPadding).toBe(16);
    expect(result.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(16);
    expect(result.breakpoints?.tablet?.unified?.common?.sectionPadding).toBe(16);
    expect(result.breakpoints?.mobile?.image?.common?.sectionPadding).toBe(16);
  });

  it('setRepresentativeGalleryCommonSetting preserves unchanged breakpoint references', () => {
    const mobileScopeRef = { adapterId: 'classic' as const, common: { sectionPadding: 8 } };
    const config = {
      mode: 'per-type' as const,
      breakpoints: {
        desktop: {
          image: { adapterId: 'classic' as const },
        },
        mobile: {
          image: mobileScopeRef,
        },
      },
    };

    // Writing the value that mobile/image already has — its scope object must stay the same.
    const result = setRepresentativeGalleryCommonSetting(config, 'sectionPadding', 8);

    expect(result.breakpoints?.mobile?.image).toBe(mobileScopeRef);
  });

  it('setRepresentativeGalleryCommonSetting returns same config reference when every value is already equal', () => {
    // All 9 combinations (3 breakpoints × 3 scopes) must carry the value for the
    // no-op identity check to fire on every scope — including the unified scope.
    const makeScope = (adapterId: 'classic' | 'compact-grid') =>
      ({ adapterId, common: { sectionPadding: 24 } }) as const;
    const config = {
      mode: 'per-type' as const,
      breakpoints: {
        desktop: {
          unified: makeScope('compact-grid'),
          image: makeScope('classic'),
          video: makeScope('classic'),
        },
        tablet: {
          unified: makeScope('compact-grid'),
          image: makeScope('classic'),
          video: makeScope('classic'),
        },
        mobile: {
          unified: makeScope('compact-grid'),
          image: makeScope('classic'),
          video: makeScope('classic'),
        },
      },
    };

    const result = setRepresentativeGalleryCommonSetting(config, 'sectionPadding', 24);

    expect(result).toBe(config);
  });

  it('setScopeGalleryCommonSetting writes the common key only into the target scope across all breakpoints', () => {
    const config = {
      mode: 'per-type' as const,
      breakpoints: {
        desktop: {
          image: { adapterId: 'classic' as const },
          video: { adapterId: 'classic' as const },
        },
      },
    };

    const result = setScopeGalleryCommonSetting(config, 'image', 'sectionPadding', 20);

    expect(result.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(20);
    expect(result.breakpoints?.tablet?.image?.common?.sectionPadding).toBe(20);
    expect(result.breakpoints?.mobile?.image?.common?.sectionPadding).toBe(20);
    // Video scope must be untouched.
    expect(result.breakpoints?.desktop?.video?.common?.sectionPadding).toBeUndefined();
  });

  it('setScopeGalleryCommonSetting preserves unchanged breakpoint scope references', () => {
    const tabletImageRef = { adapterId: 'classic' as const, common: { sectionPadding: 32 } };
    const config = {
      mode: 'per-type' as const,
      breakpoints: {
        desktop: {
          image: { adapterId: 'classic' as const, common: { sectionPadding: 16 } },
        },
        tablet: {
          image: tabletImageRef,
        },
      },
    };

    // Writing 32 to image — desktop changes, tablet/image already has 32 so it stays the same ref.
    const result = setScopeGalleryCommonSetting(config, 'image', 'sectionPadding', 32);

    expect(result.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(32);
    expect(result.breakpoints?.tablet?.image).toBe(tabletImageRef);
  });

  it('setScopeGalleryCommonSetting returns same config reference when every value is already equal', () => {
    const config = {
      mode: 'per-type' as const,
      breakpoints: {
        desktop: { image: { adapterId: 'classic' as const, common: { sectionPadding: 10 } } },
        tablet: { image: { adapterId: 'classic' as const, common: { sectionPadding: 10 } } },
        mobile: { image: { adapterId: 'classic' as const, common: { sectionPadding: 10 } } },
      },
    };

    const result = setScopeGalleryCommonSetting(config, 'image', 'sectionPadding', 10);

    expect(result).toBe(config);
  });
});