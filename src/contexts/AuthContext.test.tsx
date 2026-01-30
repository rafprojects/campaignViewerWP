import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import { AuthProvider, useAuth } from './AuthContext';
import type { AuthProvider as AuthProviderInterface, AuthSession, AuthUser } from '@/services/auth/AuthProvider';

function AuthConsumer() {
  const { isReady, isAuthenticated, permissions } = useAuth();
  return (
    <div>
      <span>{isReady ? 'ready' : 'loading'}</span>
      <span>{isAuthenticated ? 'authed' : 'guest'}</span>
      <span>{permissions.join(',')}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  it('sets ready state without provider', async () => {
    render(
      <AuthProvider fallbackPermissions={['a', 'b']}>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('guest')).toBeInTheDocument();
    expect(screen.getByText('a,b')).toBeInTheDocument();
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
});
