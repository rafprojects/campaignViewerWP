import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '../test/test-utils';
import { AuthProvider, useAuth } from './AuthContext';
import type { AuthProvider as AuthProviderInterface, AuthSession, AuthUser } from '@/services/auth/AuthProvider';

/** Interactive consumer that exposes login/logout actions to tests. */
function AuthConsumer() {
  const { isReady, isAuthenticated, permissions, user, login, logout } = useAuth();
  return (
    <div>
      <span>{isReady ? 'ready' : 'loading'}</span>
      <span>{isAuthenticated ? 'authed' : 'guest'}</span>
      <span>{permissions.join(',')}</span>
      {user && <span data-testid="role">{user.role}</span>}
      {user && <span data-testid="email">{user.email}</span>}
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

  it('detects nonce-only admin auth via permissions endpoint (P20-K)', async () => {
    // Simulate WP-injected config with nonce but no JWT.
    window.__WPSG_CONFIG__ = {
      restNonce: 'test-nonce-123',
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        campaignIds: ['42', '99'],
        isAdmin: true,
        userId: 1,
        userEmail: 'admin@example.com',
      }),
    });

    render(
      <AuthProvider fallbackPermissions={[]}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeInTheDocument();
      expect(screen.getByText('authed')).toBeInTheDocument();
      expect(screen.getByText('42,99')).toBeInTheDocument();
      expect(screen.getByTestId('role')).toHaveTextContent('admin');
    });
  });

  it('falls back to guest when nonce-only returns no user (P20-K)', async () => {
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
      <AuthProvider fallbackPermissions={['fallback']}>
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

  it('logs in via cookie endpoint when no provider is configured (P20-K)', async () => {
    window.__WPSG_CONFIG__ = { restNonce: 'initial-nonce' };

    // First call: detectNonceAuth during init — returns guest.
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
      <AuthProvider fallbackPermissions={[]}>
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

  it('throws on cookie login failure with server error message (P20-K)', async () => {
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
      <AuthProvider fallbackPermissions={[]}>
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

  it('logs out via cookie endpoint and resets to guest (P20-K)', async () => {
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
      <AuthProvider fallbackPermissions={[]}>
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
});
