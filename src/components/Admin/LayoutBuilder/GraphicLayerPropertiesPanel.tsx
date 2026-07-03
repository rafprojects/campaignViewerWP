/**
 * P17-D — GraphicLayerPropertiesPanel
 *
 * Right-panel properties editor shown when a graphic layer (LayoutGraphicLayer)
 * is selected in the Layer Panel. Mirrors the design language of
 * SlotPropertiesPanel but is scoped to graphic layer–specific properties.
 *
 * P50-J — asset-layer parity: adds a curated subset of slot-grade properties
 * (transform/rotation/flip, shape + custom clip-path, mask, border, and CSS
 * filter / drop-shadow / blend-mode effects). Rendering parity is handled by
 * the shared GraphicLayerContent component.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  NumberInput,
  Select,
  SegmentedControl,
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
  IconFlipHorizontal,
  IconFlipVertical,
  IconTrash,
} from '@tabler/icons-react';
import { BuilderColorInput as ColorInput } from './BuilderColorInput';
import type {
  LayoutGraphicLayer,
  LayoutSlotShape,
  SlotBlendMode,
  SlotFilterEffects,
  SlotShadow,
} from '@/types';
import { DEFAULT_MASK_LAYER } from '@/types';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ── Options ──────────────────────────────────────────────────────────────────

const SHAPE_OPTIONS: { value: LayoutSlotShape; label: string }[] = [
  { value: 'rectangle', label: '▬ Rectangle' },
  { value: 'circle', label: '● Circle' },
  { value: 'ellipse', label: '⬭ Ellipse' },
  { value: 'hexagon', label: '⬢ Hexagon' },
  { value: 'diamond', label: '◆ Diamond' },
  { value: 'parallelogram-left', label: '▱ Parallelogram ←' },
  { value: 'parallelogram-right', label: '▱ Parallelogram →' },
  { value: 'chevron', label: '❯ Chevron' },
  { value: 'arrow', label: '➤ Arrow' },
  { value: 'trapezoid', label: '⬟ Trapezoid' },
  { value: 'custom', label: '❂ Custom' },
];

const BLEND_MODE_OPTIONS: { value: SlotBlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
];

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

// ── Effect sub-sections (operate directly on the layer via `set`) ─────────────

function FilterEffectsControls({
  effects,
  set,
}: {
  effects: SlotFilterEffects;
  set: (patch: Partial<SlotFilterEffects>) => void;
}) {
  const { t } = useTranslation('wpsg');
  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">{t('lb_gl_brightness', 'Brightness')}</Text>
      <Slider value={effects.brightness ?? 100} onChange={(v) => set({ brightness: v })}
        min={0} max={200} step={1} size="xs" label={(v) => `${v}%`} aria-label={t('lb_gl_brightness', 'Brightness')} />
      <Text size="xs" c="dimmed">{t('lb_gl_contrast', 'Contrast')}</Text>
      <Slider value={effects.contrast ?? 100} onChange={(v) => set({ contrast: v })}
        min={0} max={200} step={1} size="xs" label={(v) => `${v}%`} aria-label={t('lb_gl_contrast', 'Contrast')} />
      <Text size="xs" c="dimmed">{t('lb_gl_saturate', 'Saturate')}</Text>
      <Slider value={effects.saturate ?? 100} onChange={(v) => set({ saturate: v })}
        min={0} max={200} step={1} size="xs" label={(v) => `${v}%`} aria-label={t('lb_gl_saturate', 'Saturate')} />
      <Text size="xs" c="dimmed">{t('lb_gl_blur', 'Blur')}</Text>
      <Slider value={effects.blur ?? 0} onChange={(v) => set({ blur: v })}
        min={0} max={20} step={0.5} size="xs" label={(v) => `${v}px`} aria-label={t('lb_gl_blur', 'Blur')} />
      <Text size="xs" c="dimmed">{t('lb_gl_grayscale', 'Grayscale')}</Text>
      <Slider value={effects.grayscale ?? 0} onChange={(v) => set({ grayscale: v })}
        min={0} max={100} step={1} size="xs" label={(v) => `${v}%`} aria-label={t('lb_gl_grayscale', 'Grayscale')} />
      <Text size="xs" c="dimmed">{t('lb_gl_hue_rotate', 'Hue rotate')}</Text>
      <Slider value={effects.hueRotate ?? 0} onChange={(v) => set({ hueRotate: v })}
        min={0} max={360} step={1} size="xs" label={(v) => `${v}°`} aria-label={t('lb_gl_hue_rotate', 'Hue rotate')} />
    </Stack>
  );
}

function ShadowControls({
  shadow,
  onToggle,
  set,
}: {
  shadow: SlotShadow | undefined;
  onToggle: (on: boolean) => void;
  set: (patch: Partial<SlotShadow>) => void;
}) {
  const { t } = useTranslation('wpsg');
  const sh = shadow ?? { offsetX: 0, offsetY: 4, blur: 8, color: 'rgba(0,0,0,0.5)' };
  const enabled = Boolean(shadow);
  return (
    <Stack gap={4}>
      <SegmentedControl
        size="xs" fullWidth
        data={[{ label: t('lb_slot_off', 'Off'), value: 'off' }, { label: t('lb_slot_on', 'On'), value: 'on' }]}
        value={enabled ? 'on' : 'off'}
        onChange={(v) => onToggle(v === 'on')}
        aria-label={t('lb_gl_drop_shadow', 'Drop shadow')}
      />
      {enabled && (
        <>
          <Group grow gap={6}>
            <NumberInput label={t('lb_slot_offx', 'Off X')} value={sh.offsetX} onChange={(v) => set({ offsetX: Number(v) || 0 })}
              min={-50} max={50} size="xs" suffix=" px" />
            <NumberInput label={t('lb_slot_offy', 'Off Y')} value={sh.offsetY} onChange={(v) => set({ offsetY: Number(v) || 0 })}
              min={-50} max={50} size="xs" suffix=" px" />
          </Group>
          <Text size="xs" c="dimmed">{t('lb_gl_blur', 'Blur')}</Text>
          <Slider value={sh.blur} onChange={(v) => set({ blur: v })}
            min={0} max={50} step={1} size="xs" label={(v) => `${v}px`} aria-label={t('lb_gl_shadow_blur', 'Shadow blur')} />
          <ColorInput label={t('lb_slot_color', 'Color')} value={sh.color} onChange={(v) => set({ color: v })}
            size="xs" format="rgba" />
        </>
      )}
    </Stack>
  );
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
  const { t } = useTranslation('wpsg');
  const shapeOptions = SHAPE_OPTIONS.map((o) => ({ value: o.value, label: t(`lb_slot_shape_${o.value}`, o.label) }));
  const blendOptions = BLEND_MODE_OPTIONS.map((o) => ({ value: o.value, label: t(`lb_slot_blend_${o.value}`, o.label) }));
  const displayName = overlay.name || t('lb_gl_default_name', 'Graphic Layer {{index}}', { index: overlayIndex });
  const [nameValue, setNameValue] = useState(displayName);

  // Inline confirm state for the destructive Remove action
  const [confirmOpen, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);

  const set = (patch: Partial<LayoutGraphicLayer>) => onUpdate(overlay.id, patch);

  function commitRename() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== displayName) {
      onRename(overlay.id, trimmed);
    } else {
      // Reset to current display name on blur if unchanged or empty
      setNameValue(displayName);
    }
  }

  const shape = overlay.shape ?? 'rectangle';
  const mask = overlay.maskLayer;

  return (
    <Stack gap="sm" p="xs">

      {/* ── Name ── */}
      <TextInput
        label={t('lb_gl_name', 'Name')}
        size="xs"
        value={nameValue}
        onChange={(e) => setNameValue(e.currentTarget.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label={t('lb_gl_name_aria', 'Graphic layer name')}
      />

      {/* ── Preview ── */}
      {overlay.imageUrl && (
        <Box
          style={{
            background: 'var(--mantine-color-default)',
            borderRadius: 4,
            padding: 4,
            textAlign: 'center',
          }}
        >
          <img
            src={overlay.imageUrl}
            alt={t('lb_gl_preview_alt', 'Graphic layer preview')}
            style={{ maxHeight: 64, maxWidth: '100%', objectFit: 'contain' }}
          />
        </Box>
      )}

      {/* ── Position ── */}
      <Divider label={t('lb_gl_position', 'Position')} labelPosition="left" />
      <Group grow gap="xs">
        <NumberInput
          label={t('lb_slot_x', 'X %')}
          value={overlay.x}
          onChange={(val) => set({ x: Number(val) || 0 })}
          min={0}
          max={100}
          step={0.5}
          size="xs"
        />
        <NumberInput
          label={t('lb_slot_y', 'Y %')}
          value={overlay.y}
          onChange={(val) => set({ y: Number(val) || 0 })}
          min={0}
          max={100}
          step={0.5}
          size="xs"
        />
      </Group>

      {/* ── Size ── */}
      <Divider label={t('lb_gl_size', 'Size')} labelPosition="left" />
      <Group grow gap="xs">
        <NumberInput
          label={t('lb_gl_w', 'W %')}
          value={overlay.width}
          onChange={(val) => set({ width: Math.max(1, Number(val) || 1) })}
          min={1}
          max={100}
          step={0.5}
          size="xs"
        />
        <NumberInput
          label={t('lb_gl_h', 'H %')}
          value={overlay.height}
          onChange={(val) => set({ height: Math.max(1, Number(val) || 1) })}
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
        onClick={() => set({ x: 0, y: 0, width: 100, height: 100 })}
      >
        {t('lb_gl_fill_canvas', 'Fill canvas')}
      </Button>

      {/* ── Transform ── */}
      <Divider label={t('lb_gl_transform', 'Transform')} labelPosition="left" />
      <Text size="xs" c="dimmed">{t('lb_gl_rotation', 'Rotation')}</Text>
      <Slider
        value={overlay.rotation ?? 0}
        onChange={(val) => set({ rotation: val })}
        min={-180}
        max={180}
        step={1}
        size="xs"
        label={(v) => `${v}°`}
        aria-label={t('lb_gl_rotation', 'Rotation')}
      />
      <Group gap="xs" grow>
        <Button
          size="xs"
          variant={overlay.flipH ? 'filled' : 'light'}
          leftSection={<IconFlipHorizontal size={14} />}
          onClick={() => set({ flipH: !overlay.flipH })}
          aria-label={t('lb_gl_flip_h_aria', 'Flip horizontal')}
        >
          {t('lb_gl_flip_h', 'Flip H')}
        </Button>
        <Button
          size="xs"
          variant={overlay.flipV ? 'filled' : 'light'}
          leftSection={<IconFlipVertical size={14} />}
          onClick={() => set({ flipV: !overlay.flipV })}
          aria-label={t('lb_gl_flip_v_aria', 'Flip vertical')}
        >
          {t('lb_gl_flip_v', 'Flip V')}
        </Button>
      </Group>

      {/* ── Opacity ── */}
      <Divider label={t('lb_gl_appearance', 'Appearance')} labelPosition="left" />
      <Text size="xs" c="dimmed">{t('lb_gl_opacity', 'Opacity')}</Text>
      <Slider
        value={overlay.opacity}
        onChange={(val) => set({ opacity: val })}
        min={0}
        max={1}
        step={0.05}
        size="xs"
        label={(v) => `${Math.round(v * 100)}%`}
        aria-label={t('lb_gl_opacity_aria', 'Graphic layer opacity')}
      />

      <Switch
        size="xs"
        label={t('lb_gl_click_through', 'Click-through')}
        description={t('lb_gl_click_through_desc', 'Pointer events pass through to layers below')}
        checked={!overlay.pointerEvents}
        onChange={(e) => set({ pointerEvents: !e.currentTarget.checked })}
      />

      {/* ── Shape / Border / Mask / Effects (collapsible) ── */}
      <Accordion variant="separated" multiple chevronPosition="right" defaultValue={[]}>
        <Accordion.Item value="shape">
          <Accordion.Control>
            <Text size="xs" fw={600}>{t('lb_gl_shape_border', 'Shape & Border')}</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Select
                label={t('lb_gl_shape', 'Shape')}
                size="xs"
                data={shapeOptions}
                value={shape}
                onChange={(val) => set({ shape: (val as LayoutSlotShape) ?? 'rectangle' })}
                allowDeselect={false}
                comboboxProps={{ withinPortal: true }}
              />
              {shape === 'custom' && (
                <TextInput
                  label={t('lb_gl_custom_clip', 'Custom clip-path')}
                  size="xs"
                  placeholder={t('lb_gl_custom_clip_ph', 'polygon(50% 0%, 100% 100%, 0% 100%)')}
                  value={overlay.clipPath ?? ''}
                  onChange={(e) => set({ clipPath: e.currentTarget.value })}
                />
              )}
              <Group grow gap="xs">
                {shape === 'rectangle' && (
                  <NumberInput
                    label={t('lb_gl_radius', 'Radius')}
                    size="xs"
                    value={overlay.borderRadius ?? 0}
                    onChange={(v) => set({ borderRadius: Number(v) || 0 })}
                    min={0}
                    max={500}
                    suffix=" px"
                  />
                )}
                <NumberInput
                  label={t('lb_gl_border', 'Border')}
                  size="xs"
                  value={overlay.borderWidth ?? 0}
                  onChange={(v) => set({ borderWidth: Math.max(0, Number(v) || 0) })}
                  min={0}
                  max={50}
                  suffix=" px"
                />
              </Group>
              {(overlay.borderWidth ?? 0) > 0 && (
                <ColorInput
                  label={t('lb_gl_border_color', 'Border color')}
                  size="xs"
                  format="rgba"
                  value={overlay.borderColor ?? '#ffffff'}
                  onChange={(v) => set({ borderColor: v })}
                />
              )}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="mask">
          <Accordion.Control>
            <Text size="xs" fw={600}>{t('lb_gl_mask', 'Mask')}</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <TextInput
                label={t('lb_gl_mask_url', 'Mask image URL')}
                size="xs"
                placeholder={t('lb_gl_mask_url_ph', 'https://… (SVG/PNG)')}
                value={mask?.url ?? ''}
                onChange={(e) => {
                  const url = e.currentTarget.value;
                  if (!url) {
                    set({ maskLayer: undefined });
                  } else {
                    set({ maskLayer: { ...DEFAULT_MASK_LAYER, ...(mask ?? {}), url } });
                  }
                }}
              />
              {mask?.url && (
                <>
                  <SegmentedControl
                    size="xs"
                    fullWidth
                    data={[
                      { label: t('lb_gl_luminance', 'Luminance'), value: 'luminance' },
                      { label: t('lb_gl_alpha', 'Alpha'), value: 'alpha' },
                    ]}
                    value={mask.mode}
                    onChange={(v) =>
                      set({ maskLayer: { ...mask, mode: v as 'luminance' | 'alpha' } })
                    }
                    aria-label={t('lb_gl_mask_mode', 'Mask mode')}
                  />
                  <Group grow gap="xs">
                    <NumberInput label={t('lb_slot_x', 'X %')} size="xs" value={mask.x}
                      onChange={(v) => set({ maskLayer: { ...mask, x: Number(v) || 0 } })} />
                    <NumberInput label={t('lb_slot_y', 'Y %')} size="xs" value={mask.y}
                      onChange={(v) => set({ maskLayer: { ...mask, y: Number(v) || 0 } })} />
                  </Group>
                  <Group grow gap="xs">
                    <NumberInput label={t('lb_gl_w', 'W %')} size="xs" value={mask.width} min={1}
                      onChange={(v) => set({ maskLayer: { ...mask, width: Math.max(1, Number(v) || 1) } })} />
                    <NumberInput label={t('lb_gl_h', 'H %')} size="xs" value={mask.height} min={1}
                      onChange={(v) => set({ maskLayer: { ...mask, height: Math.max(1, Number(v) || 1) } })} />
                  </Group>
                  <Text size="xs" c="dimmed">{t('lb_gl_feather', 'Feather')}</Text>
                  <Slider value={mask.feather} onChange={(v) => set({ maskLayer: { ...mask, feather: v } })}
                    min={0} max={50} step={1} size="xs" label={(v) => `${v}px`} aria-label={t('lb_gl_mask_feather', 'Mask feather')} />
                  <Button size="xs" variant="subtle" color="red" onClick={() => set({ maskLayer: undefined })}>
                    {t('lb_gl_clear_mask', 'Clear mask')}
                  </Button>
                </>
              )}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="effects">
          <Accordion.Control>
            <Text size="xs" fw={600}>{t('lb_gl_effects', 'Effects')}</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Select
                label={t('lb_gl_blend_mode', 'Blend mode')}
                size="xs"
                data={blendOptions}
                value={overlay.blendMode ?? 'normal'}
                onChange={(val) => set({ blendMode: (val as SlotBlendMode) ?? 'normal' })}
                allowDeselect={false}
                comboboxProps={{ withinPortal: true }}
              />
              <Divider label={t('lb_gl_filters', 'Filters')} labelPosition="left" />
              <FilterEffectsControls
                effects={overlay.filterEffects ?? {}}
                set={(patch) => set({ filterEffects: { ...(overlay.filterEffects ?? {}), ...patch } })}
              />
              <Divider label={t('lb_gl_drop_shadow', 'Drop shadow')} labelPosition="left" />
              <ShadowControls
                shadow={overlay.shadow}
                onToggle={(on) =>
                  set({ shadow: on ? (overlay.shadow ?? { offsetX: 0, offsetY: 4, blur: 8, color: 'rgba(0,0,0,0.5)' }) : undefined })
                }
                set={(patch) =>
                  set({ shadow: { ...(overlay.shadow ?? { offsetX: 0, offsetY: 4, blur: 8, color: 'rgba(0,0,0,0.5)' }), ...patch } })
                }
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* ── Stacking ── */}
      <Divider label={t('lb_gl_stacking', 'Stacking')} labelPosition="left" />
      <Group gap={4} justify="center">
        <Tooltip label={t('lb_slot_send_back_tt', 'Send to Back (Shift+[)')}>
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => onSendToBack(overlay.id)}
            aria-label={t('lb_slot_send_back_aria', 'Send to back')}
          >
            <IconArrowBigDownLine size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('lb_slot_send_bwd_tt', 'Send Backward ([)')}>
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => onSendBackward(overlay.id)}
            aria-label={t('lb_slot_send_bwd_aria', 'Send backward')}
          >
            <IconArrowDown size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('lb_slot_bring_fwd_tt', 'Bring Forward (])')}>
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => onBringForward(overlay.id)}
            aria-label={t('lb_slot_bring_fwd_aria', 'Bring forward')}
          >
            <IconArrowUp size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('lb_slot_bring_front_tt', 'Bring to Front (Shift+])')}>
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => onBringToFront(overlay.id)}
            aria-label={t('lb_slot_bring_front_aria', 'Bring to front')}
          >
            <IconArrowBigUpLine size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* ── Remove ── */}
      <Divider label={t('lb_gl_danger_zone', 'Danger zone')} labelPosition="left" />
      {confirmOpen ? (
        <Stack gap={4}>
          <Text size="xs" c="dimmed">{t('lb_gl_remove_confirm', 'Remove this graphic layer?')}</Text>
          <Group gap={4}>
            <Button size="xs" variant="subtle" onClick={closeConfirm} flex={1}>
              {t('lb_gl_cancel', 'Cancel')}
            </Button>
            <Button
              size="xs"
              color="red"
              onClick={() => { closeConfirm(); onRemove(overlay.id); }}
              leftSection={<IconTrash size={12} />}
              flex={1}
              aria-label={t('lb_gl_confirm_remove', 'Confirm remove')}
            >
              {t('lb_gl_remove', 'Remove')}
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
          aria-label={t('lb_gl_remove_layer', 'Remove layer')}
        >
          {t('lb_gl_remove_layer', 'Remove layer')}
        </Button>
      )}
    </Stack>
  );
}

setWpsgDebugDisplayName(GraphicLayerPropertiesPanel, 'LayoutBuilder:GraphicLayerPropertiesPanel');
