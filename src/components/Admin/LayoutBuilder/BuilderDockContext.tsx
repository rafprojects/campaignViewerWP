import { createContext, useContext, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { DockviewApi } from 'dockview';
import type { LayoutGraphicLayer, LayoutSlot, MediaItem } from '@/types';
import type { UseLayoutBuilderReturn } from '@/hooks/useLayoutBuilderState';

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

  // Snap
  snapEnabled: boolean;
  setSnapEnabled: Dispatch<SetStateAction<boolean>>;
  snapThreshold: number;
  setSnapThreshold: Dispatch<SetStateAction<number>>;

  // Design assets accordion
  designAssetsOpen: boolean;
  setDesignAssetsOpen: (open: boolean) => void;
  bgSectionRef: RefObject<HTMLDivElement>;

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
}

// ── Context + hook ────────────────────────────────────────────

export const BuilderDockContext = createContext<BuilderDockContextValue | null>(null);

export function useBuilderDock(): BuilderDockContextValue {
  const ctx = useContext(BuilderDockContext);
  if (!ctx) throw new Error('useBuilderDock must be used inside BuilderDockContext.Provider');
  return ctx;
}
