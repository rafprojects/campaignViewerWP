/**
 * WP Super Gallery API Client
 *
 * Public surface unchanged — all existing imports continue to work.
 *
 * Internal structure (P32-C):
 *   HttpTransportImpl  — timeout, auth, nonce-retry, online-guard, response
 *                        parsing (src/services/http/HttpTransportImpl.ts)
 *   Domain modules     — endpoint groups with focused types
 *                        (src/services/api/*.ts)
 *   ApiClient          — thin facade: extends transport, composes domain
 *                        modules, delegates method calls
 */

// ── Transport layer ───────────────────────────────────────────────────────────

export type { HttpTransport, ApiClientOptions } from './http/HttpTransport';
export { ApiError } from './http/HttpTransportImpl';
import { HttpTransportImpl } from './http/HttpTransportImpl';

// ── Domain modules ────────────────────────────────────────────────────────────

import { SettingsApi } from './api/settingsApi';
import { LayoutTemplatesApi } from './api/layoutTemplatesApi';
import { AnalyticsApi } from './api/analyticsApi';
import { CampaignsApi } from './api/campaignsApi';
import { AdminApi } from './api/adminApi';
import { WebhooksApi } from './api/webhooksApi';
import { ExportApi } from './api/exportApi';

// ── Type re-exports for backward compatibility ────────────────────────────────
// All types that callers currently import from '@/services/apiClient' are
// re-exported here so no import path changes are required.

export type { SettingsResponse, SettingsUpdateRequest } from './api/settingsApi';
export type { LayoutTemplateResponse } from './api/layoutTemplatesApi';
export type {
  CampaignAnalyticsDayEntry,
  CampaignAnalyticsResponse,
  MediaAnalyticsItem,
  MediaAnalyticsResponse,
  AnalyticsSummaryTopCampaign,
  AnalyticsSummaryResponse,
  MediaUsageCampaignRef,
  MediaUsageResponse,
} from './api/analyticsApi';
export type {
  CampaignExportPayload,
  CampaignCategoryEntry,
  CampaignTemplate,
  TagEntry,
  AccessRequest,
  AccessSummaryItem,
  AccessSummaryResponse,
} from './api/campaignsApi';
export type { WpPageSummary, ObjectCacheHealth, HealthDataResponse } from './api/adminApi';
export type {
  WebhookEndpoint,
  WebhookEndpointWithSecret,
  WebhookDelivery,
  CreateWebhookEndpointRequest,
  UpdateWebhookEndpointRequest,
} from './api/webhooksApi';

// ── Convenience re-imports for use in this file ───────────────────────────────

import type { ApiClientOptions } from './http/HttpTransport';
import type { SettingsResponse, SettingsUpdateRequest } from './api/settingsApi';
import type { LayoutTemplateResponse } from './api/layoutTemplatesApi';
import type {
  CampaignAnalyticsResponse,
  MediaAnalyticsResponse,
  AnalyticsSummaryResponse,
  MediaUsageResponse,
} from './api/analyticsApi';
import type {
  CampaignExportPayload,
  CampaignCategoryEntry,
  CampaignTemplate,
  TagEntry,
  AccessRequest,
  AccessSummaryResponse,
} from './api/campaignsApi';
import type { WpPageSummary } from './api/adminApi';
import type {
  CampaignMediaBatchRequestItem,
  CampaignMediaBatchResponse,
} from '@/types';

// ── ApiClient ─────────────────────────────────────────────────────────────────

/**
 * Thin facade that composes transport + domain modules behind the same
 * public interface as before P32-C.
 *
 * Callers continue to `new ApiClient(options)` and call domain methods
 * directly — no import changes required anywhere in the application.
 */
export class ApiClient extends HttpTransportImpl {
  private readonly _settings: SettingsApi;
  private readonly _layoutTemplates: LayoutTemplatesApi;
  private readonly _analytics: AnalyticsApi;
  private readonly _campaigns: CampaignsApi;
  private readonly _admin: AdminApi;
  private readonly _webhooks: WebhooksApi;
  private readonly _export: ExportApi;

  constructor(options: ApiClientOptions) {
    super(options);
    this._settings = new SettingsApi(this);
    this._layoutTemplates = new LayoutTemplatesApi(this);
    this._analytics = new AnalyticsApi(this);
    this._campaigns = new CampaignsApi(this);
    this._admin = new AdminApi(this);
    this._webhooks = new WebhooksApi(this);
    this._export = new ExportApi(this);
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  getSettings(): Promise<SettingsResponse> {
    return this._settings.getSettings();
  }

  updateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
    return this._settings.updateSettings(settings);
  }

