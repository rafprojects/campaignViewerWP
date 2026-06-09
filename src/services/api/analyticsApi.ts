import type { HttpTransport } from '../http/HttpTransport';

// ── Response shapes ───────────────────────────────────────────────────────────

export interface CampaignAnalyticsDayEntry {
  date: string;
  views: number;
  unique: number;
}

export interface CampaignAnalyticsResponse {
  totalViews: number;
  uniqueVisitors: number;
  daily: CampaignAnalyticsDayEntry[];
}

export interface MediaAnalyticsItem {
  media_id: string;
  views: number;
  lightbox_opens: number;
}

export interface MediaAnalyticsResponse {
  items: MediaAnalyticsItem[];
}

export interface AnalyticsSummaryTopCampaign {
  id: string;
  title: string;
  views: number;
}

export interface AnalyticsSummaryResponse {
  totalViews: number;
  uniqueVisitors: number;
  topCampaigns: AnalyticsSummaryTopCampaign[];
}

export interface MediaUsageCampaignRef {
  id: string;
  title: string;
}

export interface MediaUsageResponse {
  count: number;
  campaigns: MediaUsageCampaignRef[];
}

// ── Domain module ─────────────────────────────────────────────────────────────

/**
 * Domain module for analytics and media-usage REST endpoints.
 */
export class AnalyticsApi {
  constructor(private readonly transport: HttpTransport) {}

  async recordAnalyticsEvent(
    campaignId: string,
    eventType = 'view',
    mediaId?: string,
  ): Promise<void> {
    await this.transport.post('/wp-json/wp-super-gallery/v1/analytics/event', {
      campaignId,
      eventType,
      ...(mediaId ? { mediaId } : {}),
    });
  }

  getCampaignAnalytics(
    campaignId: string,
    from?: string,
    to?: string,
  ): Promise<CampaignAnalyticsResponse> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.transport.get<CampaignAnalyticsResponse>(
      `/wp-json/wp-super-gallery/v1/analytics/campaigns/${encodeURIComponent(campaignId)}${qs}`,
    );
  }

  getCampaignMediaAnalytics(
    campaignId: string,
    from?: string,
    to?: string,
  ): Promise<MediaAnalyticsResponse> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.transport.get<MediaAnalyticsResponse>(
      `/wp-json/wp-super-gallery/v1/analytics/campaigns/${encodeURIComponent(campaignId)}/media${qs}`,
    );
  }

  getAnalyticsSummary(from?: string, to?: string, spaceId?: string): Promise<AnalyticsSummaryResponse> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (spaceId && spaceId !== 'all') params.set('space', spaceId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.transport.get<AnalyticsSummaryResponse>(
      `/wp-json/wp-super-gallery/v1/analytics/summary${qs}`,
    );
  }

  getMediaUsage(mediaId: string): Promise<MediaUsageResponse> {
    return this.transport.get<MediaUsageResponse>(
      `/wp-json/wp-super-gallery/v1/media/${encodeURIComponent(mediaId)}/usage`,
    );
  }

  getMediaUsageSummary(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return Promise.resolve({});
    const qs = ids.map((id) => `ids[]=${encodeURIComponent(id)}`).join('&');
    return this.transport.get<Record<string, number>>(
      `/wp-json/wp-super-gallery/v1/media/usage-summary?${qs}`,
    );
  }
}
