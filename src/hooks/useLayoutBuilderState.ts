import { useState, useCallback, useEffect } from 'react';
import { enableMapSet } from 'immer';
import type { LayoutTemplate, LayoutSlot, LayoutGraphicLayer, LayoutGroup, MediaItem } from '@/types';
import { DEFAULT_LAYOUT_SLOT } from '@/types';
import { buildLayerList, computeReorderedZIndices } from '@/utils/layerList';
import { useLayoutBuilderHistory } from './useLayoutBuilderHistory';
import { useLayoutBuilderZIndex } from './useLayoutBuilderZIndex';
import { useLayoutBuilderOverlays } from './useLayoutBuilderOverlays';
import { useLayoutBuilderGroups } from './useLayoutBuilderGroups';
import { useLayoutBuilderGuides } from './useLayoutBuilderGuides';
import type { HistoryEntry } from './useLayoutBuilderHistory';

export type { HistoryEntry } from './useLayoutBuilderHistory';

enableMapSet();

// ── Constants ────────────────────────────────────────────────

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

  // ── Persistent guides (P57-E) ──
  addGuide: (axis: 'x' | 'y', position?: number) => void;
  moveGuide: (id: string, position: number) => void;
  removeGuide: (id: string) => void;
  toggleGuideLock: (id: string) => void;

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

  // ── Sub-hooks ──

  const {
    mutate, resetHistory,
    undo, redo, canUndo, canRedo,
    historyEntries, historyCurrentIndex,
    jumpToHistoryIndex, isHistoryTrimmed,
  } = useLayoutBuilderHistory({ template, setTemplateRaw, setIsDirty });

  const {
    bringToFront, sendToBack, bringForward, sendBackward, normalizeZIndices,
  } = useLayoutBuilderZIndex({ mutate, template });

  const {
    addOverlay, removeOverlay, updateOverlay, moveOverlay, resizeOverlay,
  } = useLayoutBuilderOverlays({ mutate });

  const {
    migrateGroupsIfNeeded, createGroup, wrapInGroup,
    dissolveGroup, updateGroup, selectGroup, moveGroup, reparentGroup,
  } = useLayoutBuilderGroups({ mutate, template, setSelectedSlotIds });

  const {
    addGuide, moveGuide, removeGuide, toggleGuideLock,
  } = useLayoutBuilderGuides({ mutate });

  // ── Template-level actions ──

  const setTemplate = useCallback((t: LayoutTemplate, opts?: { preserveSelection?: boolean }) => {
    setTemplateRaw(t);
    resetHistory();
    setIsDirty(false);
    if (!opts?.preserveSelection) {
      setSelectedSlotIds(new Set());
    }
  }, [resetHistory]);

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
        if (slot) {
          slot.x = Math.max(0, Math.min(100 - slot.width, x));
          slot.y = Math.max(0, Math.min(100 - slot.height, y));
        }
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

  // ── Preview ──

  const togglePreview = useCallback(() => setIsPreview((p) => !p), []);

  // ── Persistence helpers ──

  const markSaved = useCallback(() => setIsDirty(false), []);

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
    historyEntries,
    historyCurrentIndex,
    jumpToHistoryIndex,
    isHistoryTrimmed,
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
    // Persistent guides (P57-E)
    addGuide,
    moveGuide,
    removeGuide,
    toggleGuideLock,
  };
}
