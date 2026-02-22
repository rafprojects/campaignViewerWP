/**
 * P13-C: SWR-based data fetching hooks for the Admin Panel.
 *
 * Previously, AdminPanel used manual useState/useEffect patterns for every
 * resource (campaigns, media, access, audit, companies). This caused:
 *  - No caching: every tab switch or panel re-open triggered fresh network calls
 *  - No deduplication: concurrent renders could fire duplicate requests
 *  - Boilerplate: ~30 lines of loading/error/data state per resource
 *
 * These hooks wrap SWR to get stale-while-revalidate caching, automatic
 * deduplication, and background revalidation. The SWR cache persists across
 * AdminPanel open/close cycles within the same page session.
 */
import useSWR, { mutate as globalMutate, type KeyedMutator } from 'swr';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem } from '@/types';
import { sortByOrder } from '@/utils/sortByOrder';

// ── Types ──────────────────────────────────────────────────────────────────────

type ListResponse<T> = T[] | { items?: T[]; entries?: T[]; grants?: T[]; data?: T[] };

const normalizeListResponse = <T,>(response: ListResponse<T>): T[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.entries)) return response.entries;
  if (Array.isArray(response.grants)) return response.grants;
  if (Array.isArray(response.data)) return response.data;
  return [];
};

// Re-export the admin campaign type for use by consuming components.
export interface AdminCampaign {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  visibility: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
  companyId: string;
  companyName?: string;
  tags: string[];
}

interface ApiCampaignResponse {
  items: AdminCampaign[];
}

export interface AuditEntry {
  id: string;
  action: string;
  details: Record<string, unknown>;
  userId: number;
  createdAt: string;
}

export interface CompanyInfo {
  id: number;
  name: string;
  slug: string;
  campaignCount: number;
  activeCampaigns: number;
  archivedCampaigns: number;
  accessGrantCount: number;
  campaigns: Array<{ id: number; title: string; status: string }>;
}

export interface CompanyAccessGrant {
  userId: number;
  user?: { displayName: string; email: string };
  source: 'campaign' | 'company';
  grantedAt?: string;
  campaignId?: number;
  campaignTitle?: string;
  campaignStatus?: string;
  companyId?: number;
  companyName?: string;
}

// ── SWR Config ─────────────────────────────────────────────────────────────────

/** Default SWR options shared by all admin hooks. */
const ADMIN_SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 3000, // 3s dedup window
  shouldRetryOnError: false,
} as const;

// ── Hooks ──────────────────────────────────────────────────────────────────────

/**
 * Fetch the admin campaign list (includes companyId, tags, etc.).
 * Cached under key 'admin-campaigns'. Re-open AdminPanel = instant render.
 */
export function useAdminCampaigns(apiClient: ApiClient) {
  const { data, error, isLoading, mutate } = useSWR<AdminCampaign[]>(
    'admin-campaigns',
    async () => {
      const response = await apiClient.get<ApiCampaignResponse>(
        '/wp-json/wp-super-gallery/v1/campaigns?per_page=50',
      );
      return response.items ?? [];
    },
    ADMIN_SWR_OPTIONS,
  );

  return {
    campaigns: data ?? [],
    campaignsLoading: isLoading,
    campaignsError: error ? (error instanceof Error ? error.message : 'Failed to load campaigns') : null,
    mutateCampaigns: mutate,
  };
}

/**
 * Fetch access grants for a specific campaign.
 * Key: ['admin-access', 'campaign', campaignId]
 */
export function useAccessGrants(
  apiClient: ApiClient,
  mode: 'campaign' | 'company' | 'all',
  targetId: string,
) {
  const key = targetId
    ? ['admin-access', mode, targetId]
    : null; // null key = don't fetch

  const { data, error, isLoading, mutate } = useSWR<CompanyAccessGrant[]>(
    key,
    async () => {
      if (mode === 'campaign') {
        const response = await apiClient.get<ListResponse<CompanyAccessGrant>>(
          `/wp-json/wp-super-gallery/v1/campaigns/${targetId}/access`,
        );
        return normalizeListResponse(response);
      }
      // company or all mode
      const includeCampaigns = mode === 'all';
      const url = `/wp-json/wp-super-gallery/v1/companies/${targetId}/access${includeCampaigns ? '?include_campaigns=true' : ''}`;
      const response = await apiClient.get<ListResponse<CompanyAccessGrant>>(url);
      return normalizeListResponse(response);
    },
    ADMIN_SWR_OPTIONS,
  );

  return {
    accessEntries: data ?? [],
    accessLoading: isLoading,
    accessError: error,
    mutateAccess: mutate,
  };
}

/**
 * Fetch the companies list. Only fetches when enabled (access tab visible).
 */
export function useCompanies(apiClient: ApiClient, enabled: boolean) {
  const { data, error, isLoading, mutate } = useSWR<CompanyInfo[]>(
    enabled ? 'admin-companies' : null,
    async () => {
      const response = await apiClient.get<CompanyInfo[]>(
        '/wp-json/wp-super-gallery/v1/companies',
      );
      return response ?? [];
    },
    ADMIN_SWR_OPTIONS,
  );

  return {
    companies: data ?? [],
    companiesLoading: isLoading,
    companiesError: error,
    mutateCompanies: mutate,
  };
}

