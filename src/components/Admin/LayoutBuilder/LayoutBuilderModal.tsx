import { useCallback, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
  Modal,
  Group,
  Button,
  TextInput,
  ActionIcon,
  Stack,
  Text,
  Tooltip,
  Divider,
  Box,
  SegmentedControl,
  NumberInput,
  Switch,
  Tabs,
  Slider,
  FileButton,
  Select,
} from '@mantine/core';
import {
  IconDeviceFloppy,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconTrash,
  IconCopy,
  IconList,
  IconPhoto,
  IconLayersLinked,
} from '@tabler/icons-react';
import type { LayoutTemplate, MediaItem } from '@/types';
import type { ApiClient } from '@/services/apiClient';
import {
  useLayoutBuilderState,
  createEmptyTemplate,
} from '@/hooks/useLayoutBuilderState';
import { LayoutCanvas } from './LayoutCanvas';
import { SlotPropertiesPanel } from './SlotPropertiesPanel';
import { MediaPickerSidebar } from './MediaPickerSidebar';
import { debugGroup, debugLog, debugGroupEnd } from '@/utils/debug';

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
  const canvasContainerRef = useRef<HTMLDivElement>(null);
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
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [leftTab, setLeftTab] = useState<string | null>('slots');
  const [a11yAnnouncement, setA11yAnnouncement] = useState('');

  // ── Close with dirty guard ──
  const handleClose = useCallback(() => {
    if (builder.isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Discard them?');
      if (!confirmed) return;
    }
    onClose();
  }, [builder.isDirty, onClose]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Normalize z-indices to sequential integers before saving (P15-G.3)
      builder.normalizeZIndices();
      const t = builder.template;

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

      builder.setTemplate(saved);
      builder.markSaved();
      onSaved?.(saved);
      onNotify?.({ type: 'success', text: `Layout "${saved.name}" saved` });
    } catch (err) {
      onNotify?.({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save layout',
      });
    } finally {
      setIsSaving(false);
    }
  }, [builder, apiClient, onSaved, onNotify]);

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

  // ── Auto-assign media ──
  const handleAutoAssign = useCallback(() => {
    const mediaIds = media.map((m) => m.id);
    builder.autoAssignMedia(mediaIds, media);
    announce(`Auto-assigned ${Math.min(mediaIds.length, builder.template.slots.length)} media items`);
  }, [builder, media, announce]);

  // ── Keyboard shortcuts ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
        builder.clearSelection();
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
    [builder, handleDeleteSelected, handleDuplicateSelected],
  );

  // ── Get selected slot for properties panel ──
  const selectedSlot =
    builder.selectedSlotIds.size === 1
      ? builder.template.slots.find(
          (s) => s.id === Array.from(builder.selectedSlotIds)[0],
        )
      : undefined;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      fullScreen
      withCloseButton={false}
      padding={0}
      styles={{
        body: { height: '100vh', display: 'flex', flexDirection: 'column' },
        content: { overflow: 'hidden' },
      }}
      aria-label="Layout Builder"
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        onKeyDown={handleKeyDown}
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
              <Button variant="subtle" onClick={handleClose} size="sm">
                Close
              </Button>
            </Group>
          </Group>
        </Box>

        {/* ── Main workspace ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left toolbar — slot list + media picker (tabbed) */}
          {!builder.isPreview && (
            <Box
              w={240}
              style={{
                borderRight: '1px solid var(--mantine-color-default-border)',
                overflowY: 'auto',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Tabs
                value={leftTab}
                onChange={setLeftTab}
                variant="outline"
                styles={{
                  root: { display: 'flex', flexDirection: 'column', height: '100%' },
                  panel: { flex: 1, overflow: 'auto', padding: 'var(--mantine-spacing-sm)' },
                }}
              >
                <Tabs.List>
                  <Tabs.Tab value="slots" leftSection={<IconList size={14} />}>
                    Slots
                  </Tabs.Tab>
                  <Tabs.Tab value="media" leftSection={<IconPhoto size={14} />}>
                    Media
                  </Tabs.Tab>
                  <Tabs.Tab value="overlays" leftSection={<IconLayersLinked size={14} />}>
                    Overlays
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="slots">
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={600}>
                      Slots ({builder.template.slots.length})
                    </Text>
                    <Group gap={4}>
                      <Tooltip label="Add slot">
                        <ActionIcon
                          size="sm"
                          variant="light"
                          onClick={() => builder.addSlot()}
                          aria-label="Add slot"
                        >
                          <IconPlus size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete selected">
                        <ActionIcon
                          size="sm"
                          variant="light"
                          color="red"
                          onClick={handleDeleteSelected}
                          disabled={builder.selectedSlotIds.size === 0}
                          aria-label="Delete selected slots"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Duplicate selected">
                        <ActionIcon
                          size="sm"
                          variant="light"
                          onClick={handleDuplicateSelected}
                          disabled={builder.selectedSlotIds.size === 0}
                          aria-label="Duplicate selected slots"
                        >
                          <IconCopy size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>

                  {/* Layer-ordered slot list (highest z-index first) */}
                  <Stack gap={4}>
                    {[...builder.template.slots]
                      .sort((a, b) => b.zIndex - a.zIndex)
                      .map((slot) => {
                        const origIndex = builder.template.slots.findIndex(
                          (s) => s.id === slot.id,
                        );
                        return (
                          <Button
                            key={slot.id}
                            size="xs"
                            variant={
                              builder.selectedSlotIds.has(slot.id) ? 'filled' : 'subtle'
                            }
                            justify="flex-start"
                            fullWidth
                            onClick={(e: React.MouseEvent) => {
                              if (e.shiftKey) {
                                builder.toggleSlotSelection(slot.id);
                              } else {
                                builder.selectSlot(slot.id);
                              }
                            }}
                            styles={{
                              label: {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'space-between',
                              },
                            }}
                          >
                            <span>
                              Slot {origIndex + 1}
                              {slot.mediaId ? ' ✓' : ''}
                            </span>
                            <Text
                              component="span"
                              size="xs"
                              c="dimmed"
                              style={{ fontWeight: 400 }}
                            >
                              z{slot.zIndex}
                            </Text>
                          </Button>
                        );
                      })}
                    {builder.template.slots.length === 0 && (
                      <Text size="xs" c="dimmed" ta="center" py="md">
                        No slots yet. Click + to add one.
                      </Text>
                    )}
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="media">
                  <Select
                    size="xs"
                    mb="sm"
                    placeholder="Choose a campaign…"
                    value={selectedCampaignId}
                    onChange={setSelectedCampaignId}
                    data={(campaigns ?? []).map((c) => ({
                      value: String(c.id),
                      label: c.title,
                    }))}
                    clearable
                    searchable
                    aria-label="Select campaign for media"
                  />
                  <MediaPickerSidebar
                    media={media}
                    template={builder.template}
                    selectedSlotIds={builder.selectedSlotIds}
                    onAssignMedia={builder.assignMediaToSlot}
                    onClearMedia={builder.clearSlotMedia}
                    onAutoAssign={handleAutoAssign}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="overlays">
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={600}>
                      Overlays ({builder.template.overlays.length})
                    </Text>
                    <FileButton
                      accept="image/png,image/svg+xml,image/webp"
                      onChange={(file) => {
                        if (!file) return;
                        const url = URL.createObjectURL(file);
                        builder.addOverlay(url);
                        announce('Overlay added');
                      }}
                    >
                      {(props) => (
                        <Tooltip label="Add overlay image">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            {...props}
                            aria-label="Add overlay"
                          >
                            <IconPlus size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </FileButton>
                  </Group>

                  <TextInput
                    placeholder="Or paste image URL…"
                    size="xs"
                    mb="xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        builder.addOverlay(e.currentTarget.value.trim());
                        e.currentTarget.value = '';
                        announce('Overlay added from URL');
                      }
                    }}
                    aria-label="Overlay image URL"
                  />

                  <Stack gap={4}>
                    {builder.template.overlays.map((overlay, idx) => (
                      <Box
                        key={overlay.id}
                        p="xs"
                        style={{
                          border: '1px solid var(--mantine-color-default-border)',
                          borderRadius: 4,
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap" mb={4}>
                          <Text size="xs" fw={500} lineClamp={1}>
                            Overlay {idx + 1}
                          </Text>
                          <ActionIcon
                            size="xs"
                            color="red"
                            variant="subtle"
                            onClick={() => builder.removeOverlay(overlay.id)}
                            aria-label={`Remove overlay ${idx + 1}`}
                          >
                            <IconTrash size={12} />
                          </ActionIcon>
                        </Group>
                        <img
                          src={overlay.imageUrl}
                          alt={`Overlay ${idx + 1}`}
                          style={{
                            width: '100%',
                            height: 40,
                            objectFit: 'contain',
                            borderRadius: 2,
                            background: 'var(--mantine-color-dark-7)',
                            marginBottom: 4,
                          }}
                        />
                        <Text size="xs" c="dimmed" mb={2}>
                          Opacity
                        </Text>
                        <Slider
                          value={overlay.opacity}
                          onChange={(val) =>
                            builder.updateOverlay(overlay.id, { opacity: val })
                          }
                          min={0}
                          max={1}
                          step={0.05}
                          size="xs"
                          label={(v) => `${Math.round(v * 100)}%`}
                        />
                        <Group gap={4} mt={4}>
                          <Text size="xs" c="dimmed">
                            Click-through:
                          </Text>
                          <Switch
                            size="xs"
                            checked={!overlay.pointerEvents}
                            onChange={(e) =>
                              builder.updateOverlay(overlay.id, {
                                pointerEvents: !e.currentTarget.checked,
                              })
                            }
                            aria-label="Toggle click-through"
                          />
                        </Group>
                      </Box>
                    ))}
                    {builder.template.overlays.length === 0 && (
                      <Text size="xs" c="dimmed" ta="center" py="md">
                        No overlays. Upload a transparent PNG/SVG.
                      </Text>
                    )}
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </Box>
          )}

          {/* Center: canvas workspace */}
          <Box
            ref={canvasContainerRef}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--mantine-color-dark-8)',
                overflow: 'auto',
                padding: 24,
              }}
            >
              <LayoutCanvas
                template={builder.template}
                selectedSlotIds={builder.selectedSlotIds}
                isPreview={builder.isPreview}
                media={media}
                snapEnabled={snapEnabled}
                onSlotMove={builder.moveSlot}
                onSlotResize={builder.resizeSlot}
                onSlotSelect={builder.selectSlot}
                onSlotToggleSelect={builder.toggleSlotSelection}
                onCanvasClick={builder.clearSelection}
                onMediaDrop={builder.assignMediaToSlot}
                onAnnounce={announce}
                onOverlayMove={builder.moveOverlay}
                onOverlayResize={builder.resizeOverlay}
              />
            </Box>

            {/* Footer: canvas size controls */}
            {!builder.isPreview && (
              <Box
                px="md"
                py={6}
                style={{
                  borderTop: '1px solid var(--mantine-color-default-border)',
                  background: 'var(--mantine-color-body)',
                  flexShrink: 0,
                }}
              >
                <Group gap="md" justify="center" wrap="nowrap">
                  <Group gap={4} wrap="nowrap">
                    <Text size="xs" c="dimmed">
                      Max width:
                    </Text>
                    <NumberInput
                      value={builder.template.canvasMaxWidth || 0}
                      onChange={(val) => {
                        const n = Number(val) || 0;
                        builder.setTemplate({
                          ...builder.template,
                          canvasMaxWidth: n,
                          updatedAt: new Date().toISOString(),
                        });
                      }}
                      min={0}
                      max={3840}
                      step={10}
                      size="xs"
                      w={80}
                      suffix="px"
                      aria-label="Canvas max width"
                    />
                  </Group>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => {
                      builder.setTemplate({
                        ...builder.template,
                        canvasMaxWidth: 0,
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                  >
                    Fit to container
                  </Button>
                  <Divider orientation="vertical" />
                  <Switch
                    label="Snap"
                    size="xs"
                    checked={snapEnabled}
                    onChange={(e) => setSnapEnabled(e.currentTarget.checked)}
                    aria-label="Toggle snap guides"
                  />
                </Group>
              </Box>
            )}
          </Box>

          {/* Right: properties panel */}
          {!builder.isPreview && selectedSlot && (
            <Box
              w={280}
              p="sm"
              style={{
                borderLeft: '1px solid var(--mantine-color-default-border)',
                overflowY: 'auto',
                flexShrink: 0,
              }}
            >
              <SlotPropertiesPanel
                slot={selectedSlot}
                onUpdate={(updates) =>
                  builder.updateSlot(selectedSlot.id, updates)
                }
                onBringToFront={() => builder.bringToFront([selectedSlot.id])}
                onSendToBack={() => builder.sendToBack([selectedSlot.id])}
                onBringForward={() => builder.bringForward([selectedSlot.id])}
                onSendBackward={() => builder.sendBackward([selectedSlot.id])}
              />
            </Box>
          )}
        </div>

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
