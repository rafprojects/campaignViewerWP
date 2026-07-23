import { useCallback, useMemo, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { showNotification } from '@mantine/notifications';
import { getErrorMessage } from '@wp-super-gallery/shared-utils';
import i18n from '@/i18n';
import { getMediaItemsQueryKey } from '@/services/adminQuery';
import { useMediaDnd } from '@/hooks/useMediaDnd';
import { applySortMode, type MediaSortMode } from '@/components/Admin/applySortMode';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem } from '@/types';
import type { QueryClient } from '@tanstack/react-query';

const LIST_PAGE_SIZE = 50;

// [P71-E] Notification copy routed through the shared i18next instance (outside JSX).
const t = i18n.t.bind(i18n);

export function useMediaDisplay({
  media,
  setMedia,
  apiClient,
  campaignId,
  queryClient,
  onCampaignsUpdated,
  orphanFilter,
  usageSummary,
  usageSummaryLoading,
  sortMode,
  viewMode,
  listPage,
  setListPage,
}: {
  media: MediaItem[];
  setMedia: Dispatch<SetStateAction<MediaItem[]>>;
  apiClient: ApiClient;
  campaignId: string;
  queryClient: QueryClient;
  onCampaignsUpdated?: (() => void) | undefined;
  orphanFilter: boolean;
  usageSummary: Record<string, number>;
  usageSummaryLoading: boolean;
  sortMode: MediaSortMode;
  viewMode: string;
  listPage: number;
  setListPage: (page: number) => void;
}) {
  const reorderingRef = useRef(false);

  async function reorderMediaItems(nextMedia: MediaItem[]) {
    // Prevent concurrent reorder operations using stable ref-based guard
    if (reorderingRef.current) return;
    reorderingRef.current = true;

    const prev = media.slice();
    const itemsToSend = nextMedia.map((it, i) => ({ id: it.id, order: i + 1 }));

    try {
      await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/reorder`, { items: itemsToSend });
      const reorderedMedia = nextMedia.map((it, i) => ({ ...it, order: i + 1 }));
      setMedia(reorderedMedia);
      queryClient.setQueryData<MediaItem[]>(getMediaItemsQueryKey(apiClient, campaignId), reorderedMedia);
      showNotification({ title: t('mediadisp_reordered_title', 'Reordered'), message: t('mediadisp_reordered_message', 'Media order updated.') });
      onCampaignsUpdated?.();
    } catch (err) {
      // Roll back local state to previous order
      setMedia(prev);
      showNotification({ title: t('mediadisp_reorder_failed_title', 'Reorder failed'), message: getErrorMessage(err, t('mediadisp_reorder_failed_message', 'Failed to reorder media.')), color: 'red' });
    } finally {
      reorderingRef.current = false;
    }
  }

  const { sensors, activeMediaItem,
    getInsertionStyle, handleDndStart, handleDndOver, handleDndEnd, moveByKeyboard } = useMediaDnd(media, reorderMediaItems);

  // P18-G: Optionally filter to items used in exactly 1 campaign (only this one)
  // P34-B: then apply the selected sort mode.
  const displayedMedia = useMemo(() => {
    // 1. Orphan filter
    let items: MediaItem[];
    if (!orphanFilter) {
      items = media;
    } else if (usageSummaryLoading) {
      // Don't apply the filter while counts are being fetched — unknown entries
      // would be incorrectly excluded, making items temporarily disappear.
      items = media;
    } else {
      // Only include items whose usage count is a known number ≤ 1.
      // Items absent from the summary (partial/failed response) are excluded
      // rather than assumed exclusive.
      items = media.filter((m) => {
        const count = usageSummary[m.id];
        return typeof count === 'number' && count <= 1;
      });
    }

    // 2. Sort (P34-B)
    return applySortMode(items, sortMode, usageSummary);
  }, [media, orphanFilter, usageSummary, usageSummaryLoading, sortMode]);

  const mediaIds = useMemo(() => displayedMedia.map((item) => item.id), [displayedMedia]);
  const listTotalPages = useMemo(() => Math.max(1, Math.ceil(displayedMedia.length / LIST_PAGE_SIZE)), [displayedMedia.length]);
  const pagedListMedia = useMemo(() => {
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    return displayedMedia.slice(start, start + LIST_PAGE_SIZE);
  }, [displayedMedia, listPage]);

  useEffect(() => {
    if (listPage > listTotalPages) {
      setListPage(listTotalPages);
    }
  }, [listPage, listTotalPages, setListPage]);

  useEffect(() => {
    if (viewMode !== 'list') {
      setListPage(1);
    }
  }, [viewMode, setListPage]);

  const handleSortModeChange = useCallback((v: string | null) => {
    if (v) setListPage(1);
  }, [setListPage]);

  return {
    displayedMedia,
    mediaIds,
    listTotalPages,
    pagedListMedia,
    sensors,
    activeMediaItem,
    getInsertionStyle,
    handleDndStart,
    handleDndOver,
    handleDndEnd,
    moveByKeyboard,
    handleSortModeChange,
  };
}
