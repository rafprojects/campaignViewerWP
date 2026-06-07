import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Modal,
  Group,
  Button,
  TextInput,
  ActionIcon,
  Text,
  Tooltip,
  Divider,
  Box,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconDeviceFloppy,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconEye,
  IconEyeOff,
  IconDownload,
  IconUpload,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { LayoutTemplate } from '@/types';
import type { ApiClient } from '@/services/apiClient';
import {
  useLayoutBuilderState,
  createEmptyTemplate,
} from '@/hooks/useLayoutBuilderState';
import { useBuilderShellColors } from '@/hooks/useBuilderShellColors';
import { useTheme } from '@/hooks/useTheme';
import { DockviewReact, type DockviewReadyEvent, type DockviewApi } from 'dockview';
import { debugGroup, debugLog, debugGroupEnd } from '@/utils/debug';
import {
  BuilderDockContext,
  type BuilderDockContextValue,
  type OverlayLibraryItem,
} from './BuilderDockContext';
import { LayoutBuilderLayersPanel } from './LayoutBuilderLayersPanel';
import { LayoutBuilderMediaPanel } from './LayoutBuilderMediaPanel';
import { LayoutBuilderCanvasPanel } from './LayoutBuilderCanvasPanel';
import { LayoutBuilderPropertiesPanel } from './LayoutBuilderPropertiesPanel';
import { BuilderKeyboardShortcutsModal } from './BuilderKeyboardShortcutsModal';
import { BuilderHistoryPanel } from './BuilderHistoryPanel';
import { BuilderHistoryDropdown } from './BuilderHistoryDropdown';
import { useOverlayLibrary } from '@/services/layoutTemplateQuery';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { buildGroupMap, collectDescendantSlotIds } from '@/utils/groupGeometry';
import { useRootId } from '@/contexts/RootIdContext';
import { useBuilderWorkspacePrefs } from '@/hooks/useBuilderWorkspacePrefs';
import { useBuilderCampaignMedia } from '@/hooks/useBuilderCampaignMedia';
import { useBroadcastStaleness } from '@/hooks/useBroadcastStaleness';
import { useBuilderDraftRestore } from '@/hooks/useBuilderDraftRestore';

// ── Dockview panel components (stable reference outside component) ──────────

const dockComponents = {
  layers: LayoutBuilderLayersPanel,
  media: LayoutBuilderMediaPanel,
  canvas: LayoutBuilderCanvasPanel,
  properties: LayoutBuilderPropertiesPanel,
  history: BuilderHistoryPanel,
};


// ── Props ────────────────────────────────────────────────────

export interface LayoutBuilderModalProps {
  opened: boolean;
  onClose: () => void;
  apiClient: ApiClient;
  /** Existing template to edit — undefined = new template. */
  initialTemplate?: LayoutTemplate | undefined;
  onSaved?: ((template: LayoutTemplate) => void) | undefined;
  onNotify?: ((msg: { type: 'error' | 'success'; text: string }) => void) | undefined;
  /** P37-LB: true when editing a template used in campaign listing mode; activates builder guardrails. */
  listingMode?: boolean;
}

// ── Component ────────────────────────────────────────────────

