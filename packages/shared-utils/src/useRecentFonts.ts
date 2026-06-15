import { useCallback, useSyncExternalStore } from 'react';

/**
 * Default localStorage key for the recent-fonts list.
 *
 * [P51-D] The key is now parametrizable (playbook §6) so external consumers can
 * pick their own namespace instead of the hardcoded WPSG one. In-repo callers
 * use the default, which preserves the shared-store semantics they rely on.
 */
const DEFAULT_STORAGE_KEY = 'wpsg-recent-fonts';
const MAX_RECENT = 8;

/**
 * One external store per storage key. Each store keeps its own listener set and
 * snapshot cache so every hook bound to the same key sees one shared list
 * (cross-instance sync via `useSyncExternalStore`), while distinct keys stay
 * isolated.
 */
interface RecentFontsStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => string[];
  addRecentFont: (fontFamily: string) => void;
}

const SERVER_SNAPSHOT: string[] = [];
const stores = new Map<string, RecentFontsStore>();

function getStore(storageKey: string): RecentFontsStore {
  const existing = stores.get(storageKey);
  if (existing) return existing;

  let listeners: Array<() => void> = [];
  // Cached snapshot — avoids a new array reference on every getSnapshot call.
  let cachedRaw: string | null = null;
  let cachedSnapshot: string[] = [];

  const getSnapshot = (): string[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedSnapshot = raw ? (JSON.parse(raw) as string[]) : [];
      }
      return cachedSnapshot;
    } catch {
      // non-fatal: localStorage unavailable or JSON parse error — fall back to cache
      return cachedSnapshot;
    }
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners = [...listeners, listener];
    return () => { listeners = listeners.filter((l) => l !== listener); };
  };

  const addRecentFont = (fontFamily: string): void => {
    if (!fontFamily) return;
    // Extract the first name from a CSS font-family string
    const name = fontFamily.split(',')[0]!.trim().replace(/['"]/g, '');
    if (!name) return;

    const current = getSnapshot();
    const updated = [name, ...current.filter((n) => n !== name)].slice(0, MAX_RECENT);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch { /* quota exceeded — ignore */ }
    for (const l of listeners) l();
  };

  const store: RecentFontsStore = { subscribe, getSnapshot, addRecentFont };
  stores.set(storageKey, store);
  return store;
}

/**
 * Hook that provides the recent-fonts list from localStorage and a
 * function to push a newly-selected font to the top.
 *
 * Uses `useSyncExternalStore` so every consumer bound to the same `storageKey`
 * sees the same list without prop-drilling.
 *
 * @param storageKey localStorage key for the list. Defaults to
 *   `'wpsg-recent-fonts'`; pass a custom value to namespace an external app.
 */
export function useRecentFonts(storageKey: string = DEFAULT_STORAGE_KEY) {
  const store = getStore(storageKey);
  const recent = useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER_SNAPSHOT);

  const addRecentFont = useCallback(
    (fontFamily: string) => store.addRecentFont(fontFamily),
    [store],
  );

  return { recentFonts: recent, addRecentFont } as const;
}
