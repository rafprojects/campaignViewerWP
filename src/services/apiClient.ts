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
}

export interface SettingsUpdateRequest {
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
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
