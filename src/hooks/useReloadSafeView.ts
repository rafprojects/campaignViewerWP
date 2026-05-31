import { useCallback, useState } from 'react';
import { useRootId } from '@/contexts/RootIdContext';

/**
 * P36-A: Root-scoped localStorage-backed state.
 *
 * Reads from `localStorage` on mount (via lazy initializer — no effect needed)
 * and writes back on every update. The key is
 * `wpsg_view_<rootId>_<feature>`, which prevents collisions between multiple
 * shortcode mounts on the same page.
 *
 * `T` must be JSON-serializable. Returns `[value, setValue]`.
 */
export function useReloadSafeView<T>(feature: string, defaultValue: T): [T, (next: T) => void] {
  const rootId = useRootId();
  const key = `wpsg_view_${rootId}_${feature}`;

  const [value, setValueState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (next: T) => {
      setValueState(next);
      try {
        if (next === null || next === undefined) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(next));
        }
      } catch {
        // localStorage unavailable or full — state update still applies in memory
      }
    },
    [key],
  );

  return [value, setValue];
}
