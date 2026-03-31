import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/test-utils';
import { AuthBarFloating } from './AuthBarFloating';
import { CampaignContextProvider, useCampaignContext } from '@/contexts/CampaignContext';
import type { Campaign, Company, MediaItem } from '@/types';

const company: Company = {
  id: 'acme',
  name: 'Acme',
  logo: 'AC',
  brandColor: '#123456',
};

const media: MediaItem = {
  id: 'm1',
  type: 'image',
  source: 'upload',
  url: 'https://example.com/image.jpg',
  order: 1,
};

const activeCampaign: Campaign = {
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

function ActivateCampaign({ campaign }: { campaign: Campaign }) {
  const { setActiveCampaign } = useCampaignContext();

  useEffect(() => {
    setActiveCampaign(campaign);
  }, [campaign, setActiveCampaign]);

  return null;
}

describe('AuthBarFloating', () => {
  it('shows the Edit Gallery Config action for an active admin campaign and calls the handler', async () => {
    const onEditGalleryConfig = vi.fn();

    render(
      <CampaignContextProvider onEditGalleryConfig={onEditGalleryConfig}>
        <ActivateCampaign campaign={activeCampaign} />
        <AuthBarFloating
          email="admin@example.com"
          isAdmin
          onOpenAdminPanel={() => undefined}
          onOpenSettings={() => undefined}
          onLogout={() => undefined}
        />
      </CampaignContextProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Admin menu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit gallery config for Private Campaign' }));

    expect(onEditGalleryConfig).toHaveBeenCalledWith(activeCampaign);
    expect(screen.queryByText('Edit Gallery Config')).not.toBeInTheDocument();
  });
});