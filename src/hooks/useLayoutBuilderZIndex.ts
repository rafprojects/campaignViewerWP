import { useCallback } from 'react';
import { produce } from 'immer';
import type { LayoutTemplate } from '@/types';
import type { MutateFn } from './useLayoutBuilderHistory';

export function useLayoutBuilderZIndex({
  mutate,
  template,
}: {
  mutate: MutateFn;
  template: LayoutTemplate;
}) {
  const bringToFront = useCallback(
    (ids: string[]) =>
      mutate((d) => {
        const idSet = new Set(ids);
        const maxZ = Math.max(
          ...d.slots.map((s) => s.zIndex),
          ...d.overlays.map((o) => o.zIndex),
          0,
        );
        let nextZ = maxZ + 1;
        for (const slot of d.slots) {
          if (idSet.has(slot.id)) slot.zIndex = nextZ++;
        }
        for (const overlay of d.overlays) {
          if (idSet.has(overlay.id)) overlay.zIndex = nextZ++;
        }
      }, 'Bring to front'),
    [mutate],
  );

  const sendToBack = useCallback(
    (ids: string[]) =>
      mutate((d) => {
        const idSet = new Set(ids);
        const minZ = Math.min(
          ...d.slots.map((s) => s.zIndex),
          ...d.overlays.map((o) => o.zIndex),
          0,
        );
        let nextZ = minZ - ids.length;
        for (const slot of d.slots) {
          if (idSet.has(slot.id)) slot.zIndex = nextZ++;
        }
        for (const overlay of d.overlays) {
          if (idSet.has(overlay.id)) overlay.zIndex = nextZ++;
        }
        // Normalize so nothing goes below 1
        const lowestZ = Math.min(
          ...d.slots.map((s) => s.zIndex),
          ...d.overlays.map((o) => o.zIndex),
        );
        if (lowestZ < 1) {
          const offset = 1 - lowestZ;
          for (const slot of d.slots) slot.zIndex += offset;
          for (const overlay of d.overlays) overlay.zIndex += offset;
        }
      }, 'Send to back'),
    [mutate],
  );

  const bringForward = useCallback(
    (ids: string[]) =>
      mutate((d) => {
        const idSet = new Set(ids);
        type ZItem = { id: string; zIndex: number };
        const all: ZItem[] = [
          ...d.slots.map((s) => ({ id: s.id, zIndex: s.zIndex })),
          ...d.overlays.map((o) => ({ id: o.id, zIndex: o.zIndex })),
        ].sort((a, b) => a.zIndex - b.zIndex);

        // Precompute one O(1) lookup map to avoid repeated spread+find inside the loop
        const byId = new Map([...d.slots, ...d.overlays].map((x) => [x.id, x]));

        for (let i = all.length - 1; i >= 0; i--) {
          if (idSet.has(all[i]!.id)) {
            const above = all[i + 1];
            if (above && !idSet.has(above.id)) {
              const itemA = byId.get(all[i]!.id)!;
              const itemB = byId.get(above.id)!;
              const tmp = itemA.zIndex;
              itemA.zIndex = itemB.zIndex;
              itemB.zIndex = tmp;
            }
          }
        }
      }, 'Bring forward'),
    [mutate],
  );

  const sendBackward = useCallback(
    (ids: string[]) =>
      mutate((d) => {
        const idSet = new Set(ids);
        type ZItem = { id: string; zIndex: number };
        const all: ZItem[] = [
          ...d.slots.map((s) => ({ id: s.id, zIndex: s.zIndex })),
          ...d.overlays.map((o) => ({ id: o.id, zIndex: o.zIndex })),
        ].sort((a, b) => a.zIndex - b.zIndex);

        // Precompute one O(1) lookup map to avoid repeated spread+find inside the loop
        const byId = new Map([...d.slots, ...d.overlays].map((x) => [x.id, x]));

        for (let i = 0; i < all.length; i++) {
          if (idSet.has(all[i]!.id)) {
            const below = all[i - 1];
            if (below && !idSet.has(below.id)) {
              const itemA = byId.get(all[i]!.id)!;
              const itemB = byId.get(below.id)!;
              const tmp = itemA.zIndex;
              itemA.zIndex = itemB.zIndex;
              itemB.zIndex = tmp;
            }
          }
        }
      }, 'Send backward'),
    [mutate],
  );

  const normalizeZIndices = useCallback(
    (): LayoutTemplate => {
      // Produce the normalized template synchronously so the caller can use it
      // immediately (React state updates are async and would be read stale).
      const normalized = produce(template, (d) => {
        const sorted = [...d.slots].sort((a, b) => a.zIndex - b.zIndex);
        sorted.forEach((ref, i) => {
          const real = d.slots.find((s) => s.id === ref.id)!;
          real.zIndex = i + 1;
        });
      });
      // Also apply to React state for consistency (won't affect in-flight save).
      mutate((d) => {
        const sorted = [...d.slots].sort((a, b) => a.zIndex - b.zIndex);
        sorted.forEach((ref, i) => {
          const real = d.slots.find((s) => s.id === ref.id)!;
          real.zIndex = i + 1;
        });
      }, 'Normalize z-indices');
      return normalized;
    },
    [template, mutate],
  );

  return { bringToFront, sendToBack, bringForward, sendBackward, normalizeZIndices };
}
