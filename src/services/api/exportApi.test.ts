import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HttpTransport } from '../http/HttpTransport';
import { ExportApi } from './exportApi';

function makeMockTransport(overrides: Partial<HttpTransport> = {}): HttpTransport {
  return {
    get: vi.fn(),
    post: vi.fn(),
    postForm: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getBaseUrl: vi.fn().mockReturnValue('https://example.test'),
    getAuthHeaders: vi.fn().mockResolvedValue({ 'X-WP-Nonce': 'n' }),
    ...overrides,
  };
}

describe('ExportApi', () => {
  let transport: HttpTransport;
  let api: ExportApi;

  beforeEach(() => {
    transport = makeMockTransport();
    api = new ExportApi(transport);
  });

  describe('startCampaignBinaryExport', () => {
    it('POSTs to the per-campaign binary export endpoint (id encoded)', async () => {
      vi.mocked(transport.post).mockResolvedValue({ jobId: 'j1', status: 'pending' });
      const result = await api.startCampaignBinaryExport('a b');
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/a%20b/export/binary',
        {},
      );
      expect(result).toEqual({ jobId: 'j1', status: 'pending' });
    });
  });

  describe('startAuditLogBinaryExport', () => {
    it('omits absent params (empty body by default)', async () => {
      vi.mocked(transport.post).mockResolvedValue({ jobId: 'j', status: 'pending' });
      await api.startAuditLogBinaryExport();
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/admin/audit-log/export/binary',
        {},
      );
    });

    it('maps provided params, coercing campaign_id and space to numbers', async () => {
      vi.mocked(transport.post).mockResolvedValue({ jobId: 'j', status: 'pending' });
      await api.startAuditLogBinaryExport({
        from: '2026-01-01',
        to: '2026-02-01',
        action: 'campaign.moved_space',
        campaignId: '42',
        scope: 'campaign',
        severity: 'info',
        space: '7',
      });
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/admin/audit-log/export/binary',
        {
          from: '2026-01-01',
          to: '2026-02-01',
          action: 'campaign.moved_space',
          campaign_id: 42,
          scope: 'campaign',
          severity: 'info',
          space: 7,
        },
      );
    });
  });

  describe('startBulkBinaryExport', () => {
    it('POSTs numeric ids to the batch endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ jobId: 'b', status: 'pending' });
      await api.startBulkBinaryExport(['1', '2', '3']);
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/batch/export/binary',
        { ids: [1, 2, 3] },
      );
    });
  });

  describe('startMediaLibraryBinaryExport', () => {
    it('sends an empty body by default', async () => {
      vi.mocked(transport.post).mockResolvedValue({ jobId: 'm', status: 'pending' });
      await api.startMediaLibraryBinaryExport();
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/admin/media/export/binary',
        {},
      );
    });

    it('maps params and drops mimeType "all"', async () => {
      vi.mocked(transport.post).mockResolvedValue({ jobId: 'm', status: 'pending' });
      await api.startMediaLibraryBinaryExport({ campaignId: '9', mimeType: 'all', search: 'logo' });
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/admin/media/export/binary',
        { campaign_id: 9, search: 'logo' },
      );
    });

    it('includes mime_type when not "all"', async () => {
      vi.mocked(transport.post).mockResolvedValue({ jobId: 'm', status: 'pending' });
      await api.startMediaLibraryBinaryExport({ mimeType: 'image' });
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/admin/media/export/binary',
        { mime_type: 'image' },
      );
    });
  });

  describe('getExportJob', () => {
    it('GETs the export-jobs status endpoint', async () => {
      const job = { jobId: 'j', type: 'campaign', status: 'complete', createdAt: 't', error: null };
      vi.mocked(transport.get).mockResolvedValue(job);
      const result = await api.getExportJob('j');
      expect(transport.get).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/export-jobs/j');
      expect(result).toBe(job);
    });
  });

  describe('deleteExportJob', () => {
    it('DELETEs the export-jobs endpoint', async () => {
      vi.mocked(transport.delete).mockResolvedValue({ deleted: true });
      const result = await api.deleteExportJob('j x');
      expect(transport.delete).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/export-jobs/j%20x');
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('importMediaLibraryBinary', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('uploads the file via multipart fetch with auth headers and returns parsed JSON', async () => {
      const payload = { imported: [{ id: 1, url: 'u' }], skipped: ['dup'] };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      vi.stubGlobal('fetch', fetchMock);
      const file = new File(['zip'], 'lib.zip', { type: 'application/zip' });

      const result = await api.importMediaLibraryBinary(file);

      expect(result).toEqual(payload);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://example.test/wp-json/wp-super-gallery/v1/media/import/binary');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'X-WP-Nonce': 'n' });
      expect(init.body).toBeInstanceOf(FormData);
      expect((init.body as FormData).get('file')).toBe(file);
    });

    it('throws with the response text on a non-ok status', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('boom'),
      });
      vi.stubGlobal('fetch', fetchMock);
      const file = new File(['zip'], 'lib.zip');
      await expect(api.importMediaLibraryBinary(file)).rejects.toThrow('Media library import failed: boom');
    });
  });

  describe('downloadExportJob', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('fetches the ZIP and triggers an anchor download', async () => {
      const blob = new Blob(['zip']);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(blob),
      });
      vi.stubGlobal('fetch', fetchMock);
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      await api.downloadExportJob('j1', 'my.zip');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://example.test/wp-json/wp-super-gallery/v1/export-jobs/j1/download');
      expect(init.headers).toMatchObject({ 'X-WP-Nonce': 'n', Accept: 'application/zip' });
      expect(clickSpy).toHaveBeenCalledOnce();
      // The temporary anchor is cleaned up after the click.
      expect(document.querySelector('a[download]')).toBeNull();
      clickSpy.mockRestore();
    });

    it('throws when the download response is not ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      vi.stubGlobal('fetch', fetchMock);
      await expect(api.downloadExportJob('j1')).rejects.toThrow('Download failed: 404 Not Found');
    });
  });
});
