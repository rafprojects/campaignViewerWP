/**
 * P17-D — GraphicLayerPropertiesPanel
 *
 * Right-panel properties editor shown when a graphic layer (LayoutGraphicLayer)
 * is selected in the Layer Panel. Mirrors the design language of
 * SlotPropertiesPanel but is scoped to graphic layer–specific properties.
 */
import { useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  NumberInput,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowBigDownLine,
  IconArrowBigUpLine,
  IconArrowDown,
  IconArrowUp,
  IconTrash,
} from '@tabler/icons-react';
import type { LayoutGraphicLayer } from '@/types';

// ── Props ────────────────────────────────────────────────────────────────────

export interface GraphicLayerPropertiesPanelProps {
  overlay: LayoutGraphicLayer;
  /** 1-based display index used in the fallback label ("Graphic Layer 2"). */
  overlayIndex: number;
  onUpdate: (id: string, patch: Partial<LayoutGraphicLayer>) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GraphicLayerPropertiesPanel({
  overlay,
  overlayIndex,
  onUpdate,
  onRename,
  onRemove,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
}: GraphicLayerPropertiesPanelProps) {
  const displayName = overlay.name || `Graphic Layer ${overlayIndex}`;
  const [nameValue, setNameValue] = useState(displayName);

  // Inline confirm state for the destructive Remove action
  const [confirmOpen, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);

  function commitRename() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== displayName) {
      onRename(overlay.id, trimmed);
    } else {
      // Reset to current display name on blur if unchanged or empty
      setNameValue(displayName);
    }
  }

  return (
    <Stack gap="sm" p="xs">

      {/* ── Name ── */}
      <TextInput
        label="Name"
        size="xs"
        value={nameValue}
        onChange={(e) => setNameValue(e.currentTarget.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label="Graphic layer name"
      />

      {/* ── Preview ── */}
      {overlay.imageUrl && (
        <Box
          style={{
            background: 'var(--mantine-color-dark-6)',
            borderRadius: 4,
            padding: 4,
            textAlign: 'center',
          }}
        >
          <img
            src={overlay.imageUrl}
            alt="Graphic layer preview"
            style={{ maxHeight: 64, maxWidth: '100%', objectFit: 'contain' }}
          />
        </Box>
      )}

      {/* ── Position ── */}
      <Divider label="Position" labelPosition="left" />
      <Group grow gap="xs">
        <NumberInput
          label="X %"
          value={overlay.x}
          onChange={(val) => onUpdate(overlay.id, { x: Number(val) || 0 })}
          min={0}
          max={100}
          step={0.5}
          size="xs"
        />
        <NumberInput
          label="Y %"
          value={overlay.y}
          onChange={(val) => onUpdate(overlay.id, { y: Number(val) || 0 })}
          min={0}
          max={100}
          step={0.5}
          size="xs"
        />
      </Group>

      {/* ── Size ── */}
      <Divider label="Size" labelPosition="left" />
      <Group grow gap="xs">
        <NumberInput
          label="W %"
          value={overlay.width}
          onChange={(val) => onUpdate(overlay.id, { width: Math.max(1, Number(val) || 1) })}
          min={1}
          max={100}
          step={0.5}
          size="xs"
        />
        <NumberInput
          label="H %"
          value={overlay.height}
          onChange={(val) => onUpdate(overlay.id, { height: Math.max(1, Number(val) || 1) })}
          min={1}
          max={100}
          step={0.5}
          size="xs"
        />
      </Group>

      <Button
        size="xs"
        variant="subtle"
        fullWidth
        onClick={() => onUpdate(overlay.id, { x: 0, y: 0, width: 100, height: 100 })}
      >
        Fill canvas
      </Button>

      {/* ── Opacity ── */}
      <Divider label="Appearance" labelPosition="left" />
      <Text size="xs" c="dimmed">Opacity</Text>
      <Slider
        value={overlay.opacity}
        onChange={(val) => onUpdate(overlay.id, { opacity: val })}
        min={0}
        max={1}
        step={0.05}
        size="xs"
        label={(v) => `${Math.round(v * 100)}%`}
        aria-label="Graphic layer opacity"
      />

      <Switch
        size="xs"
        label="Click-through"
        description="Pointer events pass through to layers below"
        checked={!overlay.pointerEvents}
        onChange={(e) => onUpdate(overlay.id, { pointerEvents: !e.currentTarget.checked })}
      />

      {/* ── Stacking ── */}
      <Divider label="Stacking" labelPosition="left" />
      <Group gap={4} justify="center">
        <Tooltip label="Send to Back (Shift+[)">
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => onSendToBack(overlay.id)}
            aria-label="Send to back"
          >
            <IconArrowBigDownLine size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Send Backward ([)">
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => onSendBackward(overlay.id)}
            aria-label="Send backward"
          >
            <IconArrowDown size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Bring Forward (])">
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => onBringForward(overlay.id)}
            aria-label="Bring forward"
          >
            <IconArrowUp size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Bring to Front (Shift+])">
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => onBringToFront(overlay.id)}
            aria-label="Bring to front"
          >
            <IconArrowBigUpLine size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* ── Remove ── */}
      <Divider label="Danger zone" labelPosition="left" />
      {confirmOpen ? (
        <Stack gap={4}>
          <Text size="xs" c="dimmed">Remove this graphic layer?</Text>
          <Group gap={4}>
            <Button size="xs" variant="subtle" onClick={closeConfirm} flex={1}>
              Cancel
            </Button>
            <Button
              size="xs"
              color="red"
              onClick={() => { closeConfirm(); onRemove(overlay.id); }}
              leftSection={<IconTrash size={12} />}
              flex={1}
              aria-label="Confirm remove"
            >
              Remove
            </Button>
          </Group>
        </Stack>
      ) : (
        <Button
          size="xs"
          variant="light"
          color="red"
          fullWidth
          leftSection={<IconTrash size={12} />}
          onClick={openConfirm}
          aria-label="Remove layer"
        >
          Remove layer
        </Button>
      )}
    </Stack>
  );
}
