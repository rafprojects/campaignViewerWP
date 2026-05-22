/**
 * P34-B — Media sort-mode type and pure sort helper.
 * Kept in its own module so MediaTab.tsx can remain a components-only file
 * (required by the react-refresh/only-export-components lint rule).
 */
import type { MediaItem } from '@/types';

/** Available media sort modes. 'order' is the default display order. */
export type MediaSortMode = 'order' | 'title' | 'created' | 'size' | 'usage';

/**
 * Returns a new sorted copy of `items` according to `mode`.
 * Items with undefined values for the chosen field are sorted to the end.
 * Does not mutate the input array.
 */
export function applySortMode(
  items: MediaItem[],
  mode: MediaSortMode,
  usageSummary: Record<string, number>,
): MediaItem[] {
  const sorted = [...items];
  switch (mode) {
    case 'order':
      return sorted.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    case 'title':
      return sorted.sort((a, b) =>
        (a.caption ?? a.title ?? '').localeCompare(b.caption ?? b.title ?? ''),
      );
    case 'created':
      return sorted.sort((a, b) => {
        if (!a.dateUploaded && !b.dateUploaded) return 0;
        if (!a.dateUploaded) return 1;
        if (!b.dateUploaded) return -1;
        return new Date(b.dateUploaded).getTime() - new Date(a.dateUploaded).getTime();
      });
    case 'size':
      return sorted.sort((a, b) => {
        if (a.filesize == null && b.filesize == null) return 0;
        if (a.filesize == null) return 1;
        if (b.filesize == null) return -1;
        return b.filesize - a.filesize;
      });
    case 'usage':
      return sorted.sort((a, b) => {
        const ua = usageSummary[a.id] ?? 0;
        const ub = usageSummary[b.id] ?? 0;
        return ub - ua;
      });
    default:
      return sorted;
  }
}
