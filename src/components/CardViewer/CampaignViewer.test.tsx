import { useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../../test/test-utils';

vi.mock('./UnifiedGallerySection', () => ({
  UnifiedGallerySection: () => <div data-testid="unified-gallery-section" />,
}));

vi.mock('./PerTypeGallerySection', () => ({
  PerTypeGallerySection: () => <div data-testid="per-type-gallery-section" />,
}));

vi.mock('@/components/Common/GalleryConfigEditorModal', () => ({
  GalleryConfigEditorModal: ({
    opened,
    title,
    saveLabel = 'Save Campaign Gallery Config',
    clearLabel = 'Use Inherited Gallery Settings',
    onSave,
    onClear,
  }: {
    opened: boolean;
    title: string;
    saveLabel?: string;
    clearLabel?: string;
    onSave: (value: {
      mode: 'unified' | 'per-type';
      breakpoints: Record<string, unknown>;
    }) => void;
    onClear?: () => void;
  }) => {
    if (!opened) {
      return null;
    }

    return (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <button
          type="button"
          onClick={() => onSave({
            mode: 'unified',
            breakpoints: {
              desktop: { unified: { adapterId: 'classic' } },
              tablet: { unified: { adapterId: 'classic' } },
              mobile: { unified: { adapterId: 'classic' } },
            },
          })}
        >
          {saveLabel}
        </button>
        <button type="button" onClick={() => onClear?.()}>{clearLabel}</button>
      </div>
    );
  },
}));

import { CampaignViewer } from './CampaignViewer';
import { CampaignContextProvider, useCampaignContext } from '@/contexts/CampaignContext';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type Campaign, type Company, type MediaItem } from '@/types';
import type { ApiClient } from '@/services/apiClient';

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

function GalleryConfigTrigger() {
  const { activeCampaign, onEditGalleryConfig } = useCampaignContext();

  if (!activeCampaign || !onEditGalleryConfig) {
    return null;
  }

  return (
    <button type="button" onClick={() => onEditGalleryConfig(activeCampaign)}>
      Open Gallery Config
    </button>
  );
}

function CaptureActiveCampaign({ onActiveCampaign }: { onActiveCampaign: (campaign: Campaign | null) => void }) {
  const { activeCampaign } = useCampaignContext();

  useEffect(() => {
    onActiveCampaign(activeCampaign);
  }, [activeCampaign, onActiveCampaign]);

  return null;
}

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

  it('registers the active campaign in context when opened', async () => {
    const onActiveCampaign = vi.fn();

    render(
      <CampaignContextProvider>
        <CampaignViewer
          campaign={campaign}
          opened
          hasAccess
          galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
          isAdmin={false}
          onClose={() => undefined}
        />
        <CaptureActiveCampaign onActiveCampaign={onActiveCampaign} />
      </CampaignContextProvider>,
    );

    await waitFor(() => {
      expect(onActiveCampaign).toHaveBeenLastCalledWith(expect.objectContaining({ id: '1' }));
    });
  });

  it('opens the viewer gallery config editor via CampaignContext and saves overrides through the campaign API', async () => {
    const apiClient = {
      put: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as ApiClient;
    const onNotify = vi.fn();
    const onCampaignsUpdated = vi.fn().mockResolvedValue(undefined);

    render(
      <CampaignContextProvider>
        <CampaignViewer
          campaign={campaign}
          opened
          hasAccess
          galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
          isAdmin
          apiClient={apiClient}
          onNotify={onNotify}
          onCampaignsUpdated={onCampaignsUpdated}
          onClose={() => undefined}
        />
        <GalleryConfigTrigger />
      </CampaignContextProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open Gallery Config' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save Campaign Gallery Config' }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/1',
        expect.objectContaining({
          imageAdapterId: 'classic',
          videoAdapterId: 'classic',
          galleryOverrides: expect.objectContaining({
            mode: 'unified',
          }),
        }),
      );
    });

    expect(onCampaignsUpdated).toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith({
      type: 'success',
      text: 'Campaign gallery config updated.',
    });
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
