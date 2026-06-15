import { useCallback, useState } from 'react';

/**
 * Track which accordion panels have been expanded at least once so their
 * content can be lazily mounted on first open instead of eagerly at mount.
 * Panels stay mounted after first expansion to preserve input state.
 */
export function useLazyAccordion(defaultValue?: string | string[] | null) {
  const [mounted, setMounted] = useState<Set<string>>(() => {
    if (defaultValue == null) return new Set();
    return new Set(Array.isArray(defaultValue) ? defaultValue : [defaultValue]);
  });

  const onChange = useCallback((value: string | string[] | null) => {
    if (value == null) return;
    const values = Array.isArray(value) ? value : [value];
    setMounted((prev) => {
      if (values.every((v) => prev.has(v))) return prev;
      const next = new Set(prev);
      for (const v of values) next.add(v);
      return next;
    });
  }, []);

  return { mounted, onChange };
}
