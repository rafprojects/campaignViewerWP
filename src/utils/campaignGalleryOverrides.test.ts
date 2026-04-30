import { describe, expect, it } from 'vitest';

import type { Campaign } from '@/types';

import {
  buildCampaignGalleryOverrideEditorValue,
  clearCampaignGalleryOverrides,
  describeCampaignGalleryOverrides,
  getCampaignGalleryOverrideMode,
  getUniformCampaignScopeAdapterId,
  hasCampaignGalleryOverrides,
  hasCampaignScopeOverrides,
  syncCampaignGalleryOverrideMode,
  syncCampaignScopeAdapterOverride,
} from './campaignGalleryOverrides';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: '1',
    companyId: 'acme',
    company: {
      id: 'acme',
      name: 'Acme',
      logo: '',
      brandColor: '#000000',
    },
    title: 'Campaign',
    description: '',
    thumbnail: '',
    coverImage: '',
    videos: [],
    images: [],
    tags: [],
    status: 'active',
    visibility: 'private',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('campaignGalleryOverrides', () => {
  it('returns a uniform adapter id only when all breakpoints agree', () => {
    expect(getUniformCampaignScopeAdapterId({
      breakpoints: {
        desktop: { image: { adapterId: 'masonry' } },
        tablet: { image: { adapterId: 'masonry' } },
        mobile: { image: { adapterId: 'masonry' } },
      },
    }, 'image')).toBe('masonry');

    expect(getUniformCampaignScopeAdapterId({
      breakpoints: {
        desktop: { image: { adapterId: 'masonry' } },
        tablet: { image: { adapterId: 'justified' } },
        mobile: { image: { adapterId: 'masonry' } },
      },
    }, 'image')).toBe('');

    expect(getUniformCampaignScopeAdapterId({
      breakpoints: {
        desktop: { unified: { adapterId: 'classic' } },
        tablet: { unified: { adapterId: 'classic' } },
        mobile: { unified: { adapterId: 'classic' } },
      },
    }, 'unified')).toBe('classic');
  });

  it('syncs a campaign scope override across all breakpoints while preserving unrelated overrides', () => {
    expect(syncCampaignScopeAdapterOverride({
      mode: 'per-type',
      breakpoints: {
        desktop: { video: { adapterId: 'diamond' } },
      },
    }, 'image', 'masonry')).toEqual({
      mode: 'per-type',
      breakpoints: {
        desktop: {
          image: { adapterId: 'masonry' },
          video: { adapterId: 'diamond' },
        },
        tablet: {
          image: { adapterId: 'masonry' },
        },
        mobile: {
          image: { adapterId: 'masonry' },
        },
      },
    });
  });

  it('syncs a unified campaign adapter override across all breakpoints', () => {
    expect(syncCampaignScopeAdapterOverride({
      mode: 'unified',
    }, 'unified', 'classic')).toEqual({
      mode: 'unified',
      breakpoints: {
        desktop: {
          unified: { adapterId: 'classic' },
        },
        tablet: {
          unified: { adapterId: 'classic' },
        },
        mobile: {
          unified: { adapterId: 'classic' },
        },
      },
    });
  });

  it('clears only the target scope adapter ids when removing an override', () => {
    expect(syncCampaignScopeAdapterOverride({
      breakpoints: {
        desktop: {
          image: { adapterId: 'masonry', common: { sectionPadding: 24 } },
          video: { adapterId: 'diamond' },
        },
        tablet: {
          image: { adapterId: 'masonry' },
        },
        mobile: {
          image: { adapterId: 'masonry' },
        },
      },
    }, 'image', '')).toEqual({
      breakpoints: {
        desktop: {
          image: { common: { sectionPadding: 24 } },
          video: { adapterId: 'diamond' },
        },
      },
    });
  });

  it('reads and syncs the nested campaign gallery mode override', () => {
    expect(getCampaignGalleryOverrideMode({ mode: 'unified' })).toBe('unified');
    expect(getCampaignGalleryOverrideMode({})).toBe('');

    expect(syncCampaignGalleryOverrideMode({
      breakpoints: {
        desktop: { image: { adapterId: 'masonry' } },
      },
    }, 'per-type')).toEqual({
      mode: 'per-type',
      breakpoints: {
        desktop: { image: { adapterId: 'masonry' } },
      },
    });

    expect(syncCampaignGalleryOverrideMode({ mode: 'unified' }, '')).toBeUndefined();
  });

  it('builds editor state from nested campaign overrides only', () => {
    expect(buildCampaignGalleryOverrideEditorValue(makeCampaign({
      galleryOverrides: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: { adapterId: 'masonry' },
            video: {},
          },
          tablet: {},
          mobile: {
            image: {
              common: {},
            },
          },
        },
      },
    }))).toEqual({
      mode: 'per-type',
      breakpoints: {
        desktop: {
          image: { adapterId: 'masonry' },
        },
      },
    });
  });

  it('clears campaign gallery overrides back to inherited defaults', () => {
    expect(clearCampaignGalleryOverrides()).toEqual({
      galleryOverrides: undefined,
    });
  });

  it('reports override presence and describes nested breakpoint-specific overrides', () => {
    const campaign = makeCampaign({
      galleryOverrides: {
        mode: 'per-type',
        breakpoints: {
          desktop: { image: { adapterId: 'masonry' } },
          tablet: { image: { adapterId: 'justified' } },
          mobile: { video: { adapterId: 'diamond' } },
        },
      },
    });

    expect(hasCampaignScopeOverrides(campaign.galleryOverrides, 'image')).toBe(true);
    expect(hasCampaignGalleryOverrides(campaign)).toBe(true);
    expect(describeCampaignGalleryOverrides(campaign)).toEqual([
      'Image: breakpoint-specific override',
      'Video: breakpoint-specific override',
      'Mode: per-type',
    ]);
  });

  it('describes unified campaign overrides using the unified scope', () => {
    const campaign = makeCampaign({
      galleryOverrides: {
        mode: 'unified',
        breakpoints: {
          desktop: { unified: { adapterId: 'classic' } },
          tablet: { unified: { adapterId: 'classic' } },
          mobile: { unified: { adapterId: 'classic' } },
        },
      },
    });

    expect(hasCampaignGalleryOverrides(campaign)).toBe(true);
    expect(describeCampaignGalleryOverrides(campaign)).toEqual([
      'Unified: classic',
      'Mode: unified',
    ]);
  });

  it('describes non-adapter responsive setting overrides', () => {
    const campaign = makeCampaign({
      galleryOverrides: {
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

    expect(hasCampaignGalleryOverrides(campaign)).toBe(true);
    expect(describeCampaignGalleryOverrides(campaign)).toEqual([
      'Responsive settings: customized',
    ]);
  });
});