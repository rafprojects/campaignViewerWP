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
  /** P13-D: Optional ISO 8601 scheduled-publish date. */
  publishAt?: string;
  /** P13-D: Optional ISO 8601 auto-unpublish date. */
  unpublishAt?: string;
  /** P15-B: Optional layout template reference. */
  layoutTemplateId?: string;
  /** Per-campaign image gallery adapter override. */
  imageAdapterId?: string;
  /** Per-campaign video gallery adapter override. */
  videoAdapterId?: string;
  /** P18-H: Category names assigned to this campaign. */
  categories?: string[];
}

interface ApiCampaignResponse {
  items: AdminCampaign[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CampaignPagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
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
 * Supports server-side pagination via page/perPage params.
 * Cached under key ['admin-campaigns', page, perPage].
 */
export function useAdminCampaigns(apiClient: ApiClient, page = 1, perPage = 20) {
  const { data, error, isLoading, mutate } = useSWR<{ campaigns: AdminCampaign[]; pagination: CampaignPagination }>(
    ['admin-campaigns', page, perPage],
    async () => {
      const response = await apiClient.get<ApiCampaignResponse>(
        `/wp-json/wp-super-gallery/v1/campaigns?page=${page}&per_page=${perPage}`,
      );
      return {
        campaigns: response.items ?? [],
        pagination: {
          page: response.page ?? page,
          perPage: response.perPage ?? perPage,
          total: response.total ?? 0,
          totalPages: response.totalPages ?? 1,
        },
      };
    },
    ADMIN_SWR_OPTIONS,
  );

  return {
    campaigns: data?.campaigns ?? [],
    pagination: data?.pagination ?? { page, perPage, total: 0, totalPages: 1 },
    campaignsLoading: isLoading,
    campaignsError: error ? (error instanceof Error ? error.message : 'Failed to load campaigns') : null,
    mutateCampaigns: mutate,
  };
}

/**
 * Fetch all campaigns for dropdown selectors (per_page=50, the endpoint max).
 * Cached separately from the paginated table so selectors always show all
 * campaigns regardless of which page the campaigns tab is on.
 *
 * TODO: Replace with a lightweight server endpoint returning id/title only
 * to reduce payload size and sequential page walks on large installs.
 */
const MAX_SELECTOR_PAGES = 20; // Safety cap: 20 × 50 = 1 000 campaigns

export function useAllCampaignOptions(apiClient: ApiClient) {
  const { data } = useSWR<AdminCampaign[]>(
    'admin-campaign-options',
    async () => {
      const all: AdminCampaign[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const response = await apiClient.get<ApiCampaignResponse>(
          `/wp-json/wp-super-gallery/v1/campaigns?per_page=50&page=${page}`,
        );
        all.push(...(response.items ?? []));
        totalPages = response.totalPages ?? 1;
        page++;
      } while (page <= totalPages && page <= MAX_SELECTOR_PAGES);
      return all;
    },
    ADMIN_SWR_OPTIONS,
  );

  return data ?? [];
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
      const response = await apiClient.get<ListResponse<CompanyInfo>>(
        '/wp-json/wp-super-gallery/v1/companies',
      );
      return normalizeListResponse(response);
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

/** Max concurrent in-flight prefetch requests to avoid overwhelming the server. */
const PREFETCH_CONCURRENCY = 6;

/**
 * Run async tasks with bounded concurrency + stagger delay.
 * Returns a cancel function that stops scheduling of remaining batches
 * and clears pending timers (already in-flight requests will complete).
 */
function staggeredPrefetch(
  ids: string[],
  run: (id: string) => Promise<void>,
  staggerMs: number,
): () => void {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  // Chunk ids into batches of PREFETCH_CONCURRENCY
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += PREFETCH_CONCURRENCY) {
    batches.push(ids.slice(i, i + PREFETCH_CONCURRENCY));
  }

  let batchIndex = 0;
  function runNextBatch() {
    if (cancelled || batchIndex >= batches.length) return;
    const batch = batches[batchIndex++];
    Promise.allSettled(batch.map(run)).then(() => {
      if (!cancelled) {
        timers.push(setTimeout(runNextBatch, staggerMs));
      }
    });
  }

  runNextBatch();
  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}

/**
 * Background-prefetch per-campaign access grants into SWR cache.
 *
 * Called when the Access tab first opens. Each campaign's grants are fetched
 * with a 100ms stagger so switching campaigns in the Access selector is instant.
 * Only prefetches in 'campaign' mode — company/all modes depend on a selected
 * company, which isn't known until the user picks one.
 *
 * Returns a cancel function that clears all pending timeouts (call on unmount).
 */
export function prefetchAllCampaignAccess(
  apiClient: ApiClient,
  campaignIds: string[],
): () => void {
  return staggeredPrefetch(
    campaignIds,
    (id) => {
      const key = ['admin-access', 'campaign', id];
      return globalMutate(
        key,
        async () => {
          const response = await apiClient.get<ListResponse<CompanyAccessGrant>>(
            `/wp-json/wp-super-gallery/v1/campaigns/${id}/access`,
          );
          return normalizeListResponse(response);
        },
        { revalidate: false },
      ) as Promise<void>;
    },
    60,
  );
}

/**
 * Background-prefetch per-campaign audit entries into SWR cache.
 *
 * Called when the Audit tab first opens. Stagger 100ms apart. Audit logs
 * are read-only and rarely change, so this is a safe fire-and-forget cache warm.
 *
 * Returns a cancel function that clears all pending timeouts (call on unmount).
 */
export function prefetchAllCampaignAudit(
  apiClient: ApiClient,
  campaignIds: string[],
): () => void {
  return staggeredPrefetch(
    campaignIds,
    (id) => {
      const key = ['admin-audit', id];
      return globalMutate(
        key,
        async () => {
          const response = await apiClient.get<ListResponse<AuditEntry>>(
            `/wp-json/wp-super-gallery/v1/campaigns/${id}/audit`,
          );
          return normalizeListResponse(response);
        },
        { revalidate: false },
      ) as Promise<void>;
    },
    60,
  );
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
 *
 * Returns a cancel function that clears all pending timeouts (call on unmount).
 */
export function prefetchAllCampaignMedia(
  apiClient: ApiClient,
  campaignIds: string[],
): () => void {
  return staggeredPrefetch(
    campaignIds,
    (id) => {
      const key = mediaItemsKey(id);
      if (!key) return Promise.resolve();
      return globalMutate(
        key,
        async () => {
          const response = await apiClient.get<MediaItem[] | { items?: MediaItem[] }>(
            `/wp-json/wp-super-gallery/v1/campaigns/${id}/media`,
          );
          const items = Array.isArray(response) ? response : response.items ?? [];
          return sortByOrder(items);
        },
        { revalidate: false },
      ) as Promise<void>;
    },
    80,
  );
}

// Re-export the mutator type for convenience
export type { KeyedMutator };
