import { useCallback, useEffect, useRef } from 'react';
import { useRootId } from '@/contexts/RootIdContext';

/**
 * P36-A2: Persist and restore scroll position for a DOM element.
 *
 * Returns a callback ref to attach to a scrollable HTMLElement.
 * On mount, restores the saved `scrollTop`. On scroll, saves (debounced 200 ms).
 *
 * The key is `wpsg_view_<rootId>_scroll_<feature>`.
 * Pass a `tabKey` to namespace per-tab when the scroll container is shared
 * across multiple tabs (e.g. the settings panel drawer body).
 *
 * Usage:
 *   const scrollRef = useScrollRestore('settings', activeTab);
 *   <Box ref={scrollRef} style={{ overflowY: 'auto' }}>…</Box>
 */
export function useScrollRestore(feature: string, tabKey?: string | null) {
  const rootId = useRootId();
  const elementRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storageKey = tabKey
    ? `wpsg_view_${rootId}_scroll_${feature}_${tabKey}`
    : `wpsg_view_${rootId}_scroll_${feature}`;

  // Keep the storage key in a ref so the scroll handler always uses the latest
  // without needing to be re-registered on every tab change.
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  // Stable scroll handler — reads only through refs, never stale.
  const handleScroll = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const el = elementRef.current;
      if (!el) return;
      try {
        localStorage.setItem(storageKeyRef.current, JSON.stringify(el.scrollTop));
      } catch { /* ignore */ }
    }, 200);
  }, []);

  // Stable callback ref — memoized so React does not detach/reattach on every
  // render, which would re-apply the stored scroll position on each re-render
  // and cause visible scroll jumpiness on form-heavy surfaces.
  const callbackRef = useCallback((el: HTMLElement | null) => {
    if (elementRef.current === el) return;

    if (elementRef.current) {
      elementRef.current.removeEventListener('scroll', handleScroll);
    }

    elementRef.current = el;

    if (!el) return;

    // Restore saved scroll position
    try {
      const raw = localStorage.getItem(storageKeyRef.current);
      if (raw !== null) el.scrollTop = JSON.parse(raw) as number;
    } catch { /* ignore */ }

    el.addEventListener('scroll', handleScroll, { passive: true });
  }, [handleScroll]);

  // When the tabKey changes, restore scroll for the new tab.
  // Cancel any pending debounced save first — otherwise a save scheduled on
  // the previous tab could fire ~200ms later and overwrite the restored value.
  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    const el = elementRef.current;
    if (!el) return;
    try {
      const raw = localStorage.getItem(storageKey);
      el.scrollTop = raw !== null ? (JSON.parse(raw) as number) : 0;
    } catch { /* ignore */ }
  }, [storageKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      if (elementRef.current) {
        elementRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, [handleScroll]);

  return callbackRef;
}
