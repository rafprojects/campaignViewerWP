import type { AuthProvider, AuthSession, AuthUser } from './AuthProvider';
import { getWpNonce, setWpNonce } from '@/services/wpNonce';

/**
 * Cookie + REST-nonce auth provider for the default same-origin WordPress
 * deployment.
 *
 * [P51-I] Lifted out of `AuthContext` (its former no-provider branch) so the
 * context carries no WordPress coupling. Like `WpJwtProvider`, this is the WP
 * adapter behind the `AuthProvider` contract: all WP endpoints, the nonce
 * globals, and the `data.user_id/isAdmin/campaignIds` response shape live here.
 *
 * Auth is established by the WP login cookie; requests are authenticated with
 * the `X-WP-Nonce` header (injected by the HTTP transport via `getNonce`), so
 * there is no bearer token — `getAccessToken()` always returns null.
 */
export class WpNonceProvider implements AuthProvider {
  /** Detected/most-recent auth state, populated by `init()`/`login()`. */
  private cached: { user: AuthUser | null; permissions: string[] } = {
    user: null,
    permissions: [],
  };

  /**
   * Detect auth via the WP cookie + nonce. Returns a (cookie-backed) session
   * only when a user or permissions were actually detected, so the context
   * leaves its fallback permissions untouched otherwise.
   */
  async init(): Promise<AuthSession | null> {
    const nonce = getWpNonce();
    if (!nonce) {
      this.cached = { user: null, permissions: [] };
      return null;
    }
    this.cached = await this.detect(nonce);
    if (this.cached.user || this.cached.permissions.length > 0) {
      // Cookie session — no real token; sentinel signals "authenticated" to the
      // context's `session?.accessToken` gate.
      return { accessToken: 'wp-cookie-session' };
    }
    return null;
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const nonce = getWpNonce();
    const response = await fetch(`${this.apiBase()}/wp-json/wp-super-gallery/v1/auth/login`, {
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
    const newNonce = typeof data.nonce === 'string' ? data.nonce : '';
    if (newNonce) {
      setWpNonce(newNonce);
    }

    this.cached = {
      user: data.user ? (data.user as AuthUser) : null,
      permissions: Array.isArray(data.permissions) ? (data.permissions as string[]) : [],
    };

    return { accessToken: newNonce };
  }

  async logout(): Promise<void> {
    const nonce = getWpNonce();
    try {
      const response = await fetch(`${this.apiBase()}/wp-json/wp-super-gallery/v1/auth/logout`, {
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
        setWpNonce(data.nonce);
      }
    } catch {
      // Logout best-effort — the context clears local state regardless.
    }
    this.cached = { user: null, permissions: [] };
  }

  /** Cookie auth uses X-WP-Nonce, not a bearer token. */
  async getAccessToken(): Promise<string | null> {
    return null;
  }

  async getUser(): Promise<AuthUser | null> {
    return this.cached.user;
  }

  async getPermissions(): Promise<string[]> {
    return this.cached.permissions;
  }

  private async detect(
    nonce: string,
  ): Promise<{ user: AuthUser | null; permissions: string[] }> {
    try {
      const response = await fetch(`${this.apiBase()}/wp-json/wp-super-gallery/v1/permissions`, {
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

  private apiBase(): string {
    return (
      window.__WPSG_CONFIG__?.apiBase ??
      window.__WPSG_API_BASE__ ??
      window.location.origin
    );
  }
}
