import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HttpTransport } from '../http/HttpTransport';
import { WebhooksApi } from './webhooksApi';

function makeMockTransport(overrides: Partial<HttpTransport> = {}): HttpTransport {
  return {
    get: vi.fn(),
    post: vi.fn(),
    postForm: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getBaseUrl: vi.fn().mockReturnValue('https://example.test'),
    getAuthHeaders: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

describe('WebhooksApi', () => {
  let transport: HttpTransport;
  let api: WebhooksApi;

  beforeEach(() => {
    transport = makeMockTransport();
    api = new WebhooksApi(transport);
  });

  describe('listEndpoints', () => {
    it('GETs the webhooks endpoint', async () => {
      vi.mocked(transport.get).mockResolvedValue([]);
      const result = await api.listEndpoints();
      expect(transport.get).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/webhooks');
      expect(result).toEqual([]);
    });
  });

  describe('createEndpoint', () => {
    it('POSTs to the webhooks endpoint', async () => {
      const response = { index: 0, url: 'https://hook.example.com', secret: 's3cr3t', secretHint: 's3cr3t', events: [], enabled: true };
      vi.mocked(transport.post).mockResolvedValue(response);
      const result = await api.createEndpoint({ url: 'https://hook.example.com' });
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/webhooks',
        { url: 'https://hook.example.com' },
      );
      expect(result).toEqual(response);
    });
  });

  describe('updateEndpoint', () => {
    it('PUTs to a specific webhook endpoint', async () => {
      const response = { index: 0, url: 'https://hook.example.com', secretHint: 'hint', events: [], enabled: false };
      vi.mocked(transport.put).mockResolvedValue(response);
      await api.updateEndpoint(0, { enabled: false });
      expect(transport.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/webhooks/0',
        { enabled: false },
      );
    });
  });

  describe('deleteEndpoint', () => {
    it('DELETEs a specific webhook endpoint', async () => {
      vi.mocked(transport.delete).mockResolvedValue({ deleted: true });
      const result = await api.deleteEndpoint(2);
      expect(transport.delete).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/webhooks/2');
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('rotateSecret', () => {
    it('POSTs to the rotate-secret endpoint', async () => {
      vi.mocked(transport.post).mockResolvedValue({ secret: 'newSecret' });
      const result = await api.rotateSecret(1);
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/webhooks/1/rotate-secret',
        {},
      );
      expect(result.secret).toBe('newSecret');
    });
  });

  describe('listDeliveries', () => {
    it('GETs delivery log with default limit', async () => {
      vi.mocked(transport.get).mockResolvedValue([]);
      await api.listDeliveries();
      expect(transport.get).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/webhooks/delivery-log?limit=50',
      );
    });

    it('passes custom limit', async () => {
      vi.mocked(transport.get).mockResolvedValue([]);
      await api.listDeliveries(10);
      expect(transport.get).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/webhooks/delivery-log?limit=10',
      );
    });
  });
});
