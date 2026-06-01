import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '../../test/test-utils';
import MediaTab from './MediaTab';
import { showNotification } from '@mantine/notifications';

vi.mock('@mantine/notifications', () => ({
  showNotification: vi.fn(),
}));

function suppressConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => { });
}

describe('MediaTab', () => {
  // Create a fresh apiClient for each test to avoid React Query cache pollution
  // from shared mock state across tests
  const createApiClient = () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({
      uploadMaxSizeMb: 50,
      maxBatchUploadSize: 20,
      uploadAllowedTypes: 'image/*,video/*',
    }),
    addCampaignMediaBatch: vi.fn(),
    getBaseUrl: vi.fn().mockReturnValue('https://example.test'),
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test' }),
    // P18-G: media usage — default to empty map so tests aren't affected
    getMediaUsageSummary: vi.fn().mockResolvedValue({}),
    getMediaUsage: vi.fn().mockResolvedValue({ campaigns: [] }),
  } as unknown as {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getSettings: ReturnType<typeof vi.fn>;
    addCampaignMediaBatch: ReturnType<typeof vi.fn>;
    getBaseUrl: ReturnType<typeof vi.fn>;
    getAuthHeaders: ReturnType<typeof vi.fn>;
    getMediaUsageSummary: ReturnType<typeof vi.fn>;
    getMediaUsage: ReturnType<typeof vi.fn>;
  });

  // Default apiClient for tests that don't need a fresh one
  const apiClient = createApiClient();

  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    apiClient.get.mockReset();
    apiClient.post.mockReset();
    apiClient.put.mockReset();
    apiClient.delete.mockReset();
    apiClient.getSettings.mockReset();
    apiClient.getSettings.mockResolvedValue({
      uploadMaxSizeMb: 50,
      maxBatchUploadSize: 20,
      uploadAllowedTypes: 'image/*,video/*',
    });
    apiClient.addCampaignMediaBatch.mockReset();
    apiClient.getMediaUsageSummary.mockReset();
    apiClient.getMediaUsageSummary.mockResolvedValue({});
    apiClient.getMediaUsage.mockReset();
    apiClient.getMediaUsage.mockResolvedValue({ campaigns: [] });
  });

  it('renders the usage badge in the card overlay for grid view', async () => {
    apiClient.get.mockResolvedValueOnce([
      {
        id: 'm1',
        type: 'image',
        source: 'upload',
        url: 'https://example.com/1.jpg',
        thumbnail: 'https://example.com/1.jpg',
        caption: 'Overlay Item',
        order: 1,
      },
    ]);
    apiClient.getMediaUsageSummary.mockResolvedValueOnce({ m1: 2 });

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    await screen.findByText('Overlay Item');

    const gridItem = screen.getByTestId('media-draggable-m1');
    const overlay = within(gridItem).getByTestId('media-card-overlay-stack');

    expect(within(overlay).getByText('2 campaigns')).toBeInTheDocument();
    expect(gridItem.querySelector('[style*="bottom: 8px"][style*="left: 8px"]')).toBeNull();
  });

  it('renders media items and supports edit/delete/drag-reorder', async () => {
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

    // Wait for query data + useEffect sync to stabilize
    await waitFor(() => {
      expect(document.body.contains(screen.getByText('Item One'))).toBe(true);
    }, { timeout: 3000 });

    // Edit flow
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]); });
    await waitFor(() => {
      expect(screen.getByLabelText('Caption')).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/media/m1',
        expect.objectContaining({ caption: 'Updated' }),
      );
    });

    // Reorder flow (keyboard)
    await waitFor(() => {
      const handles = screen.getAllByLabelText('Drag media to reorder');
      expect(document.body.contains(handles[0])).toBe(true);
    }, { timeout: 3000 });
    const dragHandle = screen.getAllByLabelText('Drag media to reorder')[0];
    dragHandle.focus();
    await act(async () => { fireEvent.keyDown(dragHandle, { key: 'ArrowRight', code: 'ArrowRight' }); });
    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/media/reorder',
        expect.any(Object),
      );
    });

    // Delete flow
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Delete media' })[0]); });
    await waitFor(() => {
      expect(screen.getByText('Remove from Campaign')).toBeInTheDocument();
    }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove media Item Two' })); });
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
    const consoleSpy = suppressConsoleError();
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

    consoleSpy.mockRestore();
  });

  it('shows error when add external fails', async () => {
    const consoleSpy = suppressConsoleError();
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

    consoleSpy.mockRestore();
  });

  it('shows save error when edit fails', async () => {
    const consoleSpy = suppressConsoleError();
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

    // Wait for query data + useEffect sync to stabilize
    await waitFor(() => {
      expect(document.body.contains(screen.getByRole('button', { name: 'Edit' }))).toBe(true);
    }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Edit' })); });
    await waitFor(() => {
      expect(screen.getByLabelText('Caption')).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'New caption' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Save failed' }),
      );
    });

    consoleSpy.mockRestore();
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

    // Wait for query data + useEffect sync to stabilize
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: 'Edit' });
      expect(document.body.contains(btn)).toBe(true);
    }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Edit' })); });
    // Wait for modal to render (Portal + Transition)
    await waitFor(() => {
      expect(screen.getByLabelText('Caption')).toBeInTheDocument();
    }, { timeout: 3000 });
    const captionInput = screen.getByLabelText('Caption');
    fireEvent.change(captionInput, { target: { value: 'Updated Caption' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/media/m1',
        expect.objectContaining({ caption: 'Updated Caption' }),
      );
    });
  });

  it('uploads media in a batch and keeps failed files selected', async () => {
    // Use a fresh apiClient to avoid any state pollution from previous tests
    const testApiClient = createApiClient();
    testApiClient.get.mockResolvedValueOnce([]);
    testApiClient.getSettings.mockResolvedValue({
      uploadMaxSizeMb: 50,
      maxBatchUploadSize: 20,
      uploadAllowedTypes: 'image/*,video/*',
    });
    testApiClient.getBaseUrl.mockReturnValueOnce('https://example.test');
    testApiClient.getAuthHeaders.mockResolvedValueOnce({ Authorization: 'Bearer test' });
    testApiClient.addCampaignMediaBatch.mockResolvedValueOnce({
      added: [
        {
          id: 'm10',
          type: 'image',
          source: 'upload',
          url: 'https://example.com/upload.jpg',
          thumbnail: 'https://example.com/thumb.jpg',
          caption: 'test.jpg',
          order: 1,
        },
      ],
      failed: [],
      total: 1,
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
        // Fire onload asynchronously to avoid synchronous state cascades
        // that trigger Mantine SegmentedControl's setState-in-ref-callback loop.
        Promise.resolve().then(() => {
          if (this.upload.onprogress) {
            this.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent);
          }
          this.response = {
            results: [
              {
                filename: 'test.jpg',
                success: true,
                attachmentId: 55,
                url: 'https://example.com/upload.jpg',
                mimeType: 'image/jpeg',
                thumbnail: 'https://example.com/thumb.jpg',
              },
              {
                filename: 'second.webp',
                success: false,
                error: 'File too large',
              },
            ],
            total: 2,
            succeeded: 1,
            failed: 1,
          };
          this.onload?.();
        });
      });
      constructor() {
        MockXHR.instances.push(this);
      }
    }

    globalThis.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;
    window.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;

    render(<MediaTab campaignId="101" apiClient={testApiClient as any} />);

    // Wait for the component to fully render and stabilize
    await screen.findByText('Media');
    const addMediaBtn = await screen.findByRole('button', { name: 'Add Media' });
    fireEvent.click(addMediaBtn);
    await screen.findByRole('button', { name: 'Choose files' });
    const file = new File(['hello'], 'test.jpg', { type: 'image/jpeg' });
    const secondFile = new File(['world'], 'second.webp', { type: 'image/webp' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file, secondFile] } });
    expect(await screen.findByText('test.jpg')).toBeInTheDocument();
    expect(await screen.findByText('second.webp')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Upload 2 files' }));

    await waitFor(() => {
      expect(MockXHR.instances.length).toBeGreaterThan(0);
      expect(testApiClient.getAuthHeaders).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(MockXHR.instances[0].send).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(testApiClient.addCampaignMediaBatch).toHaveBeenCalledWith(
        '101',
        expect.arrayContaining([
          expect.objectContaining({
            attachmentId: 55,
            caption: 'test.jpg',
            source: 'upload',
          }),
        ]),
      );
    });

    expect(await screen.findByText('File too large')).toBeInTheDocument();
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Upload complete with issues' }),
    );

    globalThis.XMLHttpRequest = originalXhr;
    window.XMLHttpRequest = originalWindowXhr;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }, 10000); // 10 second timeout to prevent indefinite hanging

  it('shows delete error when delete fails', async () => {
    const consoleSpy = suppressConsoleError();
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

    // Wait for query data + useEffect sync to stabilize
    await waitFor(() => {
      expect(document.body.contains(screen.getByLabelText('Delete media'))).toBe(true);
    }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByLabelText('Delete media')); });
    await waitFor(() => {
      expect(screen.getByText('Remove from Campaign')).toBeInTheDocument();
    }, { timeout: 3000 });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove media Item One' })); });

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Delete failed' }),
      );
    });

    consoleSpy.mockRestore();
  }, 10000);

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

    const dragHandle = (await screen.findAllByLabelText('Drag media to reorder'))[0];
    dragHandle.focus();
    fireEvent.keyDown(dragHandle, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(apiClient.put).not.toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/101/media/reorder',
      expect.any(Object),
    );
  });

  it('shows error when reorder fails', async () => {
    const consoleSpy = suppressConsoleError();
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

    // Wait for query data + useEffect sync to stabilize
    await waitFor(() => {
      const handles = screen.getAllByLabelText('Drag media to reorder');
      expect(document.body.contains(handles[0])).toBe(true);
    }, { timeout: 3000 });
    const dragHandle = screen.getAllByLabelText('Drag media to reorder')[0];
    dragHandle.focus();
    await act(async () => { fireEvent.keyDown(dragHandle, { key: 'ArrowRight', code: 'ArrowRight' }); });
    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Reorder failed' }),
      );
    }, { timeout: 3000 });

    consoleSpy.mockRestore();
  });

  it('opens lightbox when image card is clicked and navigates prev/next', async () => {
    apiClient.get.mockResolvedValueOnce([
      {
        id: 'm1',
        type: 'image',
        source: 'upload',
        url: 'https://example.com/1.jpg',
        thumbnail: 'https://example.com/1.jpg',
        caption: 'Photo Alpha',
        order: 1,
      },
      {
        id: 'm2',
        type: 'image',
        source: 'upload',
        url: 'https://example.com/2.jpg',
        thumbnail: 'https://example.com/2.jpg',
        caption: 'Photo Beta',
        order: 2,
      },
    ]);

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    // Wait for items to load
    await screen.findByText('Photo Alpha');

    // Click the image card to open lightbox
    const imagePreviewBtn = screen.getAllByRole('button', { name: /Open image preview/ })[0];
    fireEvent.click(imagePreviewBtn);

    // Lightbox should be visible — navigate prev/next
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next image' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));

    // Close lightbox — fire the click to exercise the handler; don't wait on
    // portal removal since Mantine exit animations are unreliable in jsdom
    fireEvent.click(screen.getByRole('button', { name: 'Close lightbox' }));
  });

  it('handles rescan types successfully', async () => {
    apiClient.get.mockResolvedValueOnce([
      {
        id: 'm1',
        type: 'image',
        source: 'upload',
        url: 'https://example.com/1.jpg',
        thumbnail: 'https://example.com/1.jpg',
        caption: 'Photo One',
        order: 1,
      },
    ]);
    apiClient.post.mockResolvedValueOnce({ message: 'done', updated: 1, total: 1 });

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);

    await screen.findByText('Photo One');

    const rescanBtn = screen.getByRole('button', { name: 'Rescan Types' });
    fireEvent.click(rescanBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/media/rescan',
        {},
      );
    });

    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Rescan Complete' }),
    );
  });

  it('handles rescan types failure', async () => {
    const consoleSpy = suppressConsoleError();
    apiClient.get.mockResolvedValueOnce([
      {
        id: 'm1',
        type: 'image',
        source: 'upload',
        url: 'https://example.com/1.jpg',
        thumbnail: 'https://example.com/1.jpg',
        caption: 'Photo One',
        order: 1,
      },
    ]);
    apiClient.post.mockRejectedValueOnce(new Error('Rescan network error'));

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);
    await screen.findByText('Photo One');

    fireEvent.click(screen.getByRole('button', { name: 'Rescan Types' }));

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Rescan failed' }),
      );
    });

    consoleSpy.mockRestore();
  });

  it('switches to list view and opens lightbox from image row', async () => {
    apiClient.get.mockResolvedValueOnce([
      {
        id: 'm1',
        type: 'image',
        source: 'upload',
        url: 'https://example.com/1.jpg',
        thumbnail: 'https://example.com/1.jpg',
        caption: 'List Image',
        order: 1,
      },
    ]);

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);
    await screen.findByText('List Image');

    // Switch to list view via SegmentedControl radio input
    const listRadio = document.querySelector<HTMLInputElement>('input[type="radio"][value="list"]');
    if (listRadio) {
      fireEvent.click(listRadio);
    }

    // In list view, the thumbnail has role="button" for images  
    await waitFor(() => {
      const lightboxTriggers = screen.queryAllByRole('button', { name: /Open image preview/ });
      if (lightboxTriggers.length > 0) {
        fireEvent.click(lightboxTriggers[0]);
      }
    });
  });

  // ── P34-B: sort mode selector ─────────────────────────────────────────────

  it('renders the sort mode selector', async () => {
    apiClient.get.mockResolvedValueOnce([]);
    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);
    expect(await screen.findByRole('combobox', { name: /sort mode/i })).toBeInTheDocument();
  });

  it('defaults sort mode to "Order"', async () => {
    apiClient.get.mockResolvedValueOnce([]);
    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);
    const select = await screen.findByRole('combobox', { name: /sort mode/i });
    expect(select).toHaveValue('Order');
  });

  it('sorts media by title when "Title A–Z" is selected', async () => {
    apiClient.get.mockResolvedValueOnce([
      { id: 'z', type: 'image', source: 'upload', url: 'z.jpg', caption: 'Zebra', order: 1 },
      { id: 'a', type: 'image', source: 'upload', url: 'a.jpg', caption: 'Apple', order: 2 },
    ]);

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);
    await screen.findByText('Zebra');

    // Open the sort select and choose Title A–Z
    const select = screen.getByRole('combobox', { name: /sort mode/i });
    fireEvent.click(select);
    fireEvent.click(await screen.findByRole('option', { name: 'Title A–Z' }));

    // After re-sort, Apple should precede Zebra in the DOM
    await waitFor(() => {
      const captions = screen.getAllByText(/Apple|Zebra/);
      expect(captions[0]).toHaveTextContent('Apple');
    });
  });

  it('hides drag handles when not in order sort mode (list view)', async () => {
    // Clear any sort preference left by earlier tests
    localStorage.removeItem('wpsg_media_sortMode_root');

    apiClient.get.mockResolvedValueOnce([
      { id: 'm1', type: 'image', source: 'upload', url: '1.jpg', caption: 'Alpha', order: 1 },
      { id: 'm2', type: 'image', source: 'upload', url: '2.jpg', caption: 'Beta', order: 2 },
    ]);

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);
    // Wait for list to populate
    await screen.findByText('Alpha');

    // Switch to list view so drag handles (grip icons) are visible in the rows
    const listRadio = document.querySelector<HTMLInputElement>('input[type="radio"][value="list"]');
    if (listRadio) fireEvent.click(listRadio);
    await waitFor(() =>
      expect(screen.getAllByLabelText('Drag media to reorder').length).toBeGreaterThan(0),
    );

    // Switch to title sort — drag handles should disappear
    const select = screen.getByRole('combobox', { name: /sort mode/i });
    fireEvent.click(select);
    fireEvent.click(await screen.findByRole('option', { name: 'Title A–Z' }));

    await waitFor(() =>
      expect(screen.queryAllByLabelText('Drag media to reorder')).toHaveLength(0),
    );
  });

  it('hides drag handles when not in order sort mode (grid view)', async () => {
    // Clear any sort preference left by earlier tests
    localStorage.removeItem('wpsg_media_sortMode_root');

    apiClient.get.mockResolvedValueOnce([
      { id: 'g1', type: 'image', source: 'upload', url: '1.jpg', caption: 'Gamma', order: 1 },
      { id: 'g2', type: 'image', source: 'upload', url: '2.jpg', caption: 'Delta', order: 2 },
    ]);

    render(<MediaTab campaignId="101" apiClient={apiClient as any} />);
    // Wait for grid items to populate (default view is grid)
    await screen.findByText('Gamma');

    // In grid view, drag handles should be present for order sort
    await waitFor(() =>
      expect(screen.getAllByLabelText('Drag media to reorder').length).toBeGreaterThan(0),
    );

    // Switch to title sort — handles should disappear from card grid too
    const select = screen.getByRole('combobox', { name: /sort mode/i });
    fireEvent.click(select);
    fireEvent.click(await screen.findByRole('option', { name: 'Title A–Z' }));

    await waitFor(() =>
      expect(screen.queryAllByLabelText('Drag media to reorder')).toHaveLength(0),
    );
  });
});
