import type { HttpTransport } from '../http/HttpTransport';

/** Minimal WP page summary returned by the /wp/v2/pages endpoint. */
export interface WpPageSummary {
  id: number;
  title: { rendered: string };
  link: string;
}

export interface ObjectCacheHealth {
  persistent: boolean;
  backend: string | null;
  stats_available: boolean;
  stats: Record<string, unknown> | null;
}

export interface HealthDataResponse {
  objectCache: ObjectCacheHealth;
  [key: string]: unknown;
}

/**
 * Domain module for admin-only endpoints: WP core pages and the global
 * audit-log CSV download.
 */
export class AdminApi {
  constructor(private readonly transport: HttpTransport) {}

  /** List published WP pages — used by the magic-link landing page selector. */
  listWpPages(): Promise<WpPageSummary[]> {
    return this.transport.get<WpPageSummary[]>(
      '/wp-json/wp/v2/pages?per_page=100&status=publish&_fields=id,title,link',
    );
  }

  /** Fetch plugin health data including object-cache readiness.
   *
   * Uses a raw fetch + text extraction instead of transport.get() because
   * some object-cache drop-ins (e.g. redis-cache) output diagnostics HTML
   * before the REST response body, which makes response.json() throw. We
   * locate the first '{' and parse from there.
   */
  async getHealthData(): Promise<HealthDataResponse> {
    const url = `${this.transport.getBaseUrl()}/wp-json/wp-super-gallery/v1/admin/health`;
    const headers = await this.transport.getAuthHeaders();
    const res = await fetch(url, { headers: { ...headers, Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`Health request failed: ${res.status}`);
    }
    const text = await res.text();
    const start = text.indexOf('{');
    if (start === -1) {
      throw new Error('Health response contained no JSON');
    }
    return JSON.parse(text.slice(start)) as HealthDataResponse;
  }

  /** Trigger a CSV download of the global audit log. */
  async downloadGlobalAuditCsv(
    params: { campaignId?: string; from?: string; to?: string; action?: string } = {},
  ): Promise<void> {
    const qs = new URLSearchParams();
    if (params.campaignId) qs.set('campaign_id', params.campaignId);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.action) qs.set('action', params.action);

    const url = `${this.transport.getBaseUrl()}/wp-json/wp-super-gallery/v1/admin/audit-log${qs.toString() ? `?${qs}` : ''}`;
    const headers = await this.transport.getAuthHeaders();
    const res = await fetch(url, { headers: { ...headers, Accept: 'text/csv' } });
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'audit-log.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
