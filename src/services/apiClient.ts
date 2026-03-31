import type { AuthProvider } from '@/services/auth/AuthProvider';
import type { GalleryConfig, LayoutTemplate, TypographyOverride } from '@/types';
import type { GradientOptions } from '@/utils/gradientCss';

export interface ApiClientOptions {
  baseUrl: string;
  authProvider?: AuthProvider;
  onUnauthorized?: () => void;
  /** Default request timeout in milliseconds (P20-H-9). 0 = no timeout. Default: 30000. */
  timeout?: number;
}

export class ApiClient {
  private baseUrl: string;
  private authProvider?: AuthProvider;
  private onUnauthorized?: () => void;
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
    options: { name?: string; copyMedia?: boolean },
  ): Promise<{ id: string; title: string }> {
    return this.post<{ id: string; title: string }>(
      `/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(id)}/duplicate`,
      { name: options.name, copyMedia: options.copyMedia ?? false },
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

  // ── P18-D: Export / Import ───────────────────────────────────────────────

  async exportCampaign(id: string): Promise<CampaignExportPayload> {
    return this.get<CampaignExportPayload>(`/wp-json/wp-super-gallery/v1/campaigns/${encodeURIComponent(id)}/export`);
  }

  async importCampaign(payload: CampaignExportPayload): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/wp-json/wp-super-gallery/v1/campaigns/import', payload);
  }

  // ── P18-F: Analytics ────────────────────────────────────────────────────

  async recordAnalyticsEvent(campaignId: string, eventType = 'view'): Promise<void> {
    await this.post('/wp-json/wp-super-gallery/v1/analytics/event', {
      campaignId,
      eventType,
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

  // ── P18-H: Campaign Categories ───────────────────────────────────────────

  async listCampaignCategories(): Promise<CampaignCategoryEntry[]> {
    return this.get<CampaignCategoryEntry[]>('/wp-json/wp-super-gallery/v1/campaign-categories');
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
}

export interface SettingsResponse {
  authProvider?: string;
  apiBase?: string;
  theme?: string;
  galleryLayout?: string;
  itemsPerPage?: number;
  enableLightbox?: boolean;
  enableAnimations?: boolean;
  cacheTtl?: number;
  videoViewportHeight?: number;
  imageViewportHeight?: number;
  gallerySizingMode?: 'auto' | 'viewport' | 'manual';
  galleryManualHeight?: string;
  thumbnailScrollSpeed?: number;
  scrollAnimationStyle?: 'smooth' | 'instant';
  scrollAnimationDurationMs?: number;
  scrollAnimationEasing?: 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  scrollTransitionType?: 'fade' | 'slide' | 'slide-fade';
  imageBorderRadius?: number;
  videoBorderRadius?: number;
  transitionFadeEnabled?: boolean;
  // P12-H
  navArrowPosition?: 'top' | 'center' | 'bottom';
  navArrowSize?: number;
  navArrowColor?: string;
  navArrowBgColor?: string;
  navArrowBorderWidth?: number;
  navArrowHoverScale?: number;
  navArrowAutoHideMs?: number;
  // P12-I
  dotNavEnabled?: boolean;
  dotNavPosition?: 'below' | 'overlay-bottom' | 'overlay-top';
  dotNavSize?: number;
  dotNavActiveColor?: string;
  dotNavInactiveColor?: string;
  dotNavShape?: 'circle' | 'pill' | 'square';
  dotNavSpacing?: number;
  dotNavActiveScale?: number;
  // P12-A/B
  videoThumbnailWidth?: number;
  videoThumbnailHeight?: number;
  imageThumbnailWidth?: number;
  imageThumbnailHeight?: number;
  thumbnailGap?: number;
  thumbnailWheelScrollEnabled?: boolean;
  thumbnailDragScrollEnabled?: boolean;
  thumbnailScrollButtonsVisible?: boolean;
  // P12-J
  imageShadowPreset?: 'none' | 'subtle' | 'medium' | 'strong' | 'custom';
  videoShadowPreset?: 'none' | 'subtle' | 'medium' | 'strong' | 'custom';
  imageShadowCustom?: string;
  videoShadowCustom?: string;
  // P12-C
  imageGalleryAdapterId?: string;
  videoGalleryAdapterId?: string;
  unifiedGalleryEnabled?: boolean;
  unifiedGalleryAdapterId?: string;
  gridCardWidth?: number;
  gridCardHeight?: number;
  mosaicTargetRowHeight?: number;
  tileSize?: number;
  tileGapX?: number;
  tileGapY?: number;
  tileBorderWidth?: number;
  tileBorderColor?: string;
  tileGlowEnabled?: boolean;
  tileGlowColor?: string;
  tileGlowSpread?: number;
  tileHoverBounce?: boolean;
  masonryColumns?: number;
  // Viewport backgrounds
  imageBgType?: string;
  imageBgColor?: string;
  imageBgGradient?: string;
  imageBgImageUrl?: string;
  videoBgType?: string;
  videoBgColor?: string;
  videoBgGradient?: string;
  videoBgImageUrl?: string;
  unifiedBgType?: string;
  unifiedBgColor?: string;
  unifiedBgGradient?: string;
  unifiedBgImageUrl?: string;
  // P13-A: Campaign Card
  cardBorderRadius?: number;
  cardBorderWidth?: number;
  cardBorderMode?: string;
  cardBorderColor?: string;
  cardShadowPreset?: string;
  cardThumbnailHeight?: number;
  cardThumbnailFit?: string;
  cardGridColumns?: number;
  cardGapH?: number;
  cardGapV?: number;
  modalCoverHeight?: number;
  modalTransition?: string;
  modalTransitionDuration?: number;
  modalMaxHeight?: number;
  // P13-F: Card Gallery Pagination
  cardDisplayMode?: string;
  cardRowsPerPage?: number;
  cardPageDotNav?: boolean;
  cardPageTransitionMs?: number;
  // P13-E: Header visibility toggles
  showGalleryTitle?: boolean;
  showGallerySubtitle?: boolean;
  showAccessMode?: boolean;
  showFilterTabs?: boolean;
  showSearchBox?: boolean;
  // P13-E: App width, padding & per-gallery tile sizes
  appMaxWidth?: number;
  appPadding?: number;
  wpFullBleedDesktop?: boolean;
  wpFullBleedTablet?: boolean;
  wpFullBleedMobile?: boolean;
  imageTileSize?: number;
  videoTileSize?: number;
  // P14-C: Thumbnail cache TTL
  thumbnailCacheTtl?: number;
  // P14-F: Image optimization
  optimizeOnUpload?: boolean;
  optimizeMaxWidth?: number;
  optimizeMaxHeight?: number;
  optimizeQuality?: number;
  optimizeWebpEnabled?: boolean;
  // P14-B: Advanced Settings toggle
  advancedSettingsEnabled?: boolean;
  // P14-B: Card Appearance (advanced)
  cardLockedOpacity?: number;
  cardGradientStartOpacity?: number;
  cardGradientEndOpacity?: number;
  cardLockIconSize?: number;
  cardAccessIconSize?: number;
  cardBadgeOffsetY?: number;
  cardCompanyBadgeMaxWidth?: number;
  cardThumbnailHoverTransitionMs?: number;
  // P14-B: Gallery Text (advanced)
  galleryTitleText?: string;
  gallerySubtitleText?: string;
  campaignAboutHeadingText?: string;
  // P14-B: Modal / Viewer (advanced)
  modalCoverMobileRatio?: number;
  modalCoverTabletRatio?: number;
  modalCloseButtonSize?: number;
  modalCloseButtonBgColor?: string;
  modalContentMaxWidth?: number;
  campaignDescriptionLineHeight?: number;
  modalMobileBreakpoint?: number;
  cardPageTransitionOpacity?: number;
  // P14-B: Upload / Media (advanced)
  uploadMaxSizeMb?: number;
  uploadAllowedTypes?: string;
  libraryPageSize?: number;
  mediaListPageSize?: number;
  mediaCompactCardHeight?: number;
  mediaSmallCardHeight?: number;
  mediaMediumCardHeight?: number;
  mediaLargeCardHeight?: number;
  mediaListMinWidth?: number;
  swrDedupingIntervalMs?: number;
  notificationDismissMs?: number;
  // P14-B: Tile / Adapter (advanced)
  tileHoverOverlayOpacity?: number;
  tileBounceScaleHover?: number;
  tileBounceScaleActive?: number;
  tileBounceDurationMs?: number;
  tileBaseTransitionDurationMs?: number;
  hexVerticalOverlapRatio?: number;
  diamondVerticalOverlapRatio?: number;
  hexClipPath?: string;
  diamondClipPath?: string;
  tileDefaultPerRow?: number;
  photoNormalizeHeight?: number;
  masonryAutoColumnBreakpoints?: string;
  gridCardHoverShadow?: string;
  gridCardDefaultShadow?: string;
  gridCardHoverScale?: number;
  tileTransitionDurationMs?: number;
  // P14-B: Lightbox (advanced)
  lightboxTransitionMs?: number;
  lightboxBackdropColor?: string;
  lightboxEntryScale?: number;
  lightboxVideoMaxWidth?: number;
  lightboxVideoHeight?: number;
  lightboxMediaMaxHeight?: string;
  lightboxZIndex?: number;
  // P14-B: Navigation (advanced)
  dotNavMaxVisibleDots?: number;
  navArrowEdgeInset?: number;
  navArrowMinHitTarget?: number;
  navArrowFadeDurationMs?: number;
  navArrowScaleTransitionMs?: number;
  viewportHeightMobileRatio?: number;
  viewportHeightTabletRatio?: number;
  searchInputMinWidth?: number;
  searchInputMaxWidth?: number;
  // P14-B: System (advanced)
  expiryWarningThresholdMs?: number;
  adminSearchDebounceMs?: number;
  loginMinPasswordLength?: number;
  loginFormMaxWidth?: number;
  authBarBackdropBlur?: number;
  authBarMobileBreakpoint?: number;
  cardAutoColumnsBreakpoints?: string;
  // P15-A: Per-breakpoint gallery selection
  gallerySelectionMode?: 'unified' | 'per-breakpoint';
  desktopImageAdapterId?: string;
  desktopVideoAdapterId?: string;
  tabletImageAdapterId?: string;
  tabletVideoAdapterId?: string;
  mobileImageAdapterId?: string;
  mobileVideoAdapterId?: string;
  layoutBuilderScope?: 'full' | 'viewport';
  galleryConfig?: GalleryConfig | string;
  // P20-K
  sessionIdleTimeoutMinutes?: number;
  // P20-B: Data retention
  preserveDataOnUninstall?: boolean;
  archivePurgeDays?: number;
  archivePurgeGraceDays?: number;
  analyticsRetentionDays?: number;
  // P21-C: Card appearance
  showCardCompanyName?: boolean;
  showCardMediaCounts?: boolean;
  showCardTitle?: boolean;
  showCardDescription?: boolean;
  showCardBorder?: boolean;
  showCardAccessBadge?: boolean;
  showCardThumbnailFade?: boolean;
  // P21-D: Viewer background
  viewerBgType?: 'theme' | 'transparent' | 'solid' | 'gradient';
  viewerBgColor?: string;
  viewerBgGradient?: GradientOptions;
  showViewerBorder?: boolean;
  // P21-C: Card aspect ratio & max columns
  cardMaxColumns?: number;
  cardAspectRatio?: string;
  cardMinHeight?: number;
  // P21-G: Gallery labels
  galleryImageLabel?: string;
  galleryVideoLabel?: string;
  galleryLabelJustification?: 'left' | 'center' | 'right';
  showGalleryLabelIcon?: boolean;
  // P21-F: CampaignViewer enhancements
  campaignModalFullscreen?: boolean;
  showCampaignCompanyName?: boolean;
  showCampaignDate?: boolean;
  showCampaignAbout?: boolean;
  showCampaignDescription?: boolean;
  showCampaignStats?: boolean;
  campaignStatsAdminOnly?: boolean;
  campaignOpenMode?: 'full' | 'galleries-only';
  // P21-E: Auth bar display modes
  authBarDisplayMode?: 'bar' | 'floating' | 'draggable' | 'minimal' | 'auto-hide';
  authBarDragMargin?: number;
  // P21-H: Settings tooltips
  showSettingsTooltips?: boolean;
  // P21-I: Typography overrides
  typographyOverrides?: Record<string, TypographyOverride>;
  showInContextEditors?: boolean;
  // P21-J: QA fixes
  showCardInfoPanel?: boolean;
  showCampaignCoverImage?: boolean;
  showCampaignTags?: boolean;
  showCampaignAdminActions?: boolean;
  showCampaignGalleryLabels?: boolean;
  fullscreenContentMaxWidth?: number;
  // P22-K: Modal max width & background
  modalMaxWidth?: number;
  modalBgType?: 'theme' | 'transparent' | 'solid' | 'gradient';
  modalBgColor?: string;
  modalBgGradient?: GradientOptions;
  // P22-M: Modal gallery width/gap/margin
  modalGalleryMaxWidth?: number;
  modalGalleryGap?: number;
  modalGalleryMargin?: number;
  modalContentVerticalAlign?: 'top' | 'center' | 'bottom';
  // P22-P2: Dimension propagation — gallery section sizing
  gallerySectionMaxWidth?: number;
  gallerySectionMaxHeight?: number;
  gallerySectionHeightMode?: 'auto' | 'manual' | 'viewport';
  gallerySectionMinWidth?: number;
  gallerySectionMinHeight?: number;
  perTypeSectionEqualHeight?: boolean;
  modalInnerPadding?: number;
  gallerySectionPadding?: number;
  adapterContentPadding?: number;
  adapterSizingMode?: 'fill' | 'manual';
  adapterMaxWidthPct?: number;
  adapterMaxHeightPct?: number;
  // P22-P7: Card width unit, justification, adapter gap & justification
  cardMaxWidthUnit?: 'px' | '%';
  cardJustifyContent?: 'start' | 'center' | 'end' | 'space-between' | 'space-evenly';
  adapterItemGap?: number;
  adapterJustifyContent?: 'start' | 'center' | 'end' | 'space-between' | 'space-evenly' | 'stretch';
  // P22-P8d: Embla carousel settings
  carouselVisibleCards?: number;
  carouselAutoplay?: boolean;
  carouselAutoplaySpeed?: number;
  carouselAutoplayPauseOnHover?: boolean;
  carouselAutoplayDirection?: 'ltr' | 'rtl';
  carouselDragEnabled?: boolean;
  carouselDarkenUnfocused?: boolean;
  carouselDarkenOpacity?: number;
  carouselEdgeFade?: boolean;
  carouselLoop?: boolean;
  carouselGap?: number;
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
