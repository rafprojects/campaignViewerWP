import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HttpTransport } from '../http/HttpTransport';
import { AnalyticsApi } from './analyticsApi';

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

describe('AnalyticsApi', () => {
  let transport: HttpTransport;
  let api: AnalyticsApi;

  beforeEach(() => {
    transport = makeMockTransport();
    api = new AnalyticsApi(transport);
  });

  describe('recordAnalyticsEvent', () => {
    it('POSTs a view event for a campaign', async () => {
      vi.mocked(transport.post).mockResolvedValue(undefined);
      await api.recordAnalyticsEvent('42');
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/analytics/event',
        { campaignId: '42', eventType: 'view' },
      );
    });

    it('includes mediaId when provided', async () => {
      vi.mocked(transport.post).mockResolvedValue(undefined);
      await api.recordAnalyticsEvent('42', 'lightbox_open', 'media-1');
      expect(transport.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/analytics/event',
        { campaignId: '42', eventType: 'lightbox_open', mediaId: 'media-1' },
      );
    });
  });

  describe('getCampaignAnalytics', () => {
    it('GETs analytics for a campaign without date range', async () => {
      vi.mocked(transport.get).mockResolvedValue({ totalViews: 10, uniqueVisitors: 5, daily: [] });
      await api.getCampaignAnalytics('42');
      expect(transport.get).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/analytics/campaigns/42',
      );
    });

    it('appends from and to params when provided', async () => {
      vi.mocked(transport.get).mockResolvedValue({ totalViews: 0, uniqueVisitors: 0, daily: [] });
      await api.getCampaignAnalytics('42', '2024-01-01', '2024-01-31');
      expect(transport.get).toHaveBeenCalledWith(
        expect.stringContaining('from=2024-01-01'),
      );
      expect(transport.get).toHaveBeenCalledWith(
        expect.stringContaining('to=2024-01-31'),
      );
    });
  });

  describe('getCampaignMediaAnalytics', () => {
    it('GETs media analytics without date range', async () => {
      vi.mocked(transport.get).mockResolvedValue({ items: [] });
      await api.getCampaignMediaAnalytics('42');
      expect(transport.get).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/analytics/campaigns/42/media',
      );
    });

    it('appends date range params', async () => {
      vi.mocked(transport.get).mockResolvedValue({ items: [] });
      await api.getCampaignMediaAnalytics('42', '2024-01-01', '2024-01-31');
      expect(transport.get).toHaveBeenCalledWith(
        expect.stringContaining('from=2024-01-01'),
      );
    });
  });

  describe('getAnalyticsSummary', () => {
    it('GETs summary without filters', async () => {
      vi.mocked(transport.get).mockResolvedValue({ totalViews: 0, uniqueVisitors: 0, topCampaigns: [] });
      await api.getAnalyticsSummary();
      expect(transport.get).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/analytics/summary',
      );
    });

    it('appends spaceId when not "all"', async () => {
      vi.mocked(transport.get).mockResolvedValue({ totalViews: 0, uniqueVisitors: 0, topCampaigns: [] });
      await api.getAnalyticsSummary(undefined, undefined, 'space-1');
      expect(transport.get).toHaveBeenCalledWith(
        expect.stringContaining('space=space-1'),
      );
    });

    it('omits space param when spaceId is "all"', async () => {
      vi.mocked(transport.get).mockResolvedValue({ totalViews: 0, uniqueVisitors: 0, topCampaigns: [] });
      await api.getAnalyticsSummary(undefined, undefined, 'all');
      expect(transport.get).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/analytics/summary',
      );
    });
  });

  describe('getMediaUsage', () => {
    it('GETs usage for a specific media item', async () => {
      vi.mocked(transport.get).mockResolvedValue({ count: 2, campaigns: [] });
      await api.getMediaUsage('media-42');
      expect(transport.get).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/media/media-42/usage',
      );
    });
  });

  describe('getMediaUsageSummary', () => {
    it('returns empty object immediately for empty ids list', async () => {
      const result = await api.getMediaUsageSummary([]);
      expect(result).toEqual({});
      expect(transport.get).not.toHaveBeenCalled();
    });

    it('GETs usage summary with encoded ids', async () => {
      vi.mocked(transport.get).mockResolvedValue({ 'id-1': 3, 'id-2': 1 });
      await api.getMediaUsageSummary(['id-1', 'id-2']);
      expect(transport.get).toHaveBeenCalledWith(
        expect.stringContaining('ids[]=id-1'),
      );
    });
  });
});