  testConnection(): Promise<{ success: boolean; message: string }> {
    return this._settings.testConnection();
  }

  // ── Layout Templates ──────────────────────────────────────────────────────

  getLayoutTemplates(): Promise<LayoutTemplateResponse[]> {
    return this._layoutTemplates.getLayoutTemplates();
  }

  getLayoutTemplate(id: string): Promise<LayoutTemplateResponse> {
    return this._layoutTemplates.getLayoutTemplate(id);
  }

  createLayoutTemplate(data: Partial<LayoutTemplateResponse>): Promise<LayoutTemplateResponse> {
    return this._layoutTemplates.createLayoutTemplate(data);
  }

  updateLayoutTemplate(
    id: string,
    data: Partial<LayoutTemplateResponse>,
  ): Promise<LayoutTemplateResponse> {
    return this._layoutTemplates.updateLayoutTemplate(id, data);
  }

  deleteLayoutTemplate(id: string): Promise<{ deleted: boolean }> {
    return this._layoutTemplates.deleteLayoutTemplate(id);
  }

  duplicateLayoutTemplate(id: string, name?: string): Promise<LayoutTemplateResponse> {
    return this._layoutTemplates.duplicateLayoutTemplate(id, name);
  }

  getLayoutTemplatePublic(id: string): Promise<LayoutTemplateResponse> {
    return this._layoutTemplates.getLayoutTemplatePublic(id);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  recordAnalyticsEvent(campaignId: string, eventType?: string, mediaId?: string): Promise<void> {
    return this._analytics.recordAnalyticsEvent(campaignId, eventType, mediaId);
  }

  getCampaignAnalytics(
    campaignId: string,
    from?: string,
    to?: string,
  ): Promise<CampaignAnalyticsResponse> {
    return this._analytics.getCampaignAnalytics(campaignId, from, to);
  }

  getCampaignMediaAnalytics(
    campaignId: string,
    from?: string,
    to?: string,
  ): Promise<MediaAnalyticsResponse> {
    return this._analytics.getCampaignMediaAnalytics(campaignId, from, to);
  }

  getAnalyticsSummary(from?: string, to?: string): Promise<AnalyticsSummaryResponse> {
    return this._analytics.getAnalyticsSummary(from, to);
  }

  getMediaUsage(mediaId: string): Promise<MediaUsageResponse> {
    return this._analytics.getMediaUsage(mediaId);
  }

  getMediaUsageSummary(ids: string[]): Promise<Record<string, number>> {
    return this._analytics.getMediaUsageSummary(ids);
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  duplicateCampaign(
    id: string,
    options: { name?: string; copyMedia?: boolean; duplicateLayoutTemplate?: boolean },
  ): Promise<{ id: string; title: string }> {
    return this._campaigns.duplicateCampaign(id, options);
  }

  deleteCampaign(
    id: string,
    options?: { purgeAnalytics?: boolean },
  ): Promise<{ message: string; id: number }> {
    return this._campaigns.deleteCampaign(id, options);
  }

  batchCampaigns(
    action: 'archive' | 'restore' | 'delete',
    ids: string[],
    options?: { purgeAnalytics?: boolean },
  ): Promise<{ success: string[]; failed: Array<{ id: string; reason: string }> }> {
    return this._campaigns.batchCampaigns(action, ids, options);
  }

  addCampaignMediaBatch(
    campaignId: string,
    items: CampaignMediaBatchRequestItem[],
  ): Promise<CampaignMediaBatchResponse> {
    return this._campaigns.addCampaignMediaBatch(campaignId, items);
  }

  exportCampaign(id: string): Promise<CampaignExportPayload> {
    return this._campaigns.exportCampaign(id);
  }

  importCampaign(payload: CampaignExportPayload): Promise<Record<string, unknown>> {
    return this._campaigns.importCampaign(payload);
  }

  importCampaignBinary(
    file: File,
  ): Promise<Record<string, unknown> | { imported: Array<{ id: number; title: string }> }> {
    return this._campaigns.importCampaignBinary(file);
  }

  listCampaignCategories(): Promise<CampaignCategoryEntry[]> {
    return this._campaigns.listCampaignCategories();
  }

  createCampaignCategory(name: string, slug?: string): Promise<CampaignCategoryEntry> {
    return this._campaigns.createCampaignCategory(name, slug);
  }

  updateCampaignCategory(
    id: string,
    data: { name?: string; slug?: string },
  ): Promise<CampaignCategoryEntry> {
    return this._campaigns.updateCampaignCategory(id, data);
  }

  deleteCampaignCategory(id: string): Promise<{ deleted: boolean; id: string }> {
    return this._campaigns.deleteCampaignCategory(id);
  }

  listCampaignTags(): Promise<TagEntry[]> {
    return this._campaigns.listCampaignTags();
  }

  createCampaignTag(name: string, slug?: string): Promise<TagEntry> {
    return this._campaigns.createCampaignTag(name, slug);
  }

  deleteCampaignTag(id: string): Promise<{ deleted: boolean; id: string }> {
    return this._campaigns.deleteCampaignTag(id);
  }

  listCampaignTemplates(): Promise<CampaignTemplate[]> {
    return this._campaigns.listCampaignTemplates();
  }

  createCampaignTemplate(data: {
    name: string;
    description?: string;
    from_campaign_id?: number;
  }): Promise<CampaignTemplate> {
    return this._campaigns.createCampaignTemplate(data);
  }

  deleteCampaignTemplate(id: string): Promise<void> {
    return this._campaigns.deleteCampaignTemplate(id);
  }

  listMediaTags(): Promise<TagEntry[]> {
    return this._campaigns.listMediaTags();
  }

  createMediaTag(name: string, slug?: string): Promise<TagEntry> {
    return this._campaigns.createMediaTag(name, slug);
  }

  deleteMediaTag(id: string): Promise<{ deleted: boolean; id: string }> {
    return this._campaigns.deleteMediaTag(id);
  }

  submitAccessRequest(
    campaignId: string,
    email: string,
  ): Promise<{ message: string; token: string }> {
    return this._campaigns.submitAccessRequest(campaignId, email);
  }

  listAccessRequests(campaignId: string, status?: string): Promise<AccessRequest[]> {
    return this._campaigns.listAccessRequests(campaignId, status);
  }

  approveAccessRequest(campaignId: string, token: string): Promise<{ message: string }> {
    return this._campaigns.approveAccessRequest(campaignId, token);
  }

  denyAccessRequest(campaignId: string, token: string): Promise<{ message: string }> {
    return this._campaigns.denyAccessRequest(campaignId, token);
  }

  getAccessSummary(page?: number, perPage?: number): Promise<AccessSummaryResponse> {
    return this._campaigns.getAccessSummary(page, perPage);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  listWpPages(): Promise<WpPageSummary[]> {
    return this._admin.listWpPages();
  }

  getHealthData(): Promise<import('./api/adminApi').HealthDataResponse> {
    return this._admin.getHealthData();
  }

  downloadGlobalAuditCsv(
    params?: { campaignId?: string; from?: string; to?: string; action?: string },
  ): Promise<void> {
    return this._admin.downloadGlobalAuditCsv(params);
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  listWebhookEndpoints(): Promise<import('./api/webhooksApi').WebhookEndpoint[]> {
    return this._webhooks.listEndpoints();
  }

  createWebhookEndpoint(
    data: import('./api/webhooksApi').CreateWebhookEndpointRequest,
  ): Promise<import('./api/webhooksApi').WebhookEndpointWithSecret> {
    return this._webhooks.createEndpoint(data);
  }

  updateWebhookEndpoint(
    index: number,
    data: import('./api/webhooksApi').UpdateWebhookEndpointRequest,
  ): Promise<import('./api/webhooksApi').WebhookEndpoint> {
    return this._webhooks.updateEndpoint(index, data);
  }

  deleteWebhookEndpoint(index: number): Promise<{ deleted: boolean }> {
    return this._webhooks.deleteEndpoint(index);
  }

  rotateWebhookSecret(index: number): Promise<{ secret: string }> {
    return this._webhooks.rotateSecret(index);
  }

  listWebhookDeliveries(limit?: number): Promise<import('./api/webhooksApi').WebhookDelivery[]> {
    return this._webhooks.listDeliveries(limit);
  }

  // ── Binary Export ─────────────────────────────────────────────────────────

  startCampaignBinaryExport(
    campaignId: string,
  ): Promise<{ jobId: string; status: import('./api/exportApi').ExportJobStatus }> {
    return this._export.startCampaignBinaryExport(campaignId);
  }

  startBulkBinaryExport(
    ids: string[],
  ): Promise<{ jobId: string; status: import('./api/exportApi').ExportJobStatus }> {
    return this._export.startBulkBinaryExport(ids);
  }

  getExportJob(jobId: string): Promise<import('./api/exportApi').ExportJob> {
    return this._export.getExportJob(jobId);
  }

  deleteExportJob(jobId: string): Promise<{ deleted: boolean }> {
    return this._export.deleteExportJob(jobId);
  }

  downloadExportJob(jobId: string, filename?: string): Promise<void> {
    return this._export.downloadExportJob(jobId, filename);
  }
}
