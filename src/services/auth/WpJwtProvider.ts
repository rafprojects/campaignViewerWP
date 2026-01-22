import type { AuthProvider, AuthSession, AuthUser } from './AuthProvider';

interface WpJwtProviderOptions {
  apiBaseUrl: string;
}

const ACCESS_TOKEN_KEY = 'wpsg_access_token';
const USER_KEY = 'wpsg_user';
const PERMISSIONS_KEY = 'wpsg_permissions';

export class WpJwtProvider implements AuthProvider {
  private apiBaseUrl: string;

  constructor(options: WpJwtProviderOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
  }

  async init(): Promise<AuthSession | null> {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      return null;
    }
    if (this.isTokenExpired(token)) {
      await this.logout();
      return null;
    }
    const isValid = await this.validateToken(token);
    if (!isValid) {
      await this.logout();
      return null;
    }
    return { accessToken: token };
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const response = await fetch(`${this.apiBaseUrl}/wp-json/jwt-auth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof data?.message === 'string' && data.message.trim().length > 0
          ? data.message
          : 'Authentication failed';
      throw new Error(message);
    }
    const token = data?.token ?? '';
    if (!token) {
      throw new Error('Missing token in response');
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, token);

    const user: AuthUser = {
      id: String(data?.user_id ?? ''),
      email: data?.user_email ?? email,
      role: 'viewer',
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    return { accessToken: token, expiresAt: this.getTokenExpiryIso(token) ?? undefined };
  }

  async logout(): Promise<void> {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);
  }

  async getAccessToken(): Promise<string | null> {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      return null;
    }
    if (this.isTokenExpired(token)) {
      await this.logout();
      return null;
    }
    return token;
  }

  private async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/wp-json/jwt-auth/v1/token/validate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getUser(): Promise<AuthUser | null> {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  async getPermissions(): Promise<string[]> {
    const cached = localStorage.getItem(PERMISSIONS_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as string[];
      } catch {
        return [];
      }
    }

    const token = await this.getAccessToken();
    if (!token) {
      return [];
    }

    const response = await fetch(`${this.apiBaseUrl}/wp-json/wp-super-gallery/v1/permissions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const permissions = Array.isArray(data?.campaignIds) ? data.campaignIds : [];
    const isAdmin = Boolean(data?.isAdmin);

    if (isAdmin) {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) {
        try {
          const user = JSON.parse(raw) as AuthUser;
          localStorage.setItem(USER_KEY, JSON.stringify({ ...user, role: 'admin' }));
        } catch {
          // no-op
        }
      }
    }
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
    return permissions;
  }

  private isTokenExpired(token: string): boolean {
    const exp = this.getTokenExpiry(token);
    if (!exp) {
      return false;
    }
    return Date.now() >= exp * 1000;
  }

  private getTokenExpiryIso(token: string): string | null {
    const exp = this.getTokenExpiry(token);
    if (!exp) {
      return null;
    }
    return new Date(exp * 1000).toISOString();
  }

  private getTokenExpiry(token: string): number | null {
    const payload = this.decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') {
      return null;
    }
    return payload.exp;
  }

  private decodeJwtPayload(token: string): { exp?: number } | null {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const json = atob(padded);
      return JSON.parse(json) as { exp?: number };
    } catch {
      return null;
    }
  }
}
