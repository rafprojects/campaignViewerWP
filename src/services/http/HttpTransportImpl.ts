import type { ApiClientOptions, HttpTransport } from './HttpTransport';

/**
 * Structured error thrown by the transport on non-2xx responses or timeouts.
 *
 * Exported here so callers can `instanceof`-check without importing the full
 * ApiClient class.  Re-exported from `@/services/apiClient` for backward compat.
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Concrete HTTP transport implementation.
 *
 * Owns: timeout + AbortController, auth-header construction, nonce injection,
 * nonce refresh + retry on 403, offline guard, response parsing, 401 callback.
 *
 * Does NOT own: any knowledge of which WordPress REST endpoints exist or what
 * their request/response shapes look like — those live in the domain modules.
 */
export class HttpTransportImpl implements HttpTransport {
  private baseUrl: string;
  private authProvider: NonNullable<ApiClientOptions['authProvider']> | undefined;
  private onUnauthorized: (() => void) | undefined;
  private timeout: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.authProvider = options.authProvider;
    this.onUnauthorized = options.onUnauthorized;
    this.timeout = options.timeout ?? 30_000;
  }

  // =========================================================================
  // Transport internals
  // =========================================================================

  /**
   * Wraps `fetch` with a timeout enforced via AbortController.
   * If the caller already supplies a signal it is composed with the timeout.
   */
  private async fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    if (this.timeout <= 0) return fetch(url, init);

    let timedOut = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeout);

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

  private async getHeaders(extra?: HeadersInit): Promise<Record<string, string>> {
    const headers: Record<string, string> = await this.buildAuthHeaders();
    headers['Content-Type'] = 'application/json';
    return {
      ...headers,
      ...(extra as Record<string, string> | undefined),
    };
  }

  private assertOnline(): void {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new ApiError('You appear to be offline. Some features are unavailable.', 0);
    }
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

  // =========================================================================
  // HttpTransport interface — public HTTP verbs
  // =========================================================================

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

  // =========================================================================
  // Accessors
  // =========================================================================

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    return this.buildAuthHeaders();
  }
}
