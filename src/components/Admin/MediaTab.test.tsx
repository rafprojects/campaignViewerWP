import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import MediaTab from './MediaTab';

vi.mock('@mantine/notifications', () => ({
  showNotification: vi.fn(),
}));

describe('MediaTab', () => {
  const apiClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getBaseUrl: vi.fn().mockReturnValue('https://example.test'),
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test' }),
  } as unknown as {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getBaseUrl: ReturnType<typeof vi.fn>;
    getAuthHeaders: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    apiClient.get.mockReset();
    apiClient.post.mockReset();
    apiClient.put.mockReset();
    apiClient.delete.mockReset();
  });

  const renderWithMantine = (ui: React.ReactElement) =>
    render(<MantineProvider>{ui}</MantineProvider>);

  it('renders media items and supports edit/delete/reorder', async () => {
    apiClient.get.mockResolvedValueOnce([
      {
        id: 'm1',
        type: 'image',
        source: 'upload',
        url: 'https://example.com/1.jpg',
        thumbnail: 'https://example.com/1.jpg',
        caption: 'Item One',
        order: 1,
      },
      {
        id: 'm2',
        type: 'image',
        source: 'upload',
        url: 'https://example.com/2.jpg',
        thumbnail: 'https://example.com/2.jpg',
        caption: 'Item Two',
        order: 2,
      },
    ]);
    apiClient.put.mockResolvedValue({ id: 'm1', caption: 'Updated', thumbnail: 'https://example.com/1.jpg' });

    renderWithMantine(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    expect(await screen.findByText('Item One')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const captionInput = await screen.findByLabelText('Caption');
    fireEvent.change(captionInput, { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/media/m1',
        expect.objectContaining({ caption: 'Updated' }),
      );
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Move media down' })[0]);
    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/media/reorder',
        expect.any(Object),
      );
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete media' })[1]);
    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/campaigns/101/media/m1');
    });
  });

  it('auto-fetches external metadata and persists to server', async () => {
    apiClient.get
      .mockResolvedValueOnce([
        {
          id: 'm1',
          type: 'video',
          source: 'external',
          url: 'https://example.com/video',
          order: 1,
        },
      ])
      .mockResolvedValueOnce({ title: 'External Title', thumbnail_url: 'https://example.com/thumb.jpg' });

    apiClient.put.mockResolvedValue({});

    renderWithMantine(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/media/m1',
        expect.objectContaining({ caption: 'External Title', thumbnail: 'https://example.com/thumb.jpg' }),
      );
    });
  });
});
