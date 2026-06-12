import { useQuery } from '@tanstack/react-query';

import type { ApiClient } from '@/services/apiClient';
import type { LayoutTemplate } from '@/types';
import type { AssetLibraryItem } from '@/components/Admin/LayoutBuilder/BuilderDockContext';

const LAYOUT_TEMPLATE_QUERY_OPTIONS = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const LAYOUT_TEMPLATES_QUERY_STALE_TIME = 30_000;
export const PUBLIC_LAYOUT_TEMPLATE_QUERY_STALE_TIME = 10_000;
export const ASSET_LIBRARY_QUERY_STALE_TIME = 60_000;

function getApiClientCacheBase(apiClient: ApiClient) {
  return typeof apiClient.getBaseUrl === 'function' ? apiClient.getBaseUrl() : 'default';
}

function getLayoutTemplateQueryPrefix(apiClient: ApiClient) {
  return ['layout-templates', getApiClientCacheBase(apiClient)] as const;
}

export function getLayoutTemplatesQueryKey(apiClient: ApiClient) {
  return [...getLayoutTemplateQueryPrefix(apiClient), 'admin-list'] as const;
}

export function getAssetLibraryQueryKey(apiClient: ApiClient, spaceId?: string | number) {
  const scope = spaceId !== undefined && spaceId !== null && String(spaceId) !== 'all'
    ? String(spaceId)
    : 'all';
  return [...getLayoutTemplateQueryPrefix(apiClient), 'asset-library', scope] as const;
}

function getApiBase(): string {
  return (
    (window as unknown as Record<string, string>).__WPSG_API_BASE__ ??
    window.location.origin
  );
}

export function getPublicLayoutTemplateQueryKey(templateId: string) {
  return ['layout-template', getApiBase(), templateId] as const;
}

async function fetchPublicTemplate(templateId: string): Promise<LayoutTemplate> {
  const url = `${getApiBase()}/wp-json/wp-super-gallery/v1/layout-templates/${templateId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch layout template (${response.status})`);
  }

  return response.json() as Promise<LayoutTemplate>;
}

export function useLayoutTemplates(apiClient: ApiClient, enabled = true) {
  return useQuery<LayoutTemplate[]>({
    queryKey: getLayoutTemplatesQueryKey(apiClient),
    queryFn: async () => (await apiClient.getLayoutTemplates()) ?? [],
    enabled,
    staleTime: LAYOUT_TEMPLATES_QUERY_STALE_TIME,
    ...LAYOUT_TEMPLATE_QUERY_OPTIONS,
  });
}

export function useAssetLibrary(apiClient: ApiClient, enabled = true, spaceId?: string | number) {
  // P50-K: when scoped to a real space, pass ?space=<id> so the backend applies
  // the per-space asset filter (delegated spaces see only associated + universal
  // assets). 'all' / undefined fetches the full library unscoped.
  const scoped = spaceId !== undefined && spaceId !== null && String(spaceId) !== 'all';
  const path = scoped
    ? `/wp-json/wp-super-gallery/v1/admin/asset-library?space=${encodeURIComponent(String(spaceId))}`
    : '/wp-json/wp-super-gallery/v1/admin/asset-library';
  return useQuery<AssetLibraryItem[]>({
    queryKey: getAssetLibraryQueryKey(apiClient, spaceId),
    queryFn: async () => (
      await apiClient.get<AssetLibraryItem[] | undefined>(path)
    ) ?? [],
    enabled,
    staleTime: ASSET_LIBRARY_QUERY_STALE_TIME,
    ...LAYOUT_TEMPLATE_QUERY_OPTIONS,
  });
}

export function usePublicLayoutTemplate(templateId: string | undefined | null) {
  return useQuery<LayoutTemplate>({
    queryKey: getPublicLayoutTemplateQueryKey(templateId || 'none'),
    queryFn: () => fetchPublicTemplate(templateId!),
    enabled: Boolean(templateId),
    staleTime: PUBLIC_LAYOUT_TEMPLATE_QUERY_STALE_TIME,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: false,
  });
}