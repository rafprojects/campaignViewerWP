import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthProvider, AuthSession, AuthUser } from '@/services/auth/AuthProvider';
import { permissionsDigest } from '@/services/auth/AuthProvider';

/** Content equality for two auth users, so a refresh returning the same user
 *  keeps the previous reference (no needless context re-render). */
function sameUser(a: AuthUser | null, b: AuthUser | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.email === b.email && a.role === b.role;
}

interface AuthContextValue {
  user: AuthUser | null;
  permissions: string[];
  isAuthenticated: boolean;
  isReady: boolean;
  /** Editor-or-above (manage_wpsg): can edit. True for both `editor` and `admin`. */
  isAdmin: boolean;
  /** System admin (manage_options): full control. Gates system-only surfaces (P53-A). */
  isSystemAdmin: boolean;
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

  // [P68-C] Refresh permissions when the tab regains focus / becomes visible.
  // AuthContext otherwise reads permissions only once at mount and once at
  // login, so a grant changed elsewhere (e.g. an access request approved in
  // another tab) wouldn't surface until a full reload. Re-hydrating from the
  // provider on the "user came back to look" signal picks it up; App.tsx keys
  // the campaigns query on a permissions digest, so a refetch fires only when
  // the set actually changed. Gated on `user` — anonymous visitors have
  // nothing to refresh (and `provider.init()` re-runs the /permissions detect
  // for the default WpNonceProvider, since getPermissions() alone is cached).
  useEffect(() => {
    if (!provider || !user) return undefined;

    let cancelled = false;
    let inFlight = false;

    const refresh = async () => {
      if (inFlight) return; // coalesce overlapping focus + visibility events
      inFlight = true;
      try {
        const session = await provider.init();
        if (cancelled || !session?.accessToken) return;
        const [nextPermissions, nextUser] = await Promise.all([
          provider.getPermissions(),
          provider.getUser(),
        ]);
        if (cancelled) return;
        // Bail out of a state change (and the resulting refetch) when nothing
        // actually changed, so a plain tab-refocus is free.
        setPermissions((prev) =>
          permissionsDigest(prev) === permissionsDigest(nextPermissions) ? prev : nextPermissions,
        );
        setUser((prev) => (sameUser(prev, nextUser) ? prev : nextUser));
      } catch {
        // Best-effort — a failed refresh leaves the existing state intact.
      } finally {
        inFlight = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [provider, user]);

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
      // P53-A: tier semantics derived once here. `admin` (system admin) is a
      // superset of `editor`, so both can edit.
      isAdmin: user?.role === 'editor' || user?.role === 'admin',
      isSystemAdmin: user?.role === 'admin',
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
