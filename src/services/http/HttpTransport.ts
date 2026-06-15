import type { AuthProvider } from '@/services/auth/AuthProvider';

/**
 * Construction options shared by HttpTransportImpl and ApiClient.
 */
export interface ApiClientOptions {
  baseUrl: string;
  authProvider?: AuthProvider | undefined;
  onUnauthorized?: (() => void) | undefined;
  /** Default request timeout in milliseconds. 0 = no timeout. Default: 30 000. */
  timeout?: number | undefined;
  /**
   * Returns the current REST nonce to send as `X-WP-Nonce`, or undefined when
   * none is available. Injected so the transport stays free of any direct
   * `window.__WPSG_*` reads — the WordPress glue lives at the wiring site
   * (see `@/services/wpNonce`). When omitted, no nonce header is sent.
   */
  getNonce?: (() => string | undefined) | undefined;
  /**
   * Persists a refreshed nonce after a successful nonce-refresh round-trip.
   * Paired with `getNonce`/`noncePath`. When omitted, refresh is a no-op.
   */
  setNonce?: ((nonce: string) => void) | undefined;
  /**
   * REST path (relative to `baseUrl`) hit to refresh the nonce after a 403.
   * When omitted, the 403 → refresh → retry path is disabled.
   */
  noncePath?: string | undefined;
}

/**
 * Minimal contract that domain API modules depend on.
 *
 * Keeping domain modules coupled to this interface (rather than to the full
 * ApiClient class) makes them independently testable: a test can supply a
 * plain object mock instead of spinning up a real transport.
 */
export interface HttpTransport {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  postForm<T>(path: string, formData: FormData): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  getBaseUrl(): string;
  getAuthHeaders(): Promise<Record<string, string>>;
}
