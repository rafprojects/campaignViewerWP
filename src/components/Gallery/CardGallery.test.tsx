import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardGallery } from './CardGallery';
import type { Campaign, Company, MediaItem } from '@/types';

const company: Company = {
  id: 'acme',
  name: 'Acme',
  logo: '🏷️',
  brandColor: '#123456',
};

const baseMedia: MediaItem = {
  id: 'm1',
  type: 'image',
  source: 'upload',
  url: 'https://example.com/image.jpg',
  order: 1,
};

const buildCampaign = (id: string, title: string, visibility: 'public' | 'private'): Campaign => ({
  id,
  companyId: company.id,
  company,
  title,
  description: 'Test description',
  thumbnail: 'https://example.com/thumb.jpg',
  coverImage: 'https://example.com/cover.jpg',
  videos: [],
  images: [baseMedia],
  tags: ['test'],
  status: 'active',
  visibility,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
});

describe('CardGallery', () => {
  it('renders campaigns in lock mode by default', () => {
    render(
      <CardGallery
        campaigns={[
          buildCampaign('1', 'Public Campaign', 'public'),
          buildCampaign('2', 'Private Campaign', 'private'),
        ]}
        userPermissions={[]}
      />,
    );

    expect(screen.getByText('Public Campaign')).toBeInTheDocument();
    expect(screen.getByText('Private Campaign')).toBeInTheDocument();
  });

  it('hides inaccessible campaigns in hide mode', () => {
    render(
      <CardGallery
        campaigns={[
          buildCampaign('1', 'Public Campaign', 'public'),
          buildCampaign('2', 'Private Campaign', 'private'),
        ]}
        userPermissions={[]}
        accessMode="hide"
      />,
    );

    expect(screen.getByText('Public Campaign')).toBeInTheDocument();
    expect(screen.queryByText('Private Campaign')).not.toBeInTheDocument();
  });

  it('shows accessible campaigns in My Access filter', () => {
    render(
      <CardGallery
        campaigns={[
          buildCampaign('1', 'Public Campaign', 'public'),
          buildCampaign('2', 'Private Campaign', 'private'),
        ]}
        userPermissions={['2']}
      />,
    );

    fireEvent.click(screen.getByText('My Access'));

    expect(screen.getByText('Private Campaign')).toBeInTheDocument();
    expect(screen.getByText('Public Campaign')).toBeInTheDocument();
  });
});
