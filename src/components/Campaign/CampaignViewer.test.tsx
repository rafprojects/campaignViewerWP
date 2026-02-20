import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { CampaignViewer } from './CampaignViewer';
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
      <CampaignViewer
        campaign={campaign}
        hasAccess={false}
        galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        isAdmin={false}
        onClose={() => undefined}
      />,
    );

    expect(
      screen.getByText('This campaign is private. Sign in or request access to view media.'),
    ).toBeInTheDocument();
  });

  it('fires admin actions when enabled', () => {
    const onEditCampaign = vi.fn();
    const onArchiveCampaign = vi.fn();
    const onAddExternalMedia = vi.fn();

    render(
      <CampaignViewer
        campaign={campaign}
        hasAccess
        galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        isAdmin
        onEditCampaign={onEditCampaign}
        onArchiveCampaign={onArchiveCampaign}
        onAddExternalMedia={onAddExternalMedia}
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Private Campaign' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage media for Private Campaign' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive Private Campaign' }));

    expect(onEditCampaign).toHaveBeenCalled();
    expect(onAddExternalMedia).toHaveBeenCalled();
    expect(onArchiveCampaign).toHaveBeenCalled();
  });
});
