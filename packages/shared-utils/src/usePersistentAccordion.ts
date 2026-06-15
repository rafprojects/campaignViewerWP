import { useCallback, useState } from 'react';

/** Scoping options for localStorage-backed view hooks. */
export interface ViewScopeOptions {
  /** Per-mount scope id (e.g. a React root id) used to namespace keys. Default `'root'`. */
  scopeId?: string;
  /** Storage-key namespace prefix. Default `'wpsg_view'`. */
  namespace?: string;
}

/**
 * P36-A2: Persistent accordion state. Extends useLazyAccordion with
 * scope-keyed localStorage persistence so the expanded panel survives
 * tab changes and page reloads.
 *
 * Returns `{ mounted, value, onChange }` — drop-in for components that
 * previously used `useLazyAccordion` + `defaultValue`.
 *
 * The `scopeId` (typically a React root id) namespaces the key so multiple
 * mounts on the same page don't collide. Inject it via `options.scopeId`;
 * defaults keep the `wpsg_view_<scopeId>_accordion_<storageKey>` format.
 *
 * Usage:
 *   const { mounted, value, onChange } = usePersistentAccordion('gallery-style', 'viewport', { scopeId });
 *   <Accordion value={value} onChange={onChange}>
 *     <Accordion.Panel>
 *       {mounted.has('viewport') && <Content />}
 *     </Accordion.Panel>
 *   </Accordion>
 */
export function usePersistentAccordion(
  storageKey: string,
  defaultValue: string | null = null,
  options: ViewScopeOptions = {},
) {
  const { scopeId = 'root', namespace = 'wpsg_view' } = options;
  const key = `${namespace}_${scopeId}_accordion_${storageKey}`;

  const readStored = (): string | null => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as string | null;
    } catch { /* ignore */ }
    return defaultValue;
  };

  const [mounted, setMounted] = useState<Set<string>>(() => {
    const initial = readStored();
    return initial != null ? new Set([initial]) : new Set();
  });

  const [value, setValue] = useState<string | null>(readStored);

  const onChange = useCallback(
    (next: string | null) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch { /* localStorage full or unavailable */ }
      if (next != null) {
        setMounted((prev) => {
          if (prev.has(next)) return prev;
          const s = new Set(prev);
          s.add(next);
          return s;
        });
      }
    },
    [key],
  );

  return { mounted, value, onChange };
}
