/**
 * Branch-coverage tests for MediaUploadController (hand-authored) — targets the
 * campaign upload path, the success/failure notification branches, and the
 * single-file caption/title handling that the base test does not exercise.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { MediaUploadController } from './MediaUploadController';
import type { ApiClient } from '@/services/apiClient';

const { notifyShow, uploadMany } = vi.hoisted(() => ({ notifyShow: vi.fn(), uploadMany: vi.fn() }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: notifyShow } }));

vi.mock('@wp-super-gallery/shared-utils', async () => {
  const actual = await vi.importActual<typeof import('@wp-super-gallery/shared-utils')>('@wp-super-gallery/shared-utils');
  return {
    ...actual,
    useXhrUpload: () => ({
      upload: vi.fn(), uploadMany, progress: null, batchProgress: null,
      isUploading: false, resetProgress: vi.fn(), abort: vi.fn(),
    }),
  };
});

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    getBaseUrl: () => 'https://wp.test',
    getAuthHeaders: vi.fn().mockResolvedValue({ 'X-WP-Nonce': 'n' }),
    postForm: vi.fn().mockResolvedValue({ id: 'ov1' }),
    post: vi.fn().mockResolvedValue({}),
    addCampaignMediaBatch: vi.fn().mockResolvedValue({ added: [{ id: 'm1' }], failed: [], total: 1 }),
    ...overrides,
  } as unknown as ApiClient;
}

function selectFiles(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

const campaigns = [{ id: 1, title: 'Campaign One' }];

function clickUpload() {
  fireEvent.click(screen.getByRole('button', { name: /^Upload\b/i }));
}

beforeEach(() => {
  notifyShow.mockReset();
  uploadMany.mockReset();
});

describe('campaign upload path', () => {
  it('uploads a single file to a campaign and adds it via the batch endpoint', async () => {
    uploadMany.mockResolvedValue({
      results: [{ filename: 'p.png', success: true, attachmentId: 9, url: 'https://wp.test/p.png', thumbnail: 'https://wp.test/t.png' }],
      total: 1, succeeded: 1, failed: 0,
    });
    const apiClient = makeApiClient();
    render(
      <MediaUploadController opened onClose={vi.fn()} apiClient={apiClient} campaigns={campaigns} defaultTarget="1" />,
    );
    selectFiles([new File(['x'], 'p.png', { type: 'image/png' })]);
    clickUpload();
    await waitFor(() => expect(apiClient.addCampaignMediaBatch).toHaveBeenCalled());
    await waitFor(() => expect(notifyShow).toHaveBeenCalledWith(expect.objectContaining({ color: 'green' })));
  });

  it('reports partial failures with a red notification', async () => {
    uploadMany.mockResolvedValue({
      results: [
        { filename: 'ok.png', success: true, attachmentId: 9, url: 'https://wp.test/ok.png' },
        { filename: 'bad.png', success: false, error: 'boom' },
      ],
      total: 2, succeeded: 1, failed: 1,
    });
    const apiClient = makeApiClient();
    render(
      <MediaUploadController opened onClose={vi.fn()} apiClient={apiClient} campaigns={campaigns} defaultTarget="1" />,
    );
    selectFiles([
      new File(['x'], 'ok.png', { type: 'image/png' }),
      new File(['y'], 'bad.png', { type: 'image/png' }),
    ]);
    clickUpload();
    await waitFor(() => expect(notifyShow).toHaveBeenCalledWith(expect.objectContaining({ color: 'red' })));
  });
});
