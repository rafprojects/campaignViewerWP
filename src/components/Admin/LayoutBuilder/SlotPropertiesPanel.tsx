import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Stack,
  Text,
  NumberInput,
  Select,
  Group,
  SegmentedControl,
  TextInput,
  ActionIcon,
  Tooltip,
  Box,
  Slider,
  Button,
  Accordion,
} from '@mantine/core';
import { BuilderColorInput as ColorInput } from './BuilderColorInput';
import {
  IconArrowBigUpLine,
  IconArrowBigDownLine,
  IconArrowUp,
  IconArrowDown,
  IconAlertTriangle,
  IconInfoCircle,
  IconLink,
  IconUnlink,
  IconRefresh,
  IconPlayerPlay,
} from '@tabler/icons-react';
import type {
  LayoutSlot,
  LayoutSlotShape,
  SlotFilterEffects,
  SlotShadow,
  SlotTiltEffect,
  SlotBlendMode,
  SlotOverlayEffect,
  SlotEntranceAnimation,
  SlotEntranceType,
  SlotEntranceDirection,
} from '@/types';
import { buildSlotEntranceCss, REVEAL_CLASS } from '@/utils/slotEntrance';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ── Props ────────────────────────────────────────────────────

export interface SlotPropertiesPanelProps {
  slot: LayoutSlot;
  onUpdate: (updates: Partial<LayoutSlot>) => void;
  /** Z-index reorder callbacks (P15-G). */
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  /** P37-LB: When true, hide image-level controls and show listing-mode warning. */
  listingMode?: boolean;
}

// ── Options ──────────────────────────────────────────────────

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

