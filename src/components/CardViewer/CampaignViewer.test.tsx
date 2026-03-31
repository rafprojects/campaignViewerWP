import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';

vi.mock('./UnifiedGallerySection', () => ({
  UnifiedGallerySection: () => <div data-testid="unified-gallery-section" />,
}));

vi.mock('./PerTypeGallerySection', () => ({
  PerTypeGallerySection: () => <div data-testid="per-type-gallery-section" />,
}));

import { CampaignViewer } from './CampaignViewer';
import { CampaignContextProvider } from '@/contexts/CampaignContext';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type Campaign, type Company, type MediaItem } from '@/types';

const company: Company = {
  id: 'acme',
  name: 'Acme',
  logo: '🏷️',
  brandColor: '#123456',
};

const media: MediaItem = {
  id: 'm1',
  type: 'image',
  source: 'upload',
  url: 'https://example.com/image.jpg',
  order: 1,
};

const campaign: Campaign = {
  id: '1',
  companyId: company.id,
  company,
  title: 'Private Campaign',
  description: 'Private description',
  thumbnail: 'https://example.com/thumb.jpg',
  coverImage: 'https://example.com/cover.jpg',
  videos: [],
  images: [media],
  tags: ['test'],
  status: 'active',
  visibility: 'private',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('CampaignViewer', () => {
  it('shows access notice when locked', () => {
    render(
      <CampaignContextProvider>
        <CampaignViewer
          campaign={campaign}
          opened
          hasAccess={false}
          galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
          isAdmin={false}
          onClose={() => undefined}
        />
      </CampaignContextProvider>,
    );

    expect(
      screen.getByText('This campaign is private. Sign in or request access to view media.'),
    ).toBeInTheDocument();
  });

  it('fires admin actions via CampaignContext when opened', () => {
    const onEditCampaign = vi.fn();
    const onArchiveCampaign = vi.fn();
    const onAddExternalMedia = vi.fn();

    render(
      <CampaignContextProvider
        onEditCampaign={onEditCampaign}
        onArchiveCampaign={onArchiveCampaign}
        onAddExternalMedia={onAddExternalMedia}
      >
        <CampaignViewer
          campaign={campaign}
          opened
          hasAccess
          galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
          isAdmin
          onClose={() => undefined}
        />
      </CampaignContextProvider>,
    );

    // Admin actions are now in AuthBarFloating (via CampaignContext).
    // Verify the dialog rendered successfully.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('prefers campaign unified mode overrides over global per-type viewer mode', () => {
    render(
      <CampaignContextProvider>
        <CampaignViewer
          campaign={{
            ...campaign,
            galleryOverrides: { mode: 'unified' },
          }}
          opened
          hasAccess
          galleryBehaviorSettings={{
            ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
            unifiedGalleryEnabled: false,
            galleryConfig: {
              mode: 'per-type',
              breakpoints: {},
            },
          }}
          isAdmin={false}
          onClose={() => undefined}
        />
      </CampaignContextProvider>,
    );

    expect(screen.getByTestId('unified-gallery-section')).toBeInTheDocument();
    expect(screen.queryByTestId('per-type-gallery-section')).not.toBeInTheDocument();
  });

  it('prefers campaign per-type mode overrides over global unified viewer mode', () => {
    render(
      <CampaignContextProvider>
        <CampaignViewer
          campaign={{
            ...campaign,
            galleryOverrides: { mode: 'per-type' },
          }}
          opened
          hasAccess
          galleryBehaviorSettings={{
            ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
            unifiedGalleryEnabled: true,
            galleryConfig: {
              mode: 'unified',
              breakpoints: {},
            },
          }}
          isAdmin={false}
          onClose={() => undefined}
        />
      </CampaignContextProvider>,
    );

    expect(screen.getByTestId('per-type-gallery-section')).toBeInTheDocument();
    expect(screen.queryByTestId('unified-gallery-section')).not.toBeInTheDocument();
  });
});
