import { useCallback, useState } from 'react';
import type { ViewScopeOptions } from './usePersistentAccordion';

/**
 * P36-A: Scope-keyed localStorage-backed state.
 *
 * Reads from `localStorage` on mount (via lazy initializer — no effect needed)
 * and writes back on every update. The key is
 * `wpsg_view_<scopeId>_<feature>`, which prevents collisions between multiple
 * shortcode mounts on the same page. Inject the per-mount `scopeId` via
 * `options.scopeId` (defaults to `'root'`).
 *
 * `T` must be JSON-serializable. Returns `[value, setValue]`.
 */
export function useReloadSafeView<T>(
  feature: string,
  defaultValue: T,
  options: ViewScopeOptions = {},
): [T, (next: T) => void] {
  const { scopeId = 'root', namespace = 'wpsg_view' } = options;
  const key = `${namespace}_${scopeId}_${feature}`;

  const [value, setValueState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored) as T;
    } catch {
      // non-fatal: localStorage unavailable or stale JSON — use default
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
