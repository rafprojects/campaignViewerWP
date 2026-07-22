import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
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
import { DockviewReact, DockviewDefaultTab } from 'dockview';
import { debugGroup, debugLog, debugGroupEnd } from '@/utils/debug';
import {
  BuilderDockContext,
  type BuilderDockContextValue,
} from './BuilderDockContext';
import { LayoutBuilderLayersPanel } from './LayoutBuilderLayersPanel';
import { LayoutBuilderMediaPanel } from './LayoutBuilderMediaPanel';
import { LayoutBuilderCanvasPanel } from './LayoutBuilderCanvasPanel';
import { LayoutBuilderPropertiesPanel } from './LayoutBuilderPropertiesPanel';
import { BuilderKeyboardShortcutsModal } from './BuilderKeyboardShortcutsModal';
import { LayoutBuilderMenuBar } from './LayoutBuilderMenuBar';
import { AutoGridDialog } from './AutoGridDialog';
import { BuilderHistoryPanel } from './BuilderHistoryPanel';
import { BuilderHistoryDropdown } from './BuilderHistoryDropdown';
import { useAssetLibrary } from '@/services/layoutTemplateQuery';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { useRootId } from '@wp-super-gallery/shared-ui';
import { useBuilderWorkspacePrefs } from '@/hooks/useBuilderWorkspacePrefs';
import { useBuilderCampaignMedia } from '@/hooks/useBuilderCampaignMedia';
import { useBroadcastStaleness } from '@/hooks/useBroadcastStaleness';
import { useBuilderDraftRestore } from '@/hooks/useBuilderDraftRestore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLayoutBuilderFileIO } from '@/hooks/useLayoutBuilderFileIO';
import { useLayoutBuilderAssets } from '@/hooks/useLayoutBuilderAssets';
import { useLayoutBuilderKeyboardHandlers } from '@/hooks/useLayoutBuilderKeyboardHandlers';
import { useBuilderDockLayout } from '@/hooks/useBuilderDockLayout';

// ── Dockview panel components (stable reference outside component) ──────────

const dockComponents = {
  layers: LayoutBuilderLayersPanel,
  media: LayoutBuilderMediaPanel,
  canvas: LayoutBuilderCanvasPanel,
  properties: LayoutBuilderPropertiesPanel,
  history: BuilderHistoryPanel,
};

// Canvas must always be visible — the builder is non-functional without it.
function CanvasTabNoClose(props: React.ComponentProps<typeof DockviewDefaultTab>) {
  return <DockviewDefaultTab {...props} hideClose />;
}

