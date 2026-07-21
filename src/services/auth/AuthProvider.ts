/**
 * The caller's app-level tier (P53-A). Mirrors the backend
 * {@link WPSG_Permissions::actor_has_tier} seam:
 *   - `viewer` — logged in, read-only
 *   - `editor` — `wpsg_editor` (manage_wpsg): space-scoped app admin
 *   - `admin`  — system admin (manage_options): full control, superset of editor
 */
export type AuthRole = 'viewer' | 'editor' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: AuthRole;
}

/**
 * Resolve the tier from the backend's two boolean signals. `isSystemAdmin`
 * (manage_options) wins; `isAdmin` (manage_wpsg) is editor-or-above. The single
 * place WP providers turn the `/permissions` flags into a role.
 */
export function resolveRole(isAdmin: boolean, isSystemAdmin: boolean): AuthRole {
  if (isSystemAdmin) return 'admin';
  if (isAdmin) return 'editor';
  return 'viewer';
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt?: string | undefined;
}

/**
 * Stable, order-independent digest of a permissions (campaign-id) list.
 *
 * [P68-C] Used to key the campaigns query on the viewer's grants so a changed
 * grant set forces a refetch, and to skip redundant state updates when a
 * focus-triggered refresh returns the same set. Sorted so `['1','2']` and
 * `['2','1']` collapse to one key; entries are stringified for stability.
 */
export function permissionsDigest(permissions: string[]): string {
  return [...permissions].map(String).sort().join('|');
}

export interface AuthProvider {
  init(): Promise<AuthSession | null>;
  login(email: string, password: string): Promise<AuthSession>;
  logout(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  getUser(): Promise<AuthUser | null>;
  getPermissions(): Promise<string[]>;
}
