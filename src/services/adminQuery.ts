import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import type {
  AccessRequest,
  AccessSummaryItem,
  AccessSummaryResponse,
  AnalyticsSummaryResponse,
  ApiClient,
  CampaignAnalyticsResponse,
  CampaignCategoryEntry,
  MediaAnalyticsResponse,
  TagEntry,
} from '@/services/apiClient';
import type { GalleryConfig, MediaItem } from '@/types';
import { sortByOrder } from '@wp-super-gallery/shared-utils';

type ListResponse<T> = T[] | { items?: T[]; entries?: T[]; grants?: T[]; data?: T[] };

const normalizeListResponse = <T,>(response: ListResponse<T>): T[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.entries)) return response.entries;
  if (Array.isArray(response.grants)) return response.grants;
  if (Array.isArray(response.data)) return response.data;
  return [];
};

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
  publishAt?: string;
  unpublishAt?: string;
  layoutTemplateId?: string;
  galleryOverrides?: Partial<GalleryConfig>;
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
  /** P28-G: login name of the actor (from DB table). */
  actorLogin?: string;
  /** P28-G: campaign ID — present on global audit log responses. */
  campaignId?: string;
  createdAt: string;
  /** P40-CT1: severity level for the event. */
  severity?: 'info' | 'warning' | 'error';
  /** P40-CT1: scope — 'campaign' for campaign-scoped events, 'system' for plugin-level events. */
  scope?: 'campaign' | 'system';
  /** P40-CT1: human-readable one-line summary of the event. */
  summary?: string;
  /** P40-CT1: type of the affected resource (e.g. 'campaign', 'media', 'access_grant'). */
  resourceType?: string;
  /** P40-CT1: opaque ID of the affected resource. */
  resourceId?: string;
  /** P40-CT1: display label for the affected resource. */
  resourceLabel?: string;
  /** P40-CT1: originating subsystem (e.g. 'rest', 'cli', 'cron'). */
  source?: string;
}

export interface AuditFilters {
  from?: string;
  to?: string;
  action?: string;
  scope?: 'campaign' | 'system';
  severity?: 'info' | 'warning' | 'error';
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
  expires_at?: string | null;
  is_expired?: boolean;
  /** P33-A: Role level for this grant. Absent on legacy records → treated as 'viewer'. */
  access_level?: import('@/types').CampaignAccessLevel | undefined;
}

export interface SpaceInfo {
  id: number;
  slug: string;
  name: string;
  isolationMode: 'open' | 'delegated';
  isDefault: boolean;
  archived: boolean;
  grantCount: number;
  /** P50-A: requesting user's level in this space ('' = no access). */
  effectiveLevel?: 'owner' | 'editor' | 'viewer' | '';
  createdAt: string;
  updatedAt: string;
}

const ADMIN_QUERY_STALE_TIME = 30_000;
const SELECTOR_QUERY_STALE_TIME = 30_000;
const CATEGORY_QUERY_STALE_TIME = 60_000;
const ANALYTICS_QUERY_STALE_TIME = 10_000;
const ACCESS_REQUESTS_QUERY_STALE_TIME = 30_000;
const PREFETCH_CONCURRENCY = 6;
const MAX_SELECTOR_PAGES = 20;

/** Default interval for visibility-aware analytics polling (P34-A). */
export const ANALYTICS_POLL_INTERVAL_MS = 30_000;

/**
 * Options passed to analytics hooks to enable visibility-aware polling (P34-A).
 * When `enabled` is true the hook turns on `refetchInterval`,
 * `refetchOnWindowFocus`, and `refetchOnReconnect` so data stays fresh while
 * the analytics surface is visible and the browser is online.
 */
export interface AnalyticsPollingOptions {
  /** Activate periodic polling + focus/reconnect refetch. */
  enabled: boolean;
  /** Override the default 30-second poll interval. */
  intervalMs?: number;
}

const ADMIN_QUERY_OPTIONS = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

