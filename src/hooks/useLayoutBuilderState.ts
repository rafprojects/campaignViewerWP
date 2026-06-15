import { useState, useCallback, useEffect, useMemo } from 'react';
import { produce, enableMapSet } from 'immer';
import type { LayoutTemplate, LayoutSlot, LayoutGraphicLayer, LayoutGroup, MediaItem } from '@/types';
import { DEFAULT_LAYOUT_SLOT } from '@/types';
import { buildLayerList, computeReorderedZIndices } from '@/utils/layerList';
import {
  buildGroupMap,
  collectDescendantSlotIds,
  migrateGroupsToP30G,
  refreshGroupRects,
  reparentGroup as reparentGroupInHierarchy,
  dissolveGroupInHierarchy,
  computeGroupMoveDelta,
} from '@wp-super-gallery/shared-utils';

enableMapSet();

// ── Constants ────────────────────────────────────────────────

const MAX_HISTORY = 50;
const STORAGE_KEY_PREFIX = 'wpsg_layout_draft_';

/**
 * P36-A: Autosave payload wrapper. The `savedAt` timestamp is set at each
 * autosave tick (not the template's `updatedAt`, which only changes on server
 * save). `serverUpdatedAt` captures the server's `updatedAt` at save time so
 * the restore prompt can detect a server-side conflict.
 */
export interface LayoutDraftPayload {
  /** Unix ms timestamp of the last local autosave. */
  savedAt: number;
  /** `template.updatedAt` at the time of this autosave — used to detect server conflicts. */
  serverUpdatedAt: string;
  /** `template.schemaVersion` at the time of this autosave. */
  schemaVersion: number;
  template: LayoutTemplate;
}

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

// ── History entry ──────────────────────────────────────────

export interface HistoryEntry {
  /** Unique key for React lists. */
  id: string;
  /** Human-readable label, e.g. "Move slot", "Add layer". */
  label: string;
  /** Epoch ms — display only. */
  timestamp: number;
}

/** Internal past/future stack item — not part of the public API. */
interface HistoryItem {
  /** Template snapshot captured BEFORE the named mutation was applied. */
  snapshot: LayoutTemplate;
  entry: HistoryEntry;
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
  /** Replace the entire template (e.g., on load from API). Pass `{ preserveSelection: true }` after save. */
  setTemplate: (template: LayoutTemplate, opts?: { preserveSelection?: boolean }) => void;
  /** Update template name. */
  setName: (name: string) => void;
  /** Update canvas aspect ratio. */
  setAspectRatio: (ratio: number) => void;
  /** Update canvas background color. */
  setBackgroundColor: (color: string) => void;
  /** Change background mode (none, color, gradient, image). */
  setBackgroundMode: (mode: LayoutTemplate['backgroundMode']) => void;
  /** Set gradient direction preset. */
  setBackgroundGradientDirection: (dir: LayoutTemplate['backgroundGradientDirection']) => void;
  /** Set gradient color stops (2–3 entries). */
  setBackgroundGradientStops: (stops: LayoutTemplate['backgroundGradientStops']) => void;
  /** Set gradient type (linear, radial, conic). */
  setBackgroundGradientType: (t: LayoutTemplate['backgroundGradientType']) => void;
  /** Set custom gradient angle in degrees. */
  setBackgroundGradientAngle: (a: number | undefined) => void;
  /** Set radial shape (circle/ellipse). */
  setBackgroundRadialShape: (s: LayoutTemplate['backgroundRadialShape']) => void;
  /** Set radial size keyword. */
  setBackgroundRadialSize: (s: LayoutTemplate['backgroundRadialSize']) => void;
  /** Set radial/conic center X %. */
  setBackgroundGradientCenterX: (x: number) => void;
  /** Set radial/conic center Y %. */
  setBackgroundGradientCenterY: (y: number) => void;

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
  /** Update multiple slots in one history entry. */
  updateSlots: (updatesById: Record<string, Partial<LayoutSlot>>, label?: string) => void;
  /** Nudge selected slots by a delta (arrow key). */
  nudgeSlots: (ids: string[], dx: number, dy: number) => void;
  /** Assign a specific media item to a slot (with optional cross-campaign metadata). */
  assignMediaToSlot: (slotId: string, mediaId: string, meta?: { attachmentId?: number | undefined; url?: string | undefined }) => void;
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
  /** Set canvas height mode (aspect-ratio or fixed-vh). */
  setCanvasHeightMode: (mode: 'aspect-ratio' | 'fixed-vh') => void;
  /** Set canvas height in viewport units (1–100). */
  setCanvasHeightVh: (vh: number) => void;

