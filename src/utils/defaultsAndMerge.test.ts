import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LAYOUT_SLOT,
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryBehaviorSettings,
  type GalleryConfig,
  type LayoutSlot,
} from '@/types';
import { mergeSettingsWithDefaults } from './mergeSettingsWithDefaults';

// ═══════════════════════════════════════════════════════════════
// DEFAULT_LAYOUT_SLOT
// ═══════════════════════════════════════════════════════════════

describe('DEFAULT_LAYOUT_SLOT', () => {
  it('has all required LayoutSlot fields', () => {
    const requiredKeys: (keyof LayoutSlot)[] = [
      'id', 'x', 'y', 'width', 'height', 'zIndex',
      'shape', 'borderRadius', 'borderWidth', 'borderColor',
      'objectFit', 'objectPosition', 'clickAction', 'hoverEffect',
    ];
    for (const key of requiredKeys) {
      expect(DEFAULT_LAYOUT_SLOT).toHaveProperty(key);
    }
  });

  it('positions at origin with 25×25 default size', () => {
    expect(DEFAULT_LAYOUT_SLOT.x).toBe(0);
    expect(DEFAULT_LAYOUT_SLOT.y).toBe(0);
    expect(DEFAULT_LAYOUT_SLOT.width).toBe(25);
    expect(DEFAULT_LAYOUT_SLOT.height).toBe(25);
  });

  it('uses rectangle shape with cover fit', () => {
    expect(DEFAULT_LAYOUT_SLOT.shape).toBe('rectangle');
    expect(DEFAULT_LAYOUT_SLOT.objectFit).toBe('cover');
  });

  it('has centered object position', () => {
    expect(DEFAULT_LAYOUT_SLOT.objectPosition).toBe('50% 50%');
  });

  it('defaults to lightbox click and pop hover', () => {
    expect(DEFAULT_LAYOUT_SLOT.clickAction).toBe('lightbox');
    expect(DEFAULT_LAYOUT_SLOT.hoverEffect).toBe('pop');
  });
});

// ═══════════════════════════════════════════════════════════════
// DEFAULT_GALLERY_BEHAVIOR_SETTINGS – nested gallery config
// ═══════════════════════════════════════════════════════════════