const dockTabComponents = { canvas: CanvasTabNoClose };


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
  /** P50-K: active admin space scope ('all' or a space id). Scopes the asset library to that space. */
  spaceId?: string | undefined;
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
  spaceId,
}: LayoutBuilderModalProps) {
  const { t: tr } = useTranslation('wpsg');
  const builder = useLayoutBuilderState(initialTemplate ?? createEmptyTemplate());
  const rootId = useRootId();
  const { colorScheme } = useTheme();
  const shellColors = useBuilderShellColors();
  const [isSaving, setIsSaving] = useState(false);

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
  const { data: assetLibrary, refetch: refetchAssetLibrary } = useAssetLibrary(apiClient, opened, spaceId);

  const [builderShortcutsOpen, setBuilderShortcutsOpen] = useState(false);
  const [historyDropdownOpen, setHistoryDropdownOpen] = useState(false);
  const [gridDialogOpen, setGridDialogOpen] = useState(false);

  // ── P30-B workspace preferences ──
  const {
    snapMode, setSnapMode,
    snapThreshold, setSnapThreshold,
    showGrid, setShowGrid,
    gridSizePx, setGridSizePx,
    showRulers, setShowRulers,
    showMeasurements, setShowMeasurements,
    designAssetsOpen, setDesignAssetsOpen,
    layoutScope, setLayoutScope,
    savedSwatches, addSwatch,
  } = useBuilderWorkspacePrefs(rootId);

  const bgSectionRef = useRef<HTMLDivElement>(null);
  // ── Layer panel selection (overlay + background tracked locally; slot uses builder state) ──
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [isBackgroundSelected, setIsBackgroundSelected] = useState(false);
  const [selectedMaskSlotId, setSelectedMaskSlotId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
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

  // ── A11y announce helper ──
  const announce = useCallback((msg: string) => {
    setA11yAnnouncement(msg);
    // Clear after screen reader has time to read it
    setTimeout(() => setA11yAnnouncement(''), 3000);
  }, []);

  // ── Close with dirty guard ──
  const handleClose = useCallback(() => {
    if (builder.isDirty) {
      modals.openConfirmModal({
        title: tr('lb_mod_discard_title', 'Discard changes?'),
        children: <Text size="sm">{tr('lb_mod_discard_body', 'You have unsaved changes. Discard them?')}</Text>,
        labels: {
          confirm: tr('lb_mod_discard', 'Discard'),
          cancel: tr('lb_mod_keep_editing', 'Keep editing'),
        },
        confirmProps: { color: 'red' },
        onConfirm: () => { builder.clearDraft(); onClose(); },
      });
      return;
    }

    builder.clearDraft();
    onClose();
  }, [builder, onClose, tr]);

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
      onNotify?.({ type: 'success', text: tr('lb_mod_saved', 'Layout "{{name}}" saved', { name: saved.name }) });
      notifications.show({ message: tr('lb_mod_saved', 'Layout "{{name}}" saved', { name: saved.name }), color: 'green', autoClose: 3000 });
      // P30-D: Notify other tabs that this template was saved
      postSaved(saved.id);
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to save layout';
      onNotify?.({ type: 'error', text: errMsg });
      notifications.show({ title: tr('lb_mod_save_failed', 'Save failed'), message: errMsg, color: 'red', autoClose: 5000 });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [builder, apiClient, onSaved, onNotify, postSaved, tr]);

  // ── Delete selected slots (or the selected guide — P59-F) ──
  const handleDeleteSelected = useCallback(() => {
    if (selectedGuideId) {
      builder.removeGuide(selectedGuideId);
      setSelectedGuideId(null);
      notifications.show({ message: tr('lb_mod_guide_deleted', 'Guide deleted'), color: 'gray', autoClose: 2500 });
      return;
    }
    const ids = Array.from(builder.selectedSlotIds);
    if (ids.length === 0) return;
    builder.removeSlots(ids);
    notifications.show({
      message: tr('lb_mod_slots_deleted', '{{count}} slot deleted', { count: ids.length }),
      color: 'gray',
      autoClose: 2500,
    });
  }, [builder, selectedGuideId, tr]);

  // ── Duplicate selected slots ──
  const handleDuplicateSelected = useCallback(() => {
    const ids = Array.from(builder.selectedSlotIds);
    if (ids.length === 0) return;
    builder.duplicateSlots(ids);
    notifications.show({
      message: tr('lb_mod_slots_duplicated', '{{count}} slot duplicated', { count: ids.length }),
      color: 'blue',
      autoClose: 2500,
    });
  }, [builder, tr]);

  // ── JSON file I/O ──
  const { importFileRef, handleExportJson, handleImportJson } = useLayoutBuilderFileIO({ builder });

  // ── Asset / overlay / background upload handlers ──
  const {
    isUploadingAsset, isUploadingBg,
    handleUploadAsset, handleDeleteLibraryAsset, handleSetAssetUniversal,
    handleSetAssetTags, handleUploadBgImage, handleUploadMask,
  } = useLayoutBuilderAssets({ apiClient, refetchAssetLibrary, builder, announce, onNotify });

  // ── Group actions (used by contextual toolbar) ──
  const handleCreateGroup = useCallback(() => {
    const ids = [...builder.selectedSlotIds];
    if (ids.length < 2) return;
    builder.createGroup(ids);
    announce(`Group created (${ids.length} slots)`);
    notifications.show({ message: tr('lb_mod_group_created', 'Group created ({{count}} slots)', { count: ids.length }), color: 'blue', autoClose: 2500 });
  }, [builder, announce, tr]);

  // The toolbar always resolves the target group before calling this and passes
  // the explicit groupId — no need to re-derive from selection here.
  // Keyboard Ctrl+Shift+G has its own inline dissolve logic.
  const handleUngroupSelected = useCallback((groupId: string) => {
    builder.dissolveGroup(groupId);
    announce('Ungrouped');
    notifications.show({ message: tr('lb_mod_ungrouped', 'Ungrouped'), color: 'gray', autoClose: 2500 });
  }, [builder, announce, tr]);

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
      message: tr('lb_mod_media_assigned', '{{count}} media item assigned', { count: assignedCount }),
      color: 'blue',
      autoClose: 3000,
    });
  }, [builder, media, announce, tr]);

  // ── Keyboard shortcuts ──
  useLayoutBuilderKeyboardHandlers({
    opened,
    builder,
    announce,
    handleClose,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleSave,
    setSelectedOverlayId,
    setIsBackgroundSelected,
    setBuilderShortcutsOpen,
  });

  // ── Dock layout ──
  const { dockApiRef, handleDockReady } = useBuilderDockLayout({
    rootId,
    layoutScope,
    initialTemplateId: initialTemplate?.id ?? '',
  });

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

  // ── Get selected text layer (P59-B) ──
  const selectedText = selectedTextId
    ? builder.template.texts?.find((t) => t.id === selectedTextId)
    : undefined;

  // ── Context value for dock panels (P17-E) ──
  const contextValue: BuilderDockContextValue = {
    builder, isSaving, apiClient, media, campaigns, selectedCampaignId, setSelectedCampaignId,
    assetLibrary, isUploadingAsset, isUploadingBg,
    selectedSlot, selectedOverlayId, setSelectedOverlayId, selectedOverlay,
    selectedOverlayIndex, isBackgroundSelected, setIsBackgroundSelected,
    selectedMaskSlotId, setSelectedMaskSlotId,
    selectedTextId, setSelectedTextId, selectedText,
    snapMode, setSnapMode, snapThreshold, setSnapThreshold,
    showGrid, setShowGrid, gridSizePx, setGridSizePx,
    showRulers, setShowRulers, showMeasurements, setShowMeasurements,
    designAssetsOpen, setDesignAssetsOpen, bgSectionRef, dockApiRef,
    savedSwatches, addSwatch,
    guides: builder.template.guides ?? [],
    addGuide: builder.addGuide,
    moveGuide: builder.moveGuide,
    removeGuide: builder.removeGuide,
    toggleGuideLock: builder.toggleGuideLock,
    clearGuides: builder.clearGuides,
    selectedGuideId,
    setSelectedGuideId,
    announce,
    handleSave, handleClose, handleAutoAssign, handleUploadAsset,
    handleDeleteLibraryAsset, handleSetAssetUniversal, handleSetAssetTags, handleUploadBgImage,
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
      aria-label={tr('lb_mod_aria', 'Layout Builder')}
    >
      <ErrorBoundary
        fallback={
          <Box
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              height: '100vh',
              padding: 32,
            }}
          >
            <Text fw={600} size="lg">{tr('lb_mod_err_title', 'Something went wrong in the Layout Editor')}</Text>
            <Text size="sm" c="dimmed" ta="center">
              {tr('lb_mod_err_body', 'An unexpected error occurred. Close the editor and try again.')}
            </Text>
            <Button variant="light" color="red" onClick={onClose}>
              {tr('lb_mod_close_editor', 'Close Editor')}
            </Button>
          </Box>
        }
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
                    aria-label={tr('lb_mod_unsaved', 'Unsaved changes')}
                  />
                )}
                <TextInput
                  value={builder.template.name}
                  onChange={(e) => builder.setTemplateField('name', e.currentTarget.value)}
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
                  aria-label={tr('lb_mod_template_name', 'Template name')}
                />
              </Group>
              <Divider orientation="vertical" />
              <Tooltip label={tr('lb_mod_undo_tt', 'Undo (Ctrl+Z)')}>
                <ActionIcon
                  variant="subtle"
                  disabled={!builder.canUndo}
                  onClick={builder.undo}
                  aria-label={tr('lb_mod_undo', 'Undo')}
                >
                  <IconArrowBackUp size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={tr('lb_mod_redo_tt', 'Redo (Ctrl+Shift+Z)')}>
                <ActionIcon
                  variant="subtle"
                  disabled={!builder.canRedo}
                  onClick={builder.redo}
                  aria-label={tr('lb_mod_redo', 'Redo')}
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
                opened={historyDropdownOpen}
                onOpenedChange={setHistoryDropdownOpen}
              />
            </Group>

            {/* Centre: menu bar */}
            <LayoutBuilderMenuBar
              canUndo={builder.canUndo}
              canRedo={builder.canRedo}
              hasSelection={builder.selectedSlotIds.size > 0}
              onUndo={builder.undo}
              onRedo={builder.redo}
              onDuplicate={handleDuplicateSelected}
              onDelete={handleDeleteSelected}
              onOpenHistory={() => setHistoryDropdownOpen(true)}
              onOpenGridGenerator={() => setGridDialogOpen(true)}
              onExport={handleExportJson}
              onImport={() => importFileRef.current?.click()}
              onSave={handleSave}
              onClose={handleClose}
              showGrid={showGrid}
              setShowGrid={setShowGrid}
              showRulers={showRulers}
              setShowRulers={setShowRulers}
              showMeasurements={showMeasurements}
              setShowMeasurements={setShowMeasurements}
              dockApiRef={dockApiRef}
              templateId={initialTemplate?.id ?? ''}
              rootId={rootId}
              layoutScope={layoutScope}
              setLayoutScope={setLayoutScope}
              guideCount={(builder.template.guides ?? []).length}
              onClearGuides={builder.clearGuides}
            />

            {/* Right: preview + save + close */}
            <Group gap="sm" wrap="nowrap">
              <Tooltip label={builder.isPreview ? tr('lb_mod_edit_mode', 'Edit mode') : tr('lb_mod_preview_mode', 'Preview mode')}>
                <ActionIcon
                  variant={builder.isPreview ? 'filled' : 'subtle'}
                  onClick={builder.togglePreview}
                  aria-label={builder.isPreview ? tr('lb_mod_exit_preview', 'Exit preview') : tr('lb_mod_preview', 'Preview')}
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
                {tr('lb_mod_save', 'Save')}
              </Button>
              <Button variant="subtle" onClick={handleClose} size="sm">
                {tr('lb_mod_close', 'Close')}
              </Button>
            </Group>
          </Group>
        </Box>

        {/* ── Main workspace: dockview (P17-E) ── */}
        <BuilderDockContext.Provider value={contextValue}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <DockviewReact
              components={dockComponents}
              tabComponents={dockTabComponents}
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

        {/* ── Auto-grid generator (P58-F) ── */}
        <AutoGridDialog
          opened={gridDialogOpen}
          onClose={() => setGridDialogOpen(false)}
          onGenerate={(opts) => {
            const ids = builder.generateGrid(opts);
            if (ids.length > 0) {
              setSelectedOverlayId(null);
              setIsBackgroundSelected(false);
              setSelectedGuideId(null);
              announce(tr('lb_mod_generated', 'Generated {{count}} slot', { count: ids.length }));
            }
          }}
          hasExistingSlots={builder.template.slots.length > 0}
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
      </ErrorBoundary>
    </Modal>
  );
}

setWpsgDebugDisplayName(LayoutBuilderModal, 'LayoutBuilder:LayoutBuilderModal');
