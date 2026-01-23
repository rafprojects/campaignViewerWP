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

  it('clears expired token on init', async () => {
    const expiredToken = buildToken(Math.floor(Date.now() / 1000) - 60);
    localStorage.setItem('wpsg_access_token', expiredToken);

    const provider = new WpJwtProvider({ apiBaseUrl });
    const session = await provider.init();

    expect(session).toBeNull();
    expect(localStorage.getItem('wpsg_access_token')).toBeNull();
  });

  it('returns token when valid and not expired', async () => {
    const validToken = buildToken(Math.floor(Date.now() / 1000) + 60 * 60);
    localStorage.setItem('wpsg_access_token', validToken);

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const provider = new WpJwtProvider({ apiBaseUrl });
    const session = await provider.init();

    expect(session?.accessToken).toBe(validToken);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${apiBaseUrl}/wp-json/jwt-auth/v1/token/validate`,
      expect.objectContaining({ method: 'POST' }),
    );
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
    localStorage.setItem('wpsg_access_token', buildToken(Math.floor(Date.now() / 1000) + 3600));
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'test@example.com', role: 'viewer' }));

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ campaignIds: ['1'], isAdmin: true }),
    });

    const provider = new WpJwtProvider({ apiBaseUrl });
    const permissions = await provider.getPermissions();

    expect(permissions).toEqual(['1']);
    const updatedUser = JSON.parse(localStorage.getItem('wpsg_user') ?? '{}');
    expect(updatedUser.role).toBe('admin');
  });

  it('returns empty permissions when cached value is invalid', async () => {
    localStorage.setItem('wpsg_permissions', '{bad-json');

    const provider = new WpJwtProvider({ apiBaseUrl });
    const permissions = await provider.getPermissions();

    expect(permissions).toEqual([]);
  });

  it('returns empty permissions when no token is available', async () => {
    const provider = new WpJwtProvider({ apiBaseUrl });
    const permissions = await provider.getPermissions();

    expect(permissions).toEqual([]);
  });

  it('returns null user for invalid stored JSON', async () => {
    localStorage.setItem('wpsg_user', '{bad');

    const provider = new WpJwtProvider({ apiBaseUrl });
    const user = await provider.getUser();

    expect(user).toBeNull();
  });

  it('clears access token when expired on getAccessToken', async () => {
    const expiredToken = buildToken(Math.floor(Date.now() / 1000) - 10);
    localStorage.setItem('wpsg_access_token', expiredToken);

    const provider = new WpJwtProvider({ apiBaseUrl });
    const token = await provider.getAccessToken();

    expect(token).toBeNull();
    expect(localStorage.getItem('wpsg_access_token')).toBeNull();
  });

  it('returns cached permissions without calling fetch', async () => {
    localStorage.setItem('wpsg_permissions', JSON.stringify(['cached']));

    const provider = new WpJwtProvider({ apiBaseUrl });
    const permissions = await provider.getPermissions();

    expect(permissions).toEqual(['cached']);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns empty permissions when permissions request fails', async () => {
    const token = buildToken(Math.floor(Date.now() / 1000) + 3600);
    localStorage.setItem('wpsg_access_token', token);

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const provider = new WpJwtProvider({ apiBaseUrl });
    const permissions = await provider.getPermissions();

    expect(permissions).toEqual([]);
  });

  it('keeps token when payload is not decodable', async () => {
    localStorage.setItem('wpsg_access_token', 'bad.token');

    const provider = new WpJwtProvider({ apiBaseUrl });
    const token = await provider.getAccessToken();

    expect(token).toBe('bad.token');
  });

  it('clears token when validate endpoint rejects it', async () => {
    const token = buildToken(Math.floor(Date.now() / 1000) + 3600);
    localStorage.setItem('wpsg_access_token', token);

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    });

    const provider = new WpJwtProvider({ apiBaseUrl });
    const session = await provider.init();

    expect(session).toBeNull();
    expect(localStorage.getItem('wpsg_access_token')).toBeNull();
  });
});
