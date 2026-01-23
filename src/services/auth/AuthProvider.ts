export interface AuthUser {
  id: string;
  email: string;
  role: 'viewer' | 'admin';
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface AuthProvider {
  init(): Promise<AuthSession | null>;
  login(email: string, password: string): Promise<AuthSession>;
  logout(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  getUser(): Promise<AuthUser | null>;
  getPermissions(): Promise<string[]>;
}
