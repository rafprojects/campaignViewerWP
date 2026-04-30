import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryBehaviorSettings,
  type GalleryConfig,
} from '@/types';
import {
  applyResolvedGalleryAdapterSettings,
  resolveAdapterId,
  resolveGalleryCommonSettings,
  resolveGallerySectionRuntime,
  resolveGalleryMode,
  resolveUnifiedAdapterId,
} from './resolveAdapterId';
import { mergeSettingsWithDefaults } from './mergeSettingsWithDefaults';

/**
 * Build a settings object with targeted overrides on top of defaults.
 */
function makeSettings(overrides: Partial<GalleryBehaviorSettings> = {}): GalleryBehaviorSettings {
  return mergeSettingsWithDefaults(overrides);
}

describe('resolveGalleryMode', () => {
  it('reads gallery mode from nested galleryConfig', () => {
    const s = makeSettings({
      galleryConfig: {
        mode: 'unified',
      },
    });

    expect(resolveGalleryMode(s)).toBe('unified');
  });

  it('defaults to per-type when no nested mode is available', () => {
    expect(resolveGalleryMode({ ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, galleryConfig: undefined })).toBe('per-type');
  });

  it('accepts campaign nested overrides for mode resolution', () => {
    const s = makeSettings({
      galleryConfig: {
        mode: 'per-type',
      },
    });

    expect(resolveGalleryMode(s, { mode: 'unified' })).toBe('unified');
  });
});

// ── Per-breakpoint mode ──────────────────────────────────────

describe('resolveAdapterId – nested per-type mode', () => {
  it('returns the correct image adapter for each breakpoint', () => {
    const s = makeSettings({
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry' },
          },
          tablet: {
            image: { adapterId: 'justified' },
          },
          mobile: {
            image: { adapterId: 'compact-grid' },
          },
        },
      },
    });
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('masonry');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('justified');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('compact-grid');
  });

  it('returns the correct video adapter for each breakpoint', () => {
    const s = makeSettings({
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            video: { adapterId: 'classic' },
          },
          tablet: {
            video: { adapterId: 'hexagonal' },
          },
          mobile: {
            video: { adapterId: 'masonry' },
          },
        },
      },
    });
    expect(resolveAdapterId(s, 'video', 'desktop')).toBe('classic');
    expect(resolveAdapterId(s, 'video', 'tablet')).toBe('hexagonal');
    expect(resolveAdapterId(s, 'video', 'mobile')).toBe('masonry');
  });

  it('prefers campaign nested scope adapters over the global config', () => {
    const s = makeSettings({
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry' },
          },
        },
      },
    });

    expect(resolveAdapterId(s, 'image', 'desktop', {
      galleryOverrides: {
        breakpoints: {
          desktop: {
            image: { adapterId: 'diamond' },
          },
        },
      },
    })).toBe('diamond');
  });

  it('falls back to classic when a scope has no configured adapter', () => {
    const s = makeSettings({
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {},
          },
        },
      },
    });

    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('classic');
  });
});

// ── Default settings behaviour ───────────────────────────────

describe('resolveAdapterId – with defaults', () => {
  it('default migrated settings resolve classic for both types', () => {
    const s = makeSettings();
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('classic');
    expect(resolveAdapterId(s, 'video', 'mobile')).toBe('classic');
  });
});

// ── Layout-builder mobile guard ──────────────────────────────

describe('resolveAdapterId – layout-builder mobile fallback', () => {
  it('falls back to another configured nested scope adapter when layout-builder is unsupported on mobile', () => {
    const s = makeSettings({
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry' },
          },
          tablet: {
            image: { adapterId: 'layout-builder' },
          },
          mobile: {
            image: { adapterId: 'layout-builder' },
          },
        },
      },
    });

    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('masonry');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('layout-builder');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('masonry');
  });

  it('falls back to classic when no supported nested image adapter exists on mobile', () => {
    const s = makeSettings({
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: { adapterId: 'layout-builder' },
          },
          tablet: {
            image: { adapterId: 'layout-builder' },
          },
          mobile: {
            image: { adapterId: 'layout-builder' },
          },
        },
      },
    });

    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('classic');
  });
});

