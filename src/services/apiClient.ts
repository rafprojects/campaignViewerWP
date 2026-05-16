import type { AuthProvider } from '@/services/auth/AuthProvider';
import type {
  CampaignMediaBatchRequestItem,
  CampaignMediaBatchResponse,
  GalleryBehaviorSettings,
  LayoutTemplate,
} from '@/types';

export interface ApiClientOptions {
  baseUrl: string;
  authProvider?: AuthProvider | undefined;
  onUnauthorized?: (() => void) | undefined;
  /** Default request timeout in milliseconds (P20-H-9). 0 = no timeout. Default: 30000. */
  timeout?: number | undefined;
}

export class ApiClient {
  private baseUrl: string;
  private authProvider?: AuthProvider | undefined;
  private onUnauthorized?: (() => void) | undefined;
  private timeout: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.authProvider = options.authProvider;
    this.onUnauthorized = options.onUnauthorized;
    this.timeout = options.timeout ?? 30_000;
  }

  /**
   * Wrapper around `fetch` that enforces a request timeout via AbortController (P20-H-9).
   * If the caller already provides a signal, it is combined with the timeout signal.
   */
  private async fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    if (this.timeout <= 0) return fetch(url, init);

    let timedOut = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeout);

    // If the caller already attached an AbortSignal, listen for its abort too.
    const existingSignal = init?.signal;
    const onExternalAbort = existingSignal
      ? () => controller.abort(existingSignal.reason)
      : undefined;
    if (existingSignal) {
      if (existingSignal.aborted) {
        clearTimeout(timeoutId);
        controller.abort(existingSignal.reason);
      } else {
        existingSignal.addEventListener('abort', onExternalAbort!, { once: true });
      }
    }

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError' && timedOut) {
        throw new ApiError(`Request timed out after ${this.timeout}ms`, 0);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (onExternalAbort && existingSignal) {
        existingSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  private async getHeaders(extra?: HeadersInit): Promise<Record<string, string>> {
    const headers: Record<string, string> = await this.buildAuthHeaders();
    headers['Content-Type'] = 'application/json';
    return {
      ...headers,
      ...(extra as Record<string, string> | undefined),
    };
  }

  private async buildAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    const nonce = window.__WPSG_CONFIG__?.restNonce ?? window.__WPSG_REST_NONCE__;
    if (nonce) {
      headers['X-WP-Nonce'] = nonce;
    }
    if (this.authProvider) {
      const token = await this.authProvider.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
    return headers;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private assertOnline(): void {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new ApiError('You appear to be offline. Some features are unavailable.', 0);
    }
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    return this.buildAuthHeaders();
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401) {
        this.onUnauthorized?.();
      }

      let errorMessage = 'Request failed';
      try {
        const data = await response.json();
        if (data?.message) {
          errorMessage = data.message;
        }
      } catch {
        // ignore parse errors
      }

      throw new ApiError(errorMessage, response.status);
    }
    return response.json() as Promise<T>;
  }

  /**
   * Attempt to refresh the WP REST nonce after a 403 response.
   * Returns true if a new nonce was obtained and the request should be retried.
   */
  private async refreshNonce(): Promise<boolean> {
    try {
      const currentNonce =
        window.__WPSG_CONFIG__?.restNonce ?? window.__WPSG_REST_NONCE__;
      const response = await fetch(
        `${this.baseUrl}/wp-json/wp-super-gallery/v1/nonce`,
        {
          credentials: 'same-origin',
          headers: currentNonce ? { 'X-WP-Nonce': currentNonce } : {},
        },
      );
      if (!response.ok) return false;
      const data: { nonce?: string } = await response.json();
      if (data.nonce) {
        if (window.__WPSG_CONFIG__) {
          window.__WPSG_CONFIG__.restNonce = data.nonce;
        }
        (window as Window & { __WPSG_REST_NONCE__?: string }).__WPSG_REST_NONCE__ =
          data.nonce;
        return true;
      }
    } catch {
      // refresh failed — don't retry
    }
    return false;
  }

  /**
   * Execute a request function. On 403, attempt a nonce refresh and retry once.
   */
  private async withNonceRetry<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        const refreshed = await this.refreshNonce();
        if (refreshed) {
          return request();
        }
      }
      throw err;
    }
  }

  async get<T>(path: string, init?: RequestInit): Promise<T> {
    return this.withNonceRetry(async () => {
      this.assertOnline();
      const headers = await this.getHeaders();
      const requestInit: RequestInit = {
        ...init,
        headers: {
          ...headers,
          ...(init?.headers as Record<string, string> | undefined),
        },
      };
      const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, requestInit);
      return this.handleResponse<T>(response);
    });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.withNonceRetry(async () => {
      this.assertOnline();
      const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response);
    });
  }

  async postForm<T>(path: string, formData: FormData): Promise<T> {
    return this.withNonceRetry(async () => {
      this.assertOnline();
      const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: await this.buildAuthHeaders(),
        body: formData,
      });
      return this.handleResponse<T>(response);
    });
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.withNonceRetry(async () => {
      this.assertOnline();
      const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
        method: 'PUT',
        headers: await this.getHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response);
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.withNonceRetry(async () => {
      this.assertOnline();
      const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
        method: 'DELETE',
        headers: await this.getHeaders(),
      });
      return this.handleResponse<T>(response);
    });
  }

  // WordPress core pages (used by magic-link landing page selector)
  async listWpPages(): Promise<WpPageSummary[]> {
    return this.get<WpPageSummary[]>(
      '/wp-json/wp/v2/pages?per_page=100&status=publish&_fields=id,title,link',
    );
  }

  // Settings API methods
  async getSettings(): Promise<SettingsResponse> {
    return this.get<SettingsResponse>('/wp-json/wp-super-gallery/v1/settings');
  }

  async updateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
    return this.post<SettingsResponse>('/wp-json/wp-super-gallery/v1/settings', settings);
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return this.get<{ success: boolean; message: string }>('/wp-json/wp-super-gallery/v1/campaigns');
  }

  // ── P15-B: Layout Template API methods ─────────────────────

  async getLayoutTemplates(): Promise<LayoutTemplateResponse[]> {
    return this.get<LayoutTemplateResponse[]>('/wp-json/wp-super-gallery/v1/admin/layout-templates');
  }

  async getLayoutTemplate(id: string): Promise<LayoutTemplateResponse> {
    return this.get<LayoutTemplateResponse>(`/wp-json/wp-super-gallery/v1/admin/layout-templates/${encodeURIComponent(id)}`);
  }

  async createLayoutTemplate(data: Partial<LayoutTemplateResponse>): Promise<LayoutTemplateResponse> {
    return this.post<LayoutTemplateResponse>('/wp-json/wp-super-gallery/v1/admin/layout-templates', data);
  }

  async updateLayoutTemplate(id: string, data: Partial<LayoutTemplateResponse>): Promise<LayoutTemplateResponse> {
    return this.put<LayoutTemplateResponse>(`/wp-json/wp-super-gallery/v1/admin/layout-templates/${encodeURIComponent(id)}`, data);
  }

  async deleteLayoutTemplate(id: string): Promise<{ deleted: boolean }> {
    return this.delete<{ deleted: boolean }>(`/wp-json/wp-super-gallery/v1/admin/layout-templates/${encodeURIComponent(id)}`);
  }

  async duplicateLayoutTemplate(id: string, name?: string): Promise<LayoutTemplateResponse> {
    return this.post<LayoutTemplateResponse>(`/wp-json/wp-super-gallery/v1/admin/layout-templates/${encodeURIComponent(id)}/duplicate`, { name });
  }

  /** Public endpoint — no auth required. Used for rendering. */
  async getLayoutTemplatePublic(id: string): Promise<LayoutTemplateResponse> {
    return this.get<LayoutTemplateResponse>(`/wp-json/wp-super-gallery/v1/layout-templates/${encodeURIComponent(id)}`);
  }

  // ── P18-C: Campaign duplication ─────────────────────────────────────────

  async duplicateCampaign(
    id: string,
    options: { name?: string; copyMedia?: boolean; duplicateLayoutTemplate?: boolean },
  ): Promise<{ id: string; title: string }> {
    return this.post<{ id: string; title: string }>(
      `/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(id)}/duplicate`,
      {
        name: options.name,
        copyMedia: options.copyMedia ?? false,
        duplicateLayoutTemplate: options.duplicateLayoutTemplate ?? false,
      },
    );
  }

  // ── P28-A: Campaign hard-delete ─────────────────────────────────────────

  async deleteCampaign(
    id: string,
    options: { purgeAnalytics?: boolean } = {},
  ): Promise<{ message: string; id: number }> {
    const params = new URLSearchParams({ confirm: 'true' });
    if (options.purgeAnalytics) {
      params.set('purge_analytics', 'true');
    }
    return this.delete<{ message: string; id: number }>(
      `/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(id)}?${params.toString()}`,
    );
  }

  // ── P18-B: Bulk campaign actions ────────────────────────────────────────

  async batchCampaigns(
    action: 'archive' | 'restore',
    ids: string[],
  ): Promise<{ success: string[]; failed: Array<{ id: string; reason: string }> }> {
    return this.post<{ success: string[]; failed: Array<{ id: string; reason: string }> }>(
      '/wp-json/wp-super-gallery/v1/campaigns/batch',
      { action, ids },
    );
  }

  async addCampaignMediaBatch(
    campaignId: string,
    items: CampaignMediaBatchRequestItem[],
  ): Promise<CampaignMediaBatchResponse> {
    return this.post<CampaignMediaBatchResponse>(
      `/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(campaignId)}/media/batch`,
      { items },
    );
  }

  // ── P18-D: Export / Import ───────────────────────────────────────────────

  async exportCampaign(id: string): Promise<CampaignExportPayload> {
    return this.get<CampaignExportPayload>(`/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(id)}/export`);
  }

  async importCampaign(payload: CampaignExportPayload): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/wp-json/wp-super-gallery/v1/campaigns/import', payload);
  }

  // ── P18-F: Analytics ────────────────────────────────────────────────────

  async recordAnalyticsEvent(campaignId: string, eventType = 'view', mediaId?: string): Promise<void> {
    await this.post('/wp-json/wp-super-gallery/v1/analytics/event', {
      campaignId,
      eventType,
      ...(mediaId ? { mediaId } : {}),
    });
  }

  async getCampaignAnalytics(
    campaignId: string,
    from?: string,
    to?: string,
  ): Promise<CampaignAnalyticsResponse> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.get<CampaignAnalyticsResponse>(
      `/wp-json/wp-super-gallery/v1/analytics/campaigns/${encodeURIComponent(campaignId)}${qs}`,
    );
  }

  async getCampaignMediaAnalytics(
    campaignId: string,
    from?: string,
    to?: string,
  ): Promise<MediaAnalyticsResponse> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.get<MediaAnalyticsResponse>(
      `/wp-json/wp-super-gallery/v1/analytics/campaigns/${encodeURIComponent(campaignId)}/media${qs}`,
    );
  }

  async getAnalyticsSummary(from?: string, to?: string): Promise<AnalyticsSummaryResponse> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.get<AnalyticsSummaryResponse>(`/wp-json/wp-super-gallery/v1/analytics/summary${qs}`);
  }

  // ── P18-G: Media Usage Tracking ─────────────────────────────────────────

  async getMediaUsage(mediaId: string): Promise<MediaUsageResponse> {
    return this.get<MediaUsageResponse>(
      `/wp-json/wp-super-gallery/v1/media/${encodeURIComponent(mediaId)}/usage`,
    );
  }

  async getMediaUsageSummary(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {};
    const qs = ids.map((id) => `ids[]=${encodeURIComponent(id)}`).join('&');
    return this.get<Record<string, number>>(
      `/wp-json/wp-super-gallery/v1/media/usage-summary?${qs}`,
    );
  }

  // ── P18-H / P28-C: Campaign Categories ──────────────────────────────────

  async listCampaignCategories(): Promise<CampaignCategoryEntry[]> {
    const response = await this.get<{ items: CampaignCategoryEntry[] }>('/wp-json/wp-super-gallery/v1/campaign-categories');
    return response.items ?? [];
  }

  async createCampaignCategory(name: string, slug?: string): Promise<CampaignCategoryEntry> {
    return this.post<CampaignCategoryEntry>('/wp-json/wp-super-gallery/v1/campaign-categories', { name, ...(slug ? { slug } : {}) });
  }

  async updateCampaignCategory(id: string, data: { name?: string; slug?: string }): Promise<CampaignCategoryEntry> {
    return this.put<CampaignCategoryEntry>(`/wp-json/wp-super-gallery/v1/campaign-categories/${id}`, data);
  }

  async deleteCampaignCategory(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.delete<{ deleted: boolean; id: string }>(`/wp-json/wp-super-gallery/v1/campaign-categories/${id}`);
  }

  // ── P28-C: Campaign Tags ─────────────────────────────────────────────────

  async listCampaignTags(): Promise<TagEntry[]> {
    const response = await this.get<{ items: TagEntry[] }>('/wp-json/wp-super-gallery/v1/tags/campaign');
    return response.items ?? [];
  }

  async createCampaignTag(name: string, slug?: string): Promise<TagEntry> {
    return this.post<TagEntry>('/wp-json/wp-super-gallery/v1/tags/campaign', { name, ...(slug ? { slug } : {}) });
  }

  async deleteCampaignTag(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.delete<{ deleted: boolean; id: string }>(`/wp-json/wp-super-gallery/v1/tags/campaign/${id}`);
  }

  // ── P28-C: Media Tags ────────────────────────────────────────────────────

  async listMediaTags(): Promise<TagEntry[]> {
    const response = await this.get<{ items: TagEntry[] }>('/wp-json/wp-super-gallery/v1/tags/media');
    return response.items ?? [];
  }

  async createMediaTag(name: string, slug?: string): Promise<TagEntry> {
    return this.post<TagEntry>('/wp-json/wp-super-gallery/v1/tags/media', { name, ...(slug ? { slug } : {}) });
  }

  async deleteMediaTag(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.delete<{ deleted: boolean; id: string }>(`/wp-json/wp-super-gallery/v1/tags/media/${id}`);
  }

  // ── P18-I: Access Request Workflow ───────────────────────────────────────

  async submitAccessRequest(campaignId: string, email: string): Promise<{ message: string; token: string }> {
    return this.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access-requests`, { email });
  }

  async listAccessRequests(campaignId: string, status?: string): Promise<AccessRequest[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await this.get<AccessRequest[] | { items?: AccessRequest[] }>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access-requests${qs}`);
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.items)) return response.items;
    return [];
  }

  async approveAccessRequest(campaignId: string, token: string): Promise<{ message: string }> {
    return this.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access-requests/${token}/approve`, {});
  }

  async denyAccessRequest(campaignId: string, token: string): Promise<{ message: string }> {
    return this.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/access-requests/${token}/deny`, {});
  }

  // ── P28-J: Access Totals Summary ─────────────────────────────────────────

  async getAccessSummary(page = 1, perPage = 50): Promise<AccessSummaryResponse> {
    return this.get<AccessSummaryResponse>(
      `/wp-json/wp-super-gallery/v1/campaigns/access-summary?page=${page}&per_page=${perPage}`,
    );
  }
}

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

