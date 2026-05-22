import type { HttpTransport } from '../http/HttpTransport';

/** Minimal WP page summary returned by the /wp/v2/pages endpoint. */
export interface WpPageSummary {
  id: number;
  title: { rendered: string };
  link: string;
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
