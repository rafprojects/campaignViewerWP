import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@/services/apiClient';
import type { GalleryBehaviorSettings } from '@/types';
import {
  normalizeSettingsResponse,
  getSettingsQueryKey,
} from '@/services/settingsQuery';

/**
 * Debounced save hook for in-context editors.
 *
 * Batches multiple field changes and saves them to the server after a debounce
 * delay.  Optimistically updates the SWR cache so the UI responds instantly.
 */
export function useInContextSave(
  apiClient: ApiClient | undefined,
  settings: GalleryBehaviorSettings,
  delay = 500,
) {
    const queryClient = useQueryClient();
  const pendingRef = useRef<Record<string, unknown>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  // Ref to latest settings avoids stale closure in debounced callback
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const save = useCallback(
    (key: string, value: unknown) => {
      if (!apiClient) return;
      pendingRef.current[key] = value;
      const queryKey = getSettingsQueryKey(apiClient);

      queryClient.setQueryData(queryKey, (current: unknown) => normalizeSettingsResponse({
        ...(current as Record<string, unknown> | undefined),
        ...settingsRef.current,
        [key]: value,
      }));

      // Debounced server save
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const batch = { ...pendingRef.current };
        pendingRef.current = {};
        try {
          const response = await apiClient.updateSettings(batch);
          queryClient.setQueryData(queryKey, normalizeSettingsResponse(response));
        } catch (err) {
          console.error('[WPSG] In-context save failed:', err);
          // Revert to server state on failure
          try {
            const fresh = await apiClient.getSettings();
            queryClient.setQueryData(queryKey, normalizeSettingsResponse(fresh));
          } catch { /* keep optimistic state if refetch also fails */ }
        }
      }, delay);
    },
    [apiClient, delay, queryClient],
  );

  // Clear pending debounce timer on unmount to prevent stale network calls
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
    };
  }, []);

  return save;
}
