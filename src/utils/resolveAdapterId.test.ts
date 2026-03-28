import { describe, it, expect } from 'vitest';
import {
  resolveAdapterId,
  resolveEffectiveGallerySettings,
  resolveGalleryCommonSettings,
  resolveGalleryMode,
  resolveUnifiedAdapterId,
} from './resolveAdapterId';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import type { GalleryBehaviorSettings, GalleryConfig } from '@/types';
import { mergeSettingsWithDefaults } from './mergeSettingsWithDefaults';

/**
 * Build a settings object with targeted overrides on top of defaults.
 */
function makeSettings(overrides: Partial<GalleryBehaviorSettings> = {}): GalleryBehaviorSettings {
  return mergeSettingsWithDefaults(overrides);
}

function makeLegacyOnlySettings(overrides: Partial<GalleryBehaviorSettings> = {}): GalleryBehaviorSettings {
  return {
    ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
    ...overrides,
    galleryConfig: undefined,
  };
}

// ── Unified mode ─────────────────────────────────────────────

describe('resolveAdapterId – unified mode', () => {
  it('returns imageGalleryAdapterId for image type', () => {
    const s = makeLegacyOnlySettings({ gallerySelectionMode: 'unified', imageGalleryAdapterId: 'justified' });
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('justified');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('justified');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('justified');
  });

  it('returns videoGalleryAdapterId for video type', () => {
    const s = makeLegacyOnlySettings({ gallerySelectionMode: 'unified', videoGalleryAdapterId: 'masonry' });
    expect(resolveAdapterId(s, 'video', 'desktop')).toBe('masonry');
    expect(resolveAdapterId(s, 'video', 'tablet')).toBe('masonry');
    expect(resolveAdapterId(s, 'video', 'mobile')).toBe('masonry');
  });

  it('ignores per-breakpoint settings even if they are set', () => {
    const s = makeLegacyOnlySettings({
      gallerySelectionMode: 'unified',
      imageGalleryAdapterId: 'classic',
      desktopImageAdapterId: 'masonry',
      tabletImageAdapterId: 'justified',
      mobileImageAdapterId: 'hexagonal',
    });
    // Should always return unified adapter regardless of breakpoint-specific settings
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('classic');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('classic');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('classic');
  });
});

describe('resolveGalleryMode', () => {
  it('prefers nested galleryConfig.mode over legacy unifiedGalleryEnabled', () => {
    const s = makeSettings({
      unifiedGalleryEnabled: false,
      galleryConfig: {
        mode: 'unified',
      },
    });

    expect(resolveGalleryMode(s)).toBe('unified');
  });

  it('falls back to legacy unifiedGalleryEnabled when nested mode is absent', () => {
    expect(resolveGalleryMode(makeLegacyOnlySettings({ unifiedGalleryEnabled: true }))).toBe('unified');
    expect(resolveGalleryMode(makeLegacyOnlySettings({ unifiedGalleryEnabled: false }))).toBe('per-type');
  });

  it('accepts campaign nested overrides for mode resolution', () => {
    const s = makeSettings({
      unifiedGalleryEnabled: false,
      galleryConfig: {
        mode: 'per-type',
      },
    });

    expect(resolveGalleryMode(s, { mode: 'unified' })).toBe('unified');
  });
});

// ── Per-breakpoint mode ──────────────────────────────────────

