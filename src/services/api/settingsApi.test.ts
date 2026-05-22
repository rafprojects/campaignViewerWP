/**
 * Unit tests for SettingsApi (P32-C).
 *
 * These tests exercise the domain module against a mock HttpTransport, proving
 * that domain logic is independently testable without a real HTTP connection or
 * a full ApiClient instance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HttpTransport } from '../http/HttpTransport';
import { SettingsApi } from './settingsApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SettingsApi', () => {
  let transport: HttpTransport;
  let api: SettingsApi;

  beforeEach(() => {
    transport = makeMockTransport();
    api = new SettingsApi(transport);
  });

  describe('getSettings', () => {
    it('calls GET /wp-json/wp-super-gallery/v1/settings', async () => {
      const mockSettings = { theme: 'dark', enableLightbox: true };
      vi.mocked(transport.get).mockResolvedValue(mockSettings);

      const result = await api.getSettings();

      expect(transport.get).toHaveBeenCalledOnce();
      expect(transport.get).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/settings');
      expect(result).toEqual(mockSettings);
    });

    it('returns whatever the transport resolves with', async () => {
      vi.mocked(transport.get).mockResolvedValue({ theme: 'light', itemsPerPage: 12 });
      const result = await api.getSettings();
      expect(result.theme).toBe('light');
      expect(result.itemsPerPage).toBe(12);
    });
  });

  describe('updateSettings', () => {
    it('calls POST /wp-json/wp-super-gallery/v1/settings with the payload', async () => {
      const update = { theme: 'modern', enableAnimations: false };
      const response = { ...update, authProvider: 'cookie' };
      vi.mocked(transport.post).mockResolvedValue(response);

      const result = await api.updateSettings(update);

      expect(transport.post).toHaveBeenCalledOnce();
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/settings',
        update,
      );
      expect(result).toEqual(response);
    });

    it('passes an empty object without error', async () => {
      vi.mocked(transport.post).mockResolvedValue({});
      await expect(api.updateSettings({})).resolves.toEqual({});
      expect(transport.post).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/settings', {});
    });
  });

  describe('testConnection', () => {
    it('calls GET /wp-json/wp-super-gallery/v1/campaigns', async () => {
      vi.mocked(transport.get).mockResolvedValue({ success: true, message: 'ok' });

      const result = await api.testConnection();

      expect(transport.get).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/campaigns');
      expect(result.success).toBe(true);
    });
  });

  describe('transport isolation', () => {
    it('propagates transport errors without modification', async () => {
      const err = new Error('Network failure');
      vi.mocked(transport.get).mockRejectedValue(err);

      await expect(api.getSettings()).rejects.toThrow('Network failure');
    });

    it('does not call any transport method other than get for getSettings', async () => {
      vi.mocked(transport.get).mockResolvedValue({});
      await api.getSettings();

      expect(transport.post).not.toHaveBeenCalled();
      expect(transport.put).not.toHaveBeenCalled();
      expect(transport.delete).not.toHaveBeenCalled();
    });
  });
});
