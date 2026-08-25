import { useEffect } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import { safeLocalStorage } from '@mullion/shared-utils';
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
    key: `mullion_media_viewMode_${campaignId}`,
    defaultValue: 'grid',
    getInitialValueInEffect: false,
  });
  const [cardSize, setCardSize] = useLocalStorage<CardSize>({
    key: `mullion_media_cardSize_${campaignId}`,
    defaultValue: 'medium',
    getInitialValueInEffect: false,
  });
  const [listPage, setListPage] = useLocalStorage<number>({
    key: `mullion_media_listPage_${campaignId}`,
    defaultValue: 1,
    getInitialValueInEffect: false,
  });
  const [sortMode, setSortMode] = useLocalStorage<MediaSortMode>({
    key: `mullion_media_sortMode_${rootId}`,
    defaultValue: 'order',
    getInitialValueInEffect: false,
  });
  const [orphanFilter, setOrphanFilter] = useLocalStorage<boolean>({
    key: `mullion_media_orphanFilter_${campaignId}`,
    defaultValue: false,
    getInitialValueInEffect: false,
  });

  // P37-KS1: one-time migration of legacy global sort mode key to root-scoped key.
  useEffect(() => {
    try {
      const legacy = localStorage.getItem('mullion_media_sortMode');
      if (legacy !== null) {
        safeLocalStorage.setItem(`mullion_media_sortMode_${rootId}`, legacy);
        localStorage.removeItem('mullion_media_sortMode');
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { viewMode, setViewMode, cardSize, setCardSize, listPage, setListPage, sortMode, setSortMode, orphanFilter, setOrphanFilter };
}
