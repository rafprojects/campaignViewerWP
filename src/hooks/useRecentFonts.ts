import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'wpsg-recent-fonts';
const MAX_RECENT = 8;

let listeners: Array<() => void> = [];
function emitChange() {
  for (const l of listeners) l();
}

function getSnapshot(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => { listeners = listeners.filter((l) => l !== listener); };
}

/**
 * Hook that provides the recent-fonts list from localStorage and a
 * function to push a newly-selected font to the top.
 *
 * Uses `useSyncExternalStore` so every TypographyEditor instance on the
 * page sees the same list without prop-drilling.
 */
export function useRecentFonts() {
  const recent = useSyncExternalStore(subscribe, getSnapshot, () => [] as string[]);

  const addRecentFont = useCallback((fontFamily: string) => {
    if (!fontFamily) return;
    // Extract the first name from a CSS font-family string
    const name = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    if (!name) return;

    const current = getSnapshot();
    const updated = [name, ...current.filter((n) => n !== name)].slice(0, MAX_RECENT);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch { /* quota exceeded — ignore */ }
    emitChange();
  }, []);

  return { recentFonts: recent, addRecentFont } as const;
}
