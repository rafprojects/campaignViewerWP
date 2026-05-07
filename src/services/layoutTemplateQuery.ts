import { useQuery } from '@tanstack/react-query';

import type { ApiClient } from '@/services/apiClient';
import type { LayoutTemplate } from '@/types';
import type { OverlayLibraryItem } from '@/components/Admin/LayoutBuilder/BuilderDockContext';

const LAYOUT_TEMPLATE_QUERY_OPTIONS = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const LAYOUT_TEMPLATES_QUERY_STALE_TIME = 30_000;
export const PUBLIC_LAYOUT_TEMPLATE_QUERY_STALE_TIME = 10_000;
export const OVERLAY_LIBRARY_QUERY_STALE_TIME = 60_000;

function getApiClientCacheBase(apiClient: ApiClient) {
  return typeof apiClient.getBaseUrl === 'function' ? apiClient.getBaseUrl() : 'default';
}

function getLayoutTemplateQueryPrefix(apiClient: ApiClient) {
  return ['layout-templates', getApiClientCacheBase(apiClient)] as const;
}

export function getLayoutTemplatesQueryKey(apiClient: ApiClient) {
  return [...getLayoutTemplateQueryPrefix(apiClient), 'admin-list'] as const;
}

export function getOverlayLibraryQueryKey(apiClient: ApiClient) {
  return [...getLayoutTemplateQueryPrefix(apiClient), 'overlay-library'] as const;
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

export function useOverlayLibrary(apiClient: ApiClient, enabled = true) {
  return useQuery<OverlayLibraryItem[]>({
    queryKey: getOverlayLibraryQueryKey(apiClient),
    queryFn: async () => (
      await apiClient.get<OverlayLibraryItem[] | undefined>('/wp-json/wp-super-gallery/v1/admin/overlay-library')
    ) ?? [],
    enabled,
    staleTime: OVERLAY_LIBRARY_QUERY_STALE_TIME,
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