/** Minimal WP page summary returned by the /wp/v2/pages endpoint. */
export interface WpPageSummary {
  id: number;
  title: { rendered: string };
  link: string;
}

/**
 * Settings API response — derives from the canonical GalleryBehaviorSettings
 * model plus a small set of application-level fields. This ensures the API
 * contract stays in sync with the shared type layer automatically.
 *
 * All fields are optional because the REST response may omit defaults.
 */
export interface SettingsResponse extends Partial<GalleryBehaviorSettings> {
  // ── Application-level extras (not part of gallery behavior) ─────────────
  authProvider?: string;
  apiBase?: string;
  theme?: string;
  galleryLayout?: string;
  itemsPerPage?: number;
  enableLightbox?: boolean;
  enableAnimations?: boolean;
  cacheTtl?: number;
  /** P28-I: WP page ID used as magic-link result landing page (0 = none). */
  magicLinkLandingPageId?: number | undefined;
}

/**
 * Settings update request — same shape as response, all fields optional.
 */
export type SettingsUpdateRequest = Partial<SettingsResponse>;

/**
 * Layout template response type — identical to the TS LayoutTemplate interface.
 */
export type LayoutTemplateResponse = LayoutTemplate;

/**
 * P18-D: Campaign export/import payload shape.
 */
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

/**
 * P18-F: Analytics response shape.
 */
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

export interface CampaignCategoryEntry {
  id: string;
  name: string;
  slug: string;
  count: number;
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

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
