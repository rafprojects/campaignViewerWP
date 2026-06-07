import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem } from '@/types';

export interface MediaUsageSummaryState {
  usageSummary: Record<string, number>;
  usageSummaryLoading: boolean;
}

/** P18-G: Fetches per-item campaign usage counts whenever the media list changes. */
export function useMediaUsageSummary(apiClient: ApiClient, media: MediaItem[]): MediaUsageSummaryState {
  const [usageSummary, setUsageSummary] = useState<Record<string, number>>({});
  const [usageSummaryLoading, setUsageSummaryLoading] = useState(false);

  // Stable key derived from sorted media IDs — reorder and caption edits change
  // `media` but not the set of IDs, avoiding unnecessary network round-trips.
  const mediaIdKey = useMemo(
    () => media.map((m) => m.id).sort().join(','),
    [media],
  );
  const usageSummaryIds = useMemo(
    () => (mediaIdKey ? mediaIdKey.split(',') : []),
    [mediaIdKey],
  );

  useEffect(() => {
    if (usageSummaryIds.length === 0) {
      setUsageSummary({});
      setUsageSummaryLoading(false);
      return;
    }
    let canceled = false;
    setUsageSummaryLoading(true);
    void apiClient.getMediaUsageSummary(usageSummaryIds)
      .then((data) => {
        if (canceled) return;
        setUsageSummary(data);
        setUsageSummaryLoading(false);
      })
      .catch(() => {
        if (canceled) return;
        setUsageSummary({});
        setUsageSummaryLoading(false);
      });
    return () => { canceled = true; };
  }, [usageSummaryIds, apiClient]);

  return { usageSummary, usageSummaryLoading };
}
