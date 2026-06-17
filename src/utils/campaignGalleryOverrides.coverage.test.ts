import { describe, it, expect } from 'vitest';
import {
  buildCampaignGalleryOverrideEditorValue,
  clearCampaignGalleryOverrides,
  describeCampaignGalleryOverrides,
  getCampaignGalleryOverrideMode,
  getUniformCampaignScopeAdapterId,
  hasCampaignGalleryOverrides,
  hasCampaignScopeOverrides,
  hasMixedCampaignScopeAdapterOverrides,
  syncCampaignGalleryOverrideMode,
  syncCampaignScopeAdapterOverride,
  setCampaignBreakpointScopeAdapterOverride,
} from './campaignGalleryOverrides';

/**
 * Comprehensive coverage tests for campaignGalleryOverrides.ts
 * Tests all exported functions with boundary conditions, edge cases, and branch coverage.
 */

describe('campaignGalleryOverrides.coverage', () => {
  // ============================================================================
  // getUniformCampaignScopeAdapterId
  // ============================================================================

  describe('getUniformCampaignScopeAdapterId', () => {
    it('returns adapterId when all breakpoints have identical non-empty adapterId', () => {
      const result = getUniformCampaignScopeAdapterId({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: 'masonry' } },
          mobile: { image: { adapterId: 'masonry' } },
        },
      }, 'image');
      expect(result).toBe('masonry');
    });

    it('returns empty string when breakpoints have different adapterIds', () => {
      const result = getUniformCampaignScopeAdapterId({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: 'justified' } },
          mobile: { image: { adapterId: 'masonry' } },
        },
      }, 'image');
      expect(result).toBe('');
    });

    it('returns empty string when any breakpoint lacks adapterId', () => {
      const result = getUniformCampaignScopeAdapterId({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: {} },
          mobile: { image: { adapterId: 'masonry' } },
        },
      }, 'image');
      expect(result).toBe('');
    });

    it('returns empty string when scope config is missing', () => {
      const result = getUniformCampaignScopeAdapterId({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: {},
          mobile: { image: { adapterId: 'masonry' } },
        },
      }, 'image');
      expect(result).toBe('');
    });

    it('returns empty string when breakpoints are missing', () => {
      const result = getUniformCampaignScopeAdapterId({}, 'image');
      expect(result).toBe('');
    });

    it('returns empty string when overrides is undefined', () => {
      const result = getUniformCampaignScopeAdapterId(undefined, 'image');
      expect(result).toBe('');
    });

    it('handles empty string adapterId as missing', () => {
      const result = getUniformCampaignScopeAdapterId({
        breakpoints: {
          desktop: { image: { adapterId: '' } },
          tablet: { image: { adapterId: '' } },
          mobile: { image: { adapterId: '' } },
        },
      }, 'image');
      expect(result).toBe('');
    });

    it('handles different scope names (video, unified)', () => {
      expect(getUniformCampaignScopeAdapterId({
        breakpoints: {
          desktop: { video: { adapterId: 'diamond' } },
          tablet: { video: { adapterId: 'diamond' } },
          mobile: { video: { adapterId: 'diamond' } },
        },
      }, 'video')).toBe('diamond');

      expect(getUniformCampaignScopeAdapterId({
        breakpoints: {
          desktop: { unified: { adapterId: 'classic' } },
          tablet: { unified: { adapterId: 'classic' } },
          mobile: { unified: { adapterId: 'classic' } },
        },
      }, 'unified')).toBe('classic');
    });
  });

  // ============================================================================
  // hasMixedCampaignScopeAdapterOverrides
  // ============================================================================

  describe('hasMixedCampaignScopeAdapterOverrides', () => {
    it('returns true when breakpoints have different non-empty adapterIds', () => {
      const result = hasMixedCampaignScopeAdapterOverrides({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: 'justified' } },
          mobile: { image: { adapterId: 'diamond' } },
        },
      }, 'image');
      expect(result).toBe(true);
    });

    it('returns false when all breakpoints have uniform adapterId', () => {
      const result = hasMixedCampaignScopeAdapterOverrides({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: 'masonry' } },
          mobile: { image: { adapterId: 'masonry' } },
        },
      }, 'image');
      expect(result).toBe(false);
    });

    it('returns false when no breakpoints have adapterId', () => {
      const result = hasMixedCampaignScopeAdapterOverrides({
        breakpoints: {
          desktop: { image: {} },
          tablet: { image: {} },
          mobile: { image: {} },
        },
      }, 'image');
      expect(result).toBe(false);
    });

    it('returns false when overrides is undefined', () => {
      const result = hasMixedCampaignScopeAdapterOverrides(undefined, 'image');
      expect(result).toBe(false);
    });

    it('returns true for mix with partial coverage', () => {
      const result = hasMixedCampaignScopeAdapterOverrides({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: 'masonry' } },
          mobile: { image: {} },
        },
      }, 'image');
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // getCampaignGalleryOverrideMode
  // ============================================================================

  describe('getCampaignGalleryOverrideMode', () => {
    it('returns mode when set to unified', () => {
      const result = getCampaignGalleryOverrideMode({ mode: 'unified' });
      expect(result).toBe('unified');
    });

    it('returns mode when set to per-type', () => {
      const result = getCampaignGalleryOverrideMode({ mode: 'per-type' });
      expect(result).toBe('per-type');
    });

    it('returns empty string when mode is undefined', () => {
      const result = getCampaignGalleryOverrideMode({});
      expect(result).toBe('');
    });

    it('returns empty string when overrides is undefined', () => {
      const result = getCampaignGalleryOverrideMode(undefined);
      expect(result).toBe('');
    });

    it('returns empty string for invalid mode (handled at type level, but test current behavior)', () => {
      const result = getCampaignGalleryOverrideMode({ mode: 'invalid' } as any);
      expect(result).toBe('');
    });
  });

  // ============================================================================
  // hasCampaignScopeOverrides
  // ============================================================================

  describe('hasCampaignScopeOverrides', () => {
    it('returns true when scope has non-empty adapterId', () => {
      const result = hasCampaignScopeOverrides({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: {} },
          mobile: { image: {} },
        },
      }, 'image');
      expect(result).toBe(true);
    });

    it('returns true when scope has common settings', () => {
      const result = hasCampaignScopeOverrides({
        breakpoints: {
          desktop: { image: { common: { sectionPadding: 24 } } },
          tablet: { image: {} },
          mobile: { image: {} },
        },
      }, 'image');
      expect(result).toBe(true);
    });

    it('returns true when scope has adapterSettings', () => {
      const result = hasCampaignScopeOverrides({
        breakpoints: {
          desktop: { image: { adapterSettings: { carouselVisibleCards: 3 } } },
          tablet: { image: {} },
          mobile: { image: {} },
        },
      }, 'image');
      expect(result).toBe(true);
    });

    it('returns false when scope is completely empty', () => {
      const result = hasCampaignScopeOverrides({
        breakpoints: {
          desktop: { image: {} },
          tablet: { image: {} },
          mobile: { image: {} },
        },
      }, 'image');
      expect(result).toBe(false);
    });

    it('returns false when scope is undefined on all breakpoints', () => {
      const result = hasCampaignScopeOverrides({
        breakpoints: {
          desktop: {},
          tablet: {},
          mobile: {},
        },
      }, 'image');
      expect(result).toBe(false);
    });

    it('returns false when breakpoints are undefined', () => {
      const result = hasCampaignScopeOverrides({}, 'image');
      expect(result).toBe(false);
    });

    it('returns false when overrides is undefined', () => {
      const result = hasCampaignScopeOverrides(undefined, 'image');
      expect(result).toBe(false);
    });

    it('returns true for video and unified scopes', () => {
      expect(hasCampaignScopeOverrides({
        breakpoints: {
          desktop: { video: { adapterId: 'diamond' } },
          tablet: { video: {} },
          mobile: { video: {} },
        },
      }, 'video')).toBe(true);

      expect(hasCampaignScopeOverrides({
        breakpoints: {
          desktop: { unified: { adapterId: 'classic' } },
          tablet: { unified: {} },
          mobile: { unified: {} },
        },
      }, 'unified')).toBe(true);
    });

    it('returns true when only some breakpoints have overrides', () => {
      const result = hasCampaignScopeOverrides({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: {},
          mobile: {},
        },
      }, 'image');
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // buildCampaignGalleryOverrideEditorValue
  // ============================================================================

  describe('buildCampaignGalleryOverrideEditorValue', () => {
    it('returns undefined when galleryOverrides is undefined', () => {
      const result = buildCampaignGalleryOverrideEditorValue({});
      expect(result).toBeUndefined();
    });

    it('returns undefined when galleryOverrides has no meaningful content', () => {
      const result = buildCampaignGalleryOverrideEditorValue({
        galleryOverrides: {
          breakpoints: {
            desktop: { image: {} },
            tablet: {},
            mobile: {},
          },
        },
      });
      expect(result).toBeUndefined();
    });

    it('prunes empty scopes from breakpoints', () => {
      const result = buildCampaignGalleryOverrideEditorValue({
        galleryOverrides: {
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: { adapterId: 'masonry' },
              video: {},
            },
            tablet: {},
            mobile: {},
          },
        },
      });
      expect(result?.mode).toBe('per-type');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
      expect(result?.breakpoints?.desktop?.video).toBeUndefined();
    });

    it('prunes empty breakpoints', () => {
      const result = buildCampaignGalleryOverrideEditorValue({
        galleryOverrides: {
          mode: 'unified',
          breakpoints: {
            desktop: { unified: { adapterId: 'classic' } },
            tablet: {},
            mobile: {},
          },
        },
      });
      expect(result?.breakpoints?.desktop?.unified?.adapterId).toBe('classic');
      expect(result?.breakpoints?.tablet).toBeUndefined();
      expect(result?.breakpoints?.mobile).toBeUndefined();
    });

    it('keeps mode when present even without breakpoint overrides', () => {
      const result = buildCampaignGalleryOverrideEditorValue({
        galleryOverrides: {
          mode: 'per-type',
        },
      });
      expect(result?.mode).toBe('per-type');
    });
  });

  // ============================================================================
  // clearCampaignGalleryOverrides
  // ============================================================================

  describe('clearCampaignGalleryOverrides', () => {
    it('returns object with galleryOverrides set to undefined', () => {
      const result = clearCampaignGalleryOverrides();
      expect(result).toEqual({ galleryOverrides: undefined });
      expect(result.galleryOverrides).toBeUndefined();
    });
  });

  // ============================================================================
  // syncCampaignScopeAdapterOverride
  // ============================================================================

  describe('syncCampaignScopeAdapterOverride', () => {
    it('sets adapterId across all breakpoints when provided', () => {
      const result = syncCampaignScopeAdapterOverride({
        mode: 'per-type',
      }, 'image', 'masonry');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
      expect(result?.breakpoints?.tablet?.image?.adapterId).toBe('masonry');
      expect(result?.breakpoints?.mobile?.image?.adapterId).toBe('masonry');
    });

    it('preserves existing scope settings while setting adapterId', () => {
      const result = syncCampaignScopeAdapterOverride({
        breakpoints: {
          desktop: { image: { common: { sectionPadding: 24 } } },
          tablet: {},
          mobile: {},
        },
      }, 'image', 'masonry');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
      expect(result?.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(24);
    });

    it('removes adapterId when empty string provided', () => {
      const result = syncCampaignScopeAdapterOverride({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry', common: { sectionPadding: 24 } } },
          tablet: { image: { adapterId: 'masonry' } },
          mobile: { image: { adapterId: 'masonry' } },
        },
      }, 'image', '');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBeUndefined();
      expect(result?.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(24);
      // Empty scope with only adapterId should be pruned
      expect(result?.breakpoints?.tablet?.image).toBeUndefined();
    });

    it('clears entire breakpoint when it becomes empty after removing adapterId', () => {
      const result = syncCampaignScopeAdapterOverride({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: 'masonry' } },
          mobile: { image: { adapterId: 'masonry' } },
        },
      }, 'image', '');
      expect(result).toBeUndefined();
    });

    it('preserves mode when clearing adapterId', () => {
      const result = syncCampaignScopeAdapterOverride({
        mode: 'per-type',
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: {},
          mobile: {},
        },
      }, 'image', '');
      expect(result?.mode).toBe('per-type');
    });

    it('handles undefined initial overrides', () => {
      const result = syncCampaignScopeAdapterOverride(undefined, 'image', 'masonry');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
      expect(result?.breakpoints?.tablet?.image?.adapterId).toBe('masonry');
      expect(result?.breakpoints?.mobile?.image?.adapterId).toBe('masonry');
    });

    it('works with video scope', () => {
      const result = syncCampaignScopeAdapterOverride(
        { mode: 'per-type' },
        'video',
        'diamond'
      );
      expect(result?.breakpoints?.desktop?.video?.adapterId).toBe('diamond');
      expect(result?.breakpoints?.tablet?.video?.adapterId).toBe('diamond');
      expect(result?.breakpoints?.mobile?.video?.adapterId).toBe('diamond');
    });

    it('works with unified scope', () => {
      const result = syncCampaignScopeAdapterOverride(
        { mode: 'unified' },
        'unified',
        'classic'
      );
      expect(result?.breakpoints?.desktop?.unified?.adapterId).toBe('classic');
      expect(result?.breakpoints?.tablet?.unified?.adapterId).toBe('classic');
      expect(result?.breakpoints?.mobile?.unified?.adapterId).toBe('classic');
    });

    it('preserves unrelated scope configs', () => {
      const result = syncCampaignScopeAdapterOverride({
        breakpoints: {
          desktop: { video: { adapterId: 'diamond' } },
          tablet: {},
          mobile: {},
        },
      }, 'image', 'masonry');
      expect(result?.breakpoints?.desktop?.video?.adapterId).toBe('diamond');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
    });
  });

  // ============================================================================
  // setCampaignBreakpointScopeAdapterOverride
  // ============================================================================

  describe('setCampaignBreakpointScopeAdapterOverride', () => {
    it('sets adapterId for specific breakpoint and scope', () => {
      const result = setCampaignBreakpointScopeAdapterOverride(
        { mode: 'per-type' },
        'desktop',
        'image',
        'masonry'
      );
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
      expect(result?.breakpoints?.tablet).toBeUndefined();
    });

    it('preserves existing settings when setting adapterId', () => {
      const result = setCampaignBreakpointScopeAdapterOverride({
        breakpoints: {
          desktop: { image: { common: { sectionPadding: 24 } } },
        },
      }, 'desktop', 'image', 'masonry');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
      expect(result?.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(24);
    });

    it('removes adapterId when empty string provided', () => {
      const result = setCampaignBreakpointScopeAdapterOverride({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry', common: { sectionPadding: 24 } } },
        },
      }, 'desktop', 'image', '');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBeUndefined();
      expect(result?.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(24);
    });

    it('removes scope entirely when it becomes empty after removing adapterId', () => {
      const result = setCampaignBreakpointScopeAdapterOverride({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
        },
      }, 'desktop', 'image', '');
      expect(result?.breakpoints?.desktop?.image).toBeUndefined();
    });

    it('preserves other scopes in the same breakpoint', () => {
      const result = setCampaignBreakpointScopeAdapterOverride({
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry' },
            video: { adapterId: 'diamond' },
          },
        },
      }, 'desktop', 'image', 'justified');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBe('justified');
      expect(result?.breakpoints?.desktop?.video?.adapterId).toBe('diamond');
    });

    it('handles all breakpoint types', () => {
      expect(setCampaignBreakpointScopeAdapterOverride(
        {},
        'desktop',
        'image',
        'masonry'
      )?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');

      expect(setCampaignBreakpointScopeAdapterOverride(
        {},
        'tablet',
        'image',
        'justified'
      )?.breakpoints?.tablet?.image?.adapterId).toBe('justified');

      expect(setCampaignBreakpointScopeAdapterOverride(
        {},
        'mobile',
        'image',
        'classic'
      )?.breakpoints?.mobile?.image?.adapterId).toBe('classic');
    });

    it('handles all scope types', () => {
      expect(setCampaignBreakpointScopeAdapterOverride(
        {},
        'desktop',
        'image',
        'masonry'
      )?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');

      expect(setCampaignBreakpointScopeAdapterOverride(
        {},
        'desktop',
        'video',
        'diamond'
      )?.breakpoints?.desktop?.video?.adapterId).toBe('diamond');

      expect(setCampaignBreakpointScopeAdapterOverride(
        {},
        'desktop',
        'unified',
        'classic'
      )?.breakpoints?.desktop?.unified?.adapterId).toBe('classic');
    });

    it('handles undefined initial overrides', () => {
      const result = setCampaignBreakpointScopeAdapterOverride(
        undefined,
        'desktop',
        'image',
        'masonry'
      );
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
    });

    it('removes scope entirely from breakpoint when it has only adapterId and none remains', () => {
      const result = setCampaignBreakpointScopeAdapterOverride({
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
        },
      }, 'desktop', 'image', '');
      expect(result?.breakpoints?.desktop?.image).toBeUndefined();
    });

    it('removes adapterId but keeps scope config when other properties exist', () => {
      const result = setCampaignBreakpointScopeAdapterOverride({
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'masonry',
              common: { sectionPadding: 24 },
              adapterSettings: { carouselVisibleCards: 3 },
            },
          },
        },
      }, 'desktop', 'image', '');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBeUndefined();
      expect(result?.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(24);
      expect(result?.breakpoints?.desktop?.image?.adapterSettings?.carouselVisibleCards).toBe(3);
    });
  });

  // ============================================================================
  // syncCampaignGalleryOverrideMode
  // ============================================================================

  describe('syncCampaignGalleryOverrideMode', () => {
    it('sets mode to unified', () => {
      const result = syncCampaignGalleryOverrideMode(
        { breakpoints: { desktop: { image: { adapterId: 'masonry' } } } },
        'unified'
      );
      expect(result?.mode).toBe('unified');
    });

    it('sets mode to per-type', () => {
      const result = syncCampaignGalleryOverrideMode(
        { breakpoints: { desktop: { unified: { adapterId: 'classic' } } } },
        'per-type'
      );
      expect(result?.mode).toBe('per-type');
    });

    it('clears mode when empty string provided', () => {
      const result = syncCampaignGalleryOverrideMode(
        { mode: 'unified', breakpoints: { desktop: { unified: { adapterId: 'classic' } } } },
        ''
      );
      expect(result?.mode).toBeUndefined();
      expect(result?.breakpoints?.desktop?.unified?.adapterId).toBe('classic');
    });

    it('returns undefined when everything is cleared', () => {
      const result = syncCampaignGalleryOverrideMode({ mode: 'unified' }, '');
      expect(result).toBeUndefined();
    });

    it('preserves breakpoint overrides when setting mode', () => {
      const result = syncCampaignGalleryOverrideMode(
        { breakpoints: { desktop: { image: { adapterId: 'masonry' } } } },
        'per-type'
      );
      expect(result?.mode).toBe('per-type');
      expect(result?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
    });

    it('handles undefined initial overrides', () => {
      const result = syncCampaignGalleryOverrideMode(undefined, 'unified');
      expect(result?.mode).toBe('unified');
    });
  });

  // ============================================================================
  // hasCampaignGalleryOverrides
  // ============================================================================

  describe('hasCampaignGalleryOverrides', () => {
    it('returns true when mode is set', () => {
      const result = hasCampaignGalleryOverrides({ galleryOverrides: { mode: 'unified' } });
      expect(result).toBe(true);
    });

    it('returns true when image scope has overrides', () => {
      const result = hasCampaignGalleryOverrides({
        galleryOverrides: {
          breakpoints: {
            desktop: { image: { adapterId: 'masonry' } },
            tablet: {},
            mobile: {},
          },
        },
      });
      expect(result).toBe(true);
    });

    it('returns true when video scope has overrides', () => {
      const result = hasCampaignGalleryOverrides({
        galleryOverrides: {
          breakpoints: {
            desktop: { video: { adapterId: 'diamond' } },
            tablet: {},
            mobile: {},
          },
        },
      });
      expect(result).toBe(true);
    });

    it('returns true when unified scope has overrides', () => {
      const result = hasCampaignGalleryOverrides({
        galleryOverrides: {
          breakpoints: {
            desktop: { unified: { adapterId: 'classic' } },
            tablet: {},
            mobile: {},
          },
        },
      });
      expect(result).toBe(true);
    });

    it('returns true when responsive settings are overridden', () => {
      const result = hasCampaignGalleryOverrides({
        galleryOverrides: {
          breakpoints: {
            desktop: { image: { common: { sectionPadding: 24 } } },
            tablet: {},
            mobile: {},
          },
        },
      });
      expect(result).toBe(true);
    });

    it('returns false when there are no overrides', () => {
      const result = hasCampaignGalleryOverrides({});
      expect(result).toBe(false);
    });

    it('returns false when galleryOverrides is undefined', () => {
      const result = hasCampaignGalleryOverrides({ galleryOverrides: undefined });
      expect(result).toBe(false);
    });

    it('returns false when all structures are empty', () => {
      const result = hasCampaignGalleryOverrides({
        galleryOverrides: {
          breakpoints: {
            desktop: { image: {}, video: {}, unified: {} },
            tablet: { image: {}, video: {}, unified: {} },
            mobile: { image: {}, video: {}, unified: {} },
          },
        },
      });
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // describeCampaignGalleryOverrides
  // ============================================================================

  describe('describeCampaignGalleryOverrides', () => {
    it('describes uniform image adapter override', () => {
      const result = describeCampaignGalleryOverrides({
        galleryOverrides: {
          breakpoints: {
            desktop: { image: { adapterId: 'masonry' } },
            tablet: { image: { adapterId: 'masonry' } },
            mobile: { image: { adapterId: 'masonry' } },
          },
        },
      });
      expect(result).toContain('Image: masonry');
    });

    it('describes uniform video adapter override', () => {
      const result = describeCampaignGalleryOverrides({
        galleryOverrides: {
          breakpoints: {
            desktop: { video: { adapterId: 'diamond' } },
            tablet: { video: { adapterId: 'diamond' } },
            mobile: { video: { adapterId: 'diamond' } },
          },
        },
      });
      expect(result).toContain('Video: diamond');
    });

    it('describes breakpoint-specific image overrides', () => {
      const result = describeCampaignGalleryOverrides({
        galleryOverrides: {
          breakpoints: {
            desktop: { image: { adapterId: 'masonry' } },
            tablet: { image: { adapterId: 'justified' } },
            mobile: { image: {} },
          },
        },
      });
      expect(result).toContain('Image: breakpoint-specific override');
    });

    it('describes breakpoint-specific video overrides', () => {
      const result = describeCampaignGalleryOverrides({
        galleryOverrides: {
          breakpoints: {
            desktop: { video: { adapterId: 'diamond' } },
            tablet: { video: { adapterId: 'masonry' } },
            mobile: { video: {} },
          },
        },
      });
      expect(result).toContain('Video: breakpoint-specific override');
    });

    it('describes unified mode overrides with uniform adapter', () => {
      const result = describeCampaignGalleryOverrides({
        galleryOverrides: {
          mode: 'unified',
          breakpoints: {
            desktop: { unified: { adapterId: 'classic' } },
            tablet: { unified: { adapterId: 'classic' } },
            mobile: { unified: { adapterId: 'classic' } },
          },
        },
      });
      expect(result).toContain('Unified: classic');
      expect(result).toContain('Mode: unified');
    });

    it('describes unified mode with breakpoint-specific overrides', () => {
      const result = describeCampaignGalleryOverrides({
        galleryOverrides: {
          mode: 'unified',
          breakpoints: {
            desktop: { unified: { adapterId: 'classic' } },
            tablet: { unified: { adapterId: 'compact-grid' } },
            mobile: { unified: {} },
          },
        },
      });
      expect(result).toContain('Unified: breakpoint-specific override');
      expect(result).toContain('Mode: unified');
    });

    it('describes responsive setting overrides', () => {
      const result = describeCampaignGalleryOverrides({
        galleryOverrides: {
          breakpoints: {
            desktop: { image: { common: { sectionPadding: 24 } } },
            tablet: {},
            mobile: {},
          },
        },
      });
      expect(result).toContain('Responsive settings: customized');
    });

    it('describes per-type mode', () => {
      const result = describeCampaignGalleryOverrides({
        galleryOverrides: {
          mode: 'per-type',
          breakpoints: {
            desktop: { image: { adapterId: 'masonry' } },
            tablet: {},
            mobile: {},
          },
        },
      });
      expect(result).toContain('Mode: per-type');
    });

    it('returns empty array when no overrides', () => {
      const result = describeCampaignGalleryOverrides({});
      expect(result).toEqual([]);
    });

    it('handles combinations of image and video overrides', () => {
      const result = describeCampaignGalleryOverrides({
        galleryOverrides: {
          mode: 'per-type',
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
        },
      });
      expect(result).toContain('Image: masonry');
      expect(result).toContain('Video: diamond');
      expect(result).toContain('Mode: per-type');
    });

    it('handles mixed responsive settings with image and video', () => {
      const result = describeCampaignGalleryOverrides({
        galleryOverrides: {
          breakpoints: {
            desktop: {
              image: { adapterId: 'masonry', common: { sectionPadding: 24 } },
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
        },
      });
      expect(result).toContain('Image: masonry');
      expect(result).toContain('Video: diamond');
      expect(result).toContain('Responsive settings: customized');
    });

    it('handles unified mode without adapter overrides', () => {
      const result = describeCampaignGalleryOverrides({
        galleryOverrides: {
          mode: 'unified',
        },
      });
      expect(result).toContain('Mode: unified');
      expect(result.length).toBe(1);
    });
  });
});
