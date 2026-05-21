import { createContext, useContext, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { DockviewApi } from 'dockview';
import type { LayoutGraphicLayer, LayoutSlot, MediaItem } from '@/types';
import type { UseLayoutBuilderReturn } from '@/hooks/useLayoutBuilderState';
import type { SnapMode } from '@/utils/canvasMeasurement';

// ── Shared library type ───────────────────────────────────────

export interface OverlayLibraryItem {
  id: string;
  url: string;
  name: string;
  uploadedAt: string;
}

// ── Context shape ─────────────────────────────────────────────

export interface BuilderDockContextValue {
  // Core builder
  builder: UseLayoutBuilderReturn;
  isSaving: boolean;

  // Media
  media: MediaItem[];
  campaigns: Array<{ id: number; title: string }> | undefined;
  selectedCampaignId: string | null;
  setSelectedCampaignId: Dispatch<SetStateAction<string | null>>;

  // Overlay library
  overlayLibrary: OverlayLibraryItem[] | undefined;
  isUploadingOverlay: boolean;
  isUploadingBg: boolean;

  // Selection
  selectedSlot: LayoutSlot | undefined;
  selectedOverlayId: string | null;
  setSelectedOverlayId: Dispatch<SetStateAction<string | null>>;
  selectedOverlay: LayoutGraphicLayer | undefined;
  selectedOverlayIndex: number;
  isBackgroundSelected: boolean;
  setIsBackgroundSelected: Dispatch<SetStateAction<boolean>>;
  /** Slot ID whose mask sublayer is currently selected in the Layers panel. */
  selectedMaskSlotId: string | null;
  setSelectedMaskSlotId: Dispatch<SetStateAction<string | null>>;

  // Snap & grid (P30-B)
  snapMode: SnapMode;
  setSnapMode: Dispatch<SetStateAction<SnapMode>>;
  snapThreshold: number;
  setSnapThreshold: Dispatch<SetStateAction<number>>;
  showGrid: boolean;
  setShowGrid: Dispatch<SetStateAction<boolean>>;
  gridSizePx: number;
  setGridSizePx: Dispatch<SetStateAction<number>>;

  // Rulers & measurements (P30-B)
  showRulers: boolean;
  setShowRulers: Dispatch<SetStateAction<boolean>>;
  showMeasurements: boolean;
  setShowMeasurements: Dispatch<SetStateAction<boolean>>;

  // Design assets accordion
  designAssetsOpen: boolean;
  setDesignAssetsOpen: (open: boolean) => void;
  bgSectionRef: RefObject<HTMLDivElement | null>;

  // Dockview API reference (set in onReady)
  dockApiRef: { current: DockviewApi | null };

  // A11y
  announce: (msg: string) => void;

  // Handlers
  handleSave: () => Promise<boolean | void>;
  handleClose: () => void;
  handleAutoAssign: () => void;
  handleUploadOverlay: (file: File | null) => Promise<void>;
  handleDeleteLibraryOverlay: (id: string) => Promise<void>;
  handleUploadBgImage: (file: File | null) => Promise<void>;
  handleDeleteSelected: () => void;
  handleDuplicateSelected: () => void;
  /** Upload a mask image (PNG/SVG) and return the URL to assign to a slot. */
  handleUploadMask: (file: File) => Promise<string | null>;
  /** Create a group from the currently selected slots. */
  handleCreateGroup: () => void;
  /** Dissolve the group identified by `groupId` (passed explicitly from the toolbar). */
  handleUngroupSelected: (groupId: string) => void;
  /** Toggle lock on a specific group. */
  handleGroupLockToggle: (groupId: string, locked: boolean) => void;
  /** Toggle visibility on a specific group. */
  handleGroupVisibilityToggle: (groupId: string, visible: boolean) => void;
  /** Rename a specific group. */
  handleGroupRename: (groupId: string, name: string) => void;
  /** Bring currently selected slots forward one z-index step. */
  handleBringForwardSelected: (ids: string[]) => void;
  /** Send currently selected slots backward one z-index step. */
  handleSendBackwardSelected: (ids: string[]) => void;
}

// ── Context + hook ────────────────────────────────────────────

export const BuilderDockContext = createContext<BuilderDockContextValue | null>(null);

export function useBuilderDock(): BuilderDockContextValue {
  const ctx = useContext(BuilderDockContext);
  if (!ctx) throw new Error('useBuilderDock must be used inside BuilderDockContext.Provider');
  return ctx;
}
