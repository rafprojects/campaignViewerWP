import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '../test/test-utils';
import { AuthProvider, useAuth } from './AuthContext';
import { WpNonceProvider } from '@/services/auth/WpNonceProvider';
import type { AuthProvider as AuthProviderInterface, AuthSession, AuthUser } from '@/services/auth/AuthProvider';

/** Interactive consumer that exposes login/logout actions to tests. */
function AuthConsumer() {
  const { isReady, isAuthenticated, permissions, user, isAdmin, isSystemAdmin, login, logout } = useAuth();
  return (
    <div>
      <span>{isReady ? 'ready' : 'loading'}</span>
      <span>{isAuthenticated ? 'authed' : 'guest'}</span>
      <span>{permissions.join(',')}</span>
      {user && <span data-testid="role">{user.role}</span>}
      {user && <span data-testid="email">{user.email}</span>}
      <span data-testid="is-admin">{isAdmin ? 'editor+' : 'no'}</span>
      <span data-testid="is-system-admin">{isSystemAdmin ? 'sysadmin' : 'no'}</span>
      <button data-testid="login-btn" onClick={() => void login('user@example.com', 'pass123')}>Login</button>
      <button data-testid="logout-btn" onClick={() => void logout()}>Logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.__WPSG_CONFIG__;
    delete (window as Window & { __WPSG_REST_NONCE__?: string }).__WPSG_REST_NONCE__;
  });

  it('detects nonce-only system-admin auth via permissions endpoint (P20-K / P51-I WpNonceProvider)', async () => {
    // Simulate WP-injected config with nonce but no JWT.
    window.__WPSG_CONFIG__ = {
      restNonce: 'test-nonce-123',
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        campaignIds: ['42', '99'],
        isAdmin: true,
        isSystemAdmin: true,
        userId: 1,
        userEmail: 'admin@example.com',
      }),
    });

    render(
      <AuthProvider provider={new WpNonceProvider()} fallbackPermissions={[]}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeInTheDocument();
      expect(screen.getByText('authed')).toBeInTheDocument();
      expect(screen.getByText('42,99')).toBeInTheDocument();
      expect(screen.getByTestId('role')).toHaveTextContent('admin');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('editor+');
      expect(screen.getByTestId('is-system-admin')).toHaveTextContent('sysadmin');
    });
  });

  it('resolves the editor tier (manage_wpsg, not manage_options) and gates isSystemAdmin off (P53-A)', async () => {
    window.__WPSG_CONFIG__ = { restNonce: 'test-nonce-editor' };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        campaignIds: ['7'],
        isAdmin: true,
        isSystemAdmin: false,
        userId: 2,
        userEmail: 'editor@example.com',
      }),
    });

    render(
      <AuthProvider provider={new WpNonceProvider()} fallbackPermissions={[]}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('editor');
      // An editor can edit (isAdmin) but is NOT a system admin.
      expect(screen.getByTestId('is-admin')).toHaveTextContent('editor+');
      expect(screen.getByTestId('is-system-admin')).toHaveTextContent('no');
    });
  });

  it('falls back to guest when nonce-only returns no user (P20-K / P51-I WpNonceProvider)', async () => {
    window.__WPSG_CONFIG__ = {
      restNonce: 'test-nonce-456',
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        campaignIds: [],
        isAdmin: false,
      }),
    });

    render(
      <AuthProvider provider={new WpNonceProvider()} fallbackPermissions={['fallback']}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeInTheDocument();
      expect(screen.getByText('guest')).toBeInTheDocument();
    });
  });

  it('becomes ready without provider and without nonce', async () => {
    // No __WPSG_CONFIG__ set — no nonce available
    render(
      <AuthProvider fallbackPermissions={['a', 'b']}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeInTheDocument();
      expect(screen.getByText('guest')).toBeInTheDocument();
      expect(screen.getByText('a,b')).toBeInTheDocument();
    });
  });

  it('hydrates auth state from provider', async () => {
    const session: AuthSession = { accessToken: 'token-123' };
    const user: AuthUser = { id: '1', email: 'test@example.com', role: 'viewer' };

    const provider: AuthProviderInterface = {
      init: vi.fn().mockResolvedValue(session),
      login: vi.fn(),
      logout: vi.fn(),
      getAccessToken: vi.fn().mockResolvedValue('token-123'),
      getUser: vi.fn().mockResolvedValue(user),
      getPermissions: vi.fn().mockResolvedValue(['campaign-1']),
    };

    render(
      <AuthProvider provider={provider}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeInTheDocument();
      expect(screen.getByText('authed')).toBeInTheDocument();
      expect(screen.getByText('campaign-1')).toBeInTheDocument();
    });
  });

  // ── P20-K: Nonce-only cookie login/logout ───────────────

  it('logs in via cookie endpoint through WpNonceProvider (P20-K / P51-I)', async () => {
    window.__WPSG_CONFIG__ = { restNonce: 'initial-nonce' };

    // First call: WpNonceProvider.init() detect — returns guest.
    // Second call: POST /auth/login — returns authenticated user.
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ campaignIds: [], isAdmin: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: '5', email: 'user@example.com', role: 'admin' },
          permissions: ['10', '20'],
          isAdmin: true,
          nonce: 'fresh-nonce-after-login',
        }),
      });

    render(
      <AuthProvider provider={new WpNonceProvider()} fallbackPermissions={[]}>
        <AuthConsumer />
      </AuthProvider>,
    );

    // Wait for init (guest state).
    await waitFor(() => {
      expect(screen.getByText('ready')).toBeInTheDocument();
      expect(screen.getByText('guest')).toBeInTheDocument();
    });

    // Click the login button.
    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByText('authed')).toBeInTheDocument();
      expect(screen.getByTestId('email')).toHaveTextContent('user@example.com');
      expect(screen.getByTestId('role')).toHaveTextContent('admin');
      expect(screen.getByText('10,20')).toBeInTheDocument();
    });

    // Verify the global nonce was updated.
    expect(window.__WPSG_CONFIG__?.restNonce).toBe('fresh-nonce-after-login');

    // Verify correct fetch call.
    const loginCall = fetchMock.mock.calls[1];
    expect(loginCall[0]).toContain('/auth/login');
    expect(loginCall[1]?.method).toBe('POST');
  });

  it('throws on cookie login failure with server error message (P20-K / P51-I)', async () => {
    window.__WPSG_CONFIG__ = { restNonce: 'nonce-x' };

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ campaignIds: [], isAdmin: false }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ code: 'invalid_credentials', message: 'Invalid username or password.' }),
      });

    let loginError: Error | null = null;

    function ErrorCapture() {
      const { isReady, login } = useAuth();
      return (
        <div>
          <span>{isReady ? 'ready' : 'loading'}</span>
          <button
            data-testid="try-login"
            onClick={async () => {
              try {
                await login('bad@example.com', 'wrong');
              } catch (e) {
                loginError = e as Error;
              }
            }}
          >
            Try
          </button>
        </div>
      );
    }

    render(
      <AuthProvider provider={new WpNonceProvider()} fallbackPermissions={[]}>
        <ErrorCapture />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument());

    await act(async () => {
      screen.getByTestId('try-login').click();
    });

    expect(loginError).not.toBeNull();
    expect(loginError!.message).toBe('Invalid username or password.');
  });

  it('logs out via cookie endpoint and resets to guest (P20-K / P51-I)', async () => {
    window.__WPSG_CONFIG__ = { restNonce: 'authed-nonce' };

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    // Init: returns authenticated user.
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          campaignIds: ['1'],
          isAdmin: true,
          userId: 7,
          userEmail: 'admin@example.com',
        }),
      })
      // Logout: returns success.
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ loggedOut: true, nonce: 'guest-nonce' }),
      });

    render(
      <AuthProvider provider={new WpNonceProvider()} fallbackPermissions={[]}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('authed')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('logout-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByText('guest')).toBeInTheDocument();
    });

    // Nonce should be updated to the guest-level nonce.
    expect(window.__WPSG_CONFIG__?.restNonce).toBe('guest-nonce');

    // Verify correct fetch call.
    const logoutCall = fetchMock.mock.calls[1];
    expect(logoutCall[0]).toContain('/auth/logout');
    expect(logoutCall[1]?.method).toBe('POST');
  });

  // ── P68-C: focus/visibility permissions refresh ─────────────

  it('re-hydrates permissions when the tab becomes visible again (P68-C)', async () => {
    const user: AuthUser = { id: '1', email: 'v@example.com', role: 'viewer' };
    // getPermissions is cached at the provider level, so a real refresh comes
    // from init() re-running the /permissions detect. Model that: init resolves
    // a session each call; getPermissions returns the grown grant set second.
    const init = vi.fn().mockResolvedValue({ accessToken: 'tok' });
    const getPermissions = vi
      .fn()
      .mockResolvedValueOnce(['1']) // mount
      .mockResolvedValue(['1', '2']); // after the access grant lands
    const provider: AuthProviderInterface = {
      init,
      login: vi.fn(),
      logout: vi.fn(),
      getAccessToken: vi.fn().mockResolvedValue('tok'),
      getUser: vi.fn().mockResolvedValue(user),
      getPermissions,
    };

    render(
      <AuthProvider provider={provider}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    expect(init).toHaveBeenCalledTimes(1);

    // User returns to the tab.
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(screen.getByText('1,2')).toBeInTheDocument());
    // Re-hydrated from the provider (not just a cached getPermissions read).
    expect(init).toHaveBeenCalledTimes(2);
  });

  it('does not refresh on visibility change for an unauthenticated visitor (P68-C)', async () => {
    // Guest session — init resolves null, so no user; the focus effect must not
    // subscribe (anonymous visitors have nothing to refresh).
    const init = vi.fn().mockResolvedValue(null);
    const provider: AuthProviderInterface = {
      init,
      login: vi.fn(),
      logout: vi.fn(),
      getAccessToken: vi.fn().mockResolvedValue(null),
      getUser: vi.fn().mockResolvedValue(null),
      getPermissions: vi.fn().mockResolvedValue([]),
    };

    render(
      <AuthProvider provider={provider} fallbackPermissions={['f']}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('guest')).toBeInTheDocument());
    expect(init).toHaveBeenCalledTimes(1);

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // No second init — the guest path never subscribed the refresh listener.
    expect(init).toHaveBeenCalledTimes(1);
  });
});
