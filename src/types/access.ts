/**
 * User and per-campaign access-control (RBAC) types.
 *
 * Split out of `types/index.ts` (Phase 70-G); re-exported from `./index`.
 */

export interface User {
  id: string;
  email: string;
  role: 'viewer' | 'admin';
  permissions: string[]; // Array of campaign IDs user can access
}

/**
 * P33-A: Per-campaign access level for RBAC.
 *
 * Precedence (highest → lowest):
 *   site-wide `manage_wpsg` capability > campaign `owner` > campaign `editor` > campaign `viewer`
 *
 * Company-level grants propagate to every campaign in the company at the
 * `access_level` stored on the company grant.  A campaign-level grant for the
 * same user overrides the company grant with its own `access_level`.
 *
 * Migration default: legacy grants without an explicit `access_level` are
 * treated as `viewer` on first read; no schema mutation is required.
 */
export type CampaignAccessLevel = 'viewer' | 'editor' | 'owner';

export interface CampaignAccessGrant {
  userId: string;
  campaignId: string;
  source: 'company' | 'campaign';
  grantedAt: string;
  revokedAt?: string;
  /** P33-A: Role level for this grant. Absent on legacy records → treated as 'viewer'. */
  access_level?: CampaignAccessLevel | undefined;
  user?: {
    displayName: string;
    email: string;
    login: string;
  };
}