function getApiClientCacheBase(apiClient: ApiClient) {
  return typeof apiClient.getBaseUrl === 'function' ? apiClient.getBaseUrl() : 'default';
}

function getAdminQueryPrefix(apiClient: ApiClient) {
  return ['admin', getApiClientCacheBase(apiClient)] as const;
}

export function getSpacesQueryKey(apiClient: ApiClient) {
  return ['spaces', getApiClientCacheBase(apiClient)] as const;
}

export function useSpaces(apiClient: ApiClient) {
  const query = useQuery({
    queryKey: getSpacesQueryKey(apiClient),
    queryFn: async () => {
      const res = await apiClient.get<SpaceInfo[]>('/wp-json/wp-super-gallery/v1/spaces');
      return Array.isArray(res) ? res : [];
    },
    staleTime: ADMIN_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });
  return {
    spaces: query.data ?? [],
    spacesLoading: query.isLoading,
    spacesError: query.error,
    mutateSpaces: query.refetch,
  };
}

// P28-E: Server-side campaign filter params.
export interface CampaignFilters {
  category?: string | undefined;
  tag?: string | undefined;
  sort?: 'created_desc' | 'created_asc' | 'title_asc' | 'title_desc' | 'updated_desc' | undefined;
  includeArchived?: boolean | undefined;
  templateId?: string | undefined;
}

export function getAdminCampaignsQueryKey(apiClient: ApiClient, spaceId = 'all', page = 1, perPage = 20, filters?: CampaignFilters) {
  return [...getAdminQueryPrefix(apiClient), 'campaigns', spaceId, page, perPage, filters ?? {}] as const;
}

export function getAdminCampaignOptionsQueryKey(apiClient: ApiClient, spaceId = 'all') {
  return [...getAdminQueryPrefix(apiClient), 'campaign-options', spaceId] as const;
}

export function getAccessGrantsQueryKey(
  apiClient: ApiClient,
  mode: 'campaign' | 'company' | 'all',
  targetId: string,
  includeExpired = false,
) {
  return [...getAdminQueryPrefix(apiClient), 'access', mode, targetId, includeExpired] as const;
}

export function getCompaniesQueryKey(apiClient: ApiClient, spaceId = 'all') {
  return [...getAdminQueryPrefix(apiClient), 'companies', spaceId] as const;
}

export function getAuditEntriesQueryKey(apiClient: ApiClient, campaignId: string, filters?: AuditFilters) {
  return [...getAdminQueryPrefix(apiClient), 'audit', campaignId, filters ?? {}] as const;
}

export function getGlobalAuditQueryKey(apiClient: ApiClient, spaceId = 'all', filters?: AuditFilters & { campaignId?: string }) {
  return [...getAdminQueryPrefix(apiClient), 'globalAudit', spaceId, filters ?? {}] as const;
}

export function getMediaItemsQueryKey(apiClient: ApiClient, campaignId: string) {
  return [...getAdminQueryPrefix(apiClient), 'media', campaignId] as const;
}

export function getCampaignCategoriesQueryKey(apiClient: ApiClient) {
  return [...getAdminQueryPrefix(apiClient), 'campaign-categories'] as const;
}

export function getCampaignAnalyticsQueryKey(
  apiClient: ApiClient,
  campaignId: string,
  from: string,
  to: string,
) {
  return [...getAdminQueryPrefix(apiClient), 'campaign-analytics', campaignId, from, to] as const;
}

export function getAccessRequestsQueryKey(
  apiClient: ApiClient,
  campaignId: string,
  status?: string,
) {
  return [...getAdminQueryPrefix(apiClient), 'access-requests', campaignId, status ?? 'all'] as const;
}

