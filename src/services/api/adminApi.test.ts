/**
 * Unit tests for AdminApi.
 *
 * Exercises the domain module against a mock HttpTransport, proving that
 * admin endpoints build the right URLs/payloads and fetch calls without
 * a real HTTP connection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HttpTransport } from '../http/HttpTransport';
import { AdminApi, type WpPageSummary, type HealthDataResponse } from './adminApi';

function makeMockTransport(overrides: Partial<HttpTransport> = {}): HttpTransport {
  return {
    get: vi.fn(),
    post: vi.fn(),
    postForm: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getBaseUrl: vi.fn().mockReturnValue('https://example.test'),
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
    ...overrides,
  };
}

describe('AdminApi', () => {
  let transport: HttpTransport;
  let api: AdminApi;

  beforeEach(() => {
    transport = makeMockTransport();
    api = new AdminApi(transport);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('listWpPages', () => {
    it('GETs the WP pages endpoint with per_page, status, and _fields query params', async () => {
      const pages: WpPageSummary[] = [
        { id: 1, title: { rendered: 'Home' }, link: 'https://example.test/' },
        { id: 2, title: { rendered: 'About' }, link: 'https://example.test/about' },
      ];
      vi.mocked(transport.get).mockResolvedValue(pages);

      const result = await api.listWpPages();

      expect(transport.get).toHaveBeenCalledOnce();
      expect(transport.get).toHaveBeenCalledWith(
        '/wp-json/wp/v2/pages?per_page=100&status=publish&_fields=id,title,link',
      );
      expect(result).toEqual(pages);
    });

    it('returns an empty array when no pages exist', async () => {
      vi.mocked(transport.get).mockResolvedValue([]);

      const result = await api.listWpPages();

      expect(result).toEqual([]);
    });

    it('propagates transport errors', async () => {
      const err = new Error('Network failure');
      vi.mocked(transport.get).mockRejectedValue(err);

      await expect(api.listWpPages()).rejects.toThrow('Network failure');
    });
  });

  describe('getHealthData', () => {
    let mockFetch: typeof fetch;

    beforeEach(() => {
      mockFetch = vi.fn();
      global.fetch = mockFetch as any;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches health endpoint with getBaseUrl and getAuthHeaders', async () => {
      const healthData: HealthDataResponse = {
        objectCache: {
          persistent: true,
          backend: 'redis',
          stats_available: true,
          stats: { hits: 100, misses: 10 },
        },
      };
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify(healthData)),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);
      vi.mocked(transport.getBaseUrl).mockReturnValue('https://example.test');
      vi.mocked(transport.getAuthHeaders).mockResolvedValue({ Authorization: 'Bearer token' });

      const result = await api.getHealthData();

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.test/wp-json/wp-super-gallery/v1/admin/health',
        {
          headers: {
            Authorization: 'Bearer token',
            Accept: 'application/json',
          },
        },
      );
      expect(result).toEqual(healthData);
    });

    it('extracts JSON from response text starting at first {', async () => {
      const healthData: HealthDataResponse = {
        objectCache: {
          persistent: false,
          backend: null,
          stats_available: false,
          stats: null,
        },
      };
      const responseText = `Some diagnostic text\n{"objectCache":{"persistent":false,"backend":null,"stats_available":false,"stats":null}}`;
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue(responseText),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      const result = await api.getHealthData();

      expect(result).toEqual(healthData);
      expect(mockResponse.text).toHaveBeenCalledOnce();
    });

    it('throws error if response is not ok', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await expect(api.getHealthData()).rejects.toThrow('Health request failed: 500');
    });

    it('throws error if response status is 401', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await expect(api.getHealthData()).rejects.toThrow('Health request failed: 401');
    });

    it('throws error if response contains no JSON', async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('No JSON here, just plain text'),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await expect(api.getHealthData()).rejects.toThrow('Health response contained no JSON');
    });

    it('throws error if JSON parsing fails', async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('{invalid json}'),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await expect(api.getHealthData()).rejects.toThrow();
    });
  });

  describe('downloadGlobalAuditCsv', () => {
    let mockFetch: typeof fetch;
    let mockCreateObjectURL: typeof URL.createObjectURL;
    let mockRevokeObjectURL: typeof URL.revokeObjectURL;
    let mockLink: HTMLAnchorElement;

    beforeEach(() => {
      mockFetch = vi.fn();
      global.fetch = mockFetch as any;

      mockCreateObjectURL = vi.fn().mockReturnValue('blob:https://example.test/abc123');
      mockRevokeObjectURL = vi.fn();
      URL.createObjectURL = mockCreateObjectURL as any;
      URL.revokeObjectURL = mockRevokeObjectURL as any;

      mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      } as any;
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches audit-log endpoint with no params when called with empty object', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);
      vi.mocked(transport.getAuthHeaders).mockResolvedValue({ Authorization: 'Bearer token' });

      await api.downloadGlobalAuditCsv({});

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.test/wp-json/wp-super-gallery/v1/admin/audit-log',
        {
          headers: {
            Authorization: 'Bearer token',
            Accept: 'text/csv',
          },
        },
      );
    });

    it('fetches audit-log endpoint with no params when called with no arguments', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv();

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.test/wp-json/wp-super-gallery/v1/admin/audit-log',
        expect.any(Object),
      );
    });

    it('includes campaignId query param when provided', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv({ campaignId: 'camp123' });

      const [url] = vi.mocked(mockFetch).mock.calls[0]!;
      expect(url).toContain('campaign_id=camp123');
    });

    it('includes from query param when provided', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv({ from: '2024-01-01' });

      const [url] = vi.mocked(mockFetch).mock.calls[0]!;
      expect(url).toContain('from=2024-01-01');
    });

    it('includes to query param when provided', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv({ to: '2024-12-31' });

      const [url] = vi.mocked(mockFetch).mock.calls[0]!;
      expect(url).toContain('to=2024-12-31');
    });

    it('includes action query param when provided', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv({ action: 'update' });

      const [url] = vi.mocked(mockFetch).mock.calls[0]!;
      expect(url).toContain('action=update');
    });

    it('includes all query params when all provided', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv({
        campaignId: 'camp123',
        from: '2024-01-01',
        to: '2024-12-31',
        action: 'delete',
      });

      const [url] = vi.mocked(mockFetch).mock.calls[0]!;
      expect(url).toContain('campaign_id=camp123');
      expect(url).toContain('from=2024-01-01');
      expect(url).toContain('to=2024-12-31');
      expect(url).toContain('action=delete');
    });

    it('creates an anchor element with blob URL and download attribute', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv({});

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.href).toBe('blob:https://example.test/abc123');
      expect(mockLink.download).toBe('audit-log.csv');
    });

    it('clicks the link to trigger download', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv({});

      expect(mockLink.click).toHaveBeenCalledOnce();
    });

    it('revokes the blob URL after download', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv({});

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:https://example.test/abc123');
    });

    it('URL-encodes special characters in query params', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv({ action: 'update & delete' });

      const [url] = vi.mocked(mockFetch).mock.calls[0]!;
      // URLSearchParams encodes spaces as '+' and '&' as '%26'
      expect(url).toContain('action=update+%26+delete');
    });

    it('does not add query string when no params provided', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv();

      const [url] = vi.mocked(mockFetch).mock.calls[0]!;
      expect(url).toBe('https://example.test/wp-json/wp-super-gallery/v1/admin/audit-log');
    });

    it('skips undefined/empty params in query string', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(mockBlob),
      };
      vi.mocked(mockFetch).mockResolvedValue(mockResponse as any);

      await api.downloadGlobalAuditCsv({ campaignId: 'camp123', from: undefined });

      const [url] = vi.mocked(mockFetch).mock.calls[0]!;
      expect(url).toContain('campaign_id=camp123');
      expect(url).not.toContain('from');
    });
  });
});
