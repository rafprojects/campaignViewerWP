import { describe, expect, it } from 'vitest';

import {
  type Campaign,
  type Company,
  type GalleryBehaviorSettings,
  type MediaItem,
} from '@/types';

import {
  resolvePerTypeCampaignGalleryRenderPlan,
  resolveUnifiedCampaignGalleryRenderPlan,
  shouldUseEqualHeightPerTypeLayout,
} from './campaignGalleryRenderPlan';
import { mergeSettingsWithDefaults } from './mergeSettingsWithDefaults';

const company: Company = {
  id: 'acme',
  name: 'Acme',
  logo: '',
  brandColor: '#123456',
};

const image: MediaItem = {
  id: 'image-1',
  type: 'image',
  source: 'upload',
  url: 'https://example.com/image.jpg',
  order: 2,
};

const video: MediaItem = {
  id: 'video-1',
  type: 'video',
  source: 'upload',
  url: 'https://example.com/video.mp4',
  thumbnail: 'https://example.com/video.jpg',
  order: 1,
};

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: '1',
    companyId: company.id,
    company,
    title: 'Campaign',
    description: 'Description',
    thumbnail: 'https://example.com/thumb.jpg',
    coverImage: 'https://example.com/cover.jpg',
    videos: [video],
    images: [image],
    tags: ['tag'],
    status: 'active',
    visibility: 'private',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function makeSettings(overrides: Partial<GalleryBehaviorSettings> = {}): GalleryBehaviorSettings {
  return mergeSettingsWithDefaults(overrides);
}

describe('campaignGalleryRenderPlan', () => {
  it('resolves a unified render plan with sorted media and wrapper projection', () => {
    const plan = resolveUnifiedCampaignGalleryRenderPlan(
      makeCampaign(),
      makeSettings({
        unifiedBgType: 'none',
        unifiedBgColor: '#000000',
        imageBorderRadius: 8,
        videoBorderRadius: 10,
        galleryConfig: {
          mode: 'unified',
          breakpoints: {
            desktop: {
              unified: {
                adapterId: 'classic',
                common: {
                  viewportBgType: 'solid',
                  viewportBgColor: '#112233',
                },
                adapterSettings: {
                  imageBorderRadius: 14,
                  videoBorderRadius: 18,
                },
              },
            },
          },
        },
      }),
      'desktop',
    );

    expect(plan?.media.map((item) => item.id)).toEqual(['video-1', 'image-1']);
    expect(plan?.adapterId).toBe('classic');
    expect(plan?.wrapper.bgType).toBe('solid');
    expect(plan?.wrapper.bgColor).toBe('#112233');
    expect(plan?.wrapper.borderRadius).toBe(18);
  });

  it('resolves breakpoint-specific unified settings for non-desktop render plans', () => {
    const plan = resolveUnifiedCampaignGalleryRenderPlan(
      makeCampaign(),
      makeSettings({
        galleryConfig: {
          mode: 'unified',
          breakpoints: {
            desktop: {
              unified: {
                adapterId: 'classic',
                common: {
                  viewportBgType: 'solid',
                  viewportBgColor: '#112233',
                },
                adapterSettings: {
                  carouselVisibleCards: 2,
                  imageBorderRadius: 10,
                  videoBorderRadius: 12,
                },
              },
            },
            tablet: {
              unified: {
                adapterId: 'classic',
                common: {
                  viewportBgType: 'gradient',
                  viewportBgGradient: 'linear-gradient(135deg, #334455 0%, #556677 100%)',
                },
                adapterSettings: {
                  carouselVisibleCards: 4,
                  imageBorderRadius: 14,
                  videoBorderRadius: 20,
                },
              },
            },
          },
        },
      }),
      'tablet',
    );

    expect(plan?.adapterId).toBe('classic');
    expect(plan?.settings.carouselVisibleCards).toBe(4);
    expect(plan?.wrapper.bgType).toBe('gradient');
    expect(plan?.wrapper.bgGradient).toBe('linear-gradient(135deg, #334455 0%, #556677 100%)');
    expect(plan?.wrapper.borderRadius).toBe(20);
  });

  it('does not reuse per-type campaign overrides as unified adapter fallbacks', () => {
    const plan = resolveUnifiedCampaignGalleryRenderPlan(
      makeCampaign({
        galleryOverrides: {
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'masonry',
              },
            },
          },
        },
      }),
      makeSettings({
        galleryConfig: {
          mode: 'unified',
          breakpoints: {
            desktop: {
              unified: {
                adapterId: 'compact-grid',
              },
            },
          },
        },
      }),
      'desktop',
    );

    expect(plan?.adapterId).toBe('compact-grid');
  });

  it('resolves nested per-type campaign overrides before global config', () => {
    const plan = resolvePerTypeCampaignGalleryRenderPlan(
      makeCampaign({
        videos: [],
        images: [image],
        galleryOverrides: {
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'masonry',
              },
            },
          },
        },
      }),
      makeSettings({
        galleryConfig: {
          mode: 'per-type',
        },
      }),
      'desktop',
      'image',
    );

    expect(plan?.adapterId).toBe('masonry');
  });

  it('falls back from unsupported nested campaign adapters to global nested config', () => {
    const plan = resolvePerTypeCampaignGalleryRenderPlan(
      makeCampaign({
        videos: [],
        images: [image],
        galleryOverrides: {
          mode: 'per-type',
          breakpoints: {
            mobile: {
              image: {
                adapterId: 'layout-builder',
              },
            },
          },
        },
      }),
      makeSettings({
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
      }),
      'mobile',
      'image',
    );

    expect(plan?.adapterId).toBe('masonry');
  });

  it('resolves per-type plans with tile-size projection and adapter fallback', () => {
    const imagePlan = resolvePerTypeCampaignGalleryRenderPlan(
      makeCampaign({ videos: [], images: [image] }),
      makeSettings({
        tileSize: 120,
        imageTileSize: 180,
        galleryConfig: {
          mode: 'per-type',
          breakpoints: {
            mobile: {
              image: {
                adapterId: 'layout-builder',
                common: {
                  perTypeSectionEqualHeight: true,
                },
              },
            },
          },
        },
      }),
      'mobile',
      'image',
    );

    expect(imagePlan?.adapterId).toBe('classic');
    expect(imagePlan?.settings.tileSize).toBe(180);
    expect(imagePlan?.wrapper.borderRadius).toBe(imagePlan?.settings.imageBorderRadius ?? 0);
  });

  it('detects equal-height per-type layout when either section resolves that flag', () => {
    const imagePlan = resolvePerTypeCampaignGalleryRenderPlan(
      makeCampaign({ videos: [], images: [image] }),
      makeSettings({
        galleryConfig: {
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'classic',
                common: {
                  perTypeSectionEqualHeight: true,
                },
              },
            },
          },
        },
      }),
      'desktop',
      'image',
    );

    expect(shouldUseEqualHeightPerTypeLayout(imagePlan, null)).toBe(true);
  });
});