async function fetchAdminCampaigns(
  apiClient: ApiClient,
  spaceId: string,
  page: number,
  perPage: number,
  filters?: CampaignFilters,
): Promise<{ campaigns: AdminCampaign[]; pagination: CampaignPagination }> {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (spaceId !== 'all') params.set('space', spaceId);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.tag) params.set('tag', filters.tag);
  if (filters?.sort) params.set('sort', filters.sort);
  if (filters?.includeArchived) params.set('include_archived', 'true');
  if (filters?.templateId) params.set('template_id', filters.templateId);

  const response = await apiClient.get<ApiCampaignResponse>(
    `/wp-json/wp-super-gallery/v1/campaigns?${params.toString()}`,
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
}

async function fetchAllCampaignOptions(apiClient: ApiClient, spaceId = 'all'): Promise<AdminCampaign[]> {
  const all: AdminCampaign[] = [];
  let page = 1;
  let totalPages = 1;
  const spaceParam = spaceId !== 'all' ? `&space=${encodeURIComponent(spaceId)}` : '';

  do {
    const response = await apiClient.get<ApiCampaignResponse>(
      `/wp-json/wp-super-gallery/v1/campaigns?per_page=50&page=${page}&include_archived=true${spaceParam}`,
    );
    all.push(...(response.items ?? []));
    totalPages = response.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages && page <= MAX_SELECTOR_PAGES);

  return all;
}

async function fetchAccessGrants(
  apiClient: ApiClient,
  mode: 'campaign' | 'company' | 'all',
  targetId: string,
  includeExpired = false,
): Promise<CompanyAccessGrant[]> {
  if (mode === 'campaign') {
    const qs = includeExpired ? '?include_expired=true' : '';
    const response = await apiClient.get<ListResponse<CompanyAccessGrant>>(
      `/wp-json/wp-super-gallery/v1/campaigns/${targetId}/access${qs}`,
    );
    return normalizeListResponse(response);
  }

  const includeCampaigns = mode === 'all';
  const params = new URLSearchParams();
  if (includeCampaigns) params.set('include_campaigns', 'true');
  if (includeExpired) params.set('include_expired', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get<ListResponse<CompanyAccessGrant>>(
    `/wp-json/wp-super-gallery/v1/companies/${targetId}/access${qs}`,
  );
  return normalizeListResponse(response);
}

async function fetchCompanies(apiClient: ApiClient, spaceId = 'all'): Promise<CompanyInfo[]> {
  const spaceParam = spaceId !== 'all' ? `?space=${encodeURIComponent(spaceId)}` : '';
  const response = await apiClient.get<ListResponse<CompanyInfo>>(
    `/wp-json/wp-super-gallery/v1/companies${spaceParam}`,
  );
  return normalizeListResponse(response);
}

async function fetchAuditEntries(apiClient: ApiClient, campaignId: string, filters: AuditFilters = {}): Promise<AuditEntry[]> {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.action) params.set('action', filters.action);
  if (filters.scope) params.set('scope', filters.scope);
  if (filters.severity) params.set('severity', filters.severity);
  const qs = params.toString() ? `?${params}` : '';
  const response = await apiClient.get<ListResponse<AuditEntry>>(
    `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/audit${qs}`,
  );
  return normalizeListResponse(response);
}

async function fetchGlobalAuditEntries(
  apiClient: ApiClient,
  spaceId = 'all',
  filters: AuditFilters & { campaignId?: string } = {},
): Promise<AuditEntry[]> {
  const params = new URLSearchParams();
  if (spaceId !== 'all') params.set('space', spaceId);
  if (filters.campaignId) params.set('campaign_id', filters.campaignId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.action) params.set('action', filters.action);
  if (filters.scope) params.set('scope', filters.scope);
  if (filters.severity) params.set('severity', filters.severity);
  const qs = params.toString() ? `?${params}` : '';
  const response = await apiClient.get<ListResponse<AuditEntry>>(
    `/wp-json/wp-super-gallery/v1/admin/audit-log${qs}`,
  );
  return normalizeListResponse(response);
}

