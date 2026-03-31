import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { safeLocalStorage } from '../../../utils/safeLocalStorage';
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
  SegmentedControl,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconDeviceFloppy,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react';
import type { LayoutTemplate, MediaItem } from '@/types';
import type { ApiClient } from '@/services/apiClient';
import {
  useLayoutBuilderState,
  createEmptyTemplate,
} from '@/hooks/useLayoutBuilderState';
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

// ── Dockview panel components (stable reference outside component) ──────────

const dockComponents = {
  layers: LayoutBuilderLayersPanel,
  media: LayoutBuilderMediaPanel,
  canvas: LayoutBuilderCanvasPanel,
  properties: LayoutBuilderPropertiesPanel,
  history: BuilderHistoryPanel,
};

// ── Aspect ratio presets ─────────────────────────────────────

const ASPECT_PRESETS = [
  { label: '16:9', value: String(16 / 9) },
  { label: '4:3', value: String(4 / 3) },
  { label: '1:1', value: '1' },
  { label: '3:2', value: String(3 / 2) },
  { label: '21:9', value: String(21 / 9) },
] as const;

// ── Props ────────────────────────────────────────────────────

export interface LayoutBuilderModalProps {
  opened: boolean;
  onClose: () => void;
  apiClient: ApiClient;
  /** Existing template to edit — undefined = new template. */
  initialTemplate?: LayoutTemplate;
  onSaved?: (template: LayoutTemplate) => void;
  onNotify?: (msg: { type: 'error' | 'success'; text: string }) => void;
}

// ── Component ────────────────────────────────────────────────

