import { useCallback, useRef } from 'react';
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

  const save = useCallback(
    (key: string, value: unknown) => {
      if (!apiClient) return;
      pendingRef.current[key] = value;

      // Optimistic SWR update
      const optimistic = { ...settings, [key]: value } as GalleryBehaviorSettings;
      void mutate(SWR_KEY, optimistic, false);

      // Debounced server save
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const batch = { ...pendingRef.current };
        pendingRef.current = {};
        try {
          const response = await apiClient.updateSettings(batch);
          void mutate(SWR_KEY, mergeSettingsWithDefaults(response as Partial<GalleryBehaviorSettings>), false);
        } catch {
          // On failure the optimistic state stays — next full load will correct.
        }
      }, delay);
    },
    [apiClient, settings, delay, mutate],
  );

  return save;
}