describe('DEFAULT_GALLERY_BEHAVIOR_SETTINGS – nested gallery config', () => {
  it('defaults nested adapter selection to per-type classic with compact-grid unified', () => {
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.mode).toBe('per-type');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.breakpoints?.desktop?.image?.adapterId).toBe('classic');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.breakpoints?.desktop?.video?.adapterId).toBe('classic');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.breakpoints?.desktop?.unified?.adapterId).toBe('compact-grid');
  });

  it('defaults layoutBuilderScope to full', () => {
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.layoutBuilderScope).toBe('full');
  });

  it('hydrates the default nested galleryConfig data', () => {
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.mode).toBe('per-type');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.breakpoints?.desktop?.image?.adapterId).toBe('classic');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.breakpoints?.desktop?.unified?.adapterId).toBe('compact-grid');
  });

  it('is a valid GalleryBehaviorSettings (satisfies type contract)', () => {
    // This is a compile-time guarantee, but let's also verify at runtime
    // that no key is undefined.
    const keys = Object.keys(DEFAULT_GALLERY_BEHAVIOR_SETTINGS) as Array<
      keyof GalleryBehaviorSettings
    >;
    for (const key of keys) {
      expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS[key]).not.toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// mergeSettingsWithDefaults
// ═══════════════════════════════════════════════════════════════

describe('mergeSettingsWithDefaults', () => {
  it('returns full defaults when partial is empty', () => {
    const merged = mergeSettingsWithDefaults({});
    expect(merged).toEqual(DEFAULT_GALLERY_BEHAVIOR_SETTINGS);
  });

  it('overrides specified fields from partial', () => {
    const merged = mergeSettingsWithDefaults({
      layoutBuilderScope: 'viewport',
      imageBorderRadius: 12,
    });
    expect(merged.layoutBuilderScope).toBe('viewport');
    expect(merged.imageBorderRadius).toBe(12);
  });

  it('preserves falsy value 0 (does not replace with default)', () => {
    const merged = mergeSettingsWithDefaults({
      imageBorderRadius: 0, // default is 8
    });
    expect(merged.imageBorderRadius).toBe(0);
  });

  it('preserves falsy value false (does not replace with default)', () => {
    const merged = mergeSettingsWithDefaults({
      transitionFadeEnabled: false, // default is true
    });
    expect(merged.transitionFadeEnabled).toBe(false);
  });

  it('preserves empty string (does not replace with default)', () => {
    const merged = mergeSettingsWithDefaults({
      gallerySubtitleText: '', // default is ''
    });
    expect(merged.gallerySubtitleText).toBe('');
  });

  it('replaces null with default', () => {
    const merged = mergeSettingsWithDefaults({
      layoutBuilderScope: null as unknown as 'full',
    });
    expect(merged.layoutBuilderScope).toBe('full');
  });

  it('replaces undefined with default', () => {
    const merged = mergeSettingsWithDefaults({
      layoutBuilderScope: undefined,
    });
    expect(merged.layoutBuilderScope).toBe('full');
  });

  it('does not mutate the default object', () => {
    const originalScope = DEFAULT_GALLERY_BEHAVIOR_SETTINGS.layoutBuilderScope;
    mergeSettingsWithDefaults({ layoutBuilderScope: 'viewport' });
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.layoutBuilderScope).toBe(originalScope);
  });

  it('ignores keys not in the defaults (extra API fields)', () => {
    const merged = mergeSettingsWithDefaults({
      unknownField: 'should-be-ignored',
    } as Record<string, unknown>);
    expect(merged).not.toHaveProperty('unknownField');
  });

  it('produces a fresh object each call', () => {
    const a = mergeSettingsWithDefaults({});
    const b = mergeSettingsWithDefaults({});
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('merges nested adapter selections and layout builder scope in one pass', () => {
    const merged = mergeSettingsWithDefaults({
      layoutBuilderScope: 'viewport',
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: { adapterId: 'justified' },
            video: { adapterId: 'masonry' },
          },
          tablet: {
            image: { adapterId: 'hexagonal' },
            video: { adapterId: 'compact-grid' },
          },
          mobile: {
            image: { adapterId: 'circular' },
            video: { adapterId: 'diamond' },
          },
        },
      },
    });

    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.adapterId).toBe('justified');
    expect(merged.galleryConfig?.breakpoints?.desktop?.video?.adapterId).toBe('masonry');
    expect(merged.galleryConfig?.breakpoints?.tablet?.image?.adapterId).toBe('hexagonal');
    expect(merged.galleryConfig?.breakpoints?.tablet?.video?.adapterId).toBe('compact-grid');
    expect(merged.galleryConfig?.breakpoints?.mobile?.image?.adapterId).toBe('circular');
    expect(merged.galleryConfig?.breakpoints?.mobile?.video?.adapterId).toBe('diamond');
    expect(merged.layoutBuilderScope).toBe('viewport');
  });

  it('does not derive nested common settings from flat gallery fields', () => {
    const merged = mergeSettingsWithDefaults({
      gallerySectionPadding: 24,
      imageBgType: 'solid',
      imageBgColor: '#112233',
    });

    expect(merged.galleryConfig?.mode).toBe('per-type');
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.breakpoints?.desktop?.image?.common?.sectionPadding);
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.common?.viewportBgType).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.breakpoints?.desktop?.image?.common?.viewportBgType);
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.common?.viewportBgColor).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.breakpoints?.desktop?.image?.common?.viewportBgColor);
  });

  it('merges explicit nested galleryConfig over the default base', () => {
    const nested: GalleryConfig = {
      mode: 'unified',
      breakpoints: {
        desktop: {
          image: {
            adapterId: 'diamond',
            common: {
              sectionPadding: 8,
            },
          },
        },
      },
    };

    const merged = mergeSettingsWithDefaults({
      gallerySectionPadding: 24,
      galleryConfig: nested,
    });

    expect(merged.galleryConfig?.mode).toBe('unified');
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.adapterId).toBe('diamond');
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(8);
    expect(merged.galleryConfig?.breakpoints?.tablet?.image?.adapterId).toBe('classic');
    expect(merged.galleryConfig?.breakpoints?.tablet?.image?.common?.sectionPadding).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.breakpoints?.tablet?.image?.common?.sectionPadding);
  });

  it('parses galleryConfig when it arrives as JSON', () => {
    const merged = mergeSettingsWithDefaults({
      galleryConfig: JSON.stringify({
        mode: 'unified',
        breakpoints: {
          mobile: {
            unified: {
              adapterId: 'masonry',
            },
          },
        },
      }),
    } as Record<string, unknown>);

    expect(merged.galleryConfig?.mode).toBe('unified');
    expect(merged.galleryConfig?.breakpoints?.mobile?.unified?.adapterId).toBe('masonry');
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.adapterId).toBe('classic');
  });

  it('keeps migrated common and viewport settings nested-only when they arrive via galleryConfig', () => {
    const merged = mergeSettingsWithDefaults({
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              common: {
                sectionMaxWidth: 73,
                sectionMaxWidthUnit: '%',
                adapterSizingMode: 'manual',
                adapterMaxWidthPct: 82,
                viewportBgType: 'image',
                viewportBgImageUrl: 'https://example.com/nested-bg.jpg',
              },
            },
          },
        },
      },
    });

    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.common?.sectionMaxWidth).toBe(73);
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.common?.adapterSizingMode).toBe('manual');
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.common?.viewportBgType).toBe('image');
    expect(merged.gallerySectionMaxWidth).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.gallerySectionMaxWidth);
    expect(merged.adapterSizingMode).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.adapterSizingMode);
    expect(merged.imageBgType).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageBgType);
    expect(merged.imageBgImageUrl).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageBgImageUrl);
  });

  it('keeps viewer/common presentation settings nested-only when they arrive via galleryConfig', () => {
    const merged = mergeSettingsWithDefaults({
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              common: {
                gallerySizingMode: 'manual',
                galleryManualHeight: '75vh',
                galleryImageLabel: 'Photos',
                galleryVideoLabel: 'Clips',
                galleryLabelJustification: 'center',
                showGalleryLabelIcon: true,
                showCampaignGalleryLabels: false,
              },
            },
          },
        },
      },
    });

    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.common?.gallerySizingMode).toBe('manual');
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.common?.galleryManualHeight).toBe('75vh');
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.common?.galleryImageLabel).toBe('Photos');
    expect(merged.gallerySizingMode).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.gallerySizingMode);
    expect(merged.galleryManualHeight).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryManualHeight);
    expect(merged.galleryImageLabel).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryImageLabel);
    expect(merged.galleryVideoLabel).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryVideoLabel);
    expect(merged.galleryLabelJustification).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryLabelJustification);
    expect(merged.showGalleryLabelIcon).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.showGalleryLabelIcon);
    expect(merged.showCampaignGalleryLabels).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.showCampaignGalleryLabels);
  });

  it('keeps adapter settings nested-only when they arrive via galleryConfig', () => {
    const merged = mergeSettingsWithDefaults({
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'classic',
              adapterSettings: {
                imageBorderRadius: 14,
                carouselVisibleCards: 4,
                navArrowPosition: 'bottom',
              },
            },
          },
        },
      },
    });

    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.adapterSettings?.imageBorderRadius).toBe(14);
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.adapterSettings?.carouselVisibleCards).toBe(4);
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.adapterSettings?.navArrowPosition).toBe('bottom');
    expect(merged.imageBorderRadius).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageBorderRadius);
    expect(merged.carouselVisibleCards).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.carouselVisibleCards);
    expect(merged.navArrowPosition).toBe(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowPosition);
  });

  it('does not reconstruct removed flat adapter-selection fields from galleryConfig', () => {
    const merged = mergeSettingsWithDefaults({
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          desktop: {
            unified: { adapterId: 'masonry' },
          },
          tablet: {
            unified: { adapterId: 'compact-grid' },
          },
        },
      },
    });

    expect((merged as Record<string, unknown>).unifiedGalleryEnabled).toBeUndefined();
    expect((merged as Record<string, unknown>).unifiedGalleryAdapterId).toBeUndefined();
    expect((merged as Record<string, unknown>).gallerySelectionMode).toBeUndefined();
  });
});