export function LayoutBuilderModal({
  opened,
  onClose,
  apiClient,
  initialTemplate,
  onSaved,
  onNotify,
  listingMode = false,
}: LayoutBuilderModalProps) {
  const builder = useLayoutBuilderState(initialTemplate ?? createEmptyTemplate());
  const rootId = useRootId();
  const { colorScheme } = useTheme();
  const shellColors = useBuilderShellColors();
  const dockApiRef = useRef<DockviewApi | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const builderShellVars = useMemo(
    () => ({
      '--wpsg-builder-surface': shellColors.surface,
      '--wpsg-builder-surface-2': shellColors.surface2,
      '--wpsg-builder-surface-3': shellColors.surface3,
      '--wpsg-builder-background': shellColors.background,
      '--wpsg-builder-border': shellColors.border,
      '--wpsg-builder-border-muted': shellColors.borderMuted,
      '--wpsg-builder-text': shellColors.text,
      '--wpsg-builder-text-muted': shellColors.textMuted,
      '--wpsg-builder-text-muted-2': shellColors.textMuted2,
      '--wpsg-builder-accent': shellColors.accent,
      '--wpsg-builder-accent-soft': shellColors.accentSoft,
      '--wpsg-builder-icon-hover': shellColors.iconHover,
      '--wpsg-builder-shadow': shellColors.shadow,
      '--wpsg-builder-scrollbar': shellColors.scrollbar,
    }) as CSSProperties,
    [shellColors],
  );

  const dockTheme = useMemo(
    () => ({
      name: `wpsg-builder-shell-${colorScheme}`,
      className: 'dockview-theme-wpsg',
    }),
    [colorScheme],
  );

  // ── Campaign list + media for the media picker ──
  const { campaigns, media, selectedCampaignId, setSelectedCampaignId } = useBuilderCampaignMedia(
    apiClient,
    opened,
    initialTemplate?.id,
  );

  // ── Overlay library (P15-H) ──
  const { data: overlayLibrary, refetch: refetchOverlayLibrary } = useOverlayLibrary(apiClient, opened);
  const [isUploadingOverlay, setIsUploadingOverlay] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);

  const [builderShortcutsOpen, setBuilderShortcutsOpen] = useState(false);

  // ── P30-B workspace preferences ──
  const {
    snapMode, setSnapMode,
    snapThreshold, setSnapThreshold,
    showGrid, setShowGrid,
    gridSizePx, setGridSizePx,
    showRulers, setShowRulers,
    showMeasurements, setShowMeasurements,
    designAssetsOpen, setDesignAssetsOpen,
  } = useBuilderWorkspacePrefs(rootId);

  const bgSectionRef = useRef<HTMLDivElement>(null);
  // ── Layer panel selection (overlay + background tracked locally; slot uses builder state) ──
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [isBackgroundSelected, setIsBackgroundSelected] = useState(false);
  const [selectedMaskSlotId, setSelectedMaskSlotId] = useState<string | null>(null);
  const [a11yAnnouncement, setA11yAnnouncement] = useState('');

  // ── P30-D: Cross-tab stale detection ──
  const { postSaved } = useBroadcastStaleness(initialTemplate);

  // ── P36-A: Draft restore/discard prompt ──
  useBuilderDraftRestore({
    opened,
    initialTemplate,
    onRestoreDraft: (t) => {
      builder.setTemplate(t, { preserveSelection: false });
      builder.clearDraft();
    },
    onDiscardDraft: builder.clearDraft,
  });

  // ── P30-G: migrate flat P29-G-C groups to hierarchical format on open ──
  // The ref keeps a stable pointer to the latest `migrateGroupsIfNeeded` so
  // the effect dep array stays minimal (only [opened]).
  const migrateGroupsRef = useRef(builder.migrateGroupsIfNeeded);
  migrateGroupsRef.current = builder.migrateGroupsIfNeeded;
  useEffect(() => {
    if (!opened) return;
    migrateGroupsRef.current();

  }, [opened]);

  // ── Close with dirty guard ──
  const handleClose = useCallback(() => {
    if (builder.isDirty) {
      modals.openConfirmModal({
        title: 'Discard changes?',
        children: <Text size="sm">You have unsaved changes. Discard them?</Text>,
        labels: {
          confirm: 'Discard',
          cancel: 'Keep editing',
        },
        confirmProps: { color: 'red' },
        onConfirm: () => { builder.clearDraft(); onClose(); },
      });
      return;
    }

    builder.clearDraft();
    onClose();
  }, [builder, onClose]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // normalizeZIndices returns the normalized template synchronously; using
      // its return value avoids reading stale React state immediately after the
      // dispatch (which would miss the normalization and save old z-indices).
      const t = builder.normalizeZIndices();

      // ── DEBUG: Log what we're about to save ──
      debugGroup('[WPSG] Layout Save — pre-flight');
      debugLog('Slots being sent:', t.slots.map((s, i) => `${i + 1}:${s.id}→mediaId=${s.mediaId ?? '(none)'}`));
      debugGroupEnd();

      let saved: LayoutTemplate;
      if (t.id) {
        saved = await apiClient.updateLayoutTemplate(t.id, t);
      } else {
        saved = await apiClient.createLayoutTemplate(t);
      }

      // ── DEBUG: Log what came back from the server ──
      debugGroup('[WPSG] Layout Save — response');
      debugLog('Slots returned:', saved.slots.map((s, i) => `${i + 1}:${s.id}→mediaId=${s.mediaId ?? '(none)'}`));
      debugGroupEnd();

      builder.setTemplate(saved, { preserveSelection: true });
      builder.markSaved();
      builder.clearDraft();
      onSaved?.(saved);
      onNotify?.({ type: 'success', text: `Layout "${saved.name}" saved` });
      notifications.show({ message: `Layout "${saved.name}" saved`, color: 'green', autoClose: 3000 });
      // P30-D: Notify other tabs that this template was saved
      postSaved(saved.id);
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to save layout';
      onNotify?.({ type: 'error', text: errMsg });
      notifications.show({ title: 'Save failed', message: errMsg, color: 'red', autoClose: 5000 });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [builder, apiClient, onSaved, onNotify, postSaved]);

  // ── Delete selected slots ──
  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(builder.selectedSlotIds);
    if (ids.length === 0) return;
    builder.removeSlots(ids);
    notifications.show({
      message: `${ids.length} slot${ids.length !== 1 ? 's' : ''} deleted`,
      color: 'gray',
      autoClose: 2500,
    });
  }, [builder]);

  // ── Duplicate selected slots ──
  const handleDuplicateSelected = useCallback(() => {
    const ids = Array.from(builder.selectedSlotIds);
    if (ids.length === 0) return;
    builder.duplicateSlots(ids);
    notifications.show({
      message: `${ids.length} slot${ids.length !== 1 ? 's' : ''} duplicated`,
      color: 'blue',
      autoClose: 2500,
    });
  }, [builder]);

  // ── A11y announce helper ──
  const announce = useCallback((msg: string) => {
    setA11yAnnouncement(msg);
    // Clear after screen reader has time to read it
    setTimeout(() => setA11yAnnouncement(''), 3000);
  }, []);

  // ── JSON export ──
  const handleExportJson = useCallback(() => {
    const json = JSON.stringify(builder.template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = builder.template.name.replace(/[^a-z0-9_-]/gi, '-') || 'layout';
    a.href = url;
    a.download = `${safeName}.wpsg-layout.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [builder.template]);

  // ── JSON import ──
  const handleImportJson = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string) as unknown;
          if (
            typeof parsed !== 'object' ||
            parsed === null ||
            !('name' in parsed) ||
            !('slots' in parsed) ||
            !Array.isArray((parsed as { slots: unknown }).slots) ||
            !('canvasAspectRatio' in parsed)
          ) {
            notifications.show({
              title: 'Invalid layout file',
              message: 'The file is missing required fields (name, slots, canvasAspectRatio).',
              color: 'red',
              autoClose: 5000,
            });
            return;
          }
          const defaults = createEmptyTemplate();
          const imported: LayoutTemplate = {
            ...defaults,
            ...(parsed as Partial<LayoutTemplate>),
            id: '',
            createdAt: defaults.createdAt,
            updatedAt: defaults.updatedAt,
          };
          builder.setTemplate(imported, { preserveSelection: false });
          notifications.show({
            title: 'Layout imported',
            message: `"${imported.name}" loaded successfully.`,
            color: 'green',
            autoClose: 3000,
          });
        } catch {
          notifications.show({
            title: 'Import failed',
            message: 'Could not parse JSON file.',
            color: 'red',
            autoClose: 5000,
          });
        } finally {
          // Reset so same file can be re-imported
          if (importFileRef.current) importFileRef.current.value = '';
        }
      };
      reader.readAsText(file);
    },
    [builder],
  );

  // ── Overlay library handlers ──
  const handleUploadOverlay = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setIsUploadingOverlay(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
        const entry = await apiClient.postForm<OverlayLibraryItem>(
          '/wp-json/wp-super-gallery/v1/admin/overlay-library',
          formData,
        );
        await refetchOverlayLibrary();
        builder.addOverlay(entry.url);
        announce('Overlay uploaded and added to canvas');
        notifications.show({ message: 'Overlay added to canvas', color: 'blue', autoClose: 3000 });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Overlay upload failed';
        onNotify?.({ type: 'error', text: errMsg });
        notifications.show({ title: 'Overlay upload failed', message: errMsg, color: 'red', autoClose: 5000 });
      } finally {
        setIsUploadingOverlay(false);
      }
    },
    [apiClient, refetchOverlayLibrary, builder, announce, onNotify],
  );

  const handleDeleteLibraryOverlay = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/admin/overlay-library/${id}`);
        await refetchOverlayLibrary();
      } catch (err) {
        onNotify?.({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to delete overlay',
        });
      }
    },
    [apiClient, refetchOverlayLibrary, onNotify],
  );

  // ── Background image upload ──
  const handleUploadBgImage = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setIsUploadingBg(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
        const entry = await apiClient.postForm<OverlayLibraryItem>(
          '/wp-json/wp-super-gallery/v1/admin/overlay-library',
          formData,
        );
        builder.setBackgroundImage(entry.url);
        announce('Background image uploaded and applied');
        notifications.show({ message: 'Background image applied', color: 'blue', autoClose: 3000 });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Background image upload failed';
        onNotify?.({ type: 'error', text: errMsg });
        notifications.show({ title: 'Background upload failed', message: errMsg, color: 'red', autoClose: 5000 });
      } finally {
        setIsUploadingBg(false);
      }
    },
    [apiClient, builder, announce, onNotify],
  );

  // ── Mask image upload (reuses overlay-library endpoint) ──
  const handleUploadMask = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
        const entry = await apiClient.postForm<OverlayLibraryItem>(
          '/wp-json/wp-super-gallery/v1/admin/overlay-library',
          formData,
        );
        announce('Mask image uploaded');
        return entry.url;
      } catch (err) {
        onNotify?.({
          type: 'error',
          text: err instanceof Error ? err.message : 'Mask upload failed',
        });
        return null;
      }
    },
    [apiClient, announce, onNotify],
  );

  // ── Group actions (used by contextual toolbar) ──
  const handleCreateGroup = useCallback(() => {
    const ids = [...builder.selectedSlotIds];
    if (ids.length < 2) return;
    builder.createGroup(ids);
    announce(`Group created (${ids.length} slots)`);
    notifications.show({ message: `Group created (${ids.length} slots)`, color: 'blue', autoClose: 2500 });
  }, [builder, announce]);

  // The toolbar always resolves the target group before calling this and passes
  // the explicit groupId — no need to re-derive from selection here.
  // Keyboard Ctrl+Shift+G has its own inline dissolve logic.
  const handleUngroupSelected = useCallback((groupId: string) => {
    builder.dissolveGroup(groupId);
    announce('Ungrouped');
    notifications.show({ message: 'Ungrouped', color: 'gray', autoClose: 2500 });
  }, [builder, announce]);

  const handleGroupLockToggle = useCallback(
    (groupId: string, locked: boolean) => {
      builder.updateGroup(groupId, { locked });
      announce(locked ? 'Group locked' : 'Group unlocked');
    },
    [builder, announce],
  );

  const handleGroupVisibilityToggle = useCallback(
    (groupId: string, visible: boolean) => {
      builder.updateGroup(groupId, { visible });
      announce(visible ? 'Group shown' : 'Group hidden');
    },
    [builder, announce],
  );

  const handleGroupRename = useCallback(
    (groupId: string, name: string) => {
      builder.updateGroup(groupId, { name });
      announce(`Group renamed`);
    },
    [builder, announce],
  );

  const handleBringForwardSelected = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      builder.bringForward(ids);
      announce('Brought forward');
    },
    [builder, announce],
  );

  const handleSendBackwardSelected = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      builder.sendBackward(ids);
      announce('Sent backward');
    },
    [builder, announce],
  );

  // ── Auto-assign media ──
  const handleAutoAssign = useCallback(() => {
    const mediaIds = media.map((m) => m.id);
    builder.autoAssignMedia(mediaIds, media);
    const assignedCount = Math.min(mediaIds.length, builder.template.slots.length);
    announce(`Auto-assigned ${assignedCount} media items`);
    notifications.show({
      message: `${assignedCount} media item${assignedCount !== 1 ? 's' : ''} assigned`,
      color: 'blue',
      autoClose: 3000,
    });
  }, [builder, media, announce]);

  // ── Keyboard shortcuts ──
  // Attached at the document level so shortcuts fire regardless of which
  // focusable child (canvas, button, panel header, etc.) has focus.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture when inside inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        builder.undo();
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        builder.redo();
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        // Copy is handled via duplicateSlots on paste
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        handleDuplicateSelected();
        e.preventDefault();
      }
      // Group / wrap-in-group / select-in-group (P30-G)
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey) {
        const ids = [...builder.selectedSlotIds];
        const groups = builder.template.groups ?? [];
        const groupMap = buildGroupMap(groups);

        // P30-G: detect if selection is exactly one complete group's descendants
        const fullySelectedGroup = groups.find((g) => {
          const descIds = collectDescendantSlotIds(g.id, groupMap);
          return (
            descIds.length > 0 &&
            descIds.length === builder.selectedSlotIds.size &&
            descIds.every((id) => builder.selectedSlotIds.has(id))
          );
        });

        if (fullySelectedGroup) {
          // Wrap the full group in a new parent group
          const newId = builder.wrapInGroup([fullySelectedGroup.id]);
          builder.selectGroup(newId);
          announce('Group wrapped in parent group');
        } else {
          const touchedGroup = groups.find((g) =>
            g.memberIds.some((id) => builder.selectedSlotIds.has(id))
          );
          if (touchedGroup) {
            // Any selected slot belongs to a group — expand selection to all descendants.
            builder.selectGroup(touchedGroup.id);
            announce(`Group selected`);
          } else if (ids.length >= 2) {
            builder.createGroup(ids);
            announce(`Group created (${ids.length} slots)`);
          }
        }
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g' && e.shiftKey) {
        const groups = builder.template.groups ?? [];
        const selectedIds = builder.selectedSlotIds;
        if (groups.length > 0 && selectedIds.size > 0) {
          const shiftGGroupMap = buildGroupMap(groups);
          // P30-G fix: match by full descendant set, fall back to member overlap
          const targetGroup =
            groups.find((g) => {
              const descIds = collectDescendantSlotIds(g.id, shiftGGroupMap);
              return (
                descIds.length > 0 &&
                descIds.length === selectedIds.size &&
                descIds.every((id) => selectedIds.has(id))
              );
            }) ?? groups.find((g) => g.memberIds.some((id) => selectedIds.has(id)));
          if (targetGroup) {
            builder.dissolveGroup(targetGroup.id);
            announce('Ungrouped');
          }
        }
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        if (builder.selectedSlotIds.size > 0) {
          // Something is selected — deselect and absorb the event so the
          // Modal's own Escape-to-close handler does not fire.
          builder.clearSelection();
          e.preventDefault();
          e.stopPropagation();
        } else {
          // Nothing selected — treat Escape as a modal close.
          handleClose();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void handleSave();
      }

      if (e.key === '?') {
        setBuilderShortcutsOpen(true);
      }

      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !builder.isPreview) {
        const id = builder.addSlot();
        builder.selectSlot(id);
        setSelectedOverlayId(null);
        setIsBackgroundSelected(false);
        announce('New slot added');
        e.preventDefault();
      }

      // Z-index shortcuts (P15-G): ] = forward, [ = backward, Shift+] = front, Shift+[ = back
      const ids = Array.from(builder.selectedSlotIds);
      if (ids.length > 0) {
        if (e.key === ']' && e.shiftKey) {
          builder.bringToFront(ids);
          announce('Brought to front');
          e.preventDefault();
        } else if (e.key === ']') {
          builder.bringForward(ids);
          announce('Brought forward');
          e.preventDefault();
        } else if (e.key === '[' && e.shiftKey) {
          builder.sendToBack(ids);
          announce('Sent to back');
          e.preventDefault();
        } else if (e.key === '[') {
          builder.sendBackward(ids);
          announce('Sent backward');
          e.preventDefault();
        }
      }

      // Arrow keys: nudge selected slots
      const step = e.shiftKey ? 0.1 : 1;
      if (ids.length > 0) {
        if (e.key === 'ArrowLeft') {
          builder.nudgeSlots(ids, -step, 0);
          e.preventDefault();
        }
        if (e.key === 'ArrowRight') {
          builder.nudgeSlots(ids, step, 0);
          e.preventDefault();
        }
        if (e.key === 'ArrowUp') {
          builder.nudgeSlots(ids, 0, -step);
          e.preventDefault();
        }
        if (e.key === 'ArrowDown') {
          builder.nudgeSlots(ids, 0, step);
          e.preventDefault();
        }
      }
    },
    [announce, builder, handleClose, handleDeleteSelected, handleDuplicateSelected, handleSave, setSelectedOverlayId, setIsBackgroundSelected],
  );

  // Attach/detach the document-level listener whenever the modal opens/closes.
  useEffect(() => {
    if (!opened) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [opened, handleKeyDown]);

  // ── Get selected slot for properties panel ──
  const selectedSlot =
    builder.selectedSlotIds.size === 1
      ? builder.template.slots.find(
        (s) => s.id === Array.from(builder.selectedSlotIds)[0],
      )
      : undefined;

  // ── Get selected graphic layer (P17-D) ──
  const selectedOverlayIndex = selectedOverlayId
    ? builder.template.overlays.findIndex((o) => o.id === selectedOverlayId)
    : -1;
  const selectedOverlay =
    selectedOverlayIndex >= 0
      ? builder.template.overlays[selectedOverlayIndex]
      : undefined;

  // ── Dockview ready handler (P17-E) ──
  const handleDockReady = useCallback((event: DockviewReadyEvent) => {
    dockApiRef.current = event.api;
    const LAYOUT_KEY = `wpsg_builder_${rootId}_layout`;
    // P30-E: bumped from 1 → 2. Version 1 layouts include a History dock tab
    // that is now surfaced in the header; they are cleared so users get the
    // clean default layout without the redundant History tab.
    const LAYOUT_VERSION = 2;
    const persistLayout = () => {
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify({ version: LAYOUT_VERSION, layout: event.api.toJSON() }));
      } catch { /* ignore storage errors */ }
    };
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { version?: number; layout?: unknown } | null;
        const savedVersion = parsed && typeof parsed === 'object' ? (parsed.version ?? 0) : 0;
        if (savedVersion < LAYOUT_VERSION) {
          // Old layout (pre-P30-E) — clear and fall through to the new default.
          try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
        } else {
          // Accept both versioned { version, layout } and legacy bare-JSON saves.
          const layout =
            parsed && typeof parsed === 'object' && 'layout' in parsed
              ? parsed.layout
              : parsed;
          event.api.fromJSON(layout as Parameters<typeof event.api.fromJSON>[0]);
          event.api.onDidLayoutChange(persistLayout);
          return;
        }
      } catch {
        // Saved layout is invalid or incompatible — clear it so every
        // subsequent open doesn't repeat the same try/catch failure.
        try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
        // fall through to default layout
      }
    }
    // Default layout (P30-E): Layers+Media tabs left | Canvas centre | Properties right
    // History is now in the header dropdown — no History dock tab in the default.
    const layersPanel = event.api.addPanel({ id: 'layers', component: 'layers', title: 'Layers' });
    event.api.addPanel({ id: 'media', component: 'media', title: 'Media & Assets', position: { direction: 'within', referencePanel: layersPanel } });
    const canvasPanel = event.api.addPanel({ id: 'canvas', component: 'canvas', title: 'Canvas', position: { direction: 'right', referencePanel: layersPanel } });
    event.api.addPanel({ id: 'properties', component: 'properties', title: 'Properties', position: { direction: 'right', referencePanel: canvasPanel } });
    event.api.onDidLayoutChange(persistLayout);
  }, [rootId]);

  // ── Context value for dock panels (P17-E) ──
  const contextValue: BuilderDockContextValue = {
    builder, isSaving, media, campaigns, selectedCampaignId, setSelectedCampaignId,
    overlayLibrary, isUploadingOverlay, isUploadingBg,
    selectedSlot, selectedOverlayId, setSelectedOverlayId, selectedOverlay,
    selectedOverlayIndex, isBackgroundSelected, setIsBackgroundSelected,
    selectedMaskSlotId, setSelectedMaskSlotId,
    snapMode, setSnapMode, snapThreshold, setSnapThreshold,
    showGrid, setShowGrid, gridSizePx, setGridSizePx,
    showRulers, setShowRulers, showMeasurements, setShowMeasurements,
    designAssetsOpen, setDesignAssetsOpen, bgSectionRef, dockApiRef,
    announce,
    handleSave, handleClose, handleAutoAssign, handleUploadOverlay,
    handleDeleteLibraryOverlay, handleUploadBgImage,
    handleDeleteSelected, handleDuplicateSelected, handleUploadMask,
    handleCreateGroup, handleUngroupSelected,
    handleGroupLockToggle, handleGroupVisibilityToggle, handleGroupRename,
    handleBringForwardSelected, handleSendBackwardSelected,
    listingMode,
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      fullScreen
      withCloseButton={false}
      closeOnEscape={false}
      padding={0}
      styles={{
        body: { height: '100vh', display: 'flex', flexDirection: 'column' },
        content: { overflow: 'hidden' },
      }}
      aria-label="Layout Builder"
    >
      <div
        data-testid="builder-keyboard-handler"
        style={{
          ...builderShellVars,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--wpsg-builder-surface)',
          color: 'var(--wpsg-builder-text)',
        }}
      >
        {/* ── Header Bar ── */}
        <Box
          px="md"
          py="xs"
          style={{
            borderBottom: '1px solid var(--wpsg-builder-border)',
            background: 'var(--wpsg-builder-surface)',
            flexShrink: 0,
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            {/* Left: name + undo/redo */}
            <Group gap="sm" wrap="nowrap">
              <Group gap={4} wrap="nowrap" align="center">
                {builder.isDirty && (
                  <Box
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--mantine-color-yellow-5)',
                      flexShrink: 0,
                    }}
                    aria-label="Unsaved changes"
                  />
                )}
                <TextInput
                  value={builder.template.name}
                  onChange={(e) => builder.setName(e.currentTarget.value)}
                  variant="unstyled"
                  size="lg"
                  styles={{
                    input: {
                      fontWeight: 700,
                      fontSize: 'var(--mantine-font-size-lg)',
                      padding: '0 4px',
                      height: 'auto',
                    },
                  }}
                  aria-label="Template name"
                />
              </Group>
              <Divider orientation="vertical" />
              <Tooltip label="Undo (Ctrl+Z)">
                <ActionIcon
                  variant="subtle"
                  disabled={!builder.canUndo}
                  onClick={builder.undo}
                  aria-label="Undo"
                >
                  <IconArrowBackUp size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Redo (Ctrl+Shift+Z)">
                <ActionIcon
                  variant="subtle"
                  disabled={!builder.canRedo}
                  onClick={builder.redo}
                  aria-label="Redo"
                >
                  <IconArrowForwardUp size={18} />
                </ActionIcon>
              </Tooltip>
              {/* P30-E: history dropdown replaces the dock tab */}
              <BuilderHistoryDropdown
                historyEntries={builder.historyEntries}
                historyCurrentIndex={builder.historyCurrentIndex}
                isHistoryTrimmed={builder.isHistoryTrimmed}
                onJump={builder.jumpToHistoryIndex}
              />
            </Group>

            {/* Right: import/export + preview + save + close */}
            <Group gap="sm" wrap="nowrap">
              <Tooltip label="Export layout as JSON">
                <ActionIcon variant="subtle" onClick={handleExportJson} aria-label="Export JSON">
                  <IconDownload size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Import layout from JSON">
                <ActionIcon
                  variant="subtle"
                  onClick={() => importFileRef.current?.click()}
                  aria-label="Import JSON"
                >
                  <IconUpload size={18} />
                </ActionIcon>
              </Tooltip>
              <Divider orientation="vertical" />
              <Tooltip label={builder.isPreview ? 'Edit mode' : 'Preview mode'}>
                <ActionIcon
                  variant={builder.isPreview ? 'filled' : 'subtle'}
                  onClick={builder.togglePreview}
                  aria-label={builder.isPreview ? 'Exit preview' : 'Preview'}
                >
                  {builder.isPreview ? (
                    <IconEyeOff size={18} />
                  ) : (
                    <IconEye size={18} />
                  )}
                </ActionIcon>
              </Tooltip>
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSave}
                loading={isSaving}
                disabled={!builder.isDirty}
                size="sm"
              >
                Save
              </Button>
              <Button variant="subtle" onClick={handleClose} size="sm">
                Close
              </Button>
            </Group>
          </Group>
        </Box>

        {/* ── Main workspace: dockview (P17-E) ── */}
        <BuilderDockContext.Provider value={contextValue}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <DockviewReact
              components={dockComponents}
              onReady={handleDockReady}
              theme={dockTheme}
            />
          </div>
        </BuilderDockContext.Provider>

        {/* ── Builder keyboard shortcuts help modal ── */}
        <BuilderKeyboardShortcutsModal
          opened={builderShortcutsOpen}
          onClose={() => setBuilderShortcutsOpen(false)}
        />

        {/* Hidden file input for JSON import */}
        <input
          ref={importFileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleImportJson}
        />

        {/* ARIA live region for screen reader announcements */}
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {a11yAnnouncement}
        </div>
      </div>
    </Modal>
  );
}

setWpsgDebugDisplayName(LayoutBuilderModal, 'LayoutBuilder:LayoutBuilderModal');