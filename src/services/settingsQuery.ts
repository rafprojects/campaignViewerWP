import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import type { ApiClient, SettingsResponse, SettingsUpdateRequest } from '@/services/apiClient';
import {
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryBehaviorSettings,
} from '@/types';
import { mergeSettingsWithDefaults } from '@/utils/mergeSettingsWithDefaults';

export interface ResolvedSettingsResponse extends GalleryBehaviorSettings {
  authProvider?: string;
  apiBase?: string;
  theme?: string;
  galleryLayout?: string;
  itemsPerPage?: number;
  enableLightbox?: boolean;
  enableAnimations?: boolean;
  cacheTtl?: number;
}

export const SETTINGS_QUERY_KEY = ['settings'] as const;
export const SETTINGS_QUERY_STALE_TIME = 5 * 60 * 1000;

export function getSettingsQueryKey(apiClient: ApiClient) {
  return [...SETTINGS_QUERY_KEY, apiClient.getBaseUrl()] as const;
}

export function normalizeSettingsResponse(
  response?: Partial<ResolvedSettingsResponse> | SettingsResponse,
): ResolvedSettingsResponse {
  return {
    ...(response ?? {}),
    ...mergeSettingsWithDefaults((response ?? {}) as Partial<GalleryBehaviorSettings>),
  };
}

export const DEFAULT_RESOLVED_SETTINGS = normalizeSettingsResponse(
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
);

export function setSettingsQueryData(
  queryClient: QueryClient,
  apiClient: ApiClient,
  response?: Partial<ResolvedSettingsResponse> | SettingsResponse,
) {
  queryClient.setQueryData(
    getSettingsQueryKey(apiClient),
    normalizeSettingsResponse(response),
  );
}

export function useGetSettings(apiClient: ApiClient) {
  return useQuery({
    queryKey: getSettingsQueryKey(apiClient),
    queryFn: async () => normalizeSettingsResponse(await apiClient.getSettings()),
    staleTime: SETTINGS_QUERY_STALE_TIME,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData ?? DEFAULT_RESOLVED_SETTINGS,
  });
}

export function useUpdateSettings(apiClient: ApiClient) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: SettingsUpdateRequest) => (
      normalizeSettingsResponse(await apiClient.updateSettings(settings))
    ),
    onSuccess: (data) => {
      setSettingsQueryData(queryClient, apiClient, data);
    },
  });
}