async function fetchMediaItems(apiClient: ApiClient, campaignId: string): Promise<MediaItem[]> {
  const response = await apiClient.get<MediaItem[] | { items?: MediaItem[] }>(
    `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media`,
  );
  const items = Array.isArray(response) ? response : response.items ?? [];
  return sortByOrder(items);
}

function staggeredPrefetch(
  ids: string[],
  run: (id: string) => Promise<void>,
  staggerMs: number,
): () => void {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const batches: string[][] = [];

  for (let index = 0; index < ids.length; index += PREFETCH_CONCURRENCY) {
    batches.push(ids.slice(index, index + PREFETCH_CONCURRENCY));
  }

  let batchIndex = 0;

  function runNextBatch() {
    if (cancelled || batchIndex >= batches.length) {
      return;
    }

    const batch = batches[batchIndex++];
    if (!batch) return;
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

export function useAdminCampaigns(apiClient: ApiClient, spaceId = 'all', page = 1, perPage = 20, filters?: CampaignFilters) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: getAdminCampaignsQueryKey(apiClient, spaceId, page, perPage, filters),
    queryFn: () => fetchAdminCampaigns(apiClient, spaceId, page, perPage, filters),
    staleTime: ADMIN_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });

  return {
    campaigns: data?.campaigns ?? [],
    pagination: data?.pagination ?? { page, perPage, total: 0, totalPages: 1 },
    campaignsLoading: isLoading,
    campaignsError: error instanceof Error ? error.message : error ? 'Failed to load campaigns' : null,
    mutateCampaigns: refetch,
  };
}

export function useAllCampaignOptions(apiClient: ApiClient, spaceId = 'all', enabled = true) {
  const { data } = useQuery({
    queryKey: getAdminCampaignOptionsQueryKey(apiClient, spaceId),
    queryFn: () => fetchAllCampaignOptions(apiClient, spaceId),
    staleTime: SELECTOR_QUERY_STALE_TIME,
    enabled,
    ...ADMIN_QUERY_OPTIONS,
  });

  return data ?? [];
}

export function useAccessGrants(
  apiClient: ApiClient,
  mode: 'campaign' | 'company' | 'all',
  targetId: string,
  includeExpired = false,
) {
  const enabled = Boolean(targetId);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: getAccessGrantsQueryKey(apiClient, mode, targetId || 'none', includeExpired),
    queryFn: () => fetchAccessGrants(apiClient, mode, targetId, includeExpired),
    enabled,
    staleTime: ADMIN_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });

  return {
    accessEntries: data ?? [],
    accessLoading: isLoading,
    accessError: error ?? null,
    mutateAccess: refetch,
  };
}

export function useCompanies(apiClient: ApiClient, spaceId = 'all', enabled: boolean = true) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: getCompaniesQueryKey(apiClient, spaceId),
    queryFn: () => fetchCompanies(apiClient, spaceId),
    enabled,
    staleTime: ADMIN_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });

  return {
    companies: data ?? [],
    companiesLoading: isLoading,
    companiesError: error ?? null,
    mutateCompanies: refetch,
  };
}

export function getAllCompaniesQueryKey(apiClient: ApiClient, spaceId = 'all') {
  return [...getAdminQueryPrefix(apiClient), 'companies-all', spaceId] as const;
}

async function fetchAllCompanies(apiClient: ApiClient, spaceId = 'all'): Promise<CompanyInfo[]> {
  const spaceParam = spaceId !== 'all' ? `&space=${encodeURIComponent(spaceId)}` : '';
  const first = await apiClient.get<{ items: CompanyInfo[]; totalPages: number }>(
    `/wp-json/wp-super-gallery/v1/companies?per_page=100&page=1${spaceParam}`,
  );
  const items = first.items ?? [];
  const totalPages = first.totalPages ?? 1;
  if (totalPages <= 1) return items;
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      apiClient
        .get<{ items: CompanyInfo[] }>(`/wp-json/wp-super-gallery/v1/companies?per_page=100&page=${i + 2}${spaceParam}`)
        .then((r) => r.items ?? []),
    ),
  );
  return items.concat(...rest);
}

