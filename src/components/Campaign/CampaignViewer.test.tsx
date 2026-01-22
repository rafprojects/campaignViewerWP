import { render, screen } from '@testing-library/react';
import { CampaignViewer } from './CampaignViewer';
import type { Campaign, Company, MediaItem } from '@/types';

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
        isAdmin={false}
        onClose={() => undefined}
      />,
    );

    expect(
      screen.getByText('This campaign is private. Sign in or request access to view media.'),
    ).toBeInTheDocument();
  });
});
