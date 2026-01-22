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
});
