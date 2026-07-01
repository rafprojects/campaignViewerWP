import { useCallback } from 'react';
import type { LayoutTextLayer } from '@/types';
import { DEFAULT_TEXT_LAYER } from '@/types';
import type { MutateFn } from './useLayoutBuilderHistory';

/**
 * P59-A: Text-layer CRUD sub-hook.
 *
 * Mirrors {@link useLayoutBuilderOverlays}: every mutation flows through the
 * shared Immer `mutate()` so text edits participate in undo/redo, the dirty
 * flag, and autosave. `template.texts` is optional (absent on pre-v3
 * templates), so writes lazily initialise it and reads tolerate `undefined`.
 */
export function useLayoutBuilderText({ mutate }: { mutate: MutateFn }) {
  const addText = useCallback(
    (): string => {
      const newId = crypto.randomUUID?.() ?? `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      mutate((d) => {
        if (!d.texts) d.texts = [];
        const maxZ = Math.max(
          ...d.slots.map((s) => s.zIndex),
          ...d.overlays.map((o) => o.zIndex),
          ...d.texts.map((t) => t.zIndex),
          0,
        );
        d.texts.push({
          ...DEFAULT_TEXT_LAYER,
          id: newId,
          zIndex: maxZ + 100, // Text sits above slots by default, like overlays
        });
      }, 'Add text');
      return newId;
    },
    [mutate],
  );

  const removeText = useCallback(
    (id: string) =>
      mutate((d) => {
        if (!d.texts) return;
        d.texts = d.texts.filter((t) => t.id !== id);
      }, 'Remove text'),
    [mutate],
  );

  const updateText = useCallback(
    (id: string, updates: Partial<LayoutTextLayer>) =>
      mutate((d) => {
        const idx = d.texts?.findIndex((t) => t.id === id) ?? -1;
        if (idx !== -1) Object.assign(d.texts![idx]!, updates);
      }, 'Update text'),
    [mutate],
  );

  const moveText = useCallback(
    (id: string, x: number, y: number) =>
      mutate((d) => {
        const t = d.texts?.find((tx) => tx.id === id);
        if (t) { t.x = x; t.y = y; }
      }, 'Move text'),
    [mutate],
  );

  const resizeText = useCallback(
    (id: string, x: number, y: number, width: number, height: number) =>
      mutate((d) => {
        const t = d.texts?.find((tx) => tx.id === id);
        if (t) { t.x = x; t.y = y; t.width = width; t.height = height; }
      }, 'Resize text'),
    [mutate],
  );

  const renameText = useCallback(
    (id: string, name: string) =>
      mutate((d) => {
        const t = d.texts?.find((tx) => tx.id === id);
        if (t) t.name = name;
      }, 'Rename text'),
    [mutate],
  );

  const toggleTextVisible = useCallback(
    (id: string) =>
      mutate((d) => {
        const t = d.texts?.find((tx) => tx.id === id);
        if (t) t.visible = !(t.visible ?? true);
      }, 'Toggle text visibility'),
    [mutate],
  );

  const toggleTextLocked = useCallback(
    (id: string) =>
      mutate((d) => {
        const t = d.texts?.find((tx) => tx.id === id);
        if (t) t.locked = !t.locked;
      }, 'Toggle text lock'),
    [mutate],
  );

  return {
    addText, removeText, updateText, moveText, resizeText,
    renameText, toggleTextVisible, toggleTextLocked,
  };
}
