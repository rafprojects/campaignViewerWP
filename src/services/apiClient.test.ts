import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuthProvider } from '@/services/auth/AuthProvider';
import { ApiClient, ApiError } from './apiClient';

type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

describe('ApiClient', () => {
  const baseUrl = 'https://example.test';

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds Authorization header when auth provider is present', async () => {
    const authProvider: AuthProvider = {
      init: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      getAccessToken: vi.fn().mockResolvedValue('token-123'),
      getUser: vi.fn(),
      getPermissions: vi.fn(),
    };

    const response: FetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const client = new ApiClient({ baseUrl, authProvider });
    await client.get('/wp-json/wp-super-gallery/v1/campaigns');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/wp-json/wp-super-gallery/v1/campaigns`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    );
  });

  it('invokes onUnauthorized for 401 responses', async () => {
    const onUnauthorized = vi.fn();
    const response: FetchResponse = {
      ok: false,
      status: 401,
      json: async () => ({}),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const client = new ApiClient({ baseUrl, onUnauthorized });

    await expect(client.get('/wp-json/wp-super-gallery/v1/campaigns')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('supports put and delete requests', async () => {
    const response: FetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const client = new ApiClient({ baseUrl });
    await client.put('/wp-json/wp-super-gallery/v1/campaigns/1', { title: 'Update' });
    await client.delete('/wp-json/wp-super-gallery/v1/campaigns/1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/wp-json/wp-super-gallery/v1/campaigns/1`,
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/wp-json/wp-super-gallery/v1/campaigns/1`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('exposes baseUrl and auth headers', async () => {
    const authProvider: AuthProvider = {
      init: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      getAccessToken: vi.fn().mockResolvedValue('token-456'),
      getUser: vi.fn(),
      getPermissions: vi.fn(),
    };

    const client = new ApiClient({ baseUrl, authProvider });
    expect(client.getBaseUrl()).toBe(baseUrl);

    const headers = await client.getAuthHeaders();
    expect(headers).toEqual({ Authorization: 'Bearer token-456' });
  });

  it('fails fast and skips fetch when offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    const client = new ApiClient({ baseUrl });

    await expect(client.get('/wp-json/wp-super-gallery/v1/campaigns')).rejects.toMatchObject({
      message: 'You appear to be offline. Some features are unavailable.',
      status: 0,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('sends post request with JSON body', async () => {
    const response: FetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({ id: '1', title: 'New' }),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const client = new ApiClient({ baseUrl });
    const result = await client.post('/wp-json/wp-super-gallery/v1/campaigns', { title: 'New' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/wp-json/wp-super-gallery/v1/campaigns`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ title: 'New' }) }),
    );
    expect(result).toEqual({ id: '1', title: 'New' });
  });

  it('sends postForm request with FormData', async () => {
    const response: FetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const client = new ApiClient({ baseUrl });
    const fd = new FormData();
    fd.append('file', new Blob(['test']), 'test.jpg');
    await client.postForm('/wp-json/wp-super-gallery/v1/media', fd);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/wp-json/wp-super-gallery/v1/media`,
      expect.objectContaining({ method: 'POST', body: fd }),
    );
  });

  it('includes error message from response body in ApiError', async () => {
    const response: FetchResponse = {
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server exploded' }),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const client = new ApiClient({ baseUrl });
    await expect(client.get('/any')).rejects.toMatchObject({
      message: 'Server exploded',
      status: 500,
    });
  });

  describe('Settings API', () => {
    let client: ApiClient;
    const okResponse = (data: unknown): FetchResponse => ({
      ok: true,
      status: 200,
      json: async () => data,
    });

    beforeEach(() => {
      client = new ApiClient({ baseUrl });
    });

    it('getSettings calls GET /settings', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse({ theme: 'dark' }));
      const result = await client.getSettings();
      expect(result).toEqual({ theme: 'dark' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/settings'),
        expect.objectContaining({}),
      );
    });

    it('updateSettings calls POST /settings', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse({ theme: 'light' }));
      const result = await client.updateSettings({ theme: 'light' });
      expect(result).toEqual({ theme: 'light' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/settings'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('testConnection calls GET /campaigns', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse({ success: true, message: 'ok' }));
      const result = await client.testConnection();
      expect(result).toEqual({ success: true, message: 'ok' });
    });
  });

  describe('LayoutTemplate API', () => {
    let client: ApiClient;
    const okResponse = (data: unknown): FetchResponse => ({
      ok: true,
      status: 200,
      json: async () => data,
    });
    const templateBase = '/wp-json/wp-super-gallery/v1/admin/layout-templates';

    beforeEach(() => {
      client = new ApiClient({ baseUrl });
    });

    it('getLayoutTemplates calls GET /layout-templates', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse([]));
      const result = await client.getLayoutTemplates();
      expect(Array.isArray(result)).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${baseUrl}${templateBase}`,
        expect.objectContaining({}),
      );
    });

    it('getLayoutTemplate calls GET /layout-templates/:id', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse({ id: 'tpl1' }));
      await client.getLayoutTemplate('tpl1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${baseUrl}${templateBase}/tpl1`,
        expect.objectContaining({}),
      );
    });

    it('createLayoutTemplate calls POST /layout-templates', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse({ id: 'tpl2' }));
      await client.createLayoutTemplate({ name: 'New' } as never);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${baseUrl}${templateBase}`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('updateLayoutTemplate calls PUT /layout-templates/:id', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse({ id: 'tpl1', name: 'Updated' }));
      await client.updateLayoutTemplate('tpl1', { name: 'Updated' } as never);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${baseUrl}${templateBase}/tpl1`,
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('deleteLayoutTemplate calls DELETE /layout-templates/:id', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse({ deleted: true }));
      await client.deleteLayoutTemplate('tpl1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${baseUrl}${templateBase}/tpl1`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('duplicateLayoutTemplate calls POST /layout-templates/:id/duplicate', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse({ id: 'tpl3' }));
      await client.duplicateLayoutTemplate('tpl1', 'Copy');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${baseUrl}${templateBase}/tpl1/duplicate`,
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Copy' }) }),
      );
    });

    it('getLayoutTemplatePublic calls public endpoint without /admin/', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse({ id: 'tpl1' }));
      await client.getLayoutTemplatePublic('tpl1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${baseUrl}/wp-json/wp-super-gallery/v1/layout-templates/tpl1`,
        expect.objectContaining({}),
      );
    });
  });
});
