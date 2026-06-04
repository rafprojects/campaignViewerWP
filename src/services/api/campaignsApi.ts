import type {
  CampaignMediaBatchRequestItem,
  CampaignMediaBatchResponse,
} from '@/types';
import type { HttpTransport } from '../http/HttpTransport';

// ── Response shapes ───────────────────────────────────────────────────────────

/** P18-D: Campaign export/import payload. */
export interface CampaignExportPayload {
  version: 1;
  exported_at: string;
  campaign: Record<string, unknown>;
  layout_template: {
    id: string;
    title: string;
    slots: unknown[];
    background: unknown;
    graphicLayers: unknown[];
  } | null;
  media_references: Array<{ id: string; url: string; title: string }>;
}

export interface CampaignCategoryEntry {
  id: string;
  name: string;
  slug: string;
  count: number;
  parent_id: number;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  source: 'builtin' | 'user';
  editable: boolean;
  settings: {
    visibility: 'public' | 'private';
    galleryOverrides: Record<string, unknown> | null;
    layoutTemplateId: string | null;
  };
  createdAt: string | null;
}

export interface TagEntry {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface AccessRequest {
  token: string;
  email: string;
  campaignId: number;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  resolvedAt: string | null;
}

// ── Domain module ─────────────────────────────────────────────────────────────

/**
 * Domain module for campaign CRUD, categories, tags, templates,
 * media batches, export/import, and access-request REST endpoints.
 */
export class CampaignsApi {
  constructor(private readonly transport: HttpTransport) {}

  // ── P18-C: Duplication ───────────────────────────────────────────────────

  duplicateCampaign(
    id: string,
    options: { name?: string; copyMedia?: boolean; duplicateLayoutTemplate?: boolean },
  ): Promise<{ id: string; title: string }> {
    return this.transport.post<{ id: string; title: string }>(
      `/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(id)}/duplicate`,
      {
        name: options.name,
        copyMedia: options.copyMedia ?? false,
        duplicateLayoutTemplate: options.duplicateLayoutTemplate ?? false,
      },
    );
  }

  // ── P28-A: Hard-delete ───────────────────────────────────────────────────

  deleteCampaign(
    id: string,
    options: { purgeAnalytics?: boolean } = {},
  ): Promise<{ message: string; id: number }> {
    const params = new URLSearchParams({ confirm: 'true' });
    if (options.purgeAnalytics) {
      params.set('purge_analytics', 'true');
    }
    return this.transport.delete<{ message: string; id: number }>(
      `/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(id)}?${params.toString()}`,
    );
  }

  // ── P18-B: Bulk actions ──────────────────────────────────────────────────

  batchCampaigns(
    action: 'archive' | 'restore',
    ids: string[],
  ): Promise<{ success: string[]; failed: Array<{ id: string; reason: string }> }> {
    return this.transport.post<{
      success: string[];
      failed: Array<{ id: string; reason: string }>;
    }>('/wp-json/wp-super-gallery/v1/campaigns/batch', { action, ids });
  }

  addCampaignMediaBatch(
    campaignId: string,
    items: CampaignMediaBatchRequestItem[],
  ): Promise<CampaignMediaBatchResponse> {
    return this.transport.post<CampaignMediaBatchResponse>(
      `/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(campaignId)}/media/batch`,
      { items },
    );
  }

  // ── P18-D: Export / Import ───────────────────────────────────────────────

  exportCampaign(id: string): Promise<CampaignExportPayload> {
    return this.transport.get<CampaignExportPayload>(
      `/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(id)}/export`,
    );
  }

  importCampaign(payload: CampaignExportPayload): Promise<Record<string, unknown>> {
    return this.transport.post<Record<string, unknown>>(
      '/wp-json/wp-super-gallery/v1/campaigns/import',
      payload,
    );
  }

  importCampaignBinary(
    file: File,
  ): Promise<Record<string, unknown> | { imported: Array<{ id: number; title: string }> }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.transport.postForm<
      Record<string, unknown> | { imported: Array<{ id: number; title: string }> }
    >('/wp-json/wp-super-gallery/v1/campaigns/import/binary', fd);
  }

  // ── P18-H / P28-C: Categories ────────────────────────────────────────────

  async listCampaignCategories(): Promise<CampaignCategoryEntry[]> {
    const response = await this.transport.get<{ items: CampaignCategoryEntry[] }>(
      '/wp-json/wp-super-gallery/v1/campaign-categories',
    );
    return response.items ?? [];
  }

