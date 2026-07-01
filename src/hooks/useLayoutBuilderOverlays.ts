import { useCallback } from 'react';
import type { LayoutGraphicLayer } from '@/types';
import type { MutateFn } from './useLayoutBuilderHistory';

export function useLayoutBuilderOverlays({ mutate }: { mutate: MutateFn }) {
  const addOverlay = useCallback(
    (imageUrl: string): string => {
      const newId = crypto.randomUUID?.() ?? `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      mutate((d) => {
        const maxZ = Math.max(
          ...d.slots.map((s) => s.zIndex),
          ...d.overlays.map((o) => o.zIndex),
          ...(d.texts ?? []).map((t) => t.zIndex),
          0,
        );
        d.overlays.push({
          id: newId,
          imageUrl,
          x: 10,
          y: 10,
          width: 30,
          height: 30,
          zIndex: maxZ + 100, // Overlays above slots by default
          opacity: 1,
          pointerEvents: false,
        });
      }, 'Add layer');
      return newId;
    },
    [mutate],
  );

  const removeOverlay = useCallback(
    (id: string) =>
      mutate((d) => {
        d.overlays = d.overlays.filter((o) => o.id !== id);
      }, 'Remove layer'),
    [mutate],
  );

  const updateOverlay = useCallback(
    (id: string, updates: Partial<LayoutGraphicLayer>) =>
      mutate((d) => {
        const idx = d.overlays.findIndex((o) => o.id === id);
        if (idx !== -1) Object.assign(d.overlays[idx]!, updates);
      }, 'Update layer'),
    [mutate],
  );

  const moveOverlay = useCallback(
    (id: string, x: number, y: number) =>
      mutate((d) => {
        const o = d.overlays.find((ov) => ov.id === id);
        if (o) { o.x = x; o.y = y; }
      }, 'Move layer'),
    [mutate],
  );

  const resizeOverlay = useCallback(
    (id: string, x: number, y: number, width: number, height: number) =>
      mutate((d) => {
        const o = d.overlays.find((ov) => ov.id === id);
        if (o) { o.x = x; o.y = y; o.width = width; o.height = height; }
      }, 'Resize layer'),
    [mutate],
  );

  return { addOverlay, removeOverlay, updateOverlay, moveOverlay, resizeOverlay };
}
