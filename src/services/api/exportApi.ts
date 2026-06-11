import type { HttpTransport } from '../http/HttpTransport';

export type ExportJobStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface ExportJob {
  jobId: string;
  type: string;
  status: ExportJobStatus;
  createdAt: string;
  error: string | null;
  /** Present only when status is 'complete'. */
  downloadUrl?: string;
}

export class ExportApi {
  constructor(private readonly transport: HttpTransport) {}

  /** Enqueue a background binary ZIP export for a campaign. Returns the job ID. */
  startCampaignBinaryExport(campaignId: string): Promise<{ jobId: string; status: ExportJobStatus }> {
    return this.transport.post<{ jobId: string; status: ExportJobStatus }>(
      `/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(campaignId)}/export/binary`,
      {},
    );
  }

  /** Enqueue a background audit-log ZIP export. Returns the job ID. */
  startAuditLogBinaryExport(
    params: { from?: string; to?: string; action?: string; campaignId?: string; scope?: string; severity?: string; space?: string } = {},
  ): Promise<{ jobId: string; status: ExportJobStatus }> {
    const body: Record<string, unknown> = {};
    if (params.from)       body['from']        = params.from;
    if (params.to)         body['to']          = params.to;
    if (params.action)     body['action']      = params.action;
    if (params.campaignId) body['campaign_id'] = Number(params.campaignId);
    if (params.scope)      body['scope']       = params.scope;
    if (params.severity)   body['severity']    = params.severity;
    if (params.space)      body['space']       = Number(params.space);
    return this.transport.post<{ jobId: string; status: ExportJobStatus }>(
      '/wp-json/wp-super-gallery/v1/admin/audit-log/export/binary',
      body,
    );
  }

  /** Enqueue a background multi-campaign ZIP export. Returns a single job ID. */
  startBulkBinaryExport(ids: string[]): Promise<{ jobId: string; status: ExportJobStatus }> {
    return this.transport.post<{ jobId: string; status: ExportJobStatus }>(
      '/wp-json/wp-super-gallery/v1/campaigns/batch/export/binary',
      { ids: ids.map(Number) },
    );
  }

  /** Enqueue a background media-library ZIP export. Returns the job ID. */
  startMediaLibraryBinaryExport(
    params: { campaignId?: string; mimeType?: 'image' | 'video' | 'all'; search?: string } = {},
  ): Promise<{ jobId: string; status: ExportJobStatus }> {
    const body: Record<string, unknown> = {};
    if (params.campaignId) body['campaign_id'] = Number(params.campaignId);
    if (params.mimeType && params.mimeType !== 'all') body['mime_type'] = params.mimeType;
    if (params.search) body['search'] = params.search;
    return this.transport.post<{ jobId: string; status: ExportJobStatus }>(
      '/wp-json/wp-super-gallery/v1/admin/media/export/binary',
      body,
    );
  }

  /**
   * Upload a media library ZIP for import. Returns counts of imported / skipped items.
   * Uses fetch() directly because the payload is multipart/form-data.
   */
  async importMediaLibraryBinary(
    file: File,
  ): Promise<{ imported: Array<{ id: number; url: string }>; skipped: string[] }> {
    const url = `${this.transport.getBaseUrl()}/wp-json/wp-super-gallery/v1/media/import/binary`;
    const headers = await this.transport.getAuthHeaders();
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) {
      const text = await res.text().catch(() => String(res.status));
      throw new Error(`Media library import failed: ${text}`);
    }
    return res.json() as Promise<{ imported: Array<{ id: number; url: string }>; skipped: string[] }>;
  }

  /** Poll the status of an export job. */
  getExportJob(jobId: string): Promise<ExportJob> {
    return this.transport.get<ExportJob>(
      `/wp-json/wp-super-gallery/v1/export-jobs/${encodeURIComponent(jobId)}`,
    );
  }

  /** Cancel and delete an export job. */
  deleteExportJob(jobId: string): Promise<{ deleted: boolean }> {
    return this.transport.delete<{ deleted: boolean }>(
      `/wp-json/wp-super-gallery/v1/export-jobs/${encodeURIComponent(jobId)}`,
    );
  }

  /**
   * Fetch and trigger a browser download of a completed export ZIP.
   * Uses fetch() directly (with auth headers) to support authenticated routes.
   */
  async downloadExportJob(jobId: string, filename = 'campaign-export.zip'): Promise<void> {
    const url = `${this.transport.getBaseUrl()}/wp-json/wp-super-gallery/v1/export-jobs/${encodeURIComponent(jobId)}/download`;
    const headers = await this.transport.getAuthHeaders();
    const res = await fetch(url, { headers: { ...headers, Accept: 'application/zip' } });
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 30_000);
  }
}
