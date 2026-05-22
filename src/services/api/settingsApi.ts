import type { GalleryBehaviorSettings } from '@/types';
import type { HttpTransport } from '../http/HttpTransport';

/**
 * Settings API response — derives from GalleryBehaviorSettings plus
 * application-level fields not part of gallery behavior.
 * All fields are optional because the REST response may omit defaults.
 */
export interface SettingsResponse extends Partial<GalleryBehaviorSettings> {
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

/** Settings update request — same shape as response, all fields optional. */
export type SettingsUpdateRequest = Partial<SettingsResponse>;

/**
 * Domain module for the WP Super Gallery settings REST endpoints.
 *
 * Accepts any {@link HttpTransport} so it can be tested without a live
 * HTTP connection — pass a mock transport in unit tests.
 */
export class SettingsApi {
  constructor(private readonly transport: HttpTransport) {}

  getSettings(): Promise<SettingsResponse> {
    return this.transport.get<SettingsResponse>('/wp-json/wp-super-gallery/v1/settings');
  }

  updateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
    return this.transport.post<SettingsResponse>('/wp-json/wp-super-gallery/v1/settings', settings);
  }

  /** Connectivity probe — reuses the campaigns list endpoint. */
  testConnection(): Promise<{ success: boolean; message: string }> {
    return this.transport.get<{ success: boolean; message: string }>(
      '/wp-json/wp-super-gallery/v1/campaigns',
    );
  }
}
