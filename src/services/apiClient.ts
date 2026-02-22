import type { AuthProvider } from '@/services/auth/AuthProvider';

export interface ApiClientOptions {
  baseUrl: string;
  authProvider?: AuthProvider;
  onUnauthorized?: () => void;
}

export class ApiClient {
  private baseUrl: string;
  private authProvider?: AuthProvider;
  private onUnauthorized?: () => void;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.authProvider = options.authProvider;
    this.onUnauthorized = options.onUnauthorized;
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

  async get<T>(path: string, init?: RequestInit): Promise<T> {
    this.assertOnline();
    const headers = await this.getHeaders();
    const requestInit: RequestInit = {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers as Record<string, string> | undefined),
      },
    };
    const response = await fetch(`${this.baseUrl}${path}`, requestInit);
    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    this.assertOnline();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  async postForm<T>(path: string, formData: FormData): Promise<T> {
    this.assertOnline();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: await this.buildAuthHeaders(),
      body: formData,
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    this.assertOnline();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    this.assertOnline();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    return this.handleResponse<T>(response);
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
  cardGap?: number;
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
}

/**
 * Settings update request — same shape as response, all fields optional.
 */
export type SettingsUpdateRequest = Partial<SettingsResponse>;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