describe('resolveAdapterId – per-breakpoint mode', () => {
  it('returns the correct image adapter for each breakpoint', () => {
    const s = makeLegacyOnlySettings({
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: 'masonry',
      tabletImageAdapterId: 'justified',
      mobileImageAdapterId: 'compact-grid',
    });
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('masonry');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('justified');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('compact-grid');
  });

  it('returns the correct video adapter for each breakpoint', () => {
    const s = makeLegacyOnlySettings({
      gallerySelectionMode: 'per-breakpoint',
      desktopVideoAdapterId: 'classic',
      tabletVideoAdapterId: 'hexagonal',
      mobileVideoAdapterId: 'masonry',
    });
    expect(resolveAdapterId(s, 'video', 'desktop')).toBe('classic');
    expect(resolveAdapterId(s, 'video', 'tablet')).toBe('hexagonal');
    expect(resolveAdapterId(s, 'video', 'mobile')).toBe('masonry');
  });

  it('falls back to unified imageGalleryAdapterId when per-breakpoint value is empty', () => {
    const s = makeLegacyOnlySettings({
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: '',
      imageGalleryAdapterId: 'justified',
    });
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('justified');
  });

  it('falls back to unified videoGalleryAdapterId when per-breakpoint value is empty', () => {
    const s = makeLegacyOnlySettings({
      gallerySelectionMode: 'per-breakpoint',
      tabletVideoAdapterId: '',
      videoGalleryAdapterId: 'masonry',
    });
    expect(resolveAdapterId(s, 'video', 'tablet')).toBe('masonry');
  });

  it('uses per-breakpoint value when set, unified fallback only when falsy', () => {
    const s = makeLegacyOnlySettings({
      gallerySelectionMode: 'per-breakpoint',
      imageGalleryAdapterId: 'fallback-adapter',
      desktopImageAdapterId: 'desktop-specific',
      tabletImageAdapterId: '',    // empty → falls back
      mobileImageAdapterId: 'mobile-specific',
    });
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('desktop-specific');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('fallback-adapter');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('mobile-specific');
  });

  it('prefers nested galleryConfig per-breakpoint scope adapters over legacy flat fields', () => {
    const s = makeSettings({
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: 'masonry',
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'diamond',
            },
          },
        },
      },
    });

    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('diamond');
  });
});

// ── Default settings behaviour ───────────────────────────────

describe('resolveAdapterId – with defaults', () => {
  it('defaults are unified mode returning classic for both types', () => {
    const s = makeLegacyOnlySettings();
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('classic');
    expect(resolveAdapterId(s, 'video', 'mobile')).toBe('classic');
  });
});

// ── Layout-builder mobile guard ──────────────────────────────

describe('resolveAdapterId – layout-builder mobile fallback', () => {
  it('falls back to unified image adapter when layout-builder is resolved on mobile', () => {
    const s = makeLegacyOnlySettings({
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: 'layout-builder',
      tabletImageAdapterId: 'layout-builder',
      mobileImageAdapterId: 'layout-builder',
      imageGalleryAdapterId: 'masonry',
    });
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('layout-builder');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('layout-builder');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('masonry');
  });

  it('falls back to unified video adapter when layout-builder is resolved on mobile', () => {
    const s = makeLegacyOnlySettings({
      gallerySelectionMode: 'per-breakpoint',
      mobileVideoAdapterId: 'layout-builder',
      videoGalleryAdapterId: 'justified',
    });
    expect(resolveAdapterId(s, 'video', 'mobile')).toBe('justified');
  });

  it('falls back to classic when unified adapter is also layout-builder on mobile', () => {
    const s = makeLegacyOnlySettings({
      gallerySelectionMode: 'unified',
      imageGalleryAdapterId: 'layout-builder',
    });
    // Unified mode returns 'layout-builder', mobile guard kicks in,
    // fallback is also 'layout-builder' → returns 'classic'.
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('classic');
  });

  it('falls back from nested mobile layout-builder to the legacy flat adapter when unsupported', () => {
    const s = makeSettings({
      imageGalleryAdapterId: 'masonry',
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          mobile: {
            image: {
              adapterId: 'layout-builder',
            },
          },
        },
      },
    });

    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('masonry');
  });
});

