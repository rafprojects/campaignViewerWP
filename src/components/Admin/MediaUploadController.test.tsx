import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { MediaUploadController, GENERAL_LIBRARY_TARGET } from './MediaUploadController';
import type { ApiClient } from '@/services/apiClient';

// Silence notifications (no <Notifications/> provider in the test tree).
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

// Campaign uploads route through useXhrUpload.uploadMany — stub it.
const uploadMany = vi.fn();
vi.mock('@/hooks/useXhrUpload', () => ({
  useXhrUpload: () => ({
    upload: vi.fn(),
    uploadMany,
    progress: null,
    batchProgress: null,
    isUploading: false,
    resetProgress: vi.fn(),
    abort: vi.fn(),
  }),
}));

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    getBaseUrl: () => 'https://wp.test',
    getAuthHeaders: vi.fn().mockResolvedValue({ 'X-WP-Nonce': 'n' }),
    postForm: vi.fn().mockResolvedValue({ id: 'ov1' }),
    post: vi.fn().mockResolvedValue({}),
    addCampaignMediaBatch: vi.fn().mockResolvedValue({ added: [], failed: [], total: 0 }),
    ...overrides,
  } as unknown as ApiClient;
}

function selectFile(name = 'pic.png', type = 'image/png') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], name, { type });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

const campaigns = [{ id: 1, title: 'Campaign One' }];

describe('MediaUploadController', () => {
  beforeEach(() => {
    uploadMany.mockReset();
    uploadMany.mockResolvedValue({
      results: [{ filename: 'pic.png', success: true, attachmentId: 9, url: 'https://wp.test/pic.png', thumbnail: 'https://wp.test/pic.png' }],
      total: 1,
      succeeded: 1,
      failed: 0,
    });
  });

  it('shows the "Add to" selector with a general-library option', () => {
    render(
      <MediaUploadController
        opened
        onClose={vi.fn()}
        apiClient={makeApiClient()}
        campaigns={campaigns}
        defaultTarget={GENERAL_LIBRARY_TARGET}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Add to' })).toBeDefined();
  });

  it('routes a general-library upload to the asset-library endpoint with the universal flag', async () => {
    const apiClient = makeApiClient();
    render(
      <MediaUploadController
        opened
        onClose={vi.fn()}
        apiClient={apiClient}
        campaigns={campaigns}
        defaultTarget={GENERAL_LIBRARY_TARGET}
      />,
    );

    // Opt the asset into universal visibility, then queue a file and upload.
    fireEvent.click(screen.getByLabelText(/Make available to all spaces/i));
    selectFile();
    fireEvent.click(screen.getByRole('button', { name: /^Upload$/i }));

    await waitFor(() => expect(apiClient.postForm).toHaveBeenCalledTimes(1));
    const [path, formData] = (apiClient.postForm as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe('/wp-json/wp-super-gallery/v1/admin/asset-library');
    expect((formData as FormData).get('is_universal')).toBe('1');
    expect(uploadMany).not.toHaveBeenCalled();
  });

  it('routes a campaign upload through media/upload then addCampaignMediaBatch', async () => {
    const apiClient = makeApiClient();
    render(
      <MediaUploadController
        opened
        onClose={vi.fn()}
        apiClient={apiClient}
        campaigns={campaigns}
        defaultTarget="1"
      />,
    );

    selectFile();
    fireEvent.click(screen.getByRole('button', { name: /^Upload$/i }));

    await waitFor(() => expect(uploadMany).toHaveBeenCalledTimes(1));
    expect(uploadMany.mock.calls[0][0].url).toContain('/media/upload');
    expect(uploadMany.mock.calls[0][0].extraFields).toEqual({ campaign_id: '1' });
    await waitFor(() => expect(apiClient.addCampaignMediaBatch).toHaveBeenCalledTimes(1));
    expect((apiClient.addCampaignMediaBatch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('1');
    // General-library endpoint must not be touched on the campaign path.
    expect(apiClient.postForm).not.toHaveBeenCalled();
  });
});