/**
 * Fetch audit entries for a campaign.
 * Key: ['admin-audit', campaignId]
 */
export function useAuditEntries(apiClient: ApiClient, campaignId: string) {
  const { data, error, isLoading, mutate } = useSWR<AuditEntry[]>(
    campaignId ? ['admin-audit', campaignId] : null,
    async () => {
      const response = await apiClient.get<ListResponse<AuditEntry>>(
        `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/audit`,
      );
      return normalizeListResponse(response);
    },
    ADMIN_SWR_OPTIONS,
  );

  return {
    auditEntries: data ?? [],
    auditLoading: isLoading,
    auditError: error,
    mutateAudit: mutate,
  };
}

// ── Prefetch: Access & Audit ───────────────────────────────────────────────────

/**
 * Background-prefetch per-campaign access grants into SWR cache.
 *
 * Called when the Access tab first opens. Each campaign's grants are fetched
 * with a 100ms stagger so switching campaigns in the Access selector is instant.
 * Only prefetches in 'campaign' mode — company/all modes depend on a selected
 * company, which isn't known until the user picks one.
 */
export function prefetchAllCampaignAccess(
  apiClient: ApiClient,
  campaignIds: string[],
) {
  campaignIds.forEach((id, index) => {
    setTimeout(() => {
      const key = ['admin-access', 'campaign', id];
      void globalMutate(
        key,
        async () => {
          const response = await apiClient.get<ListResponse<CompanyAccessGrant>>(
            `/wp-json/wp-super-gallery/v1/campaigns/${id}/access`,
          );
          return normalizeListResponse(response);
        },
        { revalidate: false },
      );
    }, index * 100);
  });
}

/**
 * Background-prefetch per-campaign audit entries into SWR cache.
 *
 * Called when the Audit tab first opens. Stagger 100ms apart. Audit logs
 * are read-only and rarely change, so this is a safe fire-and-forget cache warm.
 */
export function prefetchAllCampaignAudit(
  apiClient: ApiClient,
  campaignIds: string[],
) {
  campaignIds.forEach((id, index) => {
    setTimeout(() => {
      const key = ['admin-audit', id];
      void globalMutate(
        key,
        async () => {
          const response = await apiClient.get<ListResponse<AuditEntry>>(
            `/wp-json/wp-super-gallery/v1/campaigns/${id}/audit`,
          );
          return normalizeListResponse(response);
        },
        { revalidate: false },
      );
    }, index * 100);
  });
}

// ── Media Items ────────────────────────────────────────────────────────────────

/** SWR key factory for media items — used by both the hook and prefetch. */
export const mediaItemsKey = (campaignId: string) =>
  campaignId ? ['admin-media', campaignId] : null;

/**
 * Fetch media items for a campaign via SWR.
 * Returns sorted items from cache (instant on revisit) with background revalidation.
 * MediaTab keeps a local copy via useState for optimistic mutations (upload, delete,
 * reorder, oEmbed enrichment) and syncs from SWR data on initial load / campaign change.
 */
export function useMediaItems(apiClient: ApiClient, campaignId: string) {
  const { data, error, isLoading, mutate } = useSWR<MediaItem[]>(
    mediaItemsKey(campaignId),
    async () => {
      const response = await apiClient.get<MediaItem[] | { items?: MediaItem[] }>(
        `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media`,
      );
      const items = Array.isArray(response) ? response : response.items ?? [];
      return sortByOrder(items);
    },
    ADMIN_SWR_OPTIONS,
  );

  return {
    mediaItems: data ?? [],
    mediaLoading: isLoading,
    mediaError: error,
    mutateMedia: mutate,
  };
}

/**
 * Background-prefetch media for all campaigns into SWR cache.
 *
 * Called when the Media tab is first opened. Fetches are staggered 150ms apart
 * to avoid overwhelming the server. Each fetch is non-blocking — the UI stays
 * fully responsive. SWR's dedupingInterval prevents re-fetching campaigns
 * that are already cached or in-flight.
 *
 * After prefetch completes, switching between campaigns in the Media tab
 * renders instantly from cache.
 */
export function prefetchAllCampaignMedia(
  apiClient: ApiClient,
  campaignIds: string[],
) {
  campaignIds.forEach((id, index) => {
    setTimeout(() => {
      const key = mediaItemsKey(id);
      if (!key) return;
      // globalMutate with a fetcher populates the SWR cache without
      // requiring a mounted hook. The { revalidate: false } option means
      // "only fetch if not already cached" — avoids redundant requests.
      void globalMutate(
        key,
        async () => {
          const response = await apiClient.get<MediaItem[] | { items?: MediaItem[] }>(
            `/wp-json/wp-super-gallery/v1/campaigns/${id}/media`,
          );
          const items = Array.isArray(response) ? response : response.items ?? [];
          return sortByOrder(items);
        },
        { revalidate: false },
      );
    }, index * 150); // 150ms stagger between requests
  });
}

// Re-export the mutator type for convenience
export type { KeyedMutator };