  createCampaignCategory(name: string, slug?: string): Promise<CampaignCategoryEntry> {
    return this.transport.post<CampaignCategoryEntry>(
      '/wp-json/wp-super-gallery/v1/campaign-categories',
      { name, ...(slug ? { slug } : {}) },
    );
  }

  updateCampaignCategory(
    id: string,
    data: { name?: string; slug?: string },
  ): Promise<CampaignCategoryEntry> {
    return this.transport.put<CampaignCategoryEntry>(
      `/wp-json/wp-super-gallery/v1/campaign-categories/${id}`,
      data,
    );
  }

  deleteCampaignCategory(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.transport.delete<{ deleted: boolean; id: string }>(
      `/wp-json/wp-super-gallery/v1/campaign-categories/${id}`,
    );
  }

  // ── P28-C: Campaign Tags ─────────────────────────────────────────────────

  async listCampaignTags(): Promise<TagEntry[]> {
    const response = await this.transport.get<{ items: TagEntry[] }>(
      '/wp-json/wp-super-gallery/v1/tags/campaign',
    );
    return response.items ?? [];
  }

  createCampaignTag(name: string, slug?: string): Promise<TagEntry> {
    return this.transport.post<TagEntry>('/wp-json/wp-super-gallery/v1/tags/campaign', {
      name,
      ...(slug ? { slug } : {}),
    });
  }

  deleteCampaignTag(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.transport.delete<{ deleted: boolean; id: string }>(
      `/wp-json/wp-super-gallery/v1/tags/campaign/${id}`,
    );
  }

  // ── P28-O: Campaign Templates ────────────────────────────────────────────

  async listCampaignTemplates(): Promise<CampaignTemplate[]> {
    const response = await this.transport.get<{ items: CampaignTemplate[] }>(
      '/wp-json/wp-super-gallery/v1/campaign-templates',
    );
    return response.items ?? [];
  }

  createCampaignTemplate(data: {
    name: string;
    description?: string;
    from_campaign_id?: number;
  }): Promise<CampaignTemplate> {
    return this.transport.post<CampaignTemplate>(
      '/wp-json/wp-super-gallery/v1/campaign-templates',
      data,
    );
  }

  async deleteCampaignTemplate(id: string): Promise<void> {
    await this.transport.delete(`/wp-json/wp-super-gallery/v1/campaign-templates/${id}`);
  }

  // ── P28-C: Media Tags ────────────────────────────────────────────────────

  async listMediaTags(): Promise<TagEntry[]> {
    const response = await this.transport.get<{ items: TagEntry[] }>(
      '/wp-json/wp-super-gallery/v1/tags/media',
    );
    return response.items ?? [];
  }

  createMediaTag(name: string, slug?: string): Promise<TagEntry> {
    return this.transport.post<TagEntry>('/wp-json/wp-super-gallery/v1/tags/media', {
      name,
      ...(slug ? { slug } : {}),
    });
  }

  deleteMediaTag(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.transport.delete<{ deleted: boolean; id: string }>(
      `/wp-json/wp-super-gallery/v1/tags/media/${id}`,
    );
  }

  // ── P18-I: Access Request Workflow ───────────────────────────────────────

  submitAccessRequest(
    campaignId: string,
    email: string,
  ): Promise<{ message: string; token: string }> {
    return this.transport.post(
      `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access-requests`,
      { email },
    );
  }

  async listAccessRequests(campaignId: string, status?: string): Promise<AccessRequest[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await this.transport.get<AccessRequest[] | { items?: AccessRequest[] }>(
      `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access-requests${qs}`,
    );
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.items)) return response.items;
    return [];
  }

  approveAccessRequest(campaignId: string, token: string): Promise<{ message: string }> {
    return this.transport.post(
      `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access-requests/${token}/approve`,
      {},
    );
  }

  denyAccessRequest(campaignId: string, token: string): Promise<{ message: string }> {
    return this.transport.post(
      `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access-requests/${token}/deny`,
      {},
    );
  }

  // ── P28-J: Access Totals Summary ─────────────────────────────────────────

  getAccessSummary(page = 1, perPage = 50): Promise<AccessSummaryResponse> {
    return this.transport.get<AccessSummaryResponse>(
      `/wp-json/wp-super-gallery/v1/campaigns/access-summary?page=${page}&per_page=${perPage}`,
    );
  }
}

// ── Shared response shapes used by callers outside this module ────────────────

/** One row in the access-summary response. */
export interface AccessSummaryItem {
  id: number;
  title: string;
  grantCount: number;
  pendingRequestCount: number;
  /** null = unlimited (reserved for future capacity feature). */
  capacity: number | null;
}

export interface AccessSummaryResponse {
  items: AccessSummaryItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}
