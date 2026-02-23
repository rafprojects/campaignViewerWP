import { useCallback, useRef, useState } from 'react';
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
} from '@tabler/icons-react';
import type { LayoutTemplate, MediaItem } from '@/types';
import type { ApiClient } from '@/services/apiClient';
import {
  useLayoutBuilderState,
  createEmptyTemplate,
} from '@/hooks/useLayoutBuilderState';
import { LayoutCanvas } from './LayoutCanvas';
import { SlotPropertiesPanel } from './SlotPropertiesPanel';

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
  /** Campaign media for preview assignment. */
  media?: MediaItem[];
  onSaved?: (template: LayoutTemplate) => void;
  onNotify?: (msg: { type: 'error' | 'success'; text: string }) => void;
}

// ── Component ────────────────────────────────────────────────

export function LayoutBuilderModal({
  opened,
  onClose,
  apiClient,
  initialTemplate,
  media = [],
  onSaved,
  onNotify,
}: LayoutBuilderModalProps) {
  const builder = useLayoutBuilderState(initialTemplate ?? createEmptyTemplate());
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      const t = builder.template;
      let saved: LayoutTemplate;
      if (t.id) {
        saved = await apiClient.updateLayoutTemplate(t.id, t);
      } else {
        saved = await apiClient.createLayoutTemplate(t);
      }
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
          {/* Left toolbar — slot list + add/delete */}
          {!builder.isPreview && (
            <Box
              w={220}
              p="sm"
              style={{
                borderRight: '1px solid var(--mantine-color-default-border)',
                overflowY: 'auto',
                flexShrink: 0,
              }}
            >
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

              <Stack gap={4}>
                {builder.template.slots.map((slot, index) => (
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
                      },
                    }}
                  >
                    Slot {index + 1}
                    {slot.mediaId ? ' ✓' : ''}
                  </Button>
                ))}
                {builder.template.slots.length === 0 && (
                  <Text size="xs" c="dimmed" ta="center" py="md">
                    No slots yet. Click + to add one.
                  </Text>
                )}
              </Stack>
            </Box>
          )}

          {/* Center: canvas workspace */}
          <Box
            ref={canvasContainerRef}
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
              onSlotMove={builder.moveSlot}
              onSlotResize={builder.resizeSlot}
              onSlotSelect={builder.selectSlot}
              onSlotToggleSelect={builder.toggleSlotSelection}
              onCanvasClick={builder.clearSelection}
            />
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
              />
            </Box>
          )}
        </div>
      </div>
    </Modal>
  );
}