describe('resolveUnifiedAdapterId', () => {
  it('prefers nested unified adapter for the current breakpoint', () => {
    const s = makeSettings({
      unifiedGalleryAdapterId: 'compact-grid',
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          tablet: {
            unified: {
              adapterId: 'justified',
            },
          },
        },
      },
    });

    expect(resolveUnifiedAdapterId(s, 'tablet')).toBe('justified');
  });

  it('prefers campaign nested unified adapter overrides ahead of legacy campaign overrides', () => {
    const campaignOverrides: Partial<GalleryConfig> = {
      breakpoints: {
        desktop: {
          unified: {
            adapterId: 'diamond',
          },
        },
      },
    };

    const s = makeSettings({
      unifiedGalleryAdapterId: 'compact-grid',
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          desktop: {
            unified: {
              adapterId: 'masonry',
            },
          },
        },
      },
    });

    expect(resolveUnifiedAdapterId(s, 'desktop', {
      galleryOverrides: campaignOverrides,
      legacyOverrideId: 'justified',
    })).toBe('diamond');
  });

  it('falls back to classic when unified nested adapter is unsupported on mobile', () => {
    const s = makeSettings({
      unifiedGalleryAdapterId: 'layout-builder',
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          mobile: {
            unified: {
              adapterId: 'layout-builder',
            },
          },
        },
      },
    });

    expect(resolveUnifiedAdapterId(s, 'mobile')).toBe('classic');
  });
});

describe('resolveAdapterId – campaign precedence', () => {
  it('falls back from unsupported campaign legacy override to global nested config', () => {
    const s = makeSettings({
      imageGalleryAdapterId: 'classic',
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          mobile: {
            image: {
              adapterId: 'masonry',
            },
          },
        },
      },
    });

    expect(resolveAdapterId(s, 'image', 'mobile', {
      legacyOverrideId: 'layout-builder',
    })).toBe('masonry');
  });
});

describe('resolveGalleryCommonSettings', () => {
  it('prefers nested common settings for the current breakpoint and scope', () => {
    const s = makeSettings({
      gallerySectionPadding: 16,
      adapterItemGap: 12,
      imageBgType: 'none',
      imageBgColor: '#111111',
      galleryImageLabel: 'Images',
      galleryLabelJustification: 'left',
      showGalleryLabelIcon: false,
      galleryConfig: {
        breakpoints: {
          desktop: {
            image: {
              common: {
                sectionPadding: 24,
                adapterItemGap: 20,
                viewportBgType: 'solid',
                viewportBgColor: '#112233',
                galleryImageLabel: 'Photos',
                galleryLabelJustification: 'center',
                showGalleryLabelIcon: true,
              },
            },
          },
        },
      },
    });

    expect(resolveGalleryCommonSettings(s, 'desktop', 'image')).toMatchObject({
      sectionPadding: 24,
      adapterItemGap: 20,
      viewportBgType: 'solid',
      viewportBgColor: '#112233',
      galleryImageLabel: 'Photos',
      galleryLabelJustification: 'center',
      showGalleryLabelIcon: true,
    });
  });

  it('applies campaign nested common overrides over global common settings', () => {
    const s = makeSettings({
      gallerySectionPadding: 16,
      galleryConfig: {
        breakpoints: {
          desktop: {
            image: {
              common: {
                sectionPadding: 24,
              },
            },
          },
        },
      },
    });

    expect(resolveGalleryCommonSettings(s, 'desktop', 'image', {
      breakpoints: {
        desktop: {
          image: {
            common: {
              sectionPadding: 8,
            },
          },
        },
      },
    })).toMatchObject({
      sectionPadding: 8,
    });
  });
});

