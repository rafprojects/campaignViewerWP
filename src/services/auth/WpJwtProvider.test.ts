import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WpJwtProvider } from './WpJwtProvider';

const buildToken = (expSeconds: number) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const payload = btoa(JSON.stringify({ exp: expSeconds }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${payload}.sig`;
};

describe('WpJwtProvider', () => {
  const apiBaseUrl = 'https://example.test';

  beforeEach(() => {
    localStorage.clear();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('returns null on init (no persistent storage)', async () => {
    const provider = new WpJwtProvider({ apiBaseUrl });
    const session = await provider.init();

    expect(session).toBeNull();
  });

  it('stores and returns token after login', async () => {
    const mockToken = buildToken(Math.floor(Date.now() / 1000) + 60 * 60);
    
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        token: mockToken,
        user_id: '123',
        user_email: 'test@example.com',
      }),
    });

    const provider = new WpJwtProvider({ apiBaseUrl });
    const session = await provider.login('test@example.com', 'password');

    expect(session.accessToken).toBe(mockToken);
    
    // Verify token is stored in memory and can be retrieved
    const token = await provider.getAccessToken();
    expect(token).toBe(mockToken);
  });

  it('surfaces login error message from API', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Invalid username.' }),
    });

    const provider = new WpJwtProvider({ apiBaseUrl });

    await expect(provider.login('test@example.com', 'bad-pass')).rejects.toThrow('Invalid username.');
  });

  it('marks user as admin when permissions response indicates admin', async () => {
    const mockToken = buildToken(Math.floor(Date.now() / 1000) + 3600);
    
    // First, log in to store token and user
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: mockToken,
        user_id: '1',
        user_email: 'test@example.com',
      }),
    });

    const provider = new WpJwtProvider({ apiBaseUrl });
    await provider.login('test@example.com', 'password');

    // Now mock the permissions response
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ campaignIds: ['1'], isAdmin: true }),
    });

    const permissions = await provider.getPermissions();

    expect(permissions).toEqual(['1']);
    const user = await provider.getUser();
    expect(user?.role).toBe('admin');
  });

  it('returns empty permissions when cached value is invalid (not applicable for in-memory)', async () => {
    // In-memory storage doesn't have JSON parsing issues
    const provider = new WpJwtProvider({ apiBaseUrl });
    const permissions = await provider.getPermissions();

    expect(permissions).toEqual([]);
  });

  it('returns empty permissions when no token is available', async () => {
    const provider = new WpJwtProvider({ apiBaseUrl });
    const permissions = await provider.getPermissions();

    expect(permissions).toEqual([]);
  });

  it('returns null user for invalid stored JSON (not applicable for in-memory)', async () => {
    // In-memory storage doesn't have JSON parsing issues
    const provider = new WpJwtProvider({ apiBaseUrl });
    const user = await provider.getUser();

    expect(user).toBeNull();
  });

  it('clears access token when expired on getAccessToken', async () => {
    const expiredToken = buildToken(Math.floor(Date.now() / 1000) - 10);
    
    // Mock login with expired token (should be rejected)
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        token: expiredToken,
        user_id: '123',
        user_email: 'test@example.com',
      }),
    });

    const provider = new WpJwtProvider({ apiBaseUrl });
    
    // Login should fail because token is expired
    await expect(provider.login('test@example.com', 'password')).rejects.toThrow('Received token is already expired');
    
    const token = await provider.getAccessToken();
    expect(token).toBeNull();
  });

  it('returns cached permissions without calling fetch', async () => {
    const mockToken = buildToken(Math.floor(Date.now() / 1000) + 3600);
    
    // First, log in
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: mockToken,
        user_id: '123',
        user_email: 'test@example.com',
      }),
    });

    const provider = new WpJwtProvider({ apiBaseUrl });
    await provider.login('test@example.com', 'password');

    // Mock permissions response
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ campaignIds: ['cached'], isAdmin: false }),
    });

    // First call fetches from API
    const permissions1 = await provider.getPermissions();
    expect(permissions1).toEqual(['cached']);
    
    // Clear fetch mock
    vi.clearAllMocks();
    
    // Second call should use cached value
    const permissions2 = await provider.getPermissions();
    expect(permissions2).toEqual(['cached']);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns empty permissions when permissions request fails', async () => {
    const token = buildToken(Math.floor(Date.now() / 1000) + 3600);
    
    // First, log in
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token,
        user_id: '123',
        user_email: 'test@example.com',
      }),
    });

    const provider = new WpJwtProvider({ apiBaseUrl });
    await provider.login('test@example.com', 'password');

    // Mock failed permissions request
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const permissions = await provider.getPermissions();

    expect(permissions).toEqual([]);
  });

  it('keeps token when payload is not decodable', async () => {
    // Mock login with a malformed token
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'bad.token',
        user_id: '123',
        user_email: 'test@example.com',
      }),
    });

    const provider = new WpJwtProvider({ apiBaseUrl });
    await provider.login('test@example.com', 'password');
    
    const token = await provider.getAccessToken();
    // Token with non-decodable payload has no expiry, so it's kept
    expect(token).toBe('bad.token');
  });

  it('init always returns null (no persistent storage)', async () => {
    const provider = new WpJwtProvider({ apiBaseUrl });
    const session = await provider.init();

    expect(session).toBeNull();
  });
});
