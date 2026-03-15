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
  provider?: AuthProvider;
  fallbackPermissions?: string[];
  children: React.ReactNode;
}

/**
 * Detect authentication state via WP cookie + nonce (no JWT provider).
 *
 * [P20-K] When no auth provider is configured (the default same-origin
 * deployment), the user is already authenticated via the WordPress login
 * cookie. We detect this by calling the permissions endpoint with the
 * X-WP-Nonce header (sent automatically by apiClient).
 */
async function detectNonceAuth(): Promise<{ user: AuthUser | null; permissions: string[] }> {
  const nonce = window.__WPSG_CONFIG__?.restNonce ?? window.__WPSG_REST_NONCE__;
  if (!nonce) {
    return { user: null, permissions: [] };
  }

  const apiBase = window.__WPSG_CONFIG__?.apiBase ?? window.__WPSG_API_BASE__ ?? window.location.origin;
  try {
    const response = await fetch(`${apiBase}/wp-json/wp-super-gallery/v1/permissions`, {
      credentials: 'same-origin',
      headers: { 'X-WP-Nonce': nonce },
    });

    if (!response.ok) {
      return { user: null, permissions: [] };
    }

    const data = await response.json();
    const permissions = Array.isArray(data?.campaignIds) ? data.campaignIds : [];
    const isAdmin = Boolean(data?.isAdmin);

    if (isAdmin || data?.userId) {
      const user: AuthUser = {
        id: String(data?.userId ?? '0'),
        email: data?.userEmail ?? '',
        role: isAdmin ? 'admin' : 'viewer',
      };
      return { user, permissions };
    }

    return { user: null, permissions };
  } catch {
    return { user: null, permissions: [] };
  }
}

export function AuthProvider({ provider, fallbackPermissions = [], children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>(fallbackPermissions);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (provider) {
        // JWT provider path — existing flow
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
      } else {
        // [P20-K] Nonce-only path — detect auth via WP cookie + nonce
        try {
          const result = await detectNonceAuth();
          if (isMounted) {
            setUser(result.user);
            // Only override fallback permissions when auth was actually detected
            // (nonce existed and the permissions endpoint returned data).
            if (result.user || result.permissions.length > 0) {
              setPermissions(result.permissions);
            }
          }
        } catch {
          // no-op
        } finally {
          if (isMounted) {
            setIsReady(true);
          }
        }
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [provider]);

  const login = useCallback(async (email: string, password: string) => {
    if (provider) {
      const session = await provider.login(email, password);
      const nextPermissions = await provider.getPermissions();
      const nextUser = await provider.getUser();
      setUser(nextUser);
      setPermissions(nextPermissions);
      return session;
    }

    // [P20-K] Nonce-only cookie login via the custom REST endpoint.
    const apiBase = window.__WPSG_CONFIG__?.apiBase ?? window.__WPSG_API_BASE__ ?? window.location.origin;
    const nonce = window.__WPSG_CONFIG__?.restNonce ?? window.__WPSG_REST_NONCE__;
    const response = await fetch(`${apiBase}/wp-json/wp-super-gallery/v1/auth/login`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(nonce ? { 'X-WP-Nonce': nonce } : {}),
      },
      body: JSON.stringify({ username: email, password }),
    });

    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Login failed (HTTP ${response.status}). Server returned a non-JSON response.`);
    }
    if (!response.ok) {
      throw new Error((data?.message as string) ?? 'Login failed. Check your credentials.');
    }

    // Update the global nonce so subsequent REST calls are authenticated.
    if (data.nonce) {
      if (window.__WPSG_CONFIG__) window.__WPSG_CONFIG__.restNonce = data.nonce;
      (window as unknown as Record<string, unknown>).__WPSG_REST_NONCE__ = data.nonce;
    }

    if (data.user) {
      setUser(data.user as AuthUser);
    }
    setPermissions(Array.isArray(data.permissions) ? data.permissions : []);

    return { accessToken: data.nonce ?? '' } as AuthSession;
  }, [provider]);

  const logout = useCallback(async () => {
    if (provider) {
      await provider.logout();
    } else {
      // [P20-K] Nonce-only cookie logout via the custom REST endpoint.
      const apiBase = window.__WPSG_CONFIG__?.apiBase ?? window.__WPSG_API_BASE__ ?? window.location.origin;
      const nonce = window.__WPSG_CONFIG__?.restNonce ?? window.__WPSG_REST_NONCE__;
      try {
        const response = await fetch(`${apiBase}/wp-json/wp-super-gallery/v1/auth/logout`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            ...(nonce ? { 'X-WP-Nonce': nonce } : {}),
          },
        });
        const data = await response.json();
        // Update nonce to guest-level so the UI can still hit public endpoints.
        if (data?.nonce) {
          if (window.__WPSG_CONFIG__) window.__WPSG_CONFIG__.restNonce = data.nonce;
          (window as unknown as Record<string, unknown>).__WPSG_REST_NONCE__ = data.nonce;
        }
      } catch {
        // Logout best-effort — clear local state regardless.
      }
    }
    setUser(null);
    setPermissions(fallbackPermissions);
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