export function useAllCompanies(apiClient: ApiClient, spaceId = 'all', enabled = true) {
  const { data, isLoading } = useQuery({
    queryKey: getAllCompaniesQueryKey(apiClient, spaceId),
    queryFn: () => fetchAllCompanies(apiClient, spaceId),
    enabled,
    staleTime: ADMIN_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });
  return { companies: data ?? [], companiesLoading: isLoading };
}

type CampaignPatchVars = {
  id: string;
  apiPatch: Partial<Record<string, unknown>>;
  optimisticPatch?: Partial<AdminCampaign>;
};

export function usePatchCampaign(apiClient: ApiClient) {
  const queryClient = useQueryClient();
  const campaignsPrefix = [...getAdminQueryPrefix(apiClient), 'campaigns'] as const;

  return useMutation<unknown, Error, CampaignPatchVars, { snapshots: [unknown, unknown][] }>({
    mutationFn: ({ id, apiPatch }) =>
      apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${id}`, apiPatch),

    onMutate: async ({ id, optimisticPatch }) => {
      if (!optimisticPatch) return { snapshots: [] };
      await queryClient.cancelQueries({ queryKey: campaignsPrefix });
      const snapshots = queryClient.getQueriesData<{ campaigns: AdminCampaign[] }>({ queryKey: campaignsPrefix });
      queryClient.setQueriesData<{ campaigns: AdminCampaign[]; pagination: unknown }>(
        { queryKey: campaignsPrefix },
        (old) => old ? { ...old, campaigns: old.campaigns.map((c) => String(c.id) === id ? { ...c, ...optimisticPatch } : c) } : old,
      );
      return { snapshots: snapshots as [unknown, unknown][] };
    },

    onError: (_err, _vars, context) => {
      for (const [key, data] of (context?.snapshots ?? [])) {
        queryClient.setQueryData(key as Parameters<typeof queryClient.setQueryData>[0], data);
      }
    },

    onSettled: (_data, _error, vars) => {
      void queryClient.invalidateQueries({ queryKey: campaignsPrefix });
      if ('company' in vars.apiPatch) {
        // Invalidate all company caches across spaces, not just the 'all' space bucket.
        void queryClient.invalidateQueries({ queryKey: [...getAdminQueryPrefix(apiClient), 'companies-all'] });
      }
    },
  });
}

export function useAuditEntries(apiClient: ApiClient, campaignId: string, filters: AuditFilters = {}) {
  const enabled = Boolean(campaignId);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: getAuditEntriesQueryKey(apiClient, campaignId || 'none', filters),
    queryFn: () => fetchAuditEntries(apiClient, campaignId, filters),
    enabled,
    staleTime: ADMIN_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });

  return {
    auditEntries: data ?? [],
    auditLoading: isLoading,
    auditError: error ?? null,
    mutateAudit: refetch,
  };
}

export function useGlobalAuditEntries(apiClient: ApiClient, spaceId = 'all', filters: AuditFilters & { campaignId?: string } = {}) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: getGlobalAuditQueryKey(apiClient, spaceId, filters),
    queryFn: () => fetchGlobalAuditEntries(apiClient, spaceId, filters),
    staleTime: ADMIN_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });

  return {
    globalAuditEntries: data ?? [],
    globalAuditLoading: isLoading,
    globalAuditError: error ?? null,
    mutateGlobalAudit: refetch,
  };
}

export function useMediaItems(apiClient: ApiClient, campaignId: string) {
  const enabled = Boolean(campaignId);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: getMediaItemsQueryKey(apiClient, campaignId || 'none'),
    queryFn: () => fetchMediaItems(apiClient, campaignId),
    enabled,
    staleTime: ADMIN_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });

  return {
    mediaItems: data ?? [],
    mediaLoading: isLoading,
    mediaError: error ?? null,
    mutateMedia: refetch,
  };
}

export function useCampaignCategories(apiClient: ApiClient, enabled = true) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: getCampaignCategoriesQueryKey(apiClient),
    queryFn: () => apiClient.listCampaignCategories(),
    enabled,
    staleTime: CATEGORY_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });

  return {
    campaignCategories: data ?? [],
    categoriesLoading: isLoading,
    categoriesError: error ?? null,
    mutateCampaignCategories: refetch,
  };
}

export function useCampaignAnalytics(
  apiClient: ApiClient,
  campaignId: string | null,
  from: string,
  to: string,
  polling?: AnalyticsPollingOptions,
) {
  const pollingActive = Boolean(polling?.enabled && campaignId);
  return useQuery<CampaignAnalyticsResponse>({
    queryKey: getCampaignAnalyticsQueryKey(apiClient, campaignId || 'none', from, to),
    queryFn: () => apiClient.getCampaignAnalytics(campaignId!, from, to),
    enabled: Boolean(campaignId),
    staleTime: ANALYTICS_QUERY_STALE_TIME,
    retry: false,
    refetchInterval: pollingActive ? (polling?.intervalMs ?? ANALYTICS_POLL_INTERVAL_MS) : false,
    refetchOnWindowFocus: pollingActive,
    refetchOnReconnect: pollingActive,
  });
}

export function useAccessRequests(
  apiClient: ApiClient,
  campaignId: string,
  status?: string,
) {
  return useQuery<AccessRequest[]>({
    queryKey: getAccessRequestsQueryKey(apiClient, campaignId || 'none', status),
    queryFn: () => apiClient.listAccessRequests(campaignId, status),
    enabled: Boolean(campaignId),
    staleTime: ACCESS_REQUESTS_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });
}

export function prefetchAllCampaignAccess(
  apiClient: ApiClient,
  campaignIds: string[],
  queryClient: QueryClient,
): () => void {
  return staggeredPrefetch(
    campaignIds,
    (id) => queryClient.prefetchQuery({
      queryKey: getAccessGrantsQueryKey(apiClient, 'campaign', id),
      queryFn: () => fetchAccessGrants(apiClient, 'campaign', id),
      staleTime: ADMIN_QUERY_STALE_TIME,
      ...ADMIN_QUERY_OPTIONS,
    }),
    60,
  );
}

export function prefetchAllCampaignAudit(
  apiClient: ApiClient,
  campaignIds: string[],
  queryClient: QueryClient,
): () => void {
  return staggeredPrefetch(
    campaignIds,
    (id) => queryClient.prefetchQuery({
      queryKey: getAuditEntriesQueryKey(apiClient, id),
      queryFn: () => fetchAuditEntries(apiClient, id),
      staleTime: ADMIN_QUERY_STALE_TIME,
      ...ADMIN_QUERY_OPTIONS,
    }),
    60,
  );
}

export function prefetchAllCampaignMedia(
  apiClient: ApiClient,
  campaignIds: string[],
  queryClient: QueryClient,
): () => void {
  return staggeredPrefetch(
    campaignIds,
    (id) => queryClient.prefetchQuery({
      queryKey: getMediaItemsQueryKey(apiClient, id),
      queryFn: () => fetchMediaItems(apiClient, id),
      staleTime: ADMIN_QUERY_STALE_TIME,
      ...ADMIN_QUERY_OPTIONS,
    }),
    80,
  );
}

export function getCampaignTagsQueryKey(apiClient: ApiClient) {
  return [...getAdminQueryPrefix(apiClient), 'campaign-tags'] as const;
}

export function getMediaTagsQueryKey(apiClient: ApiClient) {
  return [...getAdminQueryPrefix(apiClient), 'media-tags'] as const;
}

export function useCampaignTags(apiClient: ApiClient, enabled = true) {
  const { data, error, isLoading, refetch } = useQuery<TagEntry[]>({
    queryKey: getCampaignTagsQueryKey(apiClient),
    queryFn: () => apiClient.listCampaignTags(),
    enabled,
    staleTime: CATEGORY_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });

  return {
    campaignTags: data ?? [],
    campaignTagsLoading: isLoading,
    campaignTagsError: error ?? null,
    mutateCampaignTags: refetch,
  };
}

export function useMediaTags(apiClient: ApiClient, enabled = true) {
  const { data, error, isLoading, refetch } = useQuery<TagEntry[]>({
    queryKey: getMediaTagsQueryKey(apiClient),
    queryFn: () => apiClient.listMediaTags(),
    enabled,
    staleTime: CATEGORY_QUERY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });

  return {
    mediaTags: data ?? [],
    mediaTagsLoading: isLoading,
    mediaTagsError: error ?? null,
    mutateMediaTags: refetch,
  };
}

export function getCampaignMediaAnalyticsQueryKey(
  apiClient: ApiClient,
  campaignId: string,
  from: string,
  to: string,
) {
  return [...getAdminQueryPrefix(apiClient), 'campaign-media-analytics', campaignId, from, to] as const;
}

export function getAnalyticsSummaryQueryKey(apiClient: ApiClient, spaceId = 'all', from: string, to: string) {
  return [...getAdminQueryPrefix(apiClient), 'analytics-summary', spaceId, from, to] as const;
}

export function useCampaignMediaAnalytics(
  apiClient: ApiClient,
  campaignId: string | null,
  from: string,
  to: string,
  polling?: AnalyticsPollingOptions,
) {
  const pollingActive = Boolean(polling?.enabled && campaignId);
  return useQuery<MediaAnalyticsResponse>({
    queryKey: getCampaignMediaAnalyticsQueryKey(apiClient, campaignId || 'none', from, to),
    queryFn: () => apiClient.getCampaignMediaAnalytics(campaignId!, from, to),
    enabled: Boolean(campaignId),
    staleTime: ANALYTICS_QUERY_STALE_TIME,
    retry: false,
    refetchInterval: pollingActive ? (polling?.intervalMs ?? ANALYTICS_POLL_INTERVAL_MS) : false,
    refetchOnWindowFocus: pollingActive,
    refetchOnReconnect: pollingActive,
  });
}

export function useAnalyticsSummary(
  apiClient: ApiClient,
  spaceId = 'all',
  from: string,
  to: string,
  enabled = true,
  polling?: AnalyticsPollingOptions,
) {
  const pollingActive = Boolean(polling?.enabled && enabled);
  return useQuery<AnalyticsSummaryResponse>({
    queryKey: getAnalyticsSummaryQueryKey(apiClient, spaceId, from, to),
    queryFn: () => apiClient.getAnalyticsSummary(from, to, spaceId),
    enabled,
    staleTime: ANALYTICS_QUERY_STALE_TIME,
    retry: false,
    refetchInterval: pollingActive ? (polling?.intervalMs ?? ANALYTICS_POLL_INTERVAL_MS) : false,
    refetchOnWindowFocus: pollingActive,
    refetchOnReconnect: pollingActive,
  });
}

// ── P28-J: Access Summary ────────────────────────────────────────────────────

const ACCESS_SUMMARY_STALE_TIME = 30_000;

function getAccessSummaryQueryKey(apiClient: ApiClient, page: number, perPage: number) {
  return ['access-summary', apiClient.getBaseUrl(), page, perPage] as const;
}

export function useAccessSummary(apiClient: ApiClient, page = 1, perPage = 200) {
  return useQuery<AccessSummaryResponse>({
    queryKey: getAccessSummaryQueryKey(apiClient, page, perPage),
    queryFn: () => apiClient.getAccessSummary(page, perPage),
    staleTime: ACCESS_SUMMARY_STALE_TIME,
    ...ADMIN_QUERY_OPTIONS,
  });
}

export type { AccessRequest, AccessSummaryItem, AccessSummaryResponse, AnalyticsSummaryResponse, CampaignAnalyticsResponse, CampaignCategoryEntry, MediaAnalyticsResponse, TagEntry };