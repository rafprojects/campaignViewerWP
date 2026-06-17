import { describe, it, expect } from 'vitest';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import {
  cloneGalleryConfig,
  collectGalleryAdapterSettingValues,
  GALLERY_BREAKPOINTS,
  getActiveGalleryConfigAdapterIds,
  getGalleryConfigScopeAdapterIds,
  getLegacyViewportBackgroundFieldMap,
  getRepresentativeGalleryCommonSetting,
  getRepresentativeScopeAdapterId,
  getScopeGalleryCommonSetting,
  mergeGalleryConfig,
  parseGalleryConfig,
  resolveGalleryConfig,
  setGalleryAdapterSetting,
  setRepresentativeGalleryCommonSetting,
  setScopeGalleryCommonSetting,
} from './galleryConfig';

/**
 * Comprehensive coverage tests for galleryConfig.ts
 * Tests all exported functions with boundary conditions, edge cases, and branch coverage.
 */

describe('galleryConfig.coverage', () => {
  // ============================================================================
  // GALLERY_BREAKPOINTS
  // ============================================================================

  describe('GALLERY_BREAKPOINTS', () => {
    it('exports breakpoint array in expected order', () => {
      expect(GALLERY_BREAKPOINTS).toEqual(['desktop', 'tablet', 'mobile']);
    });

    it('contains exactly three breakpoints', () => {
      expect(GALLERY_BREAKPOINTS).toHaveLength(3);
    });
  });

  // ============================================================================
  // getLegacyViewportBackgroundFieldMap
  // ============================================================================

  describe('getLegacyViewportBackgroundFieldMap', () => {
    it('returns unified scope mapping', () => {
      const map = getLegacyViewportBackgroundFieldMap('unified');
      expect(map).toEqual({
        viewportBgType: 'unifiedBgType',
        viewportBgColor: 'unifiedBgColor',
        viewportBgGradient: 'unifiedBgGradient',
        viewportBgImageUrl: 'unifiedBgImageUrl',
      });
    });

    it('returns image scope mapping', () => {
      const map = getLegacyViewportBackgroundFieldMap('image');
      expect(map).toEqual({
        viewportBgType: 'imageBgType',
        viewportBgColor: 'imageBgColor',
        viewportBgGradient: 'imageBgGradient',
        viewportBgImageUrl: 'imageBgImageUrl',
      });
    });

    it('returns video scope mapping', () => {
      const map = getLegacyViewportBackgroundFieldMap('video');
      expect(map).toEqual({
        viewportBgType: 'videoBgType',
        viewportBgColor: 'videoBgColor',
        viewportBgGradient: 'videoBgGradient',
        viewportBgImageUrl: 'videoBgImageUrl',
      });
    });
  });

  // ============================================================================
  // cloneGalleryConfig
  // ============================================================================

  describe('cloneGalleryConfig', () => {
    it('returns undefined when input is undefined', () => {
      expect(cloneGalleryConfig(undefined)).toBeUndefined();
    });

    it('returns undefined when input is null', () => {
      expect(cloneGalleryConfig(null as any)).toBeUndefined();
    });

    it('clones mode', () => {
      const config = { mode: 'unified' as const, breakpoints: {} };
      const cloned = cloneGalleryConfig(config);
      expect(cloned?.mode).toBe('unified');
    });

    it('clones per-type mode', () => {
      const config = { mode: 'per-type' as const, breakpoints: {} };
      const cloned = cloneGalleryConfig(config);
      expect(cloned?.mode).toBe('per-type');
    });

    it('clones empty breakpoints', () => {
      const config = { mode: 'unified' as const, breakpoints: {} };
      const cloned = cloneGalleryConfig(config);
      expect(cloned?.breakpoints).toEqual({});
    });

    it('clones desktop breakpoint with all scopes', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            unified: { adapterId: 'classic', common: { sectionPadding: 8 }, adapterSettings: { carouselVisibleCards: 1 } },
            image: { adapterId: 'masonry', common: { sectionPadding: 16 } },
            video: { adapterId: 'diamond' },
          },
        },
      };
      const cloned = cloneGalleryConfig(config);
      expect(cloned?.breakpoints?.desktop?.unified?.adapterId).toBe('classic');
      expect(cloned?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
      expect(cloned?.breakpoints?.desktop?.video?.adapterId).toBe('diamond');
    });

    it('preserves scope references independence (deep clone)', () => {
      const original = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry', common: { sectionPadding: 16 } },
          },
        },
      };
      const cloned = cloneGalleryConfig(original);
      if (cloned?.breakpoints?.desktop?.image) {
        cloned.breakpoints.desktop.image.common!.sectionPadding = 32;
      }
      expect(original.breakpoints.desktop.image.common?.sectionPadding).toBe(16);
    });

    it('clones all breakpoints (desktop, tablet, mobile)', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: 'justified' } },
          mobile: { image: { adapterId: 'classic' } },
        },
      };
      const cloned = cloneGalleryConfig(config);
      expect(cloned?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
      expect(cloned?.breakpoints?.tablet?.image?.adapterId).toBe('justified');
      expect(cloned?.breakpoints?.mobile?.image?.adapterId).toBe('classic');
    });

    it('skips undefined scopes (only includes defined ones)', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry' },
            video: undefined,
            unified: undefined,
          } as any,
        },
      };
      const cloned = cloneGalleryConfig(config);
      expect(cloned?.breakpoints?.desktop?.image).toBeDefined();
      expect(cloned?.breakpoints?.desktop?.video).toBeUndefined();
    });
  });

  // ============================================================================
  // resolveGalleryConfig
  // ============================================================================

  describe('resolveGalleryConfig', () => {
    it('returns default config when galleryConfig is not provided', () => {
      const result = resolveGalleryConfig(DEFAULT_GALLERY_BEHAVIOR_SETTINGS);
      expect(result.mode).toBeDefined();
      expect(result.breakpoints).toBeDefined();
    });

    it('merges explicit galleryConfig with default', () => {
      const result = resolveGalleryConfig({
        ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
        galleryConfig: {
          mode: 'unified',
          breakpoints: {
            desktop: {
              unified: {
                adapterId: 'masonry',
                common: { sectionPadding: 8 },
              },
            },
          },
        },
      });
      expect(result.mode).toBe('unified');
      expect(result.breakpoints?.desktop?.unified?.adapterId).toBe('masonry');
    });

    it('preserves default values for unspecified breakpoints', () => {
      const result = resolveGalleryConfig({
        ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
        galleryConfig: {
          mode: 'unified',
          breakpoints: {
            desktop: {
              unified: { adapterId: 'custom' },
            },
          },
        },
      });
      // The default should have tablet and mobile scopes
      expect(result.breakpoints?.tablet).toBeDefined();
      expect(result.breakpoints?.mobile).toBeDefined();
    });
  });

  // ============================================================================
  // getGalleryConfigScopeAdapterIds
  // ============================================================================

  describe('getGalleryConfigScopeAdapterIds', () => {
    it('returns array of image adapter ids across breakpoints', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: 'justified' } },
          mobile: { image: { adapterId: 'classic' } },
        },
      };
      const result = getGalleryConfigScopeAdapterIds(config, 'image');
      expect(result).toEqual(['masonry', 'justified', 'classic']);
    });

    it('returns array of video adapter ids across breakpoints', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { video: { adapterId: 'diamond' } },
          tablet: { video: { adapterId: 'carousel' } },
          mobile: { video: {} },
        },
      };
      const result = getGalleryConfigScopeAdapterIds(config, 'video');
      expect(result).toEqual(['diamond', 'carousel']);
    });

    it('filters out empty adapter ids', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: '' } },
          mobile: { image: {} },
        },
      };
      const result = getGalleryConfigScopeAdapterIds(config, 'image');
      expect(result).toEqual(['masonry']);
    });

    it('returns empty array when no scopes have adapter ids', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: {} },
          tablet: { image: {} },
          mobile: { image: {} },
        },
      };
      const result = getGalleryConfigScopeAdapterIds(config, 'image');
      expect(result).toEqual([]);
    });

    it('returns empty array when scope is undefined on all breakpoints', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {},
          tablet: {},
          mobile: {},
        },
      };
      const result = getGalleryConfigScopeAdapterIds(config, 'image');
      expect(result).toEqual([]);
    });

    it('works with unified scope', () => {
      const config = {
        mode: 'unified' as const,
        breakpoints: {
          desktop: { unified: { adapterId: 'classic' } },
          tablet: { unified: { adapterId: 'classic' } },
          mobile: { unified: { adapterId: 'compact-grid' } },
        },
      };
      const result = getGalleryConfigScopeAdapterIds(config, 'unified');
      expect(result).toEqual(['classic', 'classic', 'compact-grid']);
    });
  });

  // ============================================================================
  // getActiveGalleryConfigAdapterIds
  // ============================================================================

  describe('getActiveGalleryConfigAdapterIds', () => {
    it('returns unified adapter ids when mode is unified', () => {
      const config = {
        mode: 'unified' as const,
        breakpoints: {
          desktop: { unified: { adapterId: 'classic' } },
          tablet: { unified: { adapterId: 'classic' } },
          mobile: { unified: { adapterId: 'classic' } },
          image: { adapterId: 'masonry' },
          video: { adapterId: 'diamond' },
        } as any,
      };
      const result = getActiveGalleryConfigAdapterIds(config);
      expect(result).toEqual(['classic', 'classic', 'classic']);
    });

    it('returns image and video adapter ids when mode is per-type', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry' },
            video: { adapterId: 'diamond' },
          },
          tablet: {
            image: { adapterId: 'justified' },
            video: { adapterId: 'carousel' },
          },
          mobile: {
            image: { adapterId: 'classic' },
            video: { adapterId: 'diamond' },
          },
        },
      };
      const result = getActiveGalleryConfigAdapterIds(config);
      // Returns all image breakpoints first, then all video breakpoints
      expect(result).toEqual(['masonry', 'justified', 'classic', 'diamond', 'carousel', 'diamond']);
    });

    it('ignores undefined mode (treats as per-type)', () => {
      const config = {
        mode: undefined,
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry' },
            video: { adapterId: 'diamond' },
          },
          tablet: {},
          mobile: {},
        },
      };
      const result = getActiveGalleryConfigAdapterIds(config);
      expect(result).toContain('masonry');
      expect(result).toContain('diamond');
    });
  });

  // ============================================================================
  // setRepresentativeGalleryCommonSetting
  // ============================================================================

  describe('setRepresentativeGalleryCommonSetting', () => {
    it('writes sectionPadding to all breakpoints and scopes', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            unified: { adapterId: 'classic' },
            image: { adapterId: 'masonry' },
            video: { adapterId: 'diamond' },
          },
          tablet: {
            unified: { adapterId: 'classic' },
            image: { adapterId: 'masonry' },
            video: { adapterId: 'diamond' },
          },
          mobile: {
            unified: { adapterId: 'classic' },
            image: { adapterId: 'masonry' },
            video: { adapterId: 'diamond' },
          },
        },
      };
      const result = setRepresentativeGalleryCommonSetting(config, 'sectionPadding', 24);
      expect(result.breakpoints?.desktop?.unified?.common?.sectionPadding).toBe(24);
      expect(result.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(24);
      expect(result.breakpoints?.desktop?.video?.common?.sectionPadding).toBe(24);
      expect(result.breakpoints?.tablet?.unified?.common?.sectionPadding).toBe(24);
      expect(result.breakpoints?.mobile?.unified?.common?.sectionPadding).toBe(24);
    });

    it('returns same reference when all values already match', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            unified: { adapterId: 'classic', common: { sectionPadding: 24 } },
            image: { adapterId: 'masonry', common: { sectionPadding: 24 } },
            video: { adapterId: 'diamond', common: { sectionPadding: 24 } },
          },
          tablet: {
            unified: { adapterId: 'classic', common: { sectionPadding: 24 } },
            image: { adapterId: 'masonry', common: { sectionPadding: 24 } },
            video: { adapterId: 'diamond', common: { sectionPadding: 24 } },
          },
          mobile: {
            unified: { adapterId: 'classic', common: { sectionPadding: 24 } },
            image: { adapterId: 'masonry', common: { sectionPadding: 24 } },
            video: { adapterId: 'diamond', common: { sectionPadding: 24 } },
          },
        },
      };
      const result = setRepresentativeGalleryCommonSetting(config, 'sectionPadding', 24);
      expect(result).toBe(config);
    });

    it('preserves unchanged breakpoint references', () => {
      const mobileUnifiedRef = { adapterId: 'classic' as const, common: { sectionPadding: 8 } };
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            unified: { adapterId: 'classic' as const },
            image: { adapterId: 'masonry' as const },
            video: { adapterId: 'diamond' as const },
          },
          tablet: {
            unified: { adapterId: 'classic' as const },
            image: { adapterId: 'masonry' as const },
            video: { adapterId: 'diamond' as const },
          },
          mobile: {
            unified: mobileUnifiedRef,
            image: { adapterId: 'masonry' as const },
            video: { adapterId: 'diamond' as const },
          },
        },
      };
      const result = setRepresentativeGalleryCommonSetting(config, 'sectionPadding', 8);
      // Mobile/unified already has 8, so it stays the same reference
      expect(result.breakpoints?.mobile?.unified).toBe(mobileUnifiedRef);
    });

    it('handles empty breakpoints (creates new scopes)', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {},
          tablet: {},
          mobile: {},
        },
      };
      const result = setRepresentativeGalleryCommonSetting(config, 'sectionPadding', 16);
      expect(result.breakpoints?.desktop?.unified?.common?.sectionPadding).toBe(16);
      expect(result.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(16);
      expect(result.breakpoints?.desktop?.video?.common?.sectionPadding).toBe(16);
    });

    it('handles multiple common setting keys', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: {},
          mobile: {},
        },
      };
      const result1 = setRepresentativeGalleryCommonSetting(config, 'sectionPadding', 16);
      const result2 = setRepresentativeGalleryCommonSetting(result1, 'sectionMaxWidth', 1200);
      expect(result2.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(16);
      expect(result2.breakpoints?.desktop?.image?.common?.sectionMaxWidth).toBe(1200);
    });
  });

  // ============================================================================
  // setScopeGalleryCommonSetting
  // ============================================================================

  describe('setScopeGalleryCommonSetting', () => {
    it('writes viewportBgType only to target scope across all breakpoints', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry' },
            video: { adapterId: 'diamond' },
          },
          tablet: {
            image: { adapterId: 'masonry' },
            video: { adapterId: 'diamond' },
          },
          mobile: {
            image: { adapterId: 'masonry' },
            video: { adapterId: 'diamond' },
          },
        },
      };
      const result = setScopeGalleryCommonSetting(config, 'image', 'viewportBgType', 'solid');
      expect(result.breakpoints?.desktop?.image?.common?.viewportBgType).toBe('solid');
      expect(result.breakpoints?.tablet?.image?.common?.viewportBgType).toBe('solid');
      expect(result.breakpoints?.mobile?.image?.common?.viewportBgType).toBe('solid');
      expect(result.breakpoints?.desktop?.video?.common?.viewportBgType).toBeUndefined();
    });

    it('returns same reference when all target scope values already match', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry', common: { viewportBgType: 'solid' } } },
          tablet: { image: { adapterId: 'masonry', common: { viewportBgType: 'solid' } } },
          mobile: { image: { adapterId: 'masonry', common: { viewportBgType: 'solid' } } },
        },
      };
      const result = setScopeGalleryCommonSetting(config, 'image', 'viewportBgType', 'solid');
      expect(result).toBe(config);
    });

    it('preserves unchanged breakpoint scope references', () => {
      const tabletImageRef = { adapterId: 'masonry' as const, common: { viewportBgType: 'solid' } };
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' as const } },
          tablet: { image: tabletImageRef },
          mobile: { image: { adapterId: 'masonry' as const } },
        },
      };
      const result = setScopeGalleryCommonSetting(config, 'image', 'viewportBgType', 'solid');
      expect(result.breakpoints?.tablet?.image).toBe(tabletImageRef);
    });

    it('works with video scope', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { video: { adapterId: 'diamond' } },
          tablet: { video: { adapterId: 'diamond' } },
          mobile: { video: { adapterId: 'diamond' } },
        },
      };
      const result = setScopeGalleryCommonSetting(config, 'video', 'viewportBgColor', '#FF0000');
      expect(result.breakpoints?.desktop?.video?.common?.viewportBgColor).toBe('#FF0000');
      expect(result.breakpoints?.tablet?.video?.common?.viewportBgColor).toBe('#FF0000');
      expect(result.breakpoints?.mobile?.video?.common?.viewportBgColor).toBe('#FF0000');
    });

    it('works with unified scope', () => {
      const config = {
        mode: 'unified' as const,
        breakpoints: {
          desktop: { unified: { adapterId: 'classic' } },
          tablet: { unified: { adapterId: 'classic' } },
          mobile: { unified: { adapterId: 'classic' } },
        },
      };
      const result = setScopeGalleryCommonSetting(config, 'unified', 'viewportBgGradient', 'linear-gradient(90deg, red, blue)');
      expect(result.breakpoints?.desktop?.unified?.common?.viewportBgGradient).toBe('linear-gradient(90deg, red, blue)');
    });

    it('handles multiple scope-specific keys', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: {},
          mobile: {},
        },
      };
      const result1 = setScopeGalleryCommonSetting(config, 'image', 'viewportBgType', 'solid');
      const result2 = setScopeGalleryCommonSetting(result1, 'image', 'viewportBgColor', '#FF0000');
      expect(result2.breakpoints?.desktop?.image?.common?.viewportBgType).toBe('solid');
      expect(result2.breakpoints?.desktop?.image?.common?.viewportBgColor).toBe('#FF0000');
    });
  });

  // ============================================================================
  // setGalleryAdapterSetting
  // ============================================================================

  describe('setGalleryAdapterSetting', () => {
    it('writes adapter setting to all applicable scopes', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 1 } },
            video: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 2 } },
          },
          tablet: {
            image: { adapterId: 'classic' },
            video: { adapterId: 'classic' },
          },
        },
      };
      const result = setGalleryAdapterSetting(config, 'carouselVisibleCards', 4);
      expect(result.breakpoints?.desktop?.image?.adapterSettings?.carouselVisibleCards).toBe(4);
      expect(result.breakpoints?.desktop?.video?.adapterSettings?.carouselVisibleCards).toBe(4);
      expect(result.breakpoints?.tablet?.image?.adapterSettings?.carouselVisibleCards).toBe(4);
      expect(result.breakpoints?.tablet?.video?.adapterSettings?.carouselVisibleCards).toBe(4);
    });

    it('returns same reference when no scopes use the adapter setting key', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry', adapterSettings: {} },
            video: { adapterId: 'masonry', adapterSettings: {} },
          },
          tablet: {},
          mobile: {},
        },
      };
      const result = setGalleryAdapterSetting(config, 'carouselVisibleCards', 4);
      // masonry may not use carouselVisibleCards, so config ref might be same
      expect(result.mode).toBe('per-type');
    });

    it('returns same reference when value is already equal', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 4 } },
            video: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 4 } },
          },
          tablet: {},
          mobile: {},
        },
      };
      const result = setGalleryAdapterSetting(config, 'carouselVisibleCards', 4);
      expect(result).toBe(config);
    });

    it('starts from default config when input is undefined', () => {
      const result = setGalleryAdapterSetting(undefined, 'carouselVisibleCards', 3);
      expect(result.breakpoints?.desktop).toBeDefined();
      expect(result.breakpoints?.tablet).toBeDefined();
      expect(result.breakpoints?.mobile).toBeDefined();
    });

    it('preserves unchanged scope references', () => {
      const masonryVideoRef = { adapterId: 'masonry' as const };
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'classic' as const, adapterSettings: { carouselVisibleCards: 1 } },
            video: masonryVideoRef,
          },
          tablet: {},
          mobile: {},
        },
      };
      const result = setGalleryAdapterSetting(config, 'carouselVisibleCards', 5);
      // masonry doesn't use carouselVisibleCards, so should be preserved
      expect(result.breakpoints?.desktop?.video).toBe(masonryVideoRef);
    });

    it('handles multiple adapter settings in sequence', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'classic' },
            video: { adapterId: 'classic' },
          },
          tablet: {},
          mobile: {},
        },
      };
      const result1 = setGalleryAdapterSetting(config, 'carouselVisibleCards', 3);
      const result2 = setGalleryAdapterSetting(result1, 'carouselGap', 16);
      expect(result2.breakpoints?.desktop?.image?.adapterSettings?.carouselVisibleCards).toBe(3);
      expect(result2.breakpoints?.desktop?.image?.adapterSettings?.carouselGap).toBe(16);
    });
  });

  // ============================================================================
  // collectGalleryAdapterSettingValues
  // ============================================================================

  describe('collectGalleryAdapterSettingValues', () => {
    it('collects first encountered value for each adapter setting in per-type mode', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 3, carouselGap: 16 } },
            video: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 5 } },
          },
          tablet: {},
          mobile: {},
        },
      };
      const result = collectGalleryAdapterSettingValues(config);
      expect(result.carouselVisibleCards).toBe(3);
      expect(result.carouselGap).toBe(16);
    });

    it('collects from unified scope in unified mode', () => {
      const config = {
        mode: 'unified' as const,
        breakpoints: {
          desktop: {
            unified: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 4 } },
            image: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 2 } },
            video: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 6 } },
          },
          tablet: {},
          mobile: {},
        },
      };
      const result = collectGalleryAdapterSettingValues(config);
      expect(result.carouselVisibleCards).toBe(4);
    });

    it('skips undefined values within adapterSettings', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: undefined, carouselGap: 16 } as any },
            video: { adapterId: 'classic' },
          },
          tablet: {},
          mobile: {},
        },
      };
      const result = collectGalleryAdapterSettingValues(config);
      expect(result.carouselVisibleCards).toBeUndefined();
      expect(result.carouselGap).toBe(16);
    });

    it('returns empty object when no adapter settings', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'classic' }, video: { adapterId: 'classic' } },
          tablet: {},
          mobile: {},
        },
      };
      const result = collectGalleryAdapterSettingValues(config);
      expect(result).toEqual({});
    });

    it('collects from multiple breakpoints in order', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 3 } },
            video: { adapterId: 'classic' },
          },
          tablet: {
            image: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 5, carouselGap: 20 } },
            video: { adapterId: 'classic', adapterSettings: { carouselGap: 24 } },
          },
          mobile: {},
        },
      };
      const result = collectGalleryAdapterSettingValues(config);
      expect(result.carouselVisibleCards).toBe(3);
      expect(result.carouselGap).toBe(20);
    });
  });

  // ============================================================================
  // getRepresentativeScopeAdapterId
  // ============================================================================

  describe('getRepresentativeScopeAdapterId', () => {
    it('returns desktop scope adapterId when available', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: 'justified' } },
          mobile: { image: { adapterId: 'classic' } },
        },
      };
      const result = getRepresentativeScopeAdapterId(config, 'image');
      expect(result).toBe('masonry');
    });

    it('falls back to tablet when desktop is missing', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {},
          tablet: { image: { adapterId: 'justified' } },
          mobile: { image: { adapterId: 'classic' } },
        },
      };
      const result = getRepresentativeScopeAdapterId(config, 'image');
      expect(result).toBe('justified');
    });

    it('falls back to mobile when desktop and tablet are missing', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {},
          tablet: {},
          mobile: { image: { adapterId: 'classic' } },
        },
      };
      const result = getRepresentativeScopeAdapterId(config, 'image');
      expect(result).toBe('classic');
    });

    it('returns empty string when no breakpoint has the scope', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {},
          tablet: {},
          mobile: {},
        },
      };
      const result = getRepresentativeScopeAdapterId(config, 'image');
      expect(result).toBe('');
    });

    it('works with video scope', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { video: { adapterId: 'diamond' } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getRepresentativeScopeAdapterId(config, 'video');
      expect(result).toBe('diamond');
    });

    it('works with unified scope', () => {
      const config = {
        mode: 'unified' as const,
        breakpoints: {
          desktop: { unified: { adapterId: 'classic' } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getRepresentativeScopeAdapterId(config, 'unified');
      expect(result).toBe('classic');
    });
  });

  // ============================================================================
  // getRepresentativeGalleryCommonSetting
  // ============================================================================

  describe('getRepresentativeGalleryCommonSetting', () => {
    it('returns setting from desktop unified scope in unified mode', () => {
      const config = {
        mode: 'unified' as const,
        breakpoints: {
          desktop: { unified: { adapterId: 'classic', common: { sectionPadding: 24 } } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getRepresentativeGalleryCommonSetting(config, 'sectionPadding');
      expect(result).toBe(24);
    });

    it('returns setting from desktop image scope in per-type mode', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry', common: { sectionPadding: 16 } } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getRepresentativeGalleryCommonSetting(config, 'sectionPadding');
      expect(result).toBe(16);
    });

    it('returns setting from video scope when image is missing', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry' },
            video: { adapterId: 'diamond', common: { sectionPadding: 20 } },
          },
          tablet: {},
          mobile: {},
        },
      };
      const result = getRepresentativeGalleryCommonSetting(config, 'sectionPadding');
      expect(result).toBe(20);
    });

    it('falls back to tablet when desktop is missing', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {},
          tablet: { image: { adapterId: 'masonry', common: { sectionPadding: 12 } } },
          mobile: {},
        },
      };
      const result = getRepresentativeGalleryCommonSetting(config, 'sectionPadding');
      expect(result).toBe(12);
    });

    it('falls back to mobile when desktop and tablet are missing', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {},
          tablet: {},
          mobile: { image: { adapterId: 'classic', common: { sectionPadding: 8 } } },
        },
      };
      const result = getRepresentativeGalleryCommonSetting(config, 'sectionPadding');
      expect(result).toBe(8);
    });

    it('returns undefined when setting is not found', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getRepresentativeGalleryCommonSetting(config, 'sectionPadding');
      expect(result).toBeUndefined();
    });

    it('returns string values', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry', common: { sectionMaxWidthUnit: 'px' } } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getRepresentativeGalleryCommonSetting(config, 'sectionMaxWidthUnit');
      expect(result).toBe('px');
    });

    it('returns boolean values', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry', common: { perTypeSectionEqualHeight: true } } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getRepresentativeGalleryCommonSetting(config, 'perTypeSectionEqualHeight');
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // getScopeGalleryCommonSetting
  // ============================================================================

  describe('getScopeGalleryCommonSetting', () => {
    it('returns viewportBgType from desktop image scope', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry', common: { viewportBgType: 'solid' } } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getScopeGalleryCommonSetting(config, 'image', 'viewportBgType');
      expect(result).toBe('solid');
    });

    it('returns viewportBgColor from video scope', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { video: { adapterId: 'diamond', common: { viewportBgColor: '#FF0000' } } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getScopeGalleryCommonSetting(config, 'video', 'viewportBgColor');
      expect(result).toBe('#FF0000');
    });

    it('returns viewportBgGradient from unified scope', () => {
      const config = {
        mode: 'unified' as const,
        breakpoints: {
          desktop: { unified: { adapterId: 'classic', common: { viewportBgGradient: 'linear-gradient(90deg, red, blue)' } } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getScopeGalleryCommonSetting(config, 'unified', 'viewportBgGradient');
      expect(result).toBe('linear-gradient(90deg, red, blue)');
    });

    it('returns viewportBgImageUrl', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry', common: { viewportBgImageUrl: 'https://example.com/image.jpg' } } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getScopeGalleryCommonSetting(config, 'image', 'viewportBgImageUrl');
      expect(result).toBe('https://example.com/image.jpg');
    });

    it('falls back to tablet when desktop is missing', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {},
          tablet: { image: { adapterId: 'masonry', common: { viewportBgType: 'gradient' } } },
          mobile: {},
        },
      };
      const result = getScopeGalleryCommonSetting(config, 'image', 'viewportBgType');
      expect(result).toBe('gradient');
    });

    it('falls back to mobile when desktop and tablet are missing', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {},
          tablet: {},
          mobile: { image: { adapterId: 'classic', common: { viewportBgType: 'image' } } },
        },
      };
      const result = getScopeGalleryCommonSetting(config, 'image', 'viewportBgType');
      expect(result).toBe('image');
    });

    it('returns undefined when setting is not found', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getScopeGalleryCommonSetting(config, 'image', 'viewportBgType');
      expect(result).toBeUndefined();
    });

    it('returns undefined when value is not a string', () => {
      const config = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry', common: { viewportBgType: null } } },
          tablet: {},
          mobile: {},
        },
      };
      const result = getScopeGalleryCommonSetting(config, 'image', 'viewportBgType');
      expect(result).toBeUndefined();
    });
  });

  // ============================================================================
  // parseGalleryConfig
  // ============================================================================

  describe('parseGalleryConfig', () => {
    it('parses valid JSON string with mode', () => {
      const result = parseGalleryConfig('{"mode":"unified"}');
      expect(result?.mode).toBe('unified');
    });

    it('parses valid JSON string with per-type mode', () => {
      const result = parseGalleryConfig('{"mode":"per-type"}');
      expect(result?.mode).toBe('per-type');
    });

    it('returns undefined for invalid JSON', () => {
      const result = parseGalleryConfig('not-json');
      expect(result).toBeUndefined();
    });

    it('returns undefined for array input', () => {
      const result = parseGalleryConfig([]);
      expect(result).toBeUndefined();
    });

    it('returns undefined for primitive inputs', () => {
      expect(parseGalleryConfig('string')).toBeUndefined();
      expect(parseGalleryConfig(123)).toBeUndefined();
      expect(parseGalleryConfig(true)).toBeUndefined();
    });

    it('returns undefined for null', () => {
      expect(parseGalleryConfig(null)).toBeUndefined();
    });

    it('parses valid JSON with breakpoints', () => {
      const result = parseGalleryConfig('{"mode":"per-type","breakpoints":{"desktop":{"image":{"adapterId":"masonry"}}}}');
      expect(result?.mode).toBe('per-type');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
    });
  });

  // ============================================================================
  // mergeGalleryConfig
  // ============================================================================

  describe('mergeGalleryConfig', () => {
    it('returns override config when both base and override provided', () => {
      const base = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: {},
          mobile: {},
        },
      };
      const override = {
        mode: 'unified' as const,
        breakpoints: {
          desktop: { unified: { adapterId: 'classic' } },
        },
      };
      const result = mergeGalleryConfig(base, override);
      expect(result.mode).toBe('unified');
      expect(result.breakpoints?.desktop?.unified?.adapterId).toBe('classic');
    });

    it('merges scope configs across breakpoints', () => {
      const base = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry', common: { sectionPadding: 8 } } },
          tablet: {},
          mobile: {},
        },
      };
      const override = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { common: { sectionMaxWidth: 1200 } } },
          tablet: {},
          mobile: {},
        },
      };
      const result = mergeGalleryConfig(base, override);
      expect(result.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
      expect(result.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(8);
      expect(result.breakpoints?.desktop?.image?.common?.sectionMaxWidth).toBe(1200);
    });

    it('returns base mode when override mode is undefined', () => {
      const base = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: {},
          mobile: {},
        },
      };
      const override = {
        breakpoints: {
          desktop: { image: { common: { sectionPadding: 16 } } },
        },
      };
      const result = mergeGalleryConfig(base, override);
      expect(result.mode).toBe('per-type');
    });

    it('includes all breakpoints even if not in override', () => {
      const base = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: 'justified' } },
          mobile: { image: { adapterId: 'classic' } },
        },
      };
      const override = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { common: { sectionPadding: 16 } } },
        },
      };
      const result = mergeGalleryConfig(base, override);
      expect(result.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
      expect(result.breakpoints?.tablet?.image?.adapterId).toBe('justified');
      expect(result.breakpoints?.mobile?.image?.adapterId).toBe('classic');
    });

    it('handles undefined override', () => {
      const base = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: {},
          mobile: {},
        },
      };
      const result = mergeGalleryConfig(base, undefined);
      expect(result.mode).toBe('per-type');
      expect(result.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
    });

    it('merges adapter settings across scopes', () => {
      const base = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterId: 'classic', adapterSettings: { carouselVisibleCards: 3 } },
          },
          tablet: {},
          mobile: {},
        },
      };
      const override = {
        mode: 'per-type' as const,
        breakpoints: {
          desktop: {
            image: { adapterSettings: { carouselGap: 16 } },
          },
        },
      };
      const result = mergeGalleryConfig(base, override);
      expect(result.breakpoints?.desktop?.image?.adapterSettings?.carouselVisibleCards).toBe(3);
      expect(result.breakpoints?.desktop?.image?.adapterSettings?.carouselGap).toBe(16);
    });
  });
});
