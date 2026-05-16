import { useCallback } from 'react';
import type { ApiClient } from '@/services/apiClient';

/**
 * Returns a stable callback that records an analytics event (view or
 * lightbox_open) via the REST API. Errors are silently swallowed so that
 * analytics failures never disrupt the user experience.
 */
export function useRecordAnalyticsEvent(apiClient: ApiClient | undefined) {
  return useCallback(
    (campaignId: string, eventType: 'view' | 'lightbox_open' = 'view', mediaId?: string) => {
      if (!apiClient || !campaignId) return;
      void apiClient.recordAnalyticsEvent(campaignId, eventType, mediaId).catch(() => {
        // Analytics failures are non-fatal.
      });
    },
    [apiClient],
  );
}
