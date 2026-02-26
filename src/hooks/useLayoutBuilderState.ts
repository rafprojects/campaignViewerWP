import { useState, useCallback, useRef, useEffect } from 'react';
import { produce, enableMapSet } from 'immer';
import type { LayoutTemplate, LayoutSlot, LayoutOverlay, MediaItem } from '@/types';
import { DEFAULT_LAYOUT_SLOT } from '@/types';
import { buildLayerList, computeReorderedZIndices } from '@/utils/layerList';

enableMapSet();

// ── Constants ────────────────────────────────────────────────

const MAX_HISTORY = 50;
const AUTOSAVE_INTERVAL_MS = 30_000;
const STORAGE_KEY_PREFIX = 'wpsg_layout_draft_';

// ── Helpers ──────────────────────────────────────────────────

/** Create a new empty template with sensible defaults. */
export function createEmptyTemplate(name = 'Untitled Layout'): LayoutTemplate {
  return {
    id: '',
    name,
    schemaVersion: 1,
    canvasAspectRatio: 16 / 9,
    canvasMinWidth: 320,
    canvasMaxWidth: 0,
    backgroundColor: '#1a1a2e',
    slots: [],
    overlays: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
  };
}

/** Generate a short unique ID for new slots. */
function generateSlotId(): string {
  return crypto.randomUUID?.() ?? `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Types ────────────────────────────────────────────────────

export interface LayoutBuilderState {
  /** Working copy of the template being edited. */
  template: LayoutTemplate;
  /** Currently selected slot IDs. */
  selectedSlotIds: Set<string>;
  /** Whether the template has unsaved changes vs the last saved version. */
  isDirty: boolean;
  /** Whether the builder is in preview mode (hides chrome, shows finalized). */
  isPreview: boolean;
}

export interface LayoutBuilderActions {
  // ── Template-level ──
  /** Replace the entire template (e.g., on load from API). */
  setTemplate: (template: LayoutTemplate) => void;
  /** Update template name. */
  setName: (name: string) => void;
  /** Update canvas aspect ratio. */
  setAspectRatio: (ratio: number) => void;
  /** Update canvas background color. */
  setBackgroundColor: (color: string) => void;

  // ── Slot CRUD ──
  /** Add a new slot with defaults. Returns the new slot's ID. */
  addSlot: () => string;
  /** Remove slot(s) by ID. */
  removeSlots: (ids: string[]) => void;
  /** Duplicate selected slot(s) with a slight offset. */
  duplicateSlots: (ids: string[]) => void;

  // ── Slot mutation ──
  /** Move a slot to a new position. */
  moveSlot: (id: string, x: number, y: number) => void;
  /** Resize a slot. */
  resizeSlot: (id: string, x: number, y: number, width: number, height: number) => void;
  /** Update arbitrary slot properties. */
  updateSlot: (id: string, updates: Partial<LayoutSlot>) => void;
  /** Nudge selected slots by a delta (arrow key). */
  nudgeSlots: (ids: string[], dx: number, dy: number) => void;
  /** Assign a specific media item to a slot (with optional cross-campaign metadata). */
  assignMediaToSlot: (slotId: string, mediaId: string, meta?: { attachmentId?: number; url?: string }) => void;
  /** Clear fixed media assignment for a slot. */
  clearSlotMedia: (slotId: string) => void;
  /** Auto-assign media to all slots by order (sets mediaId + cross-campaign metadata). */
  autoAssignMedia: (mediaIds: string[], mediaItems?: MediaItem[]) => void;

  // ── Z-Index reorder (P15-G) ──
  /** Move slot(s) to the top z-index. */
  bringToFront: (ids: string[]) => void;
  /** Move slot(s) to the bottom z-index. */
  sendToBack: (ids: string[]) => void;
  /** Increase z-index by 1 (swap with the slot above). */
  bringForward: (ids: string[]) => void;
  /** Decrease z-index by 1 (swap with the slot below). */
  sendBackward: (ids: string[]) => void;
  /** Normalize z-indices to sequential 1..N (no gaps). Returns the normalized template synchronously. */
  normalizeZIndices: () => LayoutTemplate;
  /** Update canvas background image URL ('' = none). */
  setBackgroundImage: (url: string) => void;
  /** Update background image fit mode. */
  setBackgroundImageFit: (fit: 'cover' | 'contain' | 'fill') => void;
  /** Update background image opacity. */
  setBackgroundImageOpacity: (opacity: number) => void;

  // ── Overlay CRUD (P15-H) ──
  /** Add a new overlay. Returns the overlay's ID. */
  addOverlay: (imageUrl: string) => string;
  /** Remove an overlay by ID. */
  removeOverlay: (id: string) => void;
  /** Update arbitrary overlay properties. */
  updateOverlay: (id: string, updates: Partial<LayoutOverlay>) => void;
  /** Move an overlay to a new position. */
  moveOverlay: (id: string, x: number, y: number) => void;
  /** Resize an overlay. */
  resizeOverlay: (id: string, x: number, y: number, width: number, height: number) => void;

  // ── Layer system (P16) ──
  /** Rename a slot (persists in template data). */
  renameSlot: (id: string, name: string) => void;
  /** Rename an overlay. */
  renameOverlay: (id: string, name: string) => void;
  /** Toggle builder-only visibility on a slot (visible: false = ghost in editor). */
  toggleSlotVisible: (id: string) => void;
  /** Toggle builder-only visibility on an overlay. */
  toggleOverlayVisible: (id: string) => void;
  /** Toggle drag/resize lock on a slot. */
  toggleSlotLocked: (id: string) => void;
  /** Toggle drag/resize lock on an overlay. */
  toggleOverlayLocked: (id: string) => void;
  /**
   * Cross-type layer reorder: moves `draggedId` above `targetId` in the
   * unified z-index stack. Uses `computeReorderedZIndices()` from layerList.ts.
   */
  reorderLayers: (draggedId: string, targetId: string) => void;

  // ── Selection ──
  /** Select a single slot (replaces selection). */
  selectSlot: (id: string) => void;
  /** Toggle a slot in the selection (Shift+click). */
  toggleSlotSelection: (id: string) => void;
  /** Clear selection. */
  clearSelection: () => void;

  // ── History ──
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // ── Preview ──
  togglePreview: () => void;

  // ── Persistence ──
  /** Mark the current state as saved (clears dirty flag). */
  markSaved: () => void;
}

export type UseLayoutBuilderReturn = LayoutBuilderState & LayoutBuilderActions;

// ── Hook ─────────────────────────────────────────────────────

export function useLayoutBuilderState(
  initialTemplate?: LayoutTemplate,
): UseLayoutBuilderReturn {
  const [template, setTemplateRaw] = useState<LayoutTemplate>(
    () => initialTemplate ?? createEmptyTemplate(),
  );
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  // ── History stack ──
  const [history, setHistory] = useState<LayoutTemplate[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  /** Push the current template onto the undo stack before a mutation. */
  const pushHistory = useCallback(() => {
    setHistory((prev) => {
      // Trim any redo entries after current index
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, template];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [template, historyIndex]);

  /** Apply a template mutation via Immer, pushing history first. */
  const mutate = useCallback(
    (recipe: (draft: LayoutTemplate) => void) => {
      pushHistory();
      setTemplateRaw((prev) => produce(prev, recipe));
      setIsDirty(true);
    },
    [pushHistory],
  );

  // ── Template-level actions ──

  const setTemplate = useCallback((t: LayoutTemplate) => {
    setTemplateRaw(t);
    setHistory([]);
    setHistoryIndex(-1);
    setIsDirty(false);
    setSelectedSlotIds(new Set());
  }, []);

  const setName = useCallback(
    (name: string) => mutate((d) => { d.name = name; }),
    [mutate],
  );

  const setAspectRatio = useCallback(
    (ratio: number) => mutate((d) => { d.canvasAspectRatio = ratio; }),
    [mutate],
  );

  const setBackgroundColor = useCallback(
    (color: string) => mutate((d) => { d.backgroundColor = color; }),
    [mutate],
  );

  const setBackgroundImage = useCallback(
    (url: string) => mutate((d) => { d.backgroundImage = url || undefined; }),
    [mutate],
  );

  const setBackgroundImageFit = useCallback(
    (fit: 'cover' | 'contain' | 'fill') => mutate((d) => { d.backgroundImageFit = fit; }),
    [mutate],
  );

  const setBackgroundImageOpacity = useCallback(
    (opacity: number) => mutate((d) => { d.backgroundImageOpacity = opacity; }),
    [mutate],
  );

  // ── Slot CRUD ──

  const addSlot = useCallback((): string => {
    const newId = generateSlotId();
    mutate((d) => {
      const slotCount = d.slots.length;
      // Stagger new slots so they don't stack on top of each other
      const offsetX = (slotCount * 5) % 75;
      const offsetY = (slotCount * 5) % 75;
      d.slots.push({
        ...DEFAULT_LAYOUT_SLOT,
        id: newId,
        x: offsetX,
        y: offsetY,
        zIndex: slotCount + 1,
      });
    });
    setSelectedSlotIds(new Set([newId]));
    return newId;
  }, [mutate]);

  const removeSlots = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      mutate((d) => {
        d.slots = d.slots.filter((s) => !idSet.has(s.id));
      });
      setSelectedSlotIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    },
    [mutate],
  );

  const duplicateSlots = useCallback(
    (ids: string[]) => {
      const newIds: string[] = [];
      mutate((d) => {
        for (const id of ids) {
          const source = d.slots.find((s) => s.id === id);
          if (!source) continue;
          const newId = generateSlotId();
          newIds.push(newId);
          d.slots.push({
            ...source,
            id: newId,
            x: Math.min(source.x + 3, 100 - source.width),
            y: Math.min(source.y + 3, 100 - source.height),
            zIndex: d.slots.length + 1,
          });
        }
      });
      if (newIds.length > 0) {
        setSelectedSlotIds(new Set(newIds));
      }
    },
    [mutate],
  );

  // ── Slot mutation ──

  const moveSlot = useCallback(
    (id: string, x: number, y: number) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === id);
        if (slot) { slot.x = x; slot.y = y; }
      }),
    [mutate],
  );

  const resizeSlot = useCallback(
    (id: string, x: number, y: number, width: number, height: number) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === id);
        if (slot) {
          slot.x = x;
          slot.y = y;
          slot.width = width;
          slot.height = height;
        }
      }),
    [mutate],
  );

  const updateSlot = useCallback(
    (id: string, updates: Partial<LayoutSlot>) =>
      mutate((d) => {
        const idx = d.slots.findIndex((s) => s.id === id);
        if (idx !== -1) {
          Object.assign(d.slots[idx], updates);
        }
      }),
    [mutate],
  );

  const nudgeSlots = useCallback(
    (ids: string[], dx: number, dy: number) =>
      mutate((d) => {
        const idSet = new Set(ids);
        for (const slot of d.slots) {
          if (idSet.has(slot.id)) {
            slot.x = Math.max(0, Math.min(100 - slot.width, slot.x + dx));
            slot.y = Math.max(0, Math.min(100 - slot.height, slot.y + dy));
          }
        }
      }),
    [mutate],
  );

  const assignMediaToSlot = useCallback(
    (slotId: string, mediaId: string, meta?: { attachmentId?: number; url?: string }) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === slotId);
        if (slot) {
          slot.mediaId = mediaId;
          slot.mediaAttachmentId = meta?.attachmentId;
          slot.mediaUrl = meta?.url;
        }
      }),
    [mutate],
  );

  const clearSlotMedia = useCallback(
    (slotId: string) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === slotId);
        if (slot) {
          slot.mediaId = undefined;
          slot.mediaAttachmentId = undefined;
          slot.mediaUrl = undefined;
        }
      }),
    [mutate],
  );

  const autoAssignMedia = useCallback(
    (mediaIds: string[], mediaItems?: MediaItem[]) =>
      mutate((d) => {
        for (let i = 0; i < d.slots.length; i++) {
          if (i < mediaIds.length) {
            d.slots[i].mediaId = mediaIds[i];
            const item = mediaItems?.find((m) => m.id === mediaIds[i]);
            d.slots[i].mediaAttachmentId = item?.attachmentId;
            d.slots[i].mediaUrl = item?.url;
          } else {
            d.slots[i].mediaId = undefined;
            d.slots[i].mediaAttachmentId = undefined;
            d.slots[i].mediaUrl = undefined;
          }
        }
      }),
    [mutate],
  );

  // ── Z-Index reorder (P15-G) ───────────────────────────────

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
      }),
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
      }),
    [mutate],
  );

  const bringForward = useCallback(
    (ids: string[]) =>
      mutate((d) => {
        const idSet = new Set(ids);
        // Merge slots + overlays, sort by zIndex ascending, swap target with item above
        type ZItem = { id: string; zIndex: number };
        const all: ZItem[] = [
          ...d.slots.map((s) => ({ id: s.id, zIndex: s.zIndex })),
          ...d.overlays.map((o) => ({ id: o.id, zIndex: o.zIndex })),
        ].sort((a, b) => a.zIndex - b.zIndex);

        for (let i = all.length - 1; i >= 0; i--) {
          if (idSet.has(all[i].id)) {
            const above = all[i + 1];
            if (above && !idSet.has(above.id)) {
              const itemA = [...d.slots, ...d.overlays].find((x) => x.id === all[i].id)!;
              const itemB = [...d.slots, ...d.overlays].find((x) => x.id === above.id)!;
              const tmp = itemA.zIndex;
              itemA.zIndex = itemB.zIndex;
              itemB.zIndex = tmp;
            }
          }
        }
      }),
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

        for (let i = 0; i < all.length; i++) {
          if (idSet.has(all[i].id)) {
            const below = all[i - 1];
            if (below && !idSet.has(below.id)) {
              const itemA = [...d.slots, ...d.overlays].find((x) => x.id === all[i].id)!;
              const itemB = [...d.slots, ...d.overlays].find((x) => x.id === below.id)!;
              const tmp = itemA.zIndex;
              itemA.zIndex = itemB.zIndex;
              itemB.zIndex = tmp;
            }
          }
        }
      }),
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
      });
      return normalized;
    },
    [template, mutate],
  );

  // ── Overlay CRUD (P15-H) ──────────────────────────────────

  const addOverlay = useCallback(
    (imageUrl: string): string => {
      const newId = crypto.randomUUID?.() ?? `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      mutate((d) => {
        const maxZ = Math.max(
          ...d.slots.map((s) => s.zIndex),
          ...d.overlays.map((o) => o.zIndex),
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
      });
      return newId;
    },
    [mutate],
  );

  const removeOverlay = useCallback(
    (id: string) =>
      mutate((d) => {
        d.overlays = d.overlays.filter((o) => o.id !== id);
      }),
    [mutate],
  );

  const updateOverlay = useCallback(
    (id: string, updates: Partial<LayoutOverlay>) =>
      mutate((d) => {
        const idx = d.overlays.findIndex((o) => o.id === id);
        if (idx !== -1) Object.assign(d.overlays[idx], updates);
      }),
    [mutate],
  );

  const moveOverlay = useCallback(
    (id: string, x: number, y: number) =>
      mutate((d) => {
        const o = d.overlays.find((ov) => ov.id === id);
        if (o) { o.x = x; o.y = y; }
      }),
    [mutate],
  );

  const resizeOverlay = useCallback(
    (id: string, x: number, y: number, width: number, height: number) =>
      mutate((d) => {
        const o = d.overlays.find((ov) => ov.id === id);
        if (o) { o.x = x; o.y = y; o.width = width; o.height = height; }
      }),
    [mutate],
  );

  // ── Layer system (P16) ─────────────────────────────────────────────────────

  const renameSlot = useCallback(
    (id: string, name: string) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === id);
        if (slot) slot.name = name;
      }),
    [mutate],
  );

  const renameOverlay = useCallback(
    (id: string, name: string) =>
      mutate((d) => {
        const overlay = d.overlays.find((o) => o.id === id);
        if (overlay) overlay.name = name;
      }),
    [mutate],
  );

  const toggleSlotVisible = useCallback(
    (id: string) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === id);
        if (slot) slot.visible = !(slot.visible ?? true);
      }),
    [mutate],
  );

  const toggleOverlayVisible = useCallback(
    (id: string) =>
      mutate((d) => {
        const overlay = d.overlays.find((o) => o.id === id);
        if (overlay) overlay.visible = !(overlay.visible ?? true);
      }),
    [mutate],
  );

  const toggleSlotLocked = useCallback(
    (id: string) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === id);
        if (slot) slot.locked = !(slot.locked ?? false);
      }),
    [mutate],
  );

  const toggleOverlayLocked = useCallback(
    (id: string) =>
      mutate((d) => {
        const overlay = d.overlays.find((o) => o.id === id);
        if (overlay) overlay.locked = !(overlay.locked ?? false);
      }),
    [mutate],
  );

  const reorderLayers = useCallback(
    (draggedId: string, targetId: string) =>
      mutate((d) => {
        const layers = buildLayerList(d as LayoutTemplate);
        const newZMap = computeReorderedZIndices(layers, draggedId, targetId);
        for (const slot of d.slots) {
          const z = newZMap.get(slot.id);
          if (z !== undefined) slot.zIndex = z;
        }
        for (const overlay of d.overlays) {
          const z = newZMap.get(overlay.id);
          if (z !== undefined) overlay.zIndex = z;
        }
      }),
    [mutate],
  );

  // ── Selection ──

  const selectSlot = useCallback(
    (id: string) => setSelectedSlotIds(new Set([id])),
    [],
  );

  const toggleSlotSelection = useCallback(
    (id: string) =>
      setSelectedSlotIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  const clearSelection = useCallback(
    () => setSelectedSlotIds(new Set()),
    [],
  );

  // ── History ──

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    // Save current state as a redo point if we're at the tip
    if (historyIndex === history.length - 1) {
      setHistory((prev) => [...prev, template]);
    }
    setTemplateRaw(history[historyIndex]);
    setHistoryIndex((prev) => prev - 1);
    setIsDirty(true);
  }, [canUndo, history, historyIndex, template]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const nextIdx = historyIndex + 1;
    // The redo state is at nextIdx + 1 because we pushed current when undoing
    const redoState = history[nextIdx + 1] ?? history[nextIdx];
    if (redoState) {
      setTemplateRaw(redoState);
      setHistoryIndex(nextIdx);
      setIsDirty(true);
    }
  }, [canRedo, history, historyIndex]);

  // ── Preview ──

  const togglePreview = useCallback(() => setIsPreview((p) => !p), []);

  // ── Persistence helpers ──

  const markSaved = useCallback(() => setIsDirty(false), []);

  // ── Autosave to localStorage ──
  const templateRef = useRef(template);
  templateRef.current = template;

  useEffect(() => {
    if (!template.id) return; // Don't autosave unsaved templates
    const key = STORAGE_KEY_PREFIX + template.id;
    const interval = setInterval(() => {
      try {
        localStorage.setItem(key, JSON.stringify(templateRef.current));
      } catch {
        // localStorage full or unavailable — silently skip
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [template.id]);

  return {
    // State
    template,
    selectedSlotIds,
    isDirty,
    isPreview,
    // Template-level
    setTemplate,
    setName,
    setAspectRatio,
    setBackgroundColor,
    setBackgroundImage,
    setBackgroundImageFit,
    setBackgroundImageOpacity,
    // Slot CRUD
    addSlot,
    removeSlots,
    duplicateSlots,
    // Slot mutation
    moveSlot,
    resizeSlot,
    updateSlot,
    nudgeSlots,
    assignMediaToSlot,
    clearSlotMedia,
    autoAssignMedia,
    // Z-Index reorder
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    normalizeZIndices,
    // Overlay CRUD
    addOverlay,
    removeOverlay,
    updateOverlay,
    moveOverlay,
    resizeOverlay,
    // Layer system (P16)
    renameSlot,
    renameOverlay,
    toggleSlotVisible,
    toggleOverlayVisible,
    toggleSlotLocked,
    toggleOverlayLocked,
    reorderLayers,
    // Selection
    selectSlot,
    toggleSlotSelection,
    clearSelection,
    // History
    undo,
    redo,
    canUndo,
    canRedo,
    // Preview
    togglePreview,
    // Persistence
    markSaved,
  };
}
