import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import MediaTab from './MediaTab';
import { showNotification } from '@mantine/notifications';

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

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

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

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete media' })[0]);
    // Wait for the delete confirmation modal to appear
    await waitFor(() => {
      expect(screen.getByText('Delete Media')).toBeInTheDocument();
    });
    // Confirm deletion in the modal
    fireEvent.click(screen.getByRole('button', { name: 'Delete media Item Two' }));
    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/campaigns/101/media/m2');
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

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/media/m1',
        expect.objectContaining({ caption: 'External Title', thumbnail: 'https://example.com/thumb.jpg' }),
      );
    });
  });

  it('shows error for invalid external url on add', async () => {
    apiClient.get.mockResolvedValueOnce([]);

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add Media' }));
    const urlInput = await screen.findByPlaceholderText('https://youtube.com/...');
    fireEvent.change(urlInput, {
      target: { value: 'http://example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add external media' }));

    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Invalid URL' }),
    );
  });

  it('loads external preview and adds external media', async () => {
    apiClient.get
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        title: 'Preview Title',
        thumbnail_url: 'https://example.com/preview.jpg',
        provider_name: 'YouTube',
        type: 'video',
      });
    apiClient.post.mockResolvedValue({
      id: 'm3',
      type: 'video',
      source: 'external',
      url: 'https://example.com/video',
      caption: 'Preview Title',
      thumbnail: 'https://example.com/preview.jpg',
      order: 1,
    });

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add Media' }));
    const urlInput = await screen.findByPlaceholderText('https://youtube.com/...');
    fireEvent.change(urlInput, {
      target: { value: 'https://example.com/video' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Preview external media' }));
    expect(await screen.findByText('Preview Title')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add external media' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/media',
        expect.objectContaining({ source: 'external', url: 'https://example.com/video' }),
      );
    });
  });

  it('shows error when preview url is invalid', async () => {
    apiClient.get.mockResolvedValueOnce([]);

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add Media' }));
    const urlInput = await screen.findByPlaceholderText('https://youtube.com/...');
    fireEvent.change(urlInput, { target: { value: 'http://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview external media' }));

    expect(await screen.findByText('Please enter a valid https URL.')).toBeInTheDocument();
  });

  it('shows error when preview fetch fails', async () => {
    apiClient.get
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Preview failed'));

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add Media' }));
    const urlInput = await screen.findByPlaceholderText('https://youtube.com/...');
    fireEvent.change(urlInput, { target: { value: 'https://example.com/video' } });

    fireEvent.click(screen.getByRole('button', { name: 'Preview external media' }));

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Preview failed' }),
      );
    });
  });

  it('shows error when add external fails', async () => {
    apiClient.get.mockResolvedValueOnce([]);
    apiClient.post.mockRejectedValueOnce(new Error('Add failed'));

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add Media' }));
    const urlInput = await screen.findByPlaceholderText('https://youtube.com/...');
    fireEvent.change(urlInput, { target: { value: 'https://example.com/video' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add external media' }));

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Add failed' }),
      );
    });
  });

  it('shows save error when edit fails', async () => {
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
    ]);
    apiClient.put.mockRejectedValueOnce(new Error('Save failed'));

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const captionInput = await screen.findByLabelText('Caption');
    fireEvent.change(captionInput, { target: { value: 'New caption' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Save failed' }),
      );
    });
  });

  it('saves edits successfully', async () => {
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
    ]);
    apiClient.put.mockResolvedValueOnce({
      id: 'm1',
      type: 'image',
      source: 'upload',
      url: 'https://example.com/1.jpg',
      thumbnail: 'https://example.com/1.jpg',
      caption: 'Updated Caption',
      order: 1,
    });

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const captionInput = await screen.findByLabelText('Caption');
    fireEvent.change(captionInput, { target: { value: 'Updated Caption' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/media/m1',
        expect.objectContaining({ caption: 'Updated Caption' }),
      );
    });
  });

  it('uploads media successfully', async () => {
    apiClient.get.mockResolvedValueOnce([]);
    apiClient.get.mockResolvedValueOnce([]);
    apiClient.getBaseUrl.mockReturnValueOnce('https://example.test');
    apiClient.getAuthHeaders.mockResolvedValueOnce({ Authorization: 'Bearer test' });
    apiClient.post.mockResolvedValueOnce({
      id: 'm10',
      type: 'image',
      source: 'upload',
      url: 'https://example.com/upload.jpg',
      thumbnail: 'https://example.com/thumb.jpg',
      caption: 'test.jpg',
      order: 1,
    });

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();

    const originalXhr = globalThis.XMLHttpRequest;
    const originalWindowXhr = window.XMLHttpRequest;
    class MockXHR {
      static instances: MockXHR[] = [];
      upload: { onprogress?: (e: ProgressEvent) => void } = {};
      responseType = '';
      response: any = null;
      status = 200;
      statusText = 'OK';
      readyState = 4;
      onload?: () => void;
      onerror?: () => void;
      open = vi.fn();
      setRequestHeader = vi.fn();
      send = vi.fn(() => {
        if (this.upload.onprogress) {
          this.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent);
        }
        this.response = {
          attachmentId: 55,
          url: 'https://example.com/upload.jpg',
          mimeType: 'image/jpeg',
          thumbnail: 'https://example.com/thumb.jpg',
        };
        this.onload?.();
      });
      constructor() {
        MockXHR.instances.push(this);
      }
    }
    globalThis.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;
    window.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add Media' }));
    await screen.findByRole('button', { name: 'Choose file' });
    const file = new File(['hello'], 'test.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(await screen.findByText('test.jpg')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(MockXHR.instances.length).toBeGreaterThan(0);
      expect(apiClient.getAuthHeaders).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(MockXHR.instances[0].send).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/media',
        expect.objectContaining({ caption: 'test.jpg' }),
      );
    });

    globalThis.XMLHttpRequest = originalXhr;
    window.XMLHttpRequest = originalWindowXhr;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('shows delete error when delete fails', async () => {
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
    ]);
    apiClient.delete.mockRejectedValueOnce(new Error('Delete failed'));

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    fireEvent.click(await screen.findByLabelText('Delete media'));
    await screen.findByText('Delete Media');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete media Item One' }));

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Delete failed' }),
      );
    });
  });

  it('does not reorder when only one item exists', async () => {
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
    ]);

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    fireEvent.click(await screen.findByLabelText('Move media up'));
    expect(apiClient.put).not.toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/101/media/reorder',
      expect.any(Object),
    );
  });

  it('shows error when reorder fails', async () => {
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
    apiClient.put.mockRejectedValueOnce(new Error('Reorder failed'));

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    const downButtons = await screen.findAllByLabelText('Move media down');
    fireEvent.click(downButtons[0]);
    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Reorder failed' }),
      );
    });
  });
});
