import { useCallback, useState } from 'react';
import { useRootId } from '@/contexts/RootIdContext';

/**
 * P36-A2: Persistent accordion state. Extends useLazyAccordion with
 * root-scoped localStorage persistence so the expanded panel survives
 * tab changes and page reloads.
 *
 * Returns `{ mounted, value, onChange }` — drop-in for components that
 * previously used `useLazyAccordion` + `defaultValue`.
 *
 * Usage:
 *   const { mounted, value, onChange } = usePersistentAccordion('gallery-style', 'viewport');
 *   <Accordion value={value} onChange={onChange}>
 *     <Accordion.Panel>
 *       {mounted.has('viewport') && <Content />}
 *     </Accordion.Panel>
 *   </Accordion>
 */
export function usePersistentAccordion(storageKey: string, defaultValue: string | null = null) {
  const rootId = useRootId();
  const key = `wpsg_view_${rootId}_accordion_${storageKey}`;

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