  // ── Overlay CRUD (P15-H) ──
  /** Add a new overlay. Returns the overlay's ID. */
  addOverlay: (imageUrl: string) => string;
  /** Remove an overlay by ID. */
  removeOverlay: (id: string) => void;
  /** Update arbitrary overlay properties. */
  updateOverlay: (id: string, updates: Partial<LayoutGraphicLayer>) => void;
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
  /** Toggle a slot in the selection (Ctrl/Cmd+click). */
  toggleSlotSelection: (id: string) => void;
  /** Replace selection with the given set of slot IDs (Shift+click range). */
  selectSlotsInRange: (ids: string[]) => void;
  /** Clear selection. */
  clearSelection: () => void;

  // ── History ──
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Human-readable history entries (most-recent-last). */
  historyEntries: HistoryEntry[];
  /** Current position in the history stack (-1 = no history yet / initial state). */
  historyCurrentIndex: number;
  /** Jump directly to any entry in one synchronous state transition. target -1 = initial state. */
  jumpToHistoryIndex: (target: number) => void;
  /** True once the history stack has been trimmed (oldest snapshot is no longer the initial one). */
  isHistoryTrimmed: boolean;

  // ── Preview ──
  togglePreview: () => void;

  // ── Persistence ──
  /** Mark the current state as saved (clears dirty flag). */
  markSaved: () => void;
  /** Delete the autosaved draft for the current template from localStorage. */
  clearDraft: () => void;

  // ── Groups (P30-G: nested hierarchy) ──
  /**
   * Create a group from the given slot/overlay IDs. If any ID is already a
   * member of another group, it is removed from that group first.
   * Returns the new group ID.
   */
  createGroup: (memberIds: string[]) => string;
  /**
   * Wrap a mix of slot IDs and/or group IDs in a new parent group.
   * Any selected group becomes a childGroup of the new parent; selected
   * standalone slots become leaf members of the new parent.
   * Returns the new group ID.
   */
  wrapInGroup: (slotAndGroupIds: string[]) => string;
  /** Dissolve a group, promoting its child groups to its parent (or top-level). */
  dissolveGroup: (groupId: string) => void;
  /** Update group properties (name, locked, visible, collapsed, etc.). */
  updateGroup: (groupId: string, updates: Partial<LayoutGroup>) => void;
  /** Select a group: replaces selectedSlotIds with all descendant slot member IDs. */
  selectGroup: (groupId: string) => void;
  /**
   * Move a group (and all its descendants) by a canvas-percentage delta.
   * Applies the delta to every descendant slot position and refreshes the
   * group bounding-box cache.
   */
  moveGroup: (groupId: string, dx: number, dy: number) => void;
  /**
   * Reparent a group under a new parent (or null to make it top-level).
   * Rejects silently if the reparent would create a cycle.
   */
  reparentGroup: (groupId: string, newParentId: string | null) => void;
  /**
   * Migrate a flat P29-G-C template's groups to the P30-G hierarchical model.
   * Called automatically when opening a template; also callable manually for
   * testing. No-op if the groups are already in P30-G format.
   */
  migrateGroupsIfNeeded: () => void;
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

  // ── History stack (past / future model) ──
  // past[i] = { snapshot: template BEFORE mutation i, entry: label for mutation i }
  // future[0] = most-recently-undone item (restored on redo)
  const [past, setPast] = useState<HistoryItem[]>([]);
  const [future, setFuture] = useState<HistoryItem[]>([]);
  // Tracks whether any push has ever caused a trim; once true, past[0] is no
  // longer the snapshot before the very first mutation.
  const [historyTrimmed, setHistoryTrimmed] = useState(false);