describe('resolveEffectiveGallerySettings', () => {
  it('projects resolved common settings back onto legacy runtime fields', () => {
    const s = makeSettings({
      gallerySectionPadding: 16,
      adapterItemGap: 12,
      videoBgType: 'none',
      videoBgGradient: 'linear-gradient(90deg, #000000 0%, #111111 100%)',
      galleryVideoLabel: 'Videos',
      galleryLabelJustification: 'left',
      showCampaignGalleryLabels: true,
      galleryConfig: {
        breakpoints: {
          tablet: {
            video: {
              common: {
                sectionPadding: 28,
                adapterItemGap: 6,
                viewportBgType: 'gradient',
                viewportBgGradient: 'linear-gradient(135deg, #112233 0%, #334455 100%)',
                galleryVideoLabel: 'Clips',
                galleryLabelJustification: 'right',
                showCampaignGalleryLabels: false,
              },
            },
          },
        },
      },
    });

    const resolved = resolveEffectiveGallerySettings(s, 'tablet', 'video');

    expect(resolved.gallerySectionPadding).toBe(28);
    expect(resolved.adapterItemGap).toBe(6);
    expect(resolved.videoBgType).toBe('gradient');
    expect(resolved.videoBgGradient).toBe('linear-gradient(135deg, #112233 0%, #334455 100%)');
    expect(resolved.galleryVideoLabel).toBe('Clips');
    expect(resolved.galleryLabelJustification).toBe('right');
    expect(resolved.showCampaignGalleryLabels).toBe(false);
  });

  it('projects nested adapter settings back onto legacy runtime fields', () => {
    const s = makeSettings({
      gridCardWidth: 160,
      galleryConfig: {
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'compact-grid',
              adapterSettings: {
                gridCardWidth: 220,
              },
            },
          },
        },
      },
    });

    const resolved = resolveEffectiveGallerySettings(s, 'desktop', 'image');

    expect(resolved.gridCardWidth).toBe(220);
  });

  it('projects unified classic runtime fields from nested adapter settings', () => {
    const s = makeSettings({
      imageBorderRadius: 8,
      videoBorderRadius: 8,
      imageViewportHeight: 420,
      videoViewportHeight: 420,
      imageShadowPreset: 'subtle',
      imageShadowCustom: '0 2px 8px rgba(0,0,0,0.15)',
      videoShadowPreset: 'subtle',
      videoShadowCustom: '0 2px 8px rgba(0,0,0,0.15)',
      unifiedGalleryEnabled: true,
      unifiedGalleryAdapterId: 'classic',
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          desktop: {
            unified: {
              adapterId: 'classic',
              adapterSettings: {
                imageBorderRadius: 14,
                videoBorderRadius: 18,
                imageViewportHeight: 560,
                videoViewportHeight: 500,
                imageShadowPreset: 'custom',
                imageShadowCustom: '0 8px 24px rgba(0,0,0,0.35)',
                videoShadowPreset: 'strong',
                videoShadowCustom: '0 6px 18px rgba(0,0,0,0.3)',
              },
            },
          },
        },
      },
    });

    const resolved = resolveEffectiveGallerySettings(s, 'desktop', 'unified');

    expect(resolved.imageBorderRadius).toBe(14);
    expect(resolved.videoBorderRadius).toBe(18);
    expect(resolved.imageViewportHeight).toBe(560);
    expect(resolved.videoViewportHeight).toBe(500);
    expect(resolved.imageShadowPreset).toBe('custom');
    expect(resolved.imageShadowCustom).toBe('0 8px 24px rgba(0,0,0,0.35)');
    expect(resolved.videoShadowPreset).toBe('strong');
    expect(resolved.videoShadowCustom).toBe('0 6px 18px rgba(0,0,0,0.3)');
  });

  it('applies campaign nested adapter overrides over global adapter settings', () => {
    const s = makeSettings({
      gridCardWidth: 160,
      galleryConfig: {
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'compact-grid',
              adapterSettings: {
                gridCardWidth: 220,
              },
            },
          },
        },
      },
    });

    const resolved = resolveEffectiveGallerySettings(s, 'desktop', 'image', {
      breakpoints: {
        desktop: {
          image: {
            adapterSettings: {
              gridCardWidth: 260,
            },
          },
        },
      },
    });

    expect(resolved.gridCardWidth).toBe(260);
  });
});
