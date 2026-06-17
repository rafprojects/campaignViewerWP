/**
 * Unit tests for WpNonceProvider (P51-I).
 *
 * The cookie + REST-nonce auth adapter lifted out of AuthContext. Exercises the
 * AuthProvider contract directly with a mocked global `fetch`:
 *  - init() detects admin/viewer/guest via the permissions endpoint
 *  - init() returns null (no session) when no nonce / no auth detected
 *  - login()/logout() hit the cookie endpoints and update the nonce globals
 *  - getAccessToken() is always null (cookie auth, no bearer token)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WpNonceProvider } from './WpNonceProvider';

describe('WpNonceProvider', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    window.__WPSG_CONFIG__ = { restNonce: 'nonce-1' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.__WPSG_CONFIG__;
    delete (window as Window & { __WPSG_REST_NONCE__?: string }).__WPSG_REST_NONCE__;
  });

  it('init() returns null without ever fetching when no nonce is present', async () => {
    delete window.__WPSG_CONFIG__;
    const provider = new WpNonceProvider();
    expect(await provider.init()).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(await provider.getUser()).toBeNull();
    expect(await provider.getPermissions()).toEqual([]);
  });

  it('init() resolves manage_wpsg-only to the editor tier and caches user + permissions', async () => {
    // P53-A: isAdmin (manage_wpsg) without isSystemAdmin (manage_options) = editor.
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ campaignIds: ['7', '9'], isAdmin: true, isSystemAdmin: false, userId: 3, userEmail: 'a@b.c' }),
    });

    const provider = new WpNonceProvider();
    const session = await provider.init();

    expect(session?.accessToken).toBeTruthy();
    expect(await provider.getUser()).toEqual({ id: '3', email: 'a@b.c', role: 'editor' });
    expect(await provider.getPermissions()).toEqual(['7', '9']);
    // Cookie auth — no bearer token.
    expect(await provider.getAccessToken()).toBeNull();
  });

  it('init() resolves isSystemAdmin to the admin tier', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ campaignIds: [], isAdmin: true, isSystemAdmin: true, userId: 1, userEmail: 'admin@b.c' }),
    });

    const provider = new WpNonceProvider();
    await provider.init();

    expect(await provider.getUser()).toEqual({ id: '1', email: 'admin@b.c', role: 'admin' });
  });

  it('init() returns null (guest) when the endpoint reports no user and no permissions', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ campaignIds: [], isAdmin: false }),
    });

    const provider = new WpNonceProvider();
    expect(await provider.init()).toBeNull();
    expect(await provider.getUser()).toBeNull();
  });

  it('login() posts to the cookie endpoint, updates the nonce, and caches the user', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: '5', email: 'u@e.com', role: 'viewer' },
        permissions: ['1'],
        nonce: 'fresh-nonce',
      }),
    });

    const provider = new WpNonceProvider();
    const session = await provider.login('u@e.com', 'pw');

    expect(session.accessToken).toBe('fresh-nonce');
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/wp-json/wp-super-gallery/v1/auth/login');
    expect(init.method).toBe('POST');
    expect(window.__WPSG_CONFIG__?.restNonce).toBe('fresh-nonce');
    expect(await provider.getUser()).toEqual({ id: '5', email: 'u@e.com', role: 'viewer' });
    expect(await provider.getPermissions()).toEqual(['1']);
  });

  it('login() throws the server-provided message on failure', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Invalid username or password.' }),
    });

    const provider = new WpNonceProvider();
    await expect(provider.login('bad', 'wrong')).rejects.toThrow('Invalid username or password.');
  });

  it('logout() posts to the cookie endpoint, updates to the guest nonce, and clears the cache', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ loggedOut: true, nonce: 'guest-nonce' }),
    });

    const provider = new WpNonceProvider();
    await provider.logout();

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/wp-json/wp-super-gallery/v1/auth/logout');
    expect(init.method).toBe('POST');
    expect(window.__WPSG_CONFIG__?.restNonce).toBe('guest-nonce');
    expect(await provider.getUser()).toBeNull();
    expect(await provider.getPermissions()).toEqual([]);
  });
});