  /** Save current template to the undo stack before applying a mutation. */
  const pushHistory = useCallback((label: string) => {
    const entry: HistoryEntry = {
      id: crypto.randomUUID?.() ?? `h-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      label,
      timestamp: Date.now(),
    };
    if (!historyTrimmed && past.length >= MAX_HISTORY) {
      setHistoryTrimmed(true);
    }
    setPast((prev) => {
      const next = [...prev, { snapshot: template, entry }];
      return next.length > MAX_HISTORY ? next.slice(1) : next;
    });
    setFuture([]); // new mutation always clears the redo stack
  }, [template, past, historyTrimmed]);

  /** Apply a template mutation via Immer, pushing history first. */
  const mutate = useCallback(
    (recipe: (draft: LayoutTemplate) => void, label = 'Edit') => {
      pushHistory(label);
      setTemplateRaw((prev) => produce(prev, recipe));
      setIsDirty(true);
    },
    [pushHistory],
  );

  // ── Template-level actions ──

  const setTemplate = useCallback((t: LayoutTemplate, opts?: { preserveSelection?: boolean }) => {
    setTemplateRaw(t);
    setPast([]);
    setFuture([]);
    setHistoryTrimmed(false);
    setIsDirty(false);
    if (!opts?.preserveSelection) {
      setSelectedSlotIds(new Set());
    }
  }, []);

  const setName = useCallback(
    (name: string) => mutate((d) => { d.name = name; }, 'Rename template'),
    [mutate],
  );

  const setAspectRatio = useCallback(
    (ratio: number) => mutate((d) => { d.canvasAspectRatio = ratio; }, 'Change aspect ratio'),
    [mutate],
  );

  const setBackgroundColor = useCallback(
    (color: string) => mutate((d) => { d.backgroundColor = color; }, 'Change background color'),
    [mutate],
  );

  const setBackgroundMode = useCallback(
    (mode: LayoutTemplate['backgroundMode']) => mutate((d) => { d.backgroundMode = mode; }, 'Change background mode'),
    [mutate],
  );

  const setBackgroundGradientDirection = useCallback(
    (dir: LayoutTemplate['backgroundGradientDirection']) =>
      mutate((d) => { d.backgroundGradientDirection = dir; }, 'Change gradient direction'),
    [mutate],
  );

  const setBackgroundGradientStops = useCallback(
    (stops: LayoutTemplate['backgroundGradientStops']) =>
      mutate((d) => { d.backgroundGradientStops = stops; }, 'Change gradient stops'),
    [mutate],
  );

  const setBackgroundGradientType = useCallback(
    (t: LayoutTemplate['backgroundGradientType']) =>
      mutate((d) => { d.backgroundGradientType = t; }, 'Change gradient type'),
    [mutate],
  );

  const setBackgroundGradientAngle = useCallback(
    (a: number | undefined) =>
      mutate((d) => { d.backgroundGradientAngle = a; }, 'Change gradient angle'),
    [mutate],
  );

  const setBackgroundRadialShape = useCallback(
    (s: LayoutTemplate['backgroundRadialShape']) =>
      mutate((d) => { d.backgroundRadialShape = s; }, 'Change radial shape'),
    [mutate],
  );

  const setBackgroundRadialSize = useCallback(
    (s: LayoutTemplate['backgroundRadialSize']) =>
      mutate((d) => { d.backgroundRadialSize = s; }, 'Change radial size'),
    [mutate],
  );

  const setBackgroundGradientCenterX = useCallback(
    (x: number) =>
      mutate((d) => { d.backgroundGradientCenterX = x; }, 'Change gradient center X'),
    [mutate],
  );

  const setBackgroundGradientCenterY = useCallback(
    (y: number) =>
      mutate((d) => { d.backgroundGradientCenterY = y; }, 'Change gradient center Y'),
    [mutate],
  );

  const setBackgroundImage = useCallback(
    (url: string) => mutate((d) => { d.backgroundImage = url || undefined; }, 'Set background image'),
    [mutate],
  );

  const setBackgroundImageFit = useCallback(
    (fit: 'cover' | 'contain' | 'fill') => mutate((d) => { d.backgroundImageFit = fit; }, 'Change image fit'),
    [mutate],
  );

  const setBackgroundImageOpacity = useCallback(
    (opacity: number) => mutate((d) => { d.backgroundImageOpacity = opacity; }, 'Change image opacity'),
    [mutate],
  );

  const setCanvasHeightMode = useCallback(
    (mode: 'aspect-ratio' | 'fixed-vh') => mutate((d) => { d.canvasHeightMode = mode; }, 'Change height mode'),
    [mutate],
  );

  const setCanvasHeightVh = useCallback(
    (vh: number) => mutate((d) => { d.canvasHeightVh = Math.max(1, Math.min(100, vh)); }, 'Change height vh'),
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
    }, 'Add slot');
    setSelectedSlotIds(new Set([newId]));
    return newId;
  }, [mutate]);

  const removeSlots = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      mutate((d) => {
        d.slots = d.slots.filter((s) => !idSet.has(s.id));
      }, ids.length > 1 ? 'Remove slots' : 'Remove slot');
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
      }, ids.length > 1 ? 'Duplicate slots' : 'Duplicate slot');
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
      }, 'Move slot'),
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
      }, 'Resize slot'),
    [mutate],
  );

  const updateSlot = useCallback(
    (id: string, updates: Partial<LayoutSlot>) =>
      mutate((d) => {
        const idx = d.slots.findIndex((s) => s.id === id);
        if (idx !== -1) {
          Object.assign(d.slots[idx]!, updates);
        }
      }, 'Update slot'),
    [mutate],
  );

  const updateSlots = useCallback(
    (updatesById: Record<string, Partial<LayoutSlot>>, label = 'Update slots') => {
      const slotIds = Object.keys(updatesById);
      if (slotIds.length === 0) return;
      mutate((d) => {
        const slotIdSet = new Set(slotIds);
        for (const slot of d.slots) {
          if (!slotIdSet.has(slot.id)) continue;
          Object.assign(slot, updatesById[slot.id]!);
        }
      }, label);
    },
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
      }, 'Nudge slot'),
    [mutate],
  );

  const assignMediaToSlot = useCallback(
    (slotId: string, mediaId: string, meta?: { attachmentId?: number | undefined; url?: string | undefined }) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === slotId);
        if (slot) {
          slot.mediaId = mediaId;
          slot.mediaAttachmentId = meta?.attachmentId;
          slot.mediaUrl = meta?.url;
        }
      }, 'Assign media'),
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
      }, 'Clear slot media'),
    [mutate],
  );

  const autoAssignMedia = useCallback(
    (mediaIds: string[], mediaItems?: MediaItem[]) =>
      mutate((d) => {
        for (let i = 0; i < d.slots.length; i++) {
          const slot = d.slots[i]!;
          if (i < mediaIds.length) {
            slot.mediaId = mediaIds[i]!;
            const item = mediaItems?.find((m) => m.id === mediaIds[i]);
            slot.mediaAttachmentId = item?.attachmentId;
            slot.mediaUrl = item?.url;
          } else {
            slot.mediaId = undefined;
            slot.mediaAttachmentId = undefined;
            slot.mediaUrl = undefined;
          }
        }
      }, 'Auto-assign media'),
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
        // Merge slots + overlays, sort by zIndex ascending, swap target with item above
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

  // ── Layer system (P16) ─────────────────────────────────────────────────────

  const renameSlot = useCallback(
    (id: string, name: string) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === id);
        if (slot) slot.name = name;
      }, 'Rename slot'),
    [mutate],
  );

  const renameOverlay = useCallback(
    (id: string, name: string) =>
      mutate((d) => {
        const overlay = d.overlays.find((o) => o.id === id);
        if (overlay) overlay.name = name;
      }, 'Rename layer'),
    [mutate],
  );

  const toggleSlotVisible = useCallback(
    (id: string) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === id);
        if (slot) slot.visible = !(slot.visible ?? true);
      }, 'Toggle slot visibility'),
    [mutate],
  );

  const toggleOverlayVisible = useCallback(
    (id: string) =>
      mutate((d) => {
        const overlay = d.overlays.find((o) => o.id === id);
        if (overlay) overlay.visible = !(overlay.visible ?? true);
      }, 'Toggle layer visibility'),
    [mutate],
  );

  const toggleSlotLocked = useCallback(
    (id: string) =>
      mutate((d) => {
        const slot = d.slots.find((s) => s.id === id);
        if (slot) slot.locked = !(slot.locked ?? false);
      }, 'Toggle slot lock'),
    [mutate],
  );

  const toggleOverlayLocked = useCallback(
    (id: string) =>
      mutate((d) => {
        const overlay = d.overlays.find((o) => o.id === id);
        if (overlay) overlay.locked = !(overlay.locked ?? false);
      }, 'Toggle layer lock'),
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
      }, 'Reorder layers'),
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

  const selectSlotsInRange = useCallback(
    (ids: string[]) => setSelectedSlotIds(new Set(ids)),
    [],
  );

  const clearSelection = useCallback(
    () => setSelectedSlotIds(new Set()),
    [],
  );

  // ── History ──

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const lastItem = past[past.length - 1]!;
    // Snapshot goes to future so redo can restore it.
    setFuture((prev) => [{ snapshot: template, entry: lastItem.entry }, ...prev]);
    setPast((prev) => prev.slice(0, -1));
    setTemplateRaw(lastItem.snapshot);
    setIsDirty(true);
  }, [past, template]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const nextItem = future[0]!;
    // Save current template to past before restoring redo state.
    setPast((prev) => {
      const next = [...prev, { snapshot: template, entry: nextItem.entry }];
      return next.length > MAX_HISTORY ? next.slice(1) : next;
    });
    setFuture((prev) => prev.slice(1));
    setTemplateRaw(nextItem.snapshot);
    setIsDirty(true);
  }, [future, template]);

  /**
   * Jump to any history position in a single synchronous state transition.
   * `target === -1` restores the initial state (before any mutations).
   * `target === k` restores the state after mutation k was applied.
   *
   * This avoids the stale-closure problem of calling undo()/redo() in a loop
   * (repeated calls in one tick would all read the same pre-update state).
   */
  const jumpToHistoryIndex = useCallback((target: number) => {
    // Guard: nothing to jump to.
    if (past.length === 0 && future.length === 0) return;

    // Clamp target to valid range: -1 (initial state) … (total entries - 1).
    const maxIndex = past.length + future.length - 1;
    const clamped = Math.max(-1, Math.min(target, maxIndex));

    const currentIndex = past.length - 1;
    if (clamped === currentIndex) return;

    if (clamped < currentIndex) {
      // ── Jumping backward ──────────────────────────────────────────────────
      // Build future items ordered so that future[0] undoes the smallest step,
      // i.e. first redo takes us back to position (clamped + 1).
      const newFutureItems: HistoryItem[] = [];
      for (let k = clamped + 1; k < past.length; k++) {
        // Template *at* position k = past[k+1].snapshot (before mutation k+1)
        //                          = current template when k is the last past entry.
        const snapshotAtK = k === past.length - 1 ? template : past[k + 1]!.snapshot;
        newFutureItems.push({ snapshot: snapshotAtK, entry: past[k]!.entry });
      }
      // The template to restore: state after mutation `clamped`
      //   = past[clamped + 1].snapshot (before mutation clamped+1)
      //   = past[0].snapshot (the initial template) when clamped === -1.
      const targetTemplate = clamped >= 0 ? past[clamped + 1]!.snapshot : past[0]!.snapshot;
      setPast(past.slice(0, clamped + 1));
      setFuture([...newFutureItems, ...future]);
      setTemplateRaw(targetTemplate);
      setIsDirty(true);
    } else {
      // ── Jumping forward ───────────────────────────────────────────────────
      // Consume `stepsForward` items from the front of future.
      const stepsForward = clamped - currentIndex;
      const toApply = future.slice(0, stepsForward);
      let tmpl = template;
      const newPastItems: HistoryItem[] = [];
      for (const item of toApply) {
        newPastItems.push({ snapshot: tmpl, entry: item.entry });
        tmpl = item.snapshot;
      }
      const newPast = [...past, ...newPastItems];
      setPast(newPast.length > MAX_HISTORY ? newPast.slice(newPast.length - MAX_HISTORY) : newPast);
      setFuture(future.slice(stepsForward));
      setTemplateRaw(tmpl);
      setIsDirty(true);
    }
  }, [past, future, template]);

  // ── Preview ──

  const togglePreview = useCallback(() => setIsPreview((p) => !p), []);

  // ── Persistence helpers ──

  const markSaved = useCallback(() => setIsDirty(false), []);

  // ── Groups (P30-G: nested hierarchy) ──

  const migrateGroupsIfNeeded = useCallback(() => {
    const groups = template.groups ?? [];
    const needsMigration = groups.some((g) => g.childGroupIds === undefined);
    if (!needsMigration) return;
    mutate((draft) => {
      draft.groups = migrateGroupsToP30G(draft.groups ?? [], draft.slots);
    }, 'Migrate groups to P30-G');
  }, [mutate, template.groups]);

  const createGroup = useCallback((memberIds: string[]): string => {
    const id = crypto.randomUUID?.() ?? `group-${Date.now()}`;
    const uniqueIds = [...new Set(memberIds)];
    mutate((draft) => {
      const groups = draft.groups ?? [];
      // Remove these slot IDs from any existing group's leaf members
      for (const g of groups) {
        g.memberIds = g.memberIds.filter((mid) => !uniqueIds.includes(mid));
      }
      // New group is always a top-level group (P30-G flat default)
      const newGroup: LayoutGroup = {
        id,
        memberIds: uniqueIds,
        childGroupIds: [],
        parentGroupId: null,
      };
      // Remove empty groups; prune any dangling childGroupIds that reference
      // a group that was just removed (P30-G: parent groups must not hold
      // stale child references or traversal/selection will break).
      draft.groups = groups.filter((g) => g.memberIds.length > 0 || (g.childGroupIds ?? []).length > 0);
      const survivingIds = new Set(draft.groups.map((g) => g.id));
      for (const g of draft.groups) {
        if (g.childGroupIds?.length) {
          g.childGroupIds = g.childGroupIds.filter((cid) => survivingIds.has(cid));
        }
      }
      draft.groups.push(newGroup);
      // Refresh all group rects: covers the new group AND any existing groups
      // that had members removed above (their cached union rects are now stale).
      refreshGroupRects(draft.groups, draft.slots);
    }, `Group (${uniqueIds.length} layers)`);
    return id;
  }, [mutate]);

  const wrapInGroup = useCallback((slotAndGroupIds: string[]): string => {
    const id = crypto.randomUUID?.() ?? `group-${Date.now()}`;
    mutate((draft) => {
      const groups = draft.groups ?? [];
      const groupMap = buildGroupMap(groups);

      // Separate passed IDs into group IDs and slot IDs
      const selectedGroupIds = slotAndGroupIds.filter((i) => groupMap.has(i));
      const selectedSlotIds = slotAndGroupIds.filter((i) => !groupMap.has(i));

      // Remove selected slots from existing leaf member lists
      for (const g of groups) {
        g.memberIds = g.memberIds.filter((mid) => !selectedSlotIds.includes(mid));
      }

      // Create new parent group
      const newGroup: LayoutGroup = {
        id,
        memberIds: selectedSlotIds,
        childGroupIds: selectedGroupIds,
        parentGroupId: null,
      };

      // Reparent selected groups under the new parent
      for (const gid of selectedGroupIds) {
        const g = groups.find((g) => g.id === gid);
        if (g) {
          // Remove from old parent's childGroupIds
          const oldParentId = g.parentGroupId ?? null;
          if (oldParentId) {
            const oldParent = groups.find((p) => p.id === oldParentId);
            if (oldParent) {
              oldParent.childGroupIds = (oldParent.childGroupIds ?? []).filter((c) => c !== gid);
            }
          }
          g.parentGroupId = id;
        }
      }

      // Remove empty groups; prune dangling childGroupIds references (same
      // invariant as createGroup — parent groups must not reference removed IDs).
      draft.groups = groups.filter((g) => g.memberIds.length > 0 || (g.childGroupIds ?? []).length > 0);
      const survivingIds = new Set(draft.groups.map((g) => g.id));
      for (const g of draft.groups) {
        if (g.childGroupIds?.length) {
          g.childGroupIds = g.childGroupIds.filter((cid) => survivingIds.has(cid));
        }
      }
      draft.groups.push(newGroup);
      refreshGroupRects(draft.groups, draft.slots);
    }, `Wrap in group`);
    return id;
  }, [mutate]);

  const dissolveGroup = useCallback((groupId: string) => {
    mutate((draft) => {
      draft.groups = dissolveGroupInHierarchy(groupId, draft.groups ?? []);
      // Remove empty groups after promotion
      draft.groups = draft.groups.filter(
        (g) => g.memberIds.length > 0 || (g.childGroupIds ?? []).length > 0,
      );
      // Refresh cached group rects: parent groups that absorbed promoted children
      // have a new membership set and their cached union rects are now stale.
      refreshGroupRects(draft.groups, draft.slots);
    }, 'Ungroup');
  }, [mutate]);

  const updateGroup = useCallback((groupId: string, updates: Partial<LayoutGroup>) => {
    mutate((draft) => {
      const g = (draft.groups ?? []).find((g) => g.id === groupId);
      if (g) Object.assign(g, updates);
    }, 'Update group');
  }, [mutate]);

  const selectGroup = useCallback((groupId: string) => {
    const groups = template.groups ?? [];
    const groupMap = buildGroupMap(groups);
    const slotIds = collectDescendantSlotIds(groupId, groupMap);
    const validIds = slotIds.filter((id) => template.slots.some((s) => s.id === id));
    setSelectedSlotIds(new Set(validIds));
  }, [template]);

  const moveGroup = useCallback((groupId: string, dx: number, dy: number) => {
    mutate((draft) => {
      const groups = draft.groups ?? [];
      const slotMap = new Map(draft.slots.map((s) => [s.id, s]));
      const groupMap = buildGroupMap(groups);
      const delta = computeGroupMoveDelta(groupId, dx, dy, groupMap, slotMap);
      for (const slot of draft.slots) {
        const upd = delta.get(slot.id);
        if (upd) { slot.x = upd.x; slot.y = upd.y; }
      }
      refreshGroupRects(groups, draft.slots);
    }, 'Move group');
  }, [mutate]);

  const reparentGroup = useCallback((groupId: string, newParentId: string | null) => {
    mutate((draft) => {
      draft.groups = reparentGroupInHierarchy(groupId, newParentId, draft.groups ?? []);
      refreshGroupRects(draft.groups, draft.slots);
    }, 'Reparent group');
  }, [mutate]);

  const clearDraft = useCallback(() => {
    if (!template.id) return;
    try { localStorage.removeItem(STORAGE_KEY_PREFIX + template.id); } catch { /* ignore */ }
  }, [template.id]);

  // ── Autosave to localStorage ──
  useEffect(() => {
    if (!template.id) return;
    const key = STORAGE_KEY_PREFIX + template.id;
    const timer = setTimeout(() => {
      try {
        const payload: LayoutDraftPayload = {
          savedAt: Date.now(),
          serverUpdatedAt: template.updatedAt,
          schemaVersion: template.schemaVersion,
          template,
        };
        localStorage.setItem(key, JSON.stringify(payload));
      } catch { /* storage unavailable */ }
    }, 2_000);
    return () => clearTimeout(timer);
  }, [template]);

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
    setBackgroundMode,
    setBackgroundGradientDirection,
    setBackgroundGradientStops,
    setBackgroundGradientType,
    setBackgroundGradientAngle,
    setBackgroundRadialShape,
    setBackgroundRadialSize,
    setBackgroundGradientCenterX,
    setBackgroundGradientCenterY,
    setBackgroundImage,
    setBackgroundImageFit,
    setBackgroundImageOpacity,
    setCanvasHeightMode,
    setCanvasHeightVh,
    // Slot CRUD
    addSlot,
    removeSlots,
    duplicateSlots,
    // Slot mutation
    moveSlot,
    resizeSlot,
    updateSlot,
    updateSlots,
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
    selectSlotsInRange,
    clearSelection,
    // History
    undo,
    redo,
    canUndo,
    canRedo,
    historyEntries: useMemo(
      () => [...past.map((p) => p.entry), ...future.map((f) => f.entry)],
      [past, future],
    ),
    historyCurrentIndex: past.length - 1,
    jumpToHistoryIndex,
    isHistoryTrimmed: historyTrimmed,
    // Preview
    togglePreview,
    // Persistence
    markSaved,
    clearDraft,
    // Groups (P30-G: nested hierarchy)
    createGroup,
    wrapInGroup,
    dissolveGroup,
    updateGroup,
    selectGroup,
    moveGroup,
    reparentGroup,
    migrateGroupsIfNeeded,
  };
}
