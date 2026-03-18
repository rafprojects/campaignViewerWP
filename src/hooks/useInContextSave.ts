import { useCallback, useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';
import type { ApiClient } from '@/services/apiClient';
import type { GalleryBehaviorSettings } from '@/types';
import { mergeSettingsWithDefaults } from '@/utils/mergeSettingsWithDefaults';

const SWR_KEY = 'gallery-behavior-settings';

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
  const { mutate } = useSWRConfig();
  const pendingRef = useRef<Record<string, unknown>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  // Ref to latest settings avoids stale closure in debounced callback
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const save = useCallback(
    (key: string, value: unknown) => {
      if (!apiClient) return;
      pendingRef.current[key] = value;

      // Optimistic SWR update — merge with latest settings via ref
      const optimistic = { ...settingsRef.current, [key]: value } as GalleryBehaviorSettings;
      void mutate(SWR_KEY, optimistic, false);

      // Debounced server save
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const batch = { ...pendingRef.current };
        pendingRef.current = {};
        try {
          const response = await apiClient.updateSettings(batch);
          void mutate(SWR_KEY, mergeSettingsWithDefaults(response as Partial<GalleryBehaviorSettings>), false);
        } catch (err) {
          console.error('[WPSG] In-context save failed:', err);
          // Revert to server state on failure
          try {
            const fresh = await apiClient.getSettings();
            void mutate(SWR_KEY, mergeSettingsWithDefaults(fresh as Partial<GalleryBehaviorSettings>), false);
          } catch { /* keep optimistic state if refetch also fails */ }
        }
      }, delay);
    },
    [apiClient, delay, mutate],
  );

  // Clear pending debounce timer on unmount to prevent stale network calls
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
    };
  }, []);

  return save;
}
