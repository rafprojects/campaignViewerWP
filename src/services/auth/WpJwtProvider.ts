import type { AuthProvider, AuthSession, AuthUser } from './AuthProvider';

interface WpJwtProviderOptions {
  apiBaseUrl: string;
}

export class WpJwtProvider implements AuthProvider {
  private apiBaseUrl: string;
  private accessToken: string | null = null;
  private user: AuthUser | null = null;
  private permissions: string[] | null = null;

  constructor(options: WpJwtProviderOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
  }

  async init(): Promise<AuthSession | null> {
    // No persistent storage - tokens are only kept in memory
    // User must re-authenticate on page refresh for security
    return null;
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

    // Validate token before storing
    if (this.isTokenExpired(token)) {
      throw new Error('Received token is already expired');
    }

    // Store in memory only
    this.accessToken = token;

    const user: AuthUser = {
      id: String(data?.user_id ?? ''),
      email: data?.user_email ?? email,
      role: 'viewer',
    };
    this.user = user;

    return { accessToken: token, expiresAt: this.getTokenExpiryIso(token) ?? undefined };
  }

  async logout(): Promise<void> {
    this.accessToken = null;
    this.user = null;
    this.permissions = null;
  }

  async getAccessToken(): Promise<string | null> {
    const token = this.accessToken;
    if (!token) {
      return null;
    }
    // Validate token hasn't expired before returning
    if (this.isTokenExpired(token)) {
      await this.logout();
      return null;
    }
    return token;
  }

  async getUser(): Promise<AuthUser | null> {
    return this.user;
  }

  async getPermissions(): Promise<string[]> {
    // Return cached permissions if available
    if (this.permissions !== null) {
      return this.permissions;
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

    // Update user role if admin
    if (isAdmin && this.user) {
      this.user = { ...this.user, role: 'admin' };
    }

    this.permissions = permissions;
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
