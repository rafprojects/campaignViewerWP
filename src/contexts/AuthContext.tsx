import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthProvider, AuthSession, AuthUser } from '@/services/auth/AuthProvider';

interface AuthContextValue {
  user: AuthUser | null;
  permissions: string[];
  isAuthenticated: boolean;
  isReady: boolean;
  login: (email: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  provider?: AuthProvider | undefined;
  fallbackPermissions?: string[] | undefined;
  children: React.ReactNode;
}

/**
 * [P51-I] This context is provider-driven and carries no WordPress coupling.
 * The default same-origin cookie+nonce flow lives in `WpNonceProvider`
 * (`@/services/auth/WpNonceProvider`); the cross-origin JWT flow lives in
 * `WpJwtProvider`. When no provider is supplied the user is a guest with the
 * fallback permissions.
 */
export function AuthProvider({ provider, fallbackPermissions = [], children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>(fallbackPermissions);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!provider) {
        // No provider — guest with the fallback permissions.
        if (isMounted) setIsReady(true);
        return;
      }
      try {
        const session = await provider.init();
        if (session?.accessToken) {
          const nextPermissions = await provider.getPermissions();
          const nextUser = await provider.getUser();
          if (isMounted) {
            setUser(nextUser);
            setPermissions(nextPermissions);
          }
        }
      } catch {
        // no-op
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  const login = useCallback(async (email: string, password: string) => {
    if (!provider) {
      throw new Error('Cannot sign in: no auth provider configured.');
    }
    const session = await provider.login(email, password);
    const nextPermissions = await provider.getPermissions();
    const nextUser = await provider.getUser();
    setUser(nextUser);
    setPermissions(nextPermissions);
    return session;
  }, [provider]);

  const logout = useCallback(async () => {
    if (provider) {
      try {
        await provider.logout();
      } catch {
        // Logout best-effort — clear local state regardless.
      }
    }
    setUser(null);
    setPermissions(fallbackPermissions);
    // Reload the page to fully reset WP session state
    window.location.reload();
  }, [fallbackPermissions, provider]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      isAuthenticated: Boolean(user),
      isReady,
      login,
      logout,
    }),
    [user, permissions, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
