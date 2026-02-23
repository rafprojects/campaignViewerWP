import {
  Stack,
  Text,
  NumberInput,
  Select,
  ColorInput,
  Slider,
  Divider,
  Group,
  SegmentedControl,
  TextInput,
} from '@mantine/core';
import type { LayoutSlot, LayoutSlotShape } from '@/types';

// ── Props ────────────────────────────────────────────────────

export interface SlotPropertiesPanelProps {
  slot: LayoutSlot;
  onUpdate: (updates: Partial<LayoutSlot>) => void;
}

// ── Options ──────────────────────────────────────────────────

const SHAPE_OPTIONS: { value: LayoutSlotShape; label: string }[] = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'custom', label: 'Custom' },
];

const FIT_OPTIONS = [
  { value: 'cover', label: 'Cover' },
  { value: 'contain', label: 'Contain' },
  { value: 'fill', label: 'Fill' },
];

const CLICK_OPTIONS = [
  { value: 'lightbox', label: 'Lightbox' },
  { value: 'none', label: 'None' },
];

const HOVER_OPTIONS = [
  { label: 'Pop', value: 'pop' },
  { label: 'Glow', value: 'glow' },
  { label: 'None', value: 'none' },
];

// ── Focal point presets (3×3 grid) ───────────────────────────

const FOCAL_PRESETS = [
  '0% 0%', '50% 0%', '100% 0%',
  '0% 50%', '50% 50%', '100% 50%',
  '0% 100%', '50% 100%', '100% 100%',
];

// ── Component ────────────────────────────────────────────────

export function SlotPropertiesPanel({
  slot,
  onUpdate,
}: SlotPropertiesPanelProps) {
  return (
    <Stack gap="sm">
      <Text size="sm" fw={700}>
        Slot Properties
      </Text>

      {/* ── Position ── */}
      <Divider label="Position" labelPosition="left" />
      <Group grow gap="xs">
        <NumberInput
          label="X %"
          value={slot.x}
          onChange={(val) => onUpdate({ x: Number(val) || 0 })}
          min={0}
          max={100}
          step={0.5}
          size="xs"
          decimalScale={2}
        />
        <NumberInput
          label="Y %"
          value={slot.y}
          onChange={(val) => onUpdate({ y: Number(val) || 0 })}
          min={0}
          max={100}
          step={0.5}
          size="xs"
          decimalScale={2}
        />
      </Group>

      {/* ── Size ── */}
      <Divider label="Size" labelPosition="left" />
      <Group grow gap="xs">
        <NumberInput
          label="Width %"
          value={slot.width}
          onChange={(val) => onUpdate({ width: Number(val) || 1 })}
          min={1}
          max={100}
          step={0.5}
          size="xs"
          decimalScale={2}
        />
        <NumberInput
          label="Height %"
          value={slot.height}
          onChange={(val) => onUpdate({ height: Number(val) || 1 })}
          min={1}
          max={100}
          step={0.5}
          size="xs"
          decimalScale={2}
        />
      </Group>

      {/* ── Shape ── */}
      <Divider label="Shape" labelPosition="left" />
      <Select
        label="Shape"
        data={SHAPE_OPTIONS}
        value={slot.shape}
        onChange={(val) => val && onUpdate({ shape: val as LayoutSlotShape })}
        size="xs"
      />
      {slot.shape === 'rectangle' && (
        <NumberInput
          label="Border radius (px)"
          value={slot.borderRadius}
          onChange={(val) => onUpdate({ borderRadius: Number(val) || 0 })}
          min={0}
          max={200}
          size="xs"
        />
      )}
      {slot.shape === 'custom' && (
        <TextInput
          label="CSS clip-path"
          value={slot.clipPath ?? ''}
          onChange={(e) => onUpdate({ clipPath: e.currentTarget.value })}
          placeholder="polygon(50% 0%, 100% 50%, …)"
          size="xs"
        />
      )}

      {/* ── Image Fit ── */}
      <Divider label="Image" labelPosition="left" />
      <Select
        label="Object Fit"
        data={FIT_OPTIONS}
        value={slot.objectFit}
        onChange={(val) =>
          val && onUpdate({ objectFit: val as LayoutSlot['objectFit'] })
        }
        size="xs"
      />

      {/* ── Focal Point ── */}
      <Text size="xs" fw={500}>
        Focal Point
      </Text>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          width: 90,
        }}
      >
        {FOCAL_PRESETS.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => onUpdate({ objectPosition: pos })}
            style={{
              width: 28,
              height: 28,
              border:
                slot.objectPosition === pos
                  ? '2px solid var(--mantine-color-blue-5)'
                  : '1px solid var(--mantine-color-dark-4)',
              borderRadius: 3,
              background:
                slot.objectPosition === pos
                  ? 'var(--mantine-color-blue-light)'
                  : 'transparent',
              cursor: 'pointer',
              padding: 0,
            }}
            aria-label={`Focal point ${pos}`}
          />
        ))}
      </div>
      <TextInput
        value={slot.objectPosition}
        onChange={(e) => onUpdate({ objectPosition: e.currentTarget.value })}
        placeholder="50% 50%"
        size="xs"
      />

      {/* ── Border ── */}
      <Divider label="Border" labelPosition="left" />
      <Group grow gap="xs">
        <NumberInput
          label="Width (px)"
          value={slot.borderWidth}
          onChange={(val) => onUpdate({ borderWidth: Number(val) || 0 })}
          min={0}
          max={20}
          size="xs"
        />
        <ColorInput
          label="Color"
          value={slot.borderColor}
          onChange={(val) => onUpdate({ borderColor: val })}
          size="xs"
          format="hex"
        />
      </Group>

      {/* ── Z-Index ── */}
      <Divider label="Stacking" labelPosition="left" />
      <NumberInput
        label="Z-Index"
        value={slot.zIndex}
        onChange={(val) => onUpdate({ zIndex: Number(val) || 0 })}
        min={0}
        max={100}
        size="xs"
      />

      {/* ── Interaction ── */}
      <Divider label="Interaction" labelPosition="left" />
      <Text size="xs" fw={500}>
        Click Action
      </Text>
      <SegmentedControl
        data={CLICK_OPTIONS}
        value={slot.clickAction}
        onChange={(val) =>
          onUpdate({ clickAction: val as LayoutSlot['clickAction'] })
        }
        size="xs"
        fullWidth
      />

      <Text size="xs" fw={500}>
        Hover Effect
      </Text>
      <SegmentedControl
        data={HOVER_OPTIONS}
        value={slot.hoverEffect}
        onChange={(val) =>
          onUpdate({ hoverEffect: val as LayoutSlot['hoverEffect'] })
        }
        size="xs"
        fullWidth
      />

      {/* ── Opacity slider for visual weight preview ── */}
      <Divider label="Preview" labelPosition="left" />
      <Slider
        label="Border radius preview"
        value={slot.borderRadius}
        onChange={(val) => onUpdate({ borderRadius: val })}
        min={0}
        max={100}
        size="xs"
        disabled={slot.shape !== 'rectangle'}
      />
    </Stack>
  );
}
