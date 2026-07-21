/**
 * Unit tests for HttpTransportImpl (P32-C).
 *
 * These tests exercise the transport layer in isolation using a mocked global
 * `fetch`, covering the behaviours that no higher-level test targets:
 *
 *  - Request timeout enforced via AbortController
 *  - External AbortSignal compositing (caller signal honoured alongside timeout)
 *  - Already-aborted signal short-circuits fetch immediately
 *  - Auth header construction (nonce + Bearer token)
 *  - 401 callback invocation
 *  - 403 → nonce refresh → single retry
 *  - 403 retry suppressed when nonce refresh fails
 *  - Offline guard
 *  - Error message extraction from JSON response body
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpTransportImpl, ApiError } from './HttpTransportImpl';

// ── Helpers ───────────────────────────────────────────────────────────────────

type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function makeResponse(overrides: Partial<FetchResponse> = {}): FetchResponse {
  return {
    ok: true,
    status: 200,
    json: async () => ({ result: 'ok' }),
    ...overrides,
  };
}

function makeTransport(overrides: Partial<ConstructorParameters<typeof HttpTransportImpl>[0]> = {}) {
  return new HttpTransportImpl({
    baseUrl: 'https://example.test',
    timeout: 30_000,
    // [P51-D] Nonce is now injected; default to a refresh path so the 403 →
    // refresh → retry tests exercise that branch. Individual tests override
    // getNonce/setNonce to assert header injection and persistence.
    noncePath: '/wp-json/wp-super-gallery/v1/nonce',
    ...overrides,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HttpTransportImpl', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    // Ensure navigator.onLine is true by default.
    Object.defineProperty(globalThis.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ── Timeout ───────────────────────────────────────────────────────────────

  describe('timeout enforcement', () => {
    it('throws ApiError with status 0 when the request exceeds the timeout', async () => {
      vi.useFakeTimers();

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(Object.assign(new Error('AbortError'), { name: 'AbortError' })),
            );
          }),
      );

      const transport = makeTransport({ timeout: 500 });
      const promise = transport.get('/some-path');

      // Attach the catch handler synchronously so Node.js never sees an unhandled
      // rejection between the timer firing and the assertion.
      const captured = promise.catch((e: unknown) => e as ApiError);

      // advanceTimersByTimeAsync flushes the microtask queue between ticks, allowing
      // the async chain inside get() to reach fetch() and attach the abort listener
      // before the timeout fires.
      await vi.advanceTimersByTimeAsync(600);

      // ApiError is an Error subclass; name is not auto-set, so check via instanceof.
      const err = await captured;
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(0);
      expect((err as ApiError).message).toContain('timed out');
    });

    it('does not throw a timeout error when the response arrives in time', async () => {
      vi.useFakeTimers();

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse());

      const transport = makeTransport({ timeout: 500 });
      const promise = transport.get('/some-path');

      await vi.advanceTimersByTimeAsync(100); // well within timeout

      await expect(promise).resolves.toEqual({ result: 'ok' });
    });

    it('bypasses timeout machinery when timeout is 0', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse());

      const transport = makeTransport({ timeout: 0 });
      await expect(transport.get('/some-path')).resolves.toEqual({ result: 'ok' });

      // fetch should have been called with no AbortSignal injected by transport.
      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      // init is undefined when timeout=0 and no signal provided — no interference.
      expect(init?.signal ?? null).toBeNull();
    });
  });

  // ── External AbortSignal compositing ─────────────────────────────────────

  describe('external AbortSignal compositing', () => {
    it('aborts the request when the caller-supplied signal is aborted', async () => {
      // Use fake timers + advanceTimersByTimeAsync(0) to flush the async chain
      // (getHeaders → buildAuthHeaders → fetchWithTimeout) to the point where
      // fetch() is called and the abort listener is attached, without advancing
      // real time far enough to trigger the 5 s transport timeout.
      vi.useFakeTimers();

      const controller = new AbortController();

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            if (init?.signal?.aborted) {
              reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }));
              return;
            }
            init?.signal?.addEventListener('abort', () =>
              reject(Object.assign(new Error('AbortError'), { name: 'AbortError' })),
            );
          }),
      );

      const transport = makeTransport({ timeout: 5000 });
      const promise = transport.get('/some-path', { signal: controller.signal });

      // Flush all pending microtasks (0 ms advance = no timer fires, but queued
      // promises are drained) so the async chain reaches fetch() first.
      await vi.advanceTimersByTimeAsync(0);
      controller.abort();

      // The AbortError from the caller should propagate (not wrapped as ApiError timeout).
      await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('short-circuits immediately when the caller signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            if (init?.signal?.aborted) {
              reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }));
            }
          }),
      );

      const transport = makeTransport({ timeout: 5000 });
      const promise = transport.get('/some-path', { signal: controller.signal });

      await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    });
  });

  // ── Auth header construction ──────────────────────────────────────────────

  describe('auth header construction', () => {
    it('injects X-WP-Nonce from the injected getNonce callback when it returns a value', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse());

      const transport = makeTransport({ getNonce: () => 'test-nonce-123' });
      await transport.get('/some-path');

      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['X-WP-Nonce']).toBe('test-nonce-123');
    });

    it('omits X-WP-Nonce when no getNonce callback is provided', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse());

      const transport = makeTransport({ getNonce: undefined });
      await transport.get('/some-path');

      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['X-WP-Nonce']).toBeUndefined();
    });

    // [P68-B] Anonymous visitor: the getNonce callback is always wired (App.tsx
    // passes getWpNonce), but it returns undefined because PHP no longer injects
    // restNonce for logged-out sessions. The header must then be absent so the
    // service worker's anonymous stale-while-revalidate path is reachable.
    it('omits X-WP-Nonce when the getNonce callback returns undefined (anonymous)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse());

      const transport = makeTransport({ getNonce: () => undefined });
      await transport.get('/some-path');

      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['X-WP-Nonce']).toBeUndefined();
    });

    it('injects Bearer token from authProvider when one returns a token', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse());

      const authProvider = {
        getAccessToken: vi.fn().mockResolvedValue('bearer-abc'),
        init: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
        getUser: vi.fn(),
        getPermissions: vi.fn(),
      };

      const transport = makeTransport({ authProvider });
      await transport.get('/some-path');

      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer bearer-abc');
    });

    it('omits Authorization header when authProvider returns null', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse());

      const authProvider = {
        getAccessToken: vi.fn().mockResolvedValue(null),
        init: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
        getUser: vi.fn(),
        getPermissions: vi.fn(),
      };

      const transport = makeTransport({ authProvider });
      await transport.get('/some-path');

      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    });
  });

  // ── 401 callback ─────────────────────────────────────────────────────────

  describe('401 callback', () => {
    it('invokes onUnauthorized when a 401 response is received', async () => {
      const onUnauthorized = vi.fn();
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeResponse({ ok: false, status: 401, json: async () => ({}) }),
      );

      const transport = makeTransport({ onUnauthorized });
      await expect(transport.get('/some-path')).rejects.toBeInstanceOf(ApiError);
      expect(onUnauthorized).toHaveBeenCalledOnce();
    });

    it('does not invoke onUnauthorized for non-401 errors', async () => {
      const onUnauthorized = vi.fn();
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeResponse({ ok: false, status: 500, json: async () => ({}) }),
      );

      const transport = makeTransport({ onUnauthorized });
      await expect(transport.get('/some-path')).rejects.toBeInstanceOf(ApiError);
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  // ── 403 nonce refresh + retry ─────────────────────────────────────────────

  describe('403 nonce refresh and retry', () => {
    it('refreshes nonce and retries once on 403, returning the retried response', async () => {
      const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;

      // Call sequence:
      //  1. Original request → 403
      //  2. Nonce refresh endpoint → 200 with new nonce
      //  3. Retried original request → 200
      mockFetch
        .mockResolvedValueOnce(makeResponse({ ok: false, status: 403, json: async () => ({}) }))
        .mockResolvedValueOnce(
          makeResponse({ ok: true, status: 200, json: async () => ({ nonce: 'fresh-nonce' }) }),
        )
        .mockResolvedValueOnce(makeResponse({ ok: true, status: 200, json: async () => ({ data: 'retried' }) }));

      const transport = makeTransport();
      const result = await transport.get<{ data: string }>('/some-path');

      expect(result).toEqual({ data: 'retried' });
      // fetch called 3 times: original, nonce refresh, retry
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('does NOT retry when nonce refresh endpoint itself fails', async () => {
      const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;

      mockFetch
        .mockResolvedValueOnce(makeResponse({ ok: false, status: 403, json: async () => ({}) }))
        .mockResolvedValueOnce(makeResponse({ ok: false, status: 500, json: async () => ({}) }));

      const transport = makeTransport();
      await expect(transport.get('/some-path')).rejects.toMatchObject({ status: 403 });

      // Only 2 fetch calls: original + failed nonce refresh; no retry of the original.
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does NOT retry on non-403 errors', async () => {
      const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;

      mockFetch.mockResolvedValueOnce(
        makeResponse({ ok: false, status: 500, json: async () => ({}) }),
      );

      const transport = makeTransport();
      await expect(transport.get('/some-path')).rejects.toMatchObject({ status: 500 });
      // Only the original request; no nonce endpoint call.
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('persists the refreshed nonce via the injected setNonce callback', async () => {
      const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;

      mockFetch
        .mockResolvedValueOnce(makeResponse({ ok: false, status: 403, json: async () => ({}) }))
        .mockResolvedValueOnce(
          makeResponse({ ok: true, status: 200, json: async () => ({ nonce: 'updated-nonce' }) }),
        )
        .mockResolvedValueOnce(makeResponse());

      const setNonce = vi.fn();
      const transport = makeTransport({ setNonce });
      await transport.get('/some-path');

      expect(setNonce).toHaveBeenCalledWith('updated-nonce');
    });

    it('hits baseUrl + noncePath for the refresh and skips refresh when noncePath is omitted', async () => {
      const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;

      // With noncePath omitted, a 403 must not trigger a refresh round-trip.
      mockFetch.mockResolvedValueOnce(
        makeResponse({ ok: false, status: 403, json: async () => ({}) }),
      );
      const noRefresh = makeTransport({ noncePath: undefined });
      await expect(noRefresh.get('/some-path')).rejects.toMatchObject({ status: 403 });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // With noncePath set, the refresh targets `${baseUrl}${noncePath}`.
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(makeResponse({ ok: false, status: 403, json: async () => ({}) }))
        .mockResolvedValueOnce(
          makeResponse({ ok: true, status: 200, json: async () => ({ nonce: 'n2' }) }),
        )
        .mockResolvedValueOnce(makeResponse());
      const transport = makeTransport({ noncePath: '/custom/nonce' });
      await transport.get('/some-path');
      expect(mockFetch.mock.calls[1]![0]).toBe('https://example.test/custom/nonce');
    });
  });

  // ── Offline guard ─────────────────────────────────────────────────────────

  describe('offline guard', () => {
    it('throws ApiError with status 0 when navigator.onLine is false', async () => {
      Object.defineProperty(globalThis.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });

      const transport = makeTransport();
      await expect(transport.get('/some-path')).rejects.toMatchObject({
        status: 0,
        message: expect.stringContaining('offline'),
      });

      // fetch should not have been called.
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  // ── Error message extraction ──────────────────────────────────────────────

  describe('error message extraction', () => {
    it('uses the message field from the JSON response body when present', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeResponse({
          ok: false,
          status: 422,
          json: async () => ({ message: 'Validation failed: title is required' }),
        }),
      );

      const transport = makeTransport();
      await expect(transport.get('/some-path')).rejects.toMatchObject({
        status: 422,
        message: 'Validation failed: title is required',
      });
    });

    it('falls back to "Request failed" when the response body has no message field', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeResponse({ ok: false, status: 500, json: async () => ({}) }),
      );

      const transport = makeTransport();
      await expect(transport.get('/some-path')).rejects.toMatchObject({
        status: 500,
        message: 'Request failed',
      });
    });
  });

  // ── Empty / 204 success bodies (P68-E) ────────────────────────────────────

  describe('empty success bodies', () => {
    it('resolves with undefined for a 204 response without calling json()', async () => {
      const json = vi.fn();
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        json,
      });

      const transport = makeTransport();
      await expect(transport.get('/some-path')).resolves.toBeUndefined();
      // The success path must not attempt to parse an absent body.
      expect(json).not.toHaveBeenCalled();
    });

    it('resolves with undefined for a 200 response with Content-Length: 0', async () => {
      const json = vi.fn();
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '0' }),
        json,
      });

      const transport = makeTransport();
      await expect(transport.get('/some-path')).resolves.toBeUndefined();
      expect(json).not.toHaveBeenCalled();
    });

    it('still parses JSON for a normal 2xx body (no regression)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeResponse({ status: 200, json: async () => ({ data: 'present' }) }),
      );

      const transport = makeTransport();
      await expect(transport.get('/some-path')).resolves.toEqual({ data: 'present' });
    });
  });

  // ── Accessor methods ──────────────────────────────────────────────────────

  describe('accessors', () => {
    it('getBaseUrl returns the base URL with no trailing slash', () => {
      const transport = new HttpTransportImpl({ baseUrl: 'https://example.test/' });
      expect(transport.getBaseUrl()).toBe('https://example.test');
    });

    it('getAuthHeaders resolves to an object with X-WP-Nonce when getNonce returns a value', async () => {
      const transport = makeTransport({ getNonce: () => 'nonce-xyz' });
      const headers = await transport.getAuthHeaders();
      expect(headers['X-WP-Nonce']).toBe('nonce-xyz');
    });
  });
});
