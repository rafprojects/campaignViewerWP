import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

export function AuthProvider({ provider, fallbackPermissions = [], children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>(fallbackPermissions);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!provider) {
        if (isMounted) {
          setIsReady(true);
        }
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

  const login = async (email: string, password: string) => {
    if (!provider) {
      throw new Error('No auth provider configured');
    }
    const session = await provider.login(email, password);
    const nextPermissions = await provider.getPermissions();
    const nextUser = await provider.getUser();
    setUser(nextUser);
    setPermissions(nextPermissions);
    return session;
  };

  const logout = async () => {
    if (provider) {
      await provider.logout();
    }
    setUser(null);
    setPermissions(fallbackPermissions);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      isAuthenticated: Boolean(user),
      isReady,
      login,
      logout,
    }),
    [user, permissions, isReady],
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
