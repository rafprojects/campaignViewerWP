import { useMemo, useState, type CSSProperties } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { MediaItem } from '@/types';

type DropPosition = 'before' | 'after';

export interface MediaDndState {
  sensors: ReturnType<typeof useSensors>;
  activeMediaId: string | null;
  overMediaId: string | null;
  activeMediaItem: MediaItem | null;
  getInsertionStyle: (itemId: string, axis: 'horizontal' | 'vertical') => CSSProperties | undefined;
  handleDndStart: (event: DragStartEvent) => void;
  handleDndOver: (event: DragOverEvent) => void;
  handleDndEnd: (event: DragEndEvent) => Promise<void>;
  moveByKeyboard: (itemId: string, direction: 'forward' | 'backward') => Promise<void>;
}

/** Encapsulates dnd-kit sensors, drag state, insertion indicators, and keyboard reorder. */
export function useMediaDnd(
  media: MediaItem[],
  onReorder: (nextMedia: MediaItem[]) => Promise<void>,
): MediaDndState {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [overMediaId, setOverMediaId] = useState<string | null>(null);

  const activeMediaItem = useMemo(
    () => (activeMediaId ? media.find((item) => item.id === activeMediaId) ?? null : null),
    [activeMediaId, media],
  );

  const getDropPosition = (activeId: string, overId: string): DropPosition => {
    const sourceIndex = media.findIndex((item) => item.id === activeId);
    const targetIndex = media.findIndex((item) => item.id === overId);
    return sourceIndex < targetIndex ? 'after' : 'before';
  };

  const getInsertionStyle = (itemId: string, axis: 'horizontal' | 'vertical'): CSSProperties | undefined => {
    if (!activeMediaId || !overMediaId || activeMediaId === overMediaId || itemId !== overMediaId) {
      return undefined;
    }
    const position = getDropPosition(activeMediaId, overMediaId);
    // --wpsg-color-primary is a gallery-side token; fall back to Mantine blue in the admin context.
    const c = 'var(--wpsg-color-primary, var(--mantine-color-blue-5))';
    const glow = `color-mix(in srgb, var(--wpsg-color-primary, var(--mantine-color-blue-5)) 40%, transparent)`;
    if (axis === 'horizontal') {
      return {
        boxShadow: position === 'before'
          ? `inset 4px 0 0 0 ${c}, 0 0 10px 2px ${glow}`
          : `inset -4px 0 0 0 ${c}, 0 0 10px 2px ${glow}`,
      };
    }
    return {
      boxShadow: position === 'before'
        ? `inset 0 4px 0 0 ${c}, 0 0 10px 2px ${glow}`
        : `inset 0 -4px 0 0 ${c}, 0 0 10px 2px ${glow}`,
    };
  };

  const handleDndStart = ({ active }: DragStartEvent) => {
    setActiveMediaId(String(active.id));
    setOverMediaId(String(active.id));
  };

  const handleDndOver = ({ over }: DragOverEvent) => {
    setOverMediaId(over ? String(over.id) : null);
  };

  const handleDndEnd = async ({ active, over }: DragEndEvent) => {
    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;
    setActiveMediaId(null);
    setOverMediaId(null);
    if (!overId || activeId === overId) return;
    const sourceIndex = media.findIndex((item) => item.id === activeId);
    const targetIndex = media.findIndex((item) => item.id === overId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const nextMedia = arrayMove(media, sourceIndex, targetIndex);
    await onReorder(nextMedia);
  };

  const moveByKeyboard = async (itemId: string, direction: 'forward' | 'backward') => {
    const sourceIndex = media.findIndex((item) => item.id === itemId);
    if (sourceIndex === -1) return;
    const targetIndex = direction === 'forward' ? sourceIndex + 1 : sourceIndex - 1;
    if (targetIndex < 0 || targetIndex >= media.length) return;
    const nextMedia = arrayMove(media, sourceIndex, targetIndex);
    await onReorder(nextMedia);
  };

  return { sensors, activeMediaId, overMediaId, activeMediaItem, getInsertionStyle, handleDndStart, handleDndOver, handleDndEnd, moveByKeyboard };
}
