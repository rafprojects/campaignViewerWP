import { useCallback } from 'react';
import type { MutateFn } from './useLayoutBuilderHistory';

export function useLayoutBuilderGuides({ mutate }: { mutate: MutateFn }) {
  const addGuide = useCallback(
    (axis: 'x' | 'y', position = 50) => {
      mutate((d) => {
        if (!d.guides) d.guides = [];
        d.guides.push({ id: crypto.randomUUID(), axis, position, locked: false });
      }, 'Add guide');
    },
    [mutate],
  );

  const moveGuide = useCallback(
    (id: string, position: number) => {
      mutate((d) => {
        const g = d.guides?.find((g) => g.id === id);
        if (g) g.position = Math.max(0, Math.min(100, position));
      }, 'Move guide');
    },
    [mutate],
  );

  const removeGuide = useCallback(
    (id: string) => {
      mutate((d) => {
        if (d.guides) d.guides = d.guides.filter((g) => g.id !== id);
      }, 'Remove guide');
    },
    [mutate],
  );

  const toggleGuideLock = useCallback(
    (id: string) => {
      mutate((d) => {
        const g = d.guides?.find((g) => g.id === id);
        if (g) g.locked = !g.locked;
      }, 'Lock guide');
    },
    [mutate],
  );

  return { addGuide, moveGuide, removeGuide, toggleGuideLock };
}
