import { useEffect } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import { safeLocalStorage } from '@wp-super-gallery/shared-utils';
import type { MediaSortMode } from '@/components/Admin/applySortMode';

export type ViewMode = 'grid' | 'list' | 'compact';
export type CardSize = 'small' | 'medium' | 'large';

export interface MediaViewPrefs {
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  cardSize: CardSize;
  setCardSize: (value: CardSize) => void;
  listPage: number;
  setListPage: (value: number) => void;
  sortMode: MediaSortMode;
  setSortMode: (value: MediaSortMode) => void;
  orphanFilter: boolean;
  setOrphanFilter: (value: boolean) => void;
}

/** P34-B / P37-KS1: per-campaign media view preferences, persisted in localStorage. */
export function useMediaViewPrefs(campaignId: string, rootId: string): MediaViewPrefs {
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>({
    key: `wpsg_media_viewMode_${campaignId}`,
    defaultValue: 'grid',
    getInitialValueInEffect: false,
  });
  const [cardSize, setCardSize] = useLocalStorage<CardSize>({
    key: `wpsg_media_cardSize_${campaignId}`,
    defaultValue: 'medium',
    getInitialValueInEffect: false,
  });
  const [listPage, setListPage] = useLocalStorage<number>({
    key: `wpsg_media_listPage_${campaignId}`,
    defaultValue: 1,
    getInitialValueInEffect: false,
  });
  const [sortMode, setSortMode] = useLocalStorage<MediaSortMode>({
    key: `wpsg_media_sortMode_${rootId}`,
    defaultValue: 'order',
    getInitialValueInEffect: false,
  });
  const [orphanFilter, setOrphanFilter] = useLocalStorage<boolean>({
    key: `wpsg_media_orphanFilter_${campaignId}`,
    defaultValue: false,
    getInitialValueInEffect: false,
  });

  // P37-KS1: one-time migration of legacy global sort mode key to root-scoped key.
  useEffect(() => {
    try {
      const legacy = localStorage.getItem('wpsg_media_sortMode');
      if (legacy !== null) {
        safeLocalStorage.setItem(`wpsg_media_sortMode_${rootId}`, legacy);
        localStorage.removeItem('wpsg_media_sortMode');
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { viewMode, setViewMode, cardSize, setCardSize, listPage, setListPage, sortMode, setSortMode, orphanFilter, setOrphanFilter };
}
