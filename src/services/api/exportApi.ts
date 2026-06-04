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

  /** Enqueue a background multi-campaign ZIP export. Returns a single job ID. */
  startBulkBinaryExport(ids: string[]): Promise<{ jobId: string; status: ExportJobStatus }> {
    return this.transport.post<{ jobId: string; status: ExportJobStatus }>(
      '/wp-json/wp-super-gallery/v1/campaigns/batch/export/binary',
      { ids: ids.map(Number) },
    );
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