export function LayoutBuilderModal({
  opened,
  onClose,
  apiClient,
  initialTemplate,
  onSaved,
  onNotify,
}: LayoutBuilderModalProps) {
  const builder = useLayoutBuilderState(initialTemplate ?? createEmptyTemplate());
  const dockApiRef = useRef<DockviewApi | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Fetch campaign list for the media picker ──
  const { data: campaigns } = useSWR<Array<{ id: number; title: string }>>(
    opened ? 'builder-campaigns' : null,
    async () => {
      const response = await apiClient.get<{ items: Array<{ id: number; title: string }> }>(
        '/wp-json/wp-super-gallery/v1/campaigns?per_page=50',
      );
      return response.items ?? [];
    },
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const campaignSelectionStorageKey = useMemo(
    () => `wpsg_layout_builder_campaign_${initialTemplate?.id ?? 'new'}`,
    [initialTemplate?.id],
  );

  // Restore campaign selection when editor opens.
  useEffect(() => {
    if (!opened || !campaigns || campaigns.length === 0) return;

    const saved = safeLocalStorage.getItem(campaignSelectionStorageKey);
    const hasSaved = saved && campaigns.some((c) => String(c.id) === saved);

    if (hasSaved) {
      setSelectedCampaignId(saved);
      return;
    }

    setSelectedCampaignId((curr) => {
      if (curr && campaigns.some((c) => String(c.id) === curr)) return curr;
      return String(campaigns[0].id);
    });
  }, [opened, campaigns, campaignSelectionStorageKey]);

  // Persist campaign selection per-layout while editing.
  useEffect(() => {
    if (!selectedCampaignId) return;
    safeLocalStorage.setItem(campaignSelectionStorageKey, selectedCampaignId);
  }, [selectedCampaignId, campaignSelectionStorageKey]);

  // ── Fetch media for the selected campaign ──
  const { data: campaignMedia } = useSWR<MediaItem[]>(
    selectedCampaignId ? `builder-campaign-media-${selectedCampaignId}` : null,
    async () => {
      const res = await apiClient.get<MediaItem[] | { items?: MediaItem[] }>(
        `/wp-json/wp-super-gallery/v1/campaigns/${selectedCampaignId}/media`,
      );
      return Array.isArray(res) ? res : res.items ?? [];
    },
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
  const media = useMemo(() => campaignMedia ?? [], [campaignMedia]);

  // ── Overlay library (P15-H) ──
  const { data: overlayLibrary, mutate: mutateOverlayLibrary } = useSWR<OverlayLibraryItem[]>(
    opened ? 'overlay-library' : null,
    () => apiClient.get<OverlayLibraryItem[]>('/wp-json/wp-super-gallery/v1/admin/overlay-library'),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const [isUploadingOverlay, setIsUploadingOverlay] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);

  const [builderShortcutsOpen, setBuilderShortcutsOpen] = useState(false);

  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapThreshold, setSnapThreshold] = useState(5);
  const [designAssetsOpen, setDesignAssetsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('wpsg_builder_design_assets_open');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
  const bgSectionRef = useRef<HTMLDivElement>(null);
  // ── Layer panel selection (overlay + background tracked locally; slot uses builder state) ──
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [isBackgroundSelected, setIsBackgroundSelected] = useState(false);
  const [selectedMaskSlotId, setSelectedMaskSlotId] = useState<string | null>(null);
  const [a11yAnnouncement, setA11yAnnouncement] = useState('');

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
        onConfirm: onClose,
      });
      return;
    }

    onClose();
  }, [builder.isDirty, onClose]);

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
      onSaved?.(saved);
      onNotify?.({ type: 'success', text: `Layout "${saved.name}" saved` });
      return true;
    } catch (err) {
      onNotify?.({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save layout',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [builder, apiClient, onSaved, onNotify]);

  // ── Save & Close ──
  const handleSaveAndClose = useCallback(async () => {
    const saved = await handleSave();
    if (saved) onClose();
  }, [handleSave, onClose]);

  // ── Delete selected slots ──
  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(builder.selectedSlotIds);
    if (ids.length === 0) return;
    builder.removeSlots(ids);
  }, [builder]);

  // ── Duplicate selected slots ──
  const handleDuplicateSelected = useCallback(() => {
    const ids = Array.from(builder.selectedSlotIds);
    if (ids.length === 0) return;
    builder.duplicateSlots(ids);
  }, [builder]);

  // ── A11y announce helper ──
  const announce = useCallback((msg: string) => {
    setA11yAnnouncement(msg);
    // Clear after screen reader has time to read it
    setTimeout(() => setA11yAnnouncement(''), 3000);
  }, []);

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
        await mutateOverlayLibrary();
        builder.addOverlay(entry.url);
        announce('Overlay uploaded and added to canvas');
      } catch (err) {
        onNotify?.({
          type: 'error',
          text: err instanceof Error ? err.message : 'Overlay upload failed',
        });
      } finally {
        setIsUploadingOverlay(false);
      }
    },
    [apiClient, mutateOverlayLibrary, builder, announce, onNotify],
  );

  const handleDeleteLibraryOverlay = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/admin/overlay-library/${id}`);
        await mutateOverlayLibrary();
      } catch (err) {
        onNotify?.({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to delete overlay',
        });
      }
    },
    [apiClient, mutateOverlayLibrary, onNotify],
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
      } catch (err) {
        onNotify?.({
          type: 'error',
          text: err instanceof Error ? err.message : 'Background image upload failed',
        });
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

  // ── Auto-assign media ──
  const handleAutoAssign = useCallback(() => {
    const mediaIds = media.map((m) => m.id);
    builder.autoAssignMedia(mediaIds, media);
    announce(`Auto-assigned ${Math.min(mediaIds.length, builder.template.slots.length)} media items`);
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        handleDuplicateSelected();
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
    [announce, builder, handleClose, handleDeleteSelected, handleDuplicateSelected, handleSave],
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
    const LAYOUT_KEY = 'wpsg_builder_layout';
    const LAYOUT_VERSION = 1;
    const persistLayout = () => {
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify({ version: LAYOUT_VERSION, layout: event.api.toJSON() }));
      } catch { /* ignore storage errors */ }
    };
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Accept both versioned { version, layout } and legacy bare-JSON saves.
        const layout =
          parsed && typeof parsed === 'object' && 'layout' in parsed
            ? (parsed as { layout: unknown }).layout
            : parsed;
        event.api.fromJSON(layout as Parameters<typeof event.api.fromJSON>[0]);
        event.api.onDidLayoutChange(persistLayout);
        return;
      } catch {
        // Saved layout is invalid or incompatible — clear it so every
        // subsequent open doesn't repeat the same try/catch failure.
        try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
        // fall through to default layout
      }
    }
    // Default layout: Layers+Media+History tabs left | Canvas centre | Properties right
    const layersPanel = event.api.addPanel({ id: 'layers', component: 'layers', title: 'Layers' });
    event.api.addPanel({ id: 'media', component: 'media', title: 'Media & Assets', position: { direction: 'within', referencePanel: layersPanel } });
    event.api.addPanel({ id: 'history', component: 'history', title: 'History', position: { direction: 'within', referencePanel: layersPanel } });
    const canvasPanel = event.api.addPanel({ id: 'canvas', component: 'canvas', title: 'Canvas', position: { direction: 'right', referencePanel: layersPanel } });
    event.api.addPanel({ id: 'properties', component: 'properties', title: 'Properties', position: { direction: 'right', referencePanel: canvasPanel } });
    event.api.onDidLayoutChange(persistLayout);
  }, []);

  // ── Context value for dock panels (P17-E) ──
  const contextValue: BuilderDockContextValue = {
    builder, isSaving, media, campaigns, selectedCampaignId, setSelectedCampaignId,
    overlayLibrary, isUploadingOverlay, isUploadingBg,
    selectedSlot, selectedOverlayId, setSelectedOverlayId, selectedOverlay,
    selectedOverlayIndex, isBackgroundSelected, setIsBackgroundSelected,
    selectedMaskSlotId, setSelectedMaskSlotId,
    snapEnabled, setSnapEnabled, snapThreshold, setSnapThreshold,
    designAssetsOpen, setDesignAssetsOpen, bgSectionRef, dockApiRef,
    announce,
    handleSave, handleClose, handleAutoAssign, handleUploadOverlay,
    handleDeleteLibraryOverlay, handleUploadBgImage,
    handleDeleteSelected, handleDuplicateSelected, handleUploadMask,
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
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        {/* ── Header Bar ── */}
        <Box
          px="md"
          py="xs"
          style={{
            borderBottom: '1px solid var(--mantine-color-default-border)',
            background: 'var(--mantine-color-body)',
            flexShrink: 0,
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            {/* Left: name + undo/redo */}
            <Group gap="sm" wrap="nowrap">
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
            </Group>

            {/* Center: aspect ratio */}
            <Group gap="xs" wrap="nowrap">
              <Text size="xs" c="dimmed">
                Aspect:
              </Text>
              <SegmentedControl
                size="xs"
                value={String(builder.template.canvasAspectRatio)}
                onChange={(val) => builder.setAspectRatio(Number(val))}
                data={ASPECT_PRESETS.map((p) => ({
                  label: p.label,
                  value: p.value,
                }))}
              />
            </Group>

            {/* Right: preview + save + close */}
            <Group gap="sm" wrap="nowrap">
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
              {builder.isDirty && (
                <Text size="xs" c="dimmed" fs="italic">
                  Unsaved
                </Text>
              )}
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSave}
                loading={isSaving}
                disabled={!builder.isDirty}
                size="sm"
              >
                Save
              </Button>
              <Button
                variant="light"
                onClick={handleSaveAndClose}
                loading={isSaving}
                disabled={!builder.isDirty}
                size="sm"
              >
                Save &amp; Close
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
              className="dockview-theme-dark"
              components={dockComponents}
              onReady={handleDockReady}
            />
          </div>
        </BuilderDockContext.Provider>

        {/* ── Builder keyboard shortcuts help modal ── */}
        <BuilderKeyboardShortcutsModal
          opened={builderShortcutsOpen}
          onClose={() => setBuilderShortcutsOpen(false)}
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
