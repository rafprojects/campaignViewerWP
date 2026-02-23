import { useState, useCallback, useRef, useEffect } from 'react';
import { produce, enableMapSet } from 'immer';
import type { LayoutTemplate, LayoutSlot, LayoutOverlay } from '@/types';
import { DEFAULT_LAYOUT_SLOT } from '@/types';

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
  /** Assign a specific media item to a slot. */
  assignMediaToSlot: (slotId: string, mediaId: string) => void;
  /** Clear fixed media assignment for a slot. */
  clearSlotMedia: (slotId: string) => void;
  /** Auto-assign media to all slots by order (sets mediaId). */
  autoAssignMedia: (mediaIds: string[]) => void;

  // ── Z-Index reorder (P15-G) ──
  /** Move slot(s) to the top z-index. */
  bringToFront: (ids: string[]) => void;
  /** Move slot(s) to the bottom z-index. */
  sendToBack: (ids: string[]) => void;
  /** Increase z-index by 1 (swap with the slot above). */
  bringForward: (ids: string[]) => void;
  /** Decrease z-index by 1 (swap with the slot below). */
  sendBackward: (ids: string[]) => void;
  /** Normalize z-indices to sequential 1..N (no gaps). */
  normalizeZIndices: () => void;

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
    (slotId: string, mediaId: string) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === slotId);
        if (slot) slot.mediaId = mediaId;
      }),
    [mutate],
  );

  const clearSlotMedia = useCallback(
    (slotId: string) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === slotId);
        if (slot) slot.mediaId = undefined;
      }),
    [mutate],
  );

  const autoAssignMedia = useCallback(
    (mediaIds: string[]) =>
      mutate((d) => {
        for (let i = 0; i < d.slots.length; i++) {
          d.slots[i].mediaId = i < mediaIds.length ? mediaIds[i] : undefined;
        }
      }),
    [mutate],
  );

  // ── Z-Index reorder (P15-G) ───────────────────────────────

  const bringToFront = useCallback(
    (ids: string[]) =>
      mutate((d) => {
        const idSet = new Set(ids);
        const maxZ = Math.max(...d.slots.map((s) => s.zIndex), 0);
        let nextZ = maxZ + 1;
        for (const slot of d.slots) {
          if (idSet.has(slot.id)) {
            slot.zIndex = nextZ++;
          }
        }
      }),
    [mutate],
  );

  const sendToBack = useCallback(
    (ids: string[]) =>
      mutate((d) => {
        const idSet = new Set(ids);
        const minZ = Math.min(...d.slots.map((s) => s.zIndex), 0);
        let nextZ = minZ - ids.length;
        for (const slot of d.slots) {
          if (idSet.has(slot.id)) {
            slot.zIndex = nextZ++;
          }
        }
        // Normalize so nothing goes below 0
        const lowestZ = Math.min(...d.slots.map((s) => s.zIndex));
        if (lowestZ < 0) {
          const offset = -lowestZ;
          for (const slot of d.slots) slot.zIndex += offset;
        }
      }),
    [mutate],
  );

  const bringForward = useCallback(
    (ids: string[]) =>
      mutate((d) => {
        const idSet = new Set(ids);
        // Sort slots by zIndex ascending, swap each target with the one above
        const sorted = [...d.slots].sort((a, b) => a.zIndex - b.zIndex);
        for (let i = sorted.length - 1; i >= 0; i--) {
          if (idSet.has(sorted[i].id)) {
            // Find the next slot above not in selected set
            const above = sorted[i + 1];
            if (above && !idSet.has(above.id)) {
              const real = d.slots.find((s) => s.id === sorted[i].id)!;
              const realAbove = d.slots.find((s) => s.id === above.id)!;
              const tmp = real.zIndex;
              real.zIndex = realAbove.zIndex;
              realAbove.zIndex = tmp;
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
        // Sort slots by zIndex ascending, swap each target with the one below
        const sorted = [...d.slots].sort((a, b) => a.zIndex - b.zIndex);
        for (let i = 0; i < sorted.length; i++) {
          if (idSet.has(sorted[i].id)) {
            const below = sorted[i - 1];
            if (below && !idSet.has(below.id)) {
              const real = d.slots.find((s) => s.id === sorted[i].id)!;
              const realBelow = d.slots.find((s) => s.id === below.id)!;
              const tmp = real.zIndex;
              real.zIndex = realBelow.zIndex;
              realBelow.zIndex = tmp;
            }
          }
        }
      }),
    [mutate],
  );

  const normalizeZIndices = useCallback(
    () =>
      mutate((d) => {
        const sorted = [...d.slots].sort((a, b) => a.zIndex - b.zIndex);
        sorted.forEach((ref, i) => {
          const real = d.slots.find((s) => s.id === ref.id)!;
          real.zIndex = i + 1;
        });
      }),
    [mutate],
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