describe('resolveUnifiedAdapterId', () => {
  it('prefers nested unified adapter for the current breakpoint', () => {
    const s = makeSettings({
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

  it('falls back to the global nested unified adapter when campaign overrides only change common settings', () => {
    const s = makeSettings({
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          desktop: {
            unified: {
              adapterId: 'justified',
            },
          },
        },
      },
    });

    const campaignOverrides: Partial<GalleryConfig> = {
      breakpoints: {
        desktop: {
          unified: {
            common: {
              sectionPadding: 24,
            },
          },
        },
      },
    };

    expect(resolveUnifiedAdapterId(s, 'desktop', { galleryOverrides: campaignOverrides })).toBe('justified');
  });

  it('prefers campaign nested unified adapter overrides ahead of global unified config', () => {
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
    })).toBe('diamond');
  });

  it('falls back to classic when unified nested adapter is unsupported on mobile', () => {
    const s = makeSettings({
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          desktop: {
            unified: {
              adapterId: 'layout-builder',
            },
          },
          tablet: {
            unified: {
              adapterId: 'layout-builder',
            },
          },
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

describe('resolveGallerySectionRuntime', () => {
  it('exposes resolved common and background data explicitly for the active scope', () => {
    const s = makeSettings({
      videoBgType: 'none',
      videoBgGradient: 'linear-gradient(90deg, #000000 0%, #111111 100%)',
      galleryVideoLabel: 'Videos',
      galleryConfig: {
        breakpoints: {
          tablet: {
            video: {
              common: {
                viewportBgType: 'gradient',
                viewportBgGradient: 'linear-gradient(135deg, #112233 0%, #334455 100%)',
                galleryVideoLabel: 'Clips',
                showCampaignGalleryLabels: false,
              },
            },
          },
        },
      },
    });

    const runtime = resolveGallerySectionRuntime(s, 'tablet', 'video');

    expect(runtime.scope).toBe('video');
    expect(runtime.breakpoint).toBe('tablet');
    expect(runtime.common.galleryVideoLabel).toBe('Clips');
    expect(runtime.common.showCampaignGalleryLabels).toBe(false);
    expect(runtime.background.type).toBe('gradient');
    expect(runtime.background.gradient).toBe('linear-gradient(135deg, #112233 0%, #334455 100%)');
  });
});

describe('applyResolvedGalleryAdapterSettings', () => {
  it('keeps resolved common settings nested-only', () => {
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

    const runtime = resolveGallerySectionRuntime(s, 'tablet', 'video');
    const resolved = applyResolvedGalleryAdapterSettings(s, runtime);

    expect(runtime.common.sectionPadding).toBe(28);
    expect(runtime.common.adapterItemGap).toBe(6);
    expect(runtime.common.viewportBgType).toBe('gradient');
    expect(runtime.common.viewportBgGradient).toBe('linear-gradient(135deg, #112233 0%, #334455 100%)');
    expect(runtime.common.galleryVideoLabel).toBe('Clips');
    expect(runtime.common.galleryLabelJustification).toBe('right');
    expect(runtime.common.showCampaignGalleryLabels).toBe(false);

    expect(resolved.gallerySectionPadding).toBe(16);
    expect(resolved.adapterItemGap).toBe(12);
    expect(resolved.videoBgType).toBe('none');
    expect(resolved.videoBgGradient).toBe('linear-gradient(90deg, #000000 0%, #111111 100%)');
    expect(resolved.galleryVideoLabel).toBe('Videos');
    expect(resolved.galleryLabelJustification).toBe('left');
    expect(resolved.showCampaignGalleryLabels).toBe(true);
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

    const runtime = resolveGallerySectionRuntime(s, 'desktop', 'image');
    const resolved = applyResolvedGalleryAdapterSettings(s, runtime);

    expect(resolved.gridCardWidth).toBe(220);
  });

  it('ignores dangerous adapter setting keys when projecting nested adapter settings', () => {
    const dangerousSettings = Object.create(null) as Record<string, unknown>;
    dangerousSettings.gridCardWidth = 220;
    dangerousSettings.__proto__ = { polluted: true };
    dangerousSettings.constructor = 'malicious';
    dangerousSettings.prototype = 'malicious';

    const s = makeSettings({
      gridCardWidth: 160,
      galleryConfig: {
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'compact-grid',
              adapterSettings: dangerousSettings,
            },
          },
        },
      },
    });

    const runtime = resolveGallerySectionRuntime(s, 'desktop', 'image');
    const resolved = applyResolvedGalleryAdapterSettings(s, runtime) as GalleryBehaviorSettings & Record<string, unknown>;

    expect(resolved.gridCardWidth).toBe(220);
    expect(resolved.polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(resolved, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(resolved, 'prototype')).toBe(false);
  });

  it('projects shared photo-grid adapter settings back onto legacy runtime fields', () => {
    const s = makeSettings({
      thumbnailGap: 6,
      galleryConfig: {
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'justified',
              adapterSettings: {
                thumbnailGap: 14,
              },
            },
          },
        },
      },
    });

    const runtime = resolveGallerySectionRuntime(s, 'desktop', 'image');
    const resolved = applyResolvedGalleryAdapterSettings(s, runtime);

    expect(resolved.thumbnailGap).toBe(14);
  });

  it('projects shared tile-appearance adapter settings back onto legacy runtime fields', () => {
    const s = makeSettings({
      tileBorderWidth: 0,
      tileBorderColor: '#ffffff',
      tileHoverBounce: true,
      tileGlowEnabled: false,
      tileGlowColor: '#7c9ef8',
      tileGlowSpread: 12,
      tileGapX: 8,
      tileGapY: 8,
      galleryConfig: {
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'hexagonal',
              adapterSettings: {
                tileBorderWidth: 2,
                tileBorderColor: '#ff0000',
                tileHoverBounce: false,
                tileGlowEnabled: true,
                tileGlowColor: '#00ffaa',
                tileGlowSpread: 18,
                tileGapX: 12,
                tileGapY: 10,
              },
            },
          },
        },
      },
    });

    const runtime = resolveGallerySectionRuntime(s, 'desktop', 'image');
    const resolved = applyResolvedGalleryAdapterSettings(s, runtime);

    expect(resolved.tileBorderWidth).toBe(2);
    expect(resolved.tileBorderColor).toBe('#ff0000');
    expect(resolved.tileHoverBounce).toBe(false);
    expect(resolved.tileGlowEnabled).toBe(true);
    expect(resolved.tileGlowColor).toBe('#00ffaa');
    expect(resolved.tileGlowSpread).toBe(18);
    expect(resolved.tileGapX).toBe(12);
    expect(resolved.tileGapY).toBe(10);
  });

  it('projects layout-builder adapter defaults back onto legacy runtime fields', () => {
    const s = makeSettings({
      layoutBuilderScope: 'full',
      tileGlowColor: '#7c9ef8',
      tileGlowSpread: 12,
      galleryConfig: {
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'layout-builder',
              adapterSettings: {
                layoutBuilderScope: 'viewport',
                tileGlowColor: '#00ffaa',
                tileGlowSpread: 18,
              },
            },
          },
        },
      },
    });

    const runtime = resolveGallerySectionRuntime(s, 'desktop', 'image');
    const resolved = applyResolvedGalleryAdapterSettings(s, runtime);

    expect(resolved.layoutBuilderScope).toBe('viewport');
    expect(resolved.tileGlowColor).toBe('#00ffaa');
    expect(resolved.tileGlowSpread).toBe(18);
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

    const runtime = resolveGallerySectionRuntime(s, 'desktop', 'unified');
    const resolved = applyResolvedGalleryAdapterSettings(s, runtime);

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

    const runtime = resolveGallerySectionRuntime(s, 'desktop', 'image', {
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
    const resolved = applyResolvedGalleryAdapterSettings(s, runtime);

    expect(resolved.gridCardWidth).toBe(260);
  });
});