const BLEND_MODE_OPTIONS: Array<{ value: SlotBlendMode; label: string }> = [
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

// ── Focal point presets (3×3 grid) ───────────────────────────

const FOCAL_PRESETS: Array<{ pos: string; label: string; dotX: string; dotY: string }> = [
  { pos: '0% 0%',   label: 'Top left',     dotX: '20%',  dotY: '20%'  },
  { pos: '50% 0%',  label: 'Top center',   dotX: '50%',  dotY: '20%'  },
  { pos: '100% 0%', label: 'Top right',    dotX: '80%',  dotY: '20%'  },
  { pos: '0% 50%',  label: 'Left center',  dotX: '20%',  dotY: '50%'  },
  { pos: '50% 50%', label: 'Center',       dotX: '50%',  dotY: '50%'  },
  { pos: '100% 50%',label: 'Right center', dotX: '80%',  dotY: '50%'  },
  { pos: '0% 100%', label: 'Bottom left',  dotX: '20%',  dotY: '80%'  },
  { pos: '50% 100%',label: 'Bottom center',dotX: '50%',  dotY: '80%'  },
  { pos: '100% 100%',label:'Bottom right', dotX: '80%',  dotY: '80%'  },
];

// ── Inline property row ──────────────────────────────────────

function PropRow({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  const { t } = useTranslation('wpsg');
  return (
    <Group gap={6} align="center" wrap="nowrap" style={{ minHeight: 28 }}>
      <Group gap={2} align="center" wrap="nowrap" style={{ width: 70, flexShrink: 0 }}>
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{label}</Text>
        {tooltip && (
          <Tooltip label={tooltip} multiline w={240} position="left" withArrow>
            <ActionIcon size={14} variant="transparent" c="dimmed" aria-label={t('lb_slot_prop_info', '{{label}} info', { label })}>
              <IconInfoCircle size={12} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <Box style={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Group>
  );
}

setWpsgDebugDisplayName(PropRow, 'LayoutBuilder:SlotPropertiesPanel:PropRow');

function SectionHeader({ label }: { label: string }) {
  return (
    <Box
      mt={6}
      mb={2}
      pb={3}
      style={{
        borderBottom: '1px solid var(--mantine-color-default-border)',
      }}
    >
      <Text size="xs" fw={700} tt="uppercase" c="dimmed" lts={0.8}>
        {label}
      </Text>
    </Box>
  );
}

setWpsgDebugDisplayName(SectionHeader, 'LayoutBuilder:SlotPropertiesPanel:SectionHeader');

// ── Effects sub-sections ─────────────────────────────────────

type EffectSectionProps = Pick<SlotPropertiesPanelProps, 'slot' | 'onUpdate'>;

function FilterEffectsSection({ slot, onUpdate }: EffectSectionProps) {
  const { t } = useTranslation('wpsg');
  const fe: SlotFilterEffects = slot.filterEffects ?? {};
  const setFe = (patch: Partial<SlotFilterEffects>) =>
    onUpdate({ filterEffects: { ...fe, ...patch } });
  return (
    <Stack gap={4}>
      <PropRow label={t('lb_slot_bright', 'Bright')}>
        <Slider value={fe.brightness ?? 100} onChange={(v) => setFe({ brightness: v })}
          min={0} max={200} step={1} size="xs" label={(v) => `${v}%`} />
      </PropRow>
      <PropRow label={t('lb_slot_contrast', 'Contrast')}>
        <Slider value={fe.contrast ?? 100} onChange={(v) => setFe({ contrast: v })}
          min={0} max={200} step={1} size="xs" label={(v) => `${v}%`} />
      </PropRow>
      <PropRow label={t('lb_slot_saturate', 'Saturate')}>
        <Slider value={fe.saturate ?? 100} onChange={(v) => setFe({ saturate: v })}
          min={0} max={200} step={1} size="xs" label={(v) => `${v}%`} />
      </PropRow>
      <PropRow label={t('lb_slot_blur', 'Blur')}>
        <Slider value={fe.blur ?? 0} onChange={(v) => setFe({ blur: v })}
          min={0} max={20} step={0.5} size="xs" label={(v) => `${v}px`} />
      </PropRow>
      <PropRow label={t('lb_slot_gray', 'Gray')}>
        <Slider value={fe.grayscale ?? 0} onChange={(v) => setFe({ grayscale: v })}
          min={0} max={100} step={1} size="xs" label={(v) => `${v}%`} />
      </PropRow>
      <PropRow label={t('lb_slot_sepia', 'Sepia')}>
        <Slider value={fe.sepia ?? 0} onChange={(v) => setFe({ sepia: v })}
          min={0} max={100} step={1} size="xs" label={(v) => `${v}%`} />
      </PropRow>
      <PropRow label={t('lb_slot_hue', 'Hue')}>
        <Slider value={fe.hueRotate ?? 0} onChange={(v) => setFe({ hueRotate: v })}
          min={0} max={360} step={1} size="xs" label={(v) => `${v}°`} />
      </PropRow>
      <PropRow label={t('lb_slot_invert', 'Invert')}>
        <Slider value={fe.invert ?? 0} onChange={(v) => setFe({ invert: v })}
          min={0} max={100} step={1} size="xs" label={(v) => `${v}%`} />
      </PropRow>
    </Stack>
  );
}

function ShadowSection({ slot, onUpdate }: EffectSectionProps) {
  const { t } = useTranslation('wpsg');
  const sh: SlotShadow = slot.shadow ?? { offsetX: 0, offsetY: 4, blur: 8, color: 'rgba(0,0,0,0.5)' };
  const hasShadow = Boolean(slot.shadow);
  const setSh = (patch: Partial<SlotShadow>) =>
    onUpdate({ shadow: { ...sh, ...patch } });
  return (
    <Stack gap={4}>
      <PropRow label={t('lb_slot_enable', 'Enable')}>
        <SegmentedControl
          size="xs" fullWidth
          data={[{ label: t('lb_slot_off', 'Off'), value: 'off' }, { label: t('lb_slot_on', 'On'), value: 'on' }]}
          value={hasShadow ? 'on' : 'off'}
          onChange={(v) =>
            v === 'on' ? onUpdate({ shadow: sh }) : onUpdate({ shadow: undefined })
          }
        />
      </PropRow>
      {hasShadow && (
        <>
          <Group grow gap={6}>
            <PropRow label={t('lb_slot_offx', 'Off X')}>
              <NumberInput value={sh.offsetX} onChange={(v) => setSh({ offsetX: Number(v) || 0 })}
                min={-50} max={50} size="xs" variant="filled" suffix=" px" />
            </PropRow>
            <PropRow label={t('lb_slot_offy', 'Off Y')}>
              <NumberInput value={sh.offsetY} onChange={(v) => setSh({ offsetY: Number(v) || 0 })}
                min={-50} max={50} size="xs" variant="filled" suffix=" px" />
            </PropRow>
          </Group>
          <PropRow label={t('lb_slot_blur', 'Blur')}>
            <Slider value={sh.blur} onChange={(v) => setSh({ blur: v })}
              min={0} max={50} step={1} size="xs" label={(v) => `${v}px`} />
          </PropRow>
          <PropRow label={t('lb_slot_color', 'Color')}>
            <ColorInput value={sh.color} onChange={(v) => setSh({ color: v })}
              size="xs" format="rgba" variant="filled" />
          </PropRow>
        </>
      )}
    </Stack>
  );
}

function OverlayEffectSection({ slot, onUpdate }: EffectSectionProps) {
  const { t } = useTranslation('wpsg');
  const ov: SlotOverlayEffect = slot.overlayEffect ?? { mode: 'none', intensity: 30, onHoverOnly: false };
  const setOv = (patch: Partial<SlotOverlayEffect>) =>
    onUpdate({ overlayEffect: { ...ov, ...patch } });
  return (
    <Stack gap={4}>
      <PropRow label={t('lb_slot_mode', 'Mode')}>
        <SegmentedControl
          size="xs" fullWidth
          data={[
            { label: t('lb_slot_none', 'None'), value: 'none' },
            { label: t('lb_slot_darken', 'Darken'), value: 'darken' },
            { label: t('lb_slot_lighten', 'Lighten'), value: 'lighten' },
          ]}
          value={ov.mode}
          onChange={(v) => setOv({ mode: v as SlotOverlayEffect['mode'] })}
        />
      </PropRow>
      {ov.mode !== 'none' && (
        <>
          <PropRow label={t('lb_slot_intensity', 'Intensity')}>
            <Slider value={ov.intensity} onChange={(v) => setOv({ intensity: v })}
              min={0} max={100} step={1} size="xs" label={(v) => `${v}%`} />
          </PropRow>
          <PropRow label={t('lb_slot_hover_only', 'Hover only')}>
            <SegmentedControl
              size="xs" fullWidth
              data={[{ label: t('lb_slot_always', 'Always'), value: 'always' }, { label: t('lb_slot_hover_opt', 'Hover'), value: 'hover' }]}
              value={ov.onHoverOnly ? 'hover' : 'always'}
              onChange={(v) => setOv({ onHoverOnly: v === 'hover' })}
            />
          </PropRow>
        </>
      )}
    </Stack>
  );
}

function TiltEffectSection({ slot, onUpdate }: EffectSectionProps) {
  const { t } = useTranslation('wpsg');
  const tilt: SlotTiltEffect = slot.tilt ?? { enabled: false, maxAngle: 15, perspective: 1000, resetSpeed: 300 };
  const setTilt = (patch: Partial<SlotTiltEffect>) =>
    onUpdate({ tilt: { ...tilt, ...patch } });
  return (
    <Stack gap={4}>
      <PropRow label={t('lb_slot_enable', 'Enable')}>
        <SegmentedControl
          size="xs" fullWidth
          data={[{ label: t('lb_slot_off', 'Off'), value: 'off' }, { label: t('lb_slot_on', 'On'), value: 'on' }]}
          value={tilt.enabled ? 'on' : 'off'}
          onChange={(v) => setTilt({ enabled: v === 'on' })}
        />
      </PropRow>
      {tilt.enabled && (
        <>
          <PropRow label={t('lb_slot_max_angle', 'Max °')}>
            <Slider value={tilt.maxAngle} onChange={(v) => setTilt({ maxAngle: v })}
              min={1} max={45} step={1} size="xs" label={(v) => `${v}°`} />
          </PropRow>
          <PropRow label={t('lb_slot_persp', 'Persp.')}>
            <NumberInput value={tilt.perspective} onChange={(v) => setTilt({ perspective: Number(v) || 1000 })}
              min={200} max={5000} step={50} size="xs" variant="filled" suffix=" px" />
          </PropRow>
          <PropRow label={t('lb_slot_reset', 'Reset')}>
            <NumberInput value={tilt.resetSpeed} onChange={(v) => setTilt({ resetSpeed: Number(v) || 300 })}
              min={50} max={2000} step={50} size="xs" variant="filled" suffix=" ms" />
          </PropRow>
        </>
      )}
    </Stack>
  );
}

function EntranceSection({ slot, onUpdate }: EffectSectionProps) {
  const { t } = useTranslation('wpsg');
  // P58-E: scroll-reveal entrance animation, previewed in-panel (the live builder
  // canvas uses LayoutSlotComponent; entrance only runs in the rendered gallery).
  const anim = slot.entranceAnimation;
  const [playNonce, setPlayNonce] = useState(0);
  const previewClass = 'wpsg-entrance-preview-box';

  const setAnim = (patch: Partial<SlotEntranceAnimation>) => {
    if (!anim) return;
    onUpdate({ entranceAnimation: { ...anim, ...patch } });
  };

  const previewCss = anim
    ? buildSlotEntranceCss({ className: previewClass, keyframeName: 'wpsgEntrancePreviewKf', anim, rotationDeg: 0 })
    : '';
  // Re-mount the preview box (replaying the CSS animation) on any setting change or Play click.
  const previewKey = anim
    ? `${playNonce}-${anim.type}-${anim.direction ?? ''}-${anim.durationMs ?? ''}-${anim.delayMs ?? ''}`
    : `${playNonce}`;

  return (
    <Stack gap={4}>
      <PropRow label={t('lb_slot_type', 'Type')}>
        <Select
          data={[
            { value: 'none', label: t('lb_slot_ent_none', 'None') },
            { value: 'fade', label: t('lb_slot_ent_fade', 'Fade') },
            { value: 'slide', label: t('lb_slot_ent_slide', 'Slide') },
            { value: 'zoom', label: t('lb_slot_ent_zoom', 'Zoom') },
          ]}
          value={anim?.type ?? 'none'}
          onChange={(val) => {
            if (!val || val === 'none') { onUpdate({ entranceAnimation: undefined }); return; }
            onUpdate({ entranceAnimation: { ...(anim ?? {}), type: val as SlotEntranceType } });
          }}
          size="xs" variant="filled"
          aria-label={t('lb_slot_ent_type_aria', 'Entrance animation type')}
        />
      </PropRow>

      {anim && (
        <>
          {anim.type === 'slide' && (
            <PropRow label={t('lb_slot_direction', 'Direction')}>
              <Select
                data={[
                  { value: 'up', label: t('lb_slot_dir_up', 'Up') },
                  { value: 'down', label: t('lb_slot_dir_down', 'Down') },
                  { value: 'left', label: t('lb_slot_dir_left', 'Left') },
                  { value: 'right', label: t('lb_slot_dir_right', 'Right') },
                ]}
                value={anim.direction ?? 'up'}
                onChange={(val) => val && setAnim({ direction: val as SlotEntranceDirection })}
                size="xs" variant="filled"
                aria-label={t('lb_slot_slide_dir_aria', 'Slide direction')}
              />
            </PropRow>
          )}
          <PropRow label={t('lb_slot_duration', 'Duration')}>
            <NumberInput
              value={anim.durationMs ?? 600}
              onChange={(v) => setAnim({ durationMs: typeof v === 'number' ? v : 600 })}
              min={50} max={5000} step={50} size="xs" variant="filled" suffix=" ms"
              aria-label={t('lb_slot_ent_dur_aria', 'Entrance duration')}
            />
          </PropRow>
          <PropRow label={t('lb_slot_delay', 'Delay')}>
            <NumberInput
              value={anim.delayMs ?? 0}
              onChange={(v) => setAnim({ delayMs: typeof v === 'number' ? v : 0 })}
              min={0} max={5000} step={50} size="xs" variant="filled" suffix=" ms"
              aria-label={t('lb_slot_ent_delay_aria', 'Entrance delay')}
            />
          </PropRow>
          <Group gap={8} align="center" mt={2}>
            <Box
              style={{
                width: 64, height: 40, position: 'relative', overflow: 'hidden',
                borderRadius: 4, background: 'var(--mantine-color-default-hover)',
                border: '1px solid var(--mantine-color-default-border)', flexShrink: 0,
              }}
            >
              <style>{previewCss}</style>
              <div
                key={previewKey}
                className={`${previewClass} ${REVEAL_CLASS}`}
                style={{ position: 'absolute', inset: 8, background: 'var(--mantine-color-blue-5)', borderRadius: 2 }}
              />
            </Box>
            <Button
              size="compact-xs"
              variant="light"
              leftSection={<IconPlayerPlay size={12} />}
              onClick={() => setPlayNonce((n) => n + 1)}
            >
              {t('lb_slot_play_preview', 'Play preview')}
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
setWpsgDebugDisplayName(EntranceSection, 'LayoutBuilder:SlotPropertiesPanel:EntranceSection');

// ── Component ────────────────────────────────────────────────

export function SlotPropertiesPanel({
  slot,
  onUpdate,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  listingMode = false,
}: SlotPropertiesPanelProps) {
  const { t } = useTranslation('wpsg');
  const shapeOptions = SHAPE_OPTIONS.map((o) => ({ value: o.value, label: t(`lb_slot_shape_${o.value}`, o.label) }));
  const fitOptions = FIT_OPTIONS.map((o) => ({ value: o.value, label: t(`lb_slot_fit_${o.value}`, o.label) }));
  const clickOptions = CLICK_OPTIONS.map((o) => ({ value: o.value, label: t(`lb_slot_click_${o.value}`, o.label) }));
  const hoverOptions = HOVER_OPTIONS.map((o) => ({ value: o.value, label: t(`lb_slot_hover_${o.value}`, o.label) }));
  const blendOptions = BLEND_MODE_OPTIONS.map((o) => ({ value: o.value, label: t(`lb_slot_blend_${o.value}`, o.label) }));
  const lockSizeRatio = slot.lockAspectRatio ?? false;
  const rotScrubRef = useRef<{ startX: number; startRot: number } | null>(null);
  const aspectRatio = useMemo(() => {
    const safeWidth = slot.width > 0 ? slot.width : 1;
    const safeHeight = slot.height > 0 ? slot.height : 1;
    return safeHeight / safeWidth;
  }, [slot.width, slot.height]);

  const clampPct = (value: number) => Math.max(1, Math.min(100, value));

  return (
    <>
      {listingMode && (
        <Box
          mb={6}
          style={{
            display: 'flex',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 6,
            background: 'var(--mantine-color-yellow-light)',
            color: 'var(--mantine-color-yellow-9)',
            fontSize: '0.8125rem',
            lineHeight: 1.4,
          }}
          role="note"
        >
          <IconAlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {t('lb_slot_listing_note', 'Listing mode: container effects (tilt, border, overlay, blend) apply to the card wrapper. Image-specific controls are hidden.')}
          </span>
        </Box>
      )}
    <Accordion
      multiple
      defaultValue={['layout', 'image', 'effects', 'stacking']}
      chevronPosition="right"
      styles={{
        item: { borderBottom: '1px solid var(--mantine-color-default-border)' },
        control: { paddingBlock: 6, paddingInline: 4 },
        panel: { padding: 0 },
        content: { padding: '4px 4px 8px' },
      }}
    >
      {/* ── Layout ─────────────────────────────────────────── */}
      <Accordion.Item value="layout">
        <Accordion.Control>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" lts={0.8}>{t('lb_slot_acc_layout', 'Layout')}</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap={4}>
            <PropRow label={t('lb_slot_name', 'Name')}>
              <TextInput
                value={slot.name ?? ''}
                onChange={(e) => onUpdate({ name: e.currentTarget.value || undefined })}
                placeholder={t('lb_slot_name_ph', 'Slot')}
                size="xs"
                variant="filled"
              />
            </PropRow>

            <SectionHeader label={t('lb_slot_sh_position', 'Position')} />
            <Group grow gap={6}>
              <PropRow label={t('lb_slot_x', 'X %')}>
                <NumberInput
                  value={slot.x}
                  onChange={(val) => onUpdate({ x: Number(val) || 0 })}
                  min={0} max={100} step={0.5} size="xs" decimalScale={2} variant="filled"
                />
              </PropRow>
              <PropRow label={t('lb_slot_y', 'Y %')}>
                <NumberInput
                  value={slot.y}
                  onChange={(val) => onUpdate({ y: Number(val) || 0 })}
                  min={0} max={100} step={0.5} size="xs" decimalScale={2} variant="filled"
                />
              </PropRow>
            </Group>

            <SectionHeader label={t('lb_slot_sh_size', 'Size')} />
            <Group gap={4} align="center" wrap="nowrap">
              <Box style={{ flex: 1 }}>
                <NumberInput
                  value={slot.width}
                  onChange={(val) => {
                    const width = clampPct(Number(val) || 1);
                    if (!lockSizeRatio) { onUpdate({ width }); return; }
                    const height = clampPct(Number((width * aspectRatio).toFixed(2)));
                    onUpdate({ width, height });
                  }}
                  min={1} max={100} step={0.5} size="xs" decimalScale={2} variant="filled"
                  aria-label={t('lb_slot_width_aria', 'Width %')}
                  leftSection={<Text size="10px" c="dimmed">W</Text>}
                />
              </Box>
              <Tooltip label={lockSizeRatio ? t('lb_slot_unlock', 'Unlock aspect ratio') : t('lb_slot_lock', 'Lock aspect ratio')} position="top">
                <ActionIcon
                  size="sm"
                  variant={lockSizeRatio ? 'filled' : 'subtle'}
                  color={lockSizeRatio ? 'blue' : 'gray'}
                  onClick={() => onUpdate({ lockAspectRatio: !lockSizeRatio })}
                  aria-label={lockSizeRatio ? t('lb_slot_unlock', 'Unlock aspect ratio') : t('lb_slot_lock', 'Lock aspect ratio')}
                  style={{ flexShrink: 0 }}
                >
                  {lockSizeRatio ? <IconLink size={14} /> : <IconUnlink size={14} />}
                </ActionIcon>
              </Tooltip>
              <Box style={{ flex: 1 }}>
                <NumberInput
                  value={slot.height}
                  onChange={(val) => {
                    const height = clampPct(Number(val) || 1);
                    if (!lockSizeRatio) { onUpdate({ height }); return; }
                    const width = clampPct(Number((height / aspectRatio).toFixed(2)));
                    onUpdate({ width, height });
                  }}
                  min={1} max={100} step={0.5} size="xs" decimalScale={2} variant="filled"
                  aria-label={t('lb_slot_height_aria', 'Height %')}
                  leftSection={<Text size="10px" c="dimmed">H</Text>}
                />
              </Box>
            </Group>

            {/* Rotation section header — drag left/right to scrub value (pointer capture for reliability) */}
            <div
              style={{
                marginTop: 6,
                marginBottom: 2,
                paddingBottom: 3,
                borderBottom: '1px solid var(--mantine-color-default-border)',
                cursor: 'ew-resize',
                userSelect: 'none',
                touchAction: 'none',
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                rotScrubRef.current = { startX: e.clientX, startRot: slot.rotation ?? 0 };
              }}
              onPointerMove={(e) => {
                if (!rotScrubRef.current || !(e.buttons & 1)) return;
                const delta = e.clientX - rotScrubRef.current.startX;
                const next = ((Math.round(rotScrubRef.current.startRot + delta) % 360) + 360) % 360;
                onUpdate({ rotation: next === 0 ? undefined : next });
              }}
              onPointerUp={() => { rotScrubRef.current = null; }}
              onPointerCancel={() => { rotScrubRef.current = null; }}
            >
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" lts={0.8}>{t('lb_slot_rotation', 'Rotation')}</Text>
            </div>
            <Group gap={6} align="center" wrap="nowrap">
              <NumberInput
                value={slot.rotation ?? 0}
                onChange={(val) => {
                  const deg = ((Math.round(Number(val)) % 360) + 360) % 360;
                  onUpdate({ rotation: deg === 0 ? undefined : deg });
                }}
                min={0} max={359} step={1} size="xs" variant="filled"
                aria-label={t('lb_slot_rot_aria', 'Rotation degrees')}
                rightSection={<Text size="10px" c="dimmed">°</Text>}
                style={{ flex: 1 }}
              />
              {(slot.rotation ?? 0) !== 0 && (
                <Tooltip label={t('lb_slot_reset_rot', 'Reset rotation')}>
                  <ActionIcon size="sm" variant="subtle" onClick={() => onUpdate({ rotation: undefined })} aria-label={t('lb_slot_reset_rot', 'Reset rotation')}>
                    <IconRefresh size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>

            <SectionHeader label={t('lb_slot_sh_opacity', 'Opacity')} />
            <Slider
              value={slot.opacity ?? 1}
              onChange={(v) => onUpdate({ opacity: v >= 1 ? undefined : v })}
              min={0}
              max={1}
              step={0.05}
              size="xs"
              label={(v) => `${Math.round(v * 100)}%`}
              aria-label={t('lb_slot_opacity_aria', 'Slot opacity')}
            />

            <SectionHeader label={t('lb_slot_sh_shape', 'Shape')} />
            <PropRow label={t('lb_slot_preset', 'Preset')}>
              <Select
                data={shapeOptions}
                value={slot.shape}
                onChange={(val) => val && onUpdate({ shape: val as LayoutSlotShape })}
                size="xs"
                variant="filled"
              />
            </PropRow>
            {slot.shape === 'custom' && (
              <PropRow label={t('lb_slot_clippath', 'Clip-path')}>
                <TextInput
                  value={slot.clipPath ?? ''}
                  onChange={(e) => onUpdate({ clipPath: e.currentTarget.value })}
                  placeholder={t('lb_slot_clippath_ph', 'polygon(50% 0%, 100% 50%, …)')}
                  size="xs"
                  variant="filled"
                />
              </PropRow>
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      {/* ── Image ──────────────────────────────────────────── */}
      {listingMode ? (
        <Box
          style={{
            padding: '8px 4px',
            fontSize: '0.8125rem',
            color: 'var(--mantine-color-dimmed)',
            borderBottom: '1px solid var(--mantine-color-default-border)',
            display: 'flex',
            gap: 6,
            alignItems: 'flex-start',
          }}
        >
          <IconInfoCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{t('lb_slot_listing_image_note', 'Image fit and focal point settings do not apply in listing mode — slots act as positioned containers for campaign cards.')}</span>
        </Box>
      ) : (
      <Accordion.Item value="image">
        <Accordion.Control>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" lts={0.8}>{t('lb_slot_acc_image', 'Image')}</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap={4}>
            <PropRow label={t('lb_slot_fit', 'Fit')}>
              <Select
                data={fitOptions}
                value={slot.objectFit}
                onChange={(val) =>
                  val && onUpdate({ objectFit: val as LayoutSlot['objectFit'] })
                }
                size="xs"
                variant="filled"
              />
            </PropRow>

            <PropRow label={t('lb_slot_focus', 'Focus')}>
              <div
                title={t('lb_slot_focus_title', 'Click a position to set which part of the image stays in frame.')}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 2,
                  width: 78,
                }}
              >
                {FOCAL_PRESETS.map(({ pos, label, dotX, dotY }) => {
                  const isActive = slot.objectPosition === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      title={t(`lb_slot_focal_${pos.replace(/[^0-9]+/g, '_').replace(/^_|_$/g, '')}`, label)}
                      onClick={() => onUpdate({ objectPosition: pos })}
                      style={{
                        width: 24,
                        height: 24,
                        border: isActive
                          ? '2px solid var(--mantine-color-blue-5)'
                          : '1px solid var(--mantine-color-default-border)',
                        borderRadius: 3,
                        background: isActive
                          ? 'var(--mantine-color-blue-7)'
                          : 'var(--mantine-color-default)',
                        cursor: 'pointer',
                        padding: 0,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      aria-label={t(`lb_slot_focal_${pos.replace(/[^0-9]+/g, '_').replace(/^_|_$/g, '')}`, label)}
                      aria-pressed={isActive}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: isActive
                            ? '#fff'
                            : 'var(--mantine-color-text)',
                          left: dotX,
                          top: dotY,
                          transform: 'translate(-50%, -50%)',
                          pointerEvents: 'none',
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </PropRow>
            <PropRow label={t('lb_slot_custom', 'Custom')}>
              <TextInput
                value={slot.objectPosition}
                onChange={(e) => onUpdate({ objectPosition: e.currentTarget.value })}
                placeholder={t('lb_slot_custom_ph', '50% 50%')}
                size="xs"
                variant="filled"
              />
            </PropRow>

            <SectionHeader label={t('lb_slot_sh_border', 'Border')} />
            {slot.shape === 'rectangle' && (
              <PropRow label={t('lb_slot_radius', 'Radius')}>
                <NumberInput
                  value={slot.borderRadius}
                  onChange={(val) => onUpdate({ borderRadius: Number(val) || 0 })}
                  min={0} max={200} size="xs" variant="filled"
                  suffix=" px"
                />
              </PropRow>
            )}
            <Group grow gap={6}>
              <PropRow label={t('lb_slot_bwidth', 'Width')}>
                <NumberInput
                  value={slot.borderWidth}
                  onChange={(val) => onUpdate({ borderWidth: Number(val) || 0 })}
                  min={0} max={20} size="xs" variant="filled"
                  suffix=" px"
                />
              </PropRow>
              <PropRow label={t('lb_slot_color', 'Color')}>
                <ColorInput
                  value={slot.borderColor}
                  onChange={(val) => onUpdate({ borderColor: val })}
                  size="xs" format="hex" variant="filled"
                />
              </PropRow>
            </Group>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
      )}

      {/* ── Effects ────────────────────────────────────────── */}
      <Accordion.Item value="effects">
        <Accordion.Control>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" lts={0.8}>{t('lb_slot_acc_effects', 'Effects')}</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap={4}>
            <SectionHeader label={t('lb_slot_sh_filters', 'Filters')} />
            <FilterEffectsSection slot={slot} onUpdate={onUpdate} />

            <SectionHeader label={t('lb_slot_sh_shadow', 'Shadow')} />
            <ShadowSection slot={slot} onUpdate={onUpdate} />

            <SectionHeader label={t('lb_slot_sh_blend', 'Blend')} />
            <PropRow label={t('lb_slot_mode', 'Mode')}>
              <Select
                size="xs" variant="filled"
                data={blendOptions}
                value={slot.blendMode ?? 'normal'}
                onChange={(v) => onUpdate({ blendMode: (v ?? 'normal') as SlotBlendMode })}
              />
            </PropRow>

            <SectionHeader label={t('lb_slot_sh_overlay', 'Overlay')} />
            <OverlayEffectSection slot={slot} onUpdate={onUpdate} />

            <SectionHeader label={t('lb_slot_sh_tilt', '3D Tilt')} />
            <TiltEffectSection slot={slot} onUpdate={onUpdate} />

            <SectionHeader label={t('lb_slot_sh_entrance', 'Entrance')} />
            <EntranceSection slot={slot} onUpdate={onUpdate} />
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      {/* ── Stacking & Interaction ─────────────────────────── */}
      <Accordion.Item value="stacking">
        <Accordion.Control>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" lts={0.8}>{t('lb_slot_acc_stacking', 'Stacking & Interaction')}</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap={4}>
            <SectionHeader label={t('lb_slot_sh_stacking', 'Stacking')} />
            <Group gap={6} align="center" wrap="nowrap">
              <PropRow label={t('lb_slot_zindex', 'Z-Index')}>
                <NumberInput
                  value={slot.zIndex}
                  onChange={(val) => onUpdate({ zIndex: Number(val) || 0 })}
                  min={0} max={100} size="xs" variant="filled"
                />
              </PropRow>
              <Group gap={2} style={{ flexShrink: 0 }}>
                <Tooltip label={t('lb_slot_send_back_tt', 'Send to Back (Shift+[)')}>
                  <ActionIcon size="xs" variant="subtle" onClick={onSendToBack} aria-label={t('lb_slot_send_back_aria', 'Send to back')}>
                    <IconArrowBigDownLine size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t('lb_slot_send_bwd_tt', 'Send Backward ([)')}>
                  <ActionIcon size="xs" variant="subtle" onClick={onSendBackward} aria-label={t('lb_slot_send_bwd_aria', 'Send backward')}>
                    <IconArrowDown size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t('lb_slot_bring_fwd_tt', 'Bring Forward (])')}>
                  <ActionIcon size="xs" variant="subtle" onClick={onBringForward} aria-label={t('lb_slot_bring_fwd_aria', 'Bring forward')}>
                    <IconArrowUp size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t('lb_slot_bring_front_tt', 'Bring to Front (Shift+])')}>
                  <ActionIcon size="xs" variant="subtle" onClick={onBringToFront} aria-label={t('lb_slot_bring_front_aria', 'Bring to front')}>
                    <IconArrowBigUpLine size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            <SectionHeader label={t('lb_slot_sh_interaction', 'Interaction')} />
            {listingMode ? (
              <Box
                style={{
                  padding: '4px 0',
                  fontSize: '0.8125rem',
                  color: 'var(--mantine-color-dimmed)',
                  display: 'flex',
                  gap: 6,
                  alignItems: 'flex-start',
                }}
              >
                <IconInfoCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{t('lb_slot_listing_click_note', 'Card click is controlled by the campaign card component.')}</span>
              </Box>
            ) : (
              <PropRow label={t('lb_slot_click', 'Click')}>
                <SegmentedControl
                  data={clickOptions}
                  value={slot.clickAction}
                  onChange={(val) =>
                    onUpdate({ clickAction: val as LayoutSlot['clickAction'] })
                  }
                  size="xs"
                  fullWidth
                />
              </PropRow>
            )}
            <PropRow label={t('lb_slot_hover', 'Hover')}>
              <SegmentedControl
                data={hoverOptions}
                value={slot.hoverEffect}
                onChange={(val) =>
                  onUpdate({ hoverEffect: val as LayoutSlot['hoverEffect'] })
                }
                size="xs"
                fullWidth
              />
            </PropRow>
            {slot.hoverEffect === 'glow' && (
              <>
                <PropRow label={t('lb_slot_glow', 'Glow')}>
                  <ColorInput
                    value={slot.glowColor || '#7c9ef8'}
                    onChange={(v) => onUpdate({ glowColor: v })}
                    size="xs" format="hex" variant="filled"
                  />
                </PropRow>
                <PropRow label={t('lb_slot_spread', 'Spread')}>
                  <Slider
                    value={slot.glowSpread ?? 12}
                    onChange={(v) => onUpdate({ glowSpread: v })}
                    min={2} max={60} step={1} size="xs" label={(v) => `${v}px`}
                  />
                </PropRow>
              </>
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
    </>
  );
}

setWpsgDebugDisplayName(SlotPropertiesPanel, 'LayoutBuilder:SlotPropertiesPanel');
