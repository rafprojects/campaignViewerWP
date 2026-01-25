import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  uploadFile,
  getOEmbed,
  getCampaignMedia,
  addMediaToCampaign,
  updateMedia,
  deleteMedia,
  reorderMedia,
} from './media';

class MockXHR {
  method = '';
  url = '';
  headers: Record<string, string> = {};
  responseType = '';
  status = 0;
  response: unknown = null;
  responseText = '';
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  upload: { onprogress?: (e: ProgressEvent) => void } = {};

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  send() {
    // no-op
  }

  triggerLoad(status: number, response: unknown) {
    this.status = status;
    this.response = response;
    this.onload?.();
  }

  triggerError() {
    this.onerror?.();
  }
}

describe('media api helpers', () => {
  let lastXHR: MockXHR | null = null;

  beforeEach(() => {
    lastXHR = null;
    (globalThis as unknown as { XMLHttpRequest: typeof MockXHR }).XMLHttpRequest = class extends MockXHR {
      constructor() {
        super();
        lastXHR = this;
      }
    };
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uploadFile resolves with response and reports progress', async () => {
    const onProgress = vi.fn();
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    const promise = uploadFile(file, onProgress);
    expect(lastXHR).toBeTruthy();

    lastXHR?.upload.onprogress?.({
      lengthComputable: true,
      loaded: 5,
      total: 10,
    } as ProgressEvent);

    lastXHR?.triggerLoad(201, { attachmentId: '99', url: 'https://example.com/file.jpg' });

    await expect(promise).resolves.toEqual({ attachmentId: '99', url: 'https://example.com/file.jpg' });
    expect(onProgress).toHaveBeenCalledWith(50);
  });

  it('uploadFile rejects on error', async () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const promise = uploadFile(file);

    expect(lastXHR).toBeTruthy();
    lastXHR?.triggerError();

    await expect(promise).rejects.toThrow('Network error during upload');
  });

  it('uploadFile rejects on non-2xx status', async () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const promise = uploadFile(file);

    expect(lastXHR).toBeTruthy();
    if (lastXHR) {
      lastXHR.responseText = 'Bad request';
      lastXHR.triggerLoad(400, null);
    }

    await expect(promise).rejects.toThrow('Upload failed: 400 Bad request');
  });

  it('getOEmbed throws on non-200 responses', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not found',
    });

    await expect(getOEmbed('https://example.com')).rejects.toThrow('oEmbed fetch failed: 404 Not found');
  });

  it('getOEmbed returns parsed data on success', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Example' }),
    });

    await expect(getOEmbed('https://example.com')).resolves.toEqual({ title: 'Example' });
  });

  it('getCampaignMedia returns data and handles errors', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'm1' }] })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(getCampaignMedia('101')).resolves.toEqual([{ id: 'm1' }]);
    await expect(getCampaignMedia('101')).rejects.toThrow('Failed to fetch media: 500');
  });

  it('add/update/delete/reorder media use correct methods', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await addMediaToCampaign('101', { id: 'm1' });
    await updateMedia('101', 'm1', { caption: 'Updated' });
    await deleteMedia('101', 'm1');
    await reorderMedia('101', [{ id: 'm1', order: 1 }]);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/101/media',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/101/media/m1',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/101/media/m1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/101/media/reorder',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
