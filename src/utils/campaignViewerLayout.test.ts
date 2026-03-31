import { describe, expect, it } from 'vitest';

import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';

import { resolveCampaignViewerGalleryShellLayout } from './campaignViewerLayout';

describe('campaignViewerLayout', () => {
  it('clamps outer gallery shell spacing and width values', () => {
    const layout = resolveCampaignViewerGalleryShellLayout({
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      modalGalleryGap: 999,
      modalGalleryMargin: 999,
      modalGalleryMaxWidth: 99999,
    });

    expect(layout.galleryGap).toBe(64);
    expect(layout.maxWidth).toBe('3000px');
    expect(layout.paddingLeft).toBe('120px');
    expect(layout.paddingRight).toBe('120px');
  });

  it('resolves gallery mode from campaign overrides while keeping default shell values', () => {
    const layout = resolveCampaignViewerGalleryShellLayout(
      {
        ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
        unifiedGalleryEnabled: false,
      },
      {
        mode: 'unified',
      },
    );

    expect(layout.galleryMode).toBe('unified');
    expect(layout.galleryGap).toBe(32);
    expect(layout.maxWidth).toBe('100%');
  });
});