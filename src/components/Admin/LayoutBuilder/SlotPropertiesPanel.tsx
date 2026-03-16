import { useMemo } from 'react';
import {
  Stack,
  Text,
  NumberInput,
  Select,
  ColorInput,
  Group,
  SegmentedControl,
  TextInput,
  ActionIcon,
  Tooltip,
  Box,
  Slider,
} from '@mantine/core';
import {
  IconArrowBigUpLine,
  IconArrowBigDownLine,
  IconArrowUp,
  IconArrowDown,
  IconInfoCircle,
  IconLink,
  IconUnlink,
} from '@tabler/icons-react';
import type {
  LayoutSlot,
  LayoutSlotShape,
  SlotFilterEffects,
  SlotShadow,
  SlotTiltEffect,
  SlotBlendMode,
  SlotOverlayEffect,
} from '@/types';

// ── Props ────────────────────────────────────────────────────

export interface SlotPropertiesPanelProps {
  slot: LayoutSlot;
  onUpdate: (updates: Partial<LayoutSlot>) => void;
  /** Z-index reorder callbacks (P15-G). */
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;

}

// ── Options ──────────────────────────────────────────────────

const SHAPE_OPTIONS: { value: LayoutSlotShape; label: string }[] = [
  { value: 'rectangle', label: '\u25ac Rectangle' },
  { value: 'circle', label: '\u25cf Circle' },
  { value: 'ellipse', label: '\u2b2d Ellipse' },
  { value: 'hexagon', label: '\u2b22 Hexagon' },
  { value: 'diamond', label: '\u25c6 Diamond' },
  { value: 'parallelogram-left', label: '\u25b1 Parallelogram \u2190' },
  { value: 'parallelogram-right', label: '\u25b1 Parallelogram \u2192' },
  { value: 'chevron', label: '\u276f Chevron' },
  { value: 'arrow', label: '\u27a4 Arrow' },
  { value: 'trapezoid', label: '\u2b1f Trapezoid' },
  { value: 'custom', label: '\u2742 Custom' },
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

/**
 * Each preset is a CSS object-position value: "X% Y%".
 * First value = horizontal (0% = left, 50% = center, 100% = right).
 * Second value = vertical  (0% = top,  50% = center, 100% = bottom).
 */
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

/** Reusable inline label + control row. */
function PropRow({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  return (
    <Group gap={6} align="center" wrap="nowrap" style={{ minHeight: 28 }}>
      <Group gap={2} align="center" wrap="nowrap" style={{ width: 70, flexShrink: 0 }}>
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{label}</Text>
        {tooltip && (
          <Tooltip label={tooltip} multiline w={240} position="left" withArrow>
            <ActionIcon size={14} variant="transparent" c="dimmed" aria-label={`${label} info`}>
              <IconInfoCircle size={12} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <Box style={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Group>
  );
}

/** Section header with a subtle horizontal rule. */
function SectionHeader({ label }: { label: string }) {
  return (
    <Box
      mt={6}
      mb={2}
      pb={3}
      style={{
        borderBottom: '1px solid var(--mantine-color-dark-5)',
      }}
    >
      <Text size="xs" fw={700} tt="uppercase" c="dimmed" lts={0.8}>
        {label}
      </Text>
    </Box>
  );
}

// ── Component ────────────────────────────────────────────────

export function SlotPropertiesPanel({
  slot,
  onUpdate,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
}: SlotPropertiesPanelProps) {
  const lockSizeRatio = slot.lockAspectRatio ?? false;
  const aspectRatio = useMemo(() => {
    const safeWidth = slot.width > 0 ? slot.width : 1;
    const safeHeight = slot.height > 0 ? slot.height : 1;
    return safeHeight / safeWidth;
  }, [slot.width, slot.height]);

  const clampPct = (value: number) => Math.max(1, Math.min(100, value));

  return (
    <Stack gap={4} p={4}>
      {/* ── Name ── */}
      <PropRow label="Name">
        <TextInput
          value={slot.name ?? ''}
          onChange={(e) => onUpdate({ name: e.currentTarget.value || undefined })}
          placeholder="Slot"
          size="xs"
          variant="filled"
        />
      </PropRow>

      {/* ── Position ── */}
      <SectionHeader label="Position" />
      <Group grow gap={6}>
        <PropRow label="X %">
          <NumberInput
            value={slot.x}
            onChange={(val) => onUpdate({ x: Number(val) || 0 })}
            min={0} max={100} step={0.5} size="xs" decimalScale={2} variant="filled"
          />
        </PropRow>
        <PropRow label="Y %">
          <NumberInput
            value={slot.y}
            onChange={(val) => onUpdate({ y: Number(val) || 0 })}
            min={0} max={100} step={0.5} size="xs" decimalScale={2} variant="filled"
          />
        </PropRow>
      </Group>

      {/* ── Size ── */}
      <SectionHeader label="Size" />
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
            aria-label="Width %"
            leftSection={<Text size="10px" c="dimmed">W</Text>}
          />
        </Box>
        <Tooltip label={lockSizeRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'} position="top">
          <ActionIcon
            size="sm"
            variant={lockSizeRatio ? 'filled' : 'subtle'}
            color={lockSizeRatio ? 'blue' : 'gray'}
            onClick={() => onUpdate({ lockAspectRatio: !lockSizeRatio })}
            aria-label={lockSizeRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
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
            aria-label="Height %"
            leftSection={<Text size="10px" c="dimmed">H</Text>}
          />
        </Box>
      </Group>

      {/* ── Shape ── */}
      <SectionHeader label="Shape" />
      <PropRow label="Preset">
        <Select
          data={SHAPE_OPTIONS}
          value={slot.shape}
          onChange={(val) => val && onUpdate({ shape: val as LayoutSlotShape })}
          size="xs"
          variant="filled"
        />
      </PropRow>
      {slot.shape === 'custom' && (
        <PropRow label="Clip-path">
          <TextInput
            value={slot.clipPath ?? ''}
            onChange={(e) => onUpdate({ clipPath: e.currentTarget.value })}
            placeholder="polygon(50% 0%, 100% 50%, …)"
            size="xs"
            variant="filled"
          />
        </PropRow>
      )}

      {/* ── Image ── */}
      <SectionHeader label="Image" />
      <PropRow label="Fit">
        <Select
          data={FIT_OPTIONS}
          value={slot.objectFit}
          onChange={(val) =>
            val && onUpdate({ objectFit: val as LayoutSlot['objectFit'] })
          }
          size="xs"
          variant="filled"
        />
      </PropRow>

      {/* ── Focal Point ── */}
      <PropRow label="Focus">
        <div
          title="Click a position to set which part of the image stays in frame."
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
                title={label}
                onClick={() => onUpdate({ objectPosition: pos })}
                style={{
                  width: 24,
                  height: 24,
                  border: isActive
                    ? '2px solid var(--mantine-color-blue-5)'
                    : '1px solid var(--mantine-color-dark-4)',
                  borderRadius: 3,
                  background: isActive
                    ? 'var(--mantine-color-blue-7)'
                    : 'var(--mantine-color-dark-6)',
                  cursor: 'pointer',
                  padding: 0,
                  position: 'relative',
                  overflow: 'hidden',
                }}
                aria-label={label}
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
                      : 'var(--mantine-color-dark-1)',
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
      <PropRow label="Custom">
        <TextInput
          value={slot.objectPosition}
          onChange={(e) => onUpdate({ objectPosition: e.currentTarget.value })}
          placeholder="50% 50%"
          size="xs"
          variant="filled"
        />
      </PropRow>

      {/* ── Border ── */}
      <SectionHeader label="Border" />
      {slot.shape === 'rectangle' && (
        <PropRow label="Radius">
          <NumberInput
            value={slot.borderRadius}
            onChange={(val) => onUpdate({ borderRadius: Number(val) || 0 })}
            min={0} max={200} size="xs" variant="filled"
            suffix=" px"
          />
        </PropRow>
      )}
      <Group grow gap={6}>
        <PropRow label="Width">
          <NumberInput
            value={slot.borderWidth}
            onChange={(val) => onUpdate({ borderWidth: Number(val) || 0 })}
            min={0} max={20} size="xs" variant="filled"
            suffix=" px"
          />
        </PropRow>
        <PropRow label="Color">
          <ColorInput
            value={slot.borderColor}
            onChange={(val) => onUpdate({ borderColor: val })}
            size="xs" format="hex" variant="filled"
          />
        </PropRow>
      </Group>

      {/* ── Stacking ── */}
      <SectionHeader label="Stacking" />
      <Group gap={6} align="center" wrap="nowrap">
        <PropRow label="Z-Index">
          <NumberInput
            value={slot.zIndex}
            onChange={(val) => onUpdate({ zIndex: Number(val) || 0 })}
            min={0} max={100} size="xs" variant="filled"
          />
        </PropRow>
        <Group gap={2} style={{ flexShrink: 0 }}>
          <Tooltip label="Send to Back (Shift+[)">
            <ActionIcon size="xs" variant="subtle" onClick={onSendToBack} aria-label="Send to back">
              <IconArrowBigDownLine size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Send Backward ([)">
            <ActionIcon size="xs" variant="subtle" onClick={onSendBackward} aria-label="Send backward">
              <IconArrowDown size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Bring Forward (])">
            <ActionIcon size="xs" variant="subtle" onClick={onBringForward} aria-label="Bring forward">
              <IconArrowUp size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Bring to Front (Shift+])">
            <ActionIcon size="xs" variant="subtle" onClick={onBringToFront} aria-label="Bring to front">
              <IconArrowBigUpLine size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* ── Interaction ── */}
      <SectionHeader label="Interaction" />
      <PropRow label="Click">
        <SegmentedControl
          data={CLICK_OPTIONS}
          value={slot.clickAction}
          onChange={(val) =>
            onUpdate({ clickAction: val as LayoutSlot['clickAction'] })
          }
          size="xs"
          fullWidth
        />
      </PropRow>
      <PropRow label="Hover">
        <SegmentedControl
          data={HOVER_OPTIONS}
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
          <PropRow label="Glow">
            <ColorInput
              value={slot.glowColor || '#7c9ef8'}
              onChange={(v) => onUpdate({ glowColor: v })}
              size="xs"
              format="hex"
              variant="filled"
            />
          </PropRow>
          <PropRow label="Spread">
            <Slider
              value={slot.glowSpread ?? 12}
              onChange={(v) => onUpdate({ glowSpread: v })}
              min={2}
              max={60}
              step={1}
              size="xs"
              label={(v) => `${v}px`}
            />
          </PropRow>
        </>
      )}

      {/* ── Image Effects ── */}
      <SectionHeader label="Filters" />
      {(() => {
        const fe: SlotFilterEffects = slot.filterEffects ?? {};
        const setFe = (patch: Partial<SlotFilterEffects>) =>
          onUpdate({ filterEffects: { ...fe, ...patch } });
        return (
          <Stack gap={4}>
            <PropRow label="Bright">
              <Slider
                value={fe.brightness ?? 100} onChange={(v) => setFe({ brightness: v })}
                min={0} max={200} step={1} size="xs" label={(v) => `${v}%`}
              />
            </PropRow>
            <PropRow label="Contrast">
              <Slider
                value={fe.contrast ?? 100} onChange={(v) => setFe({ contrast: v })}
                min={0} max={200} step={1} size="xs" label={(v) => `${v}%`}
              />
            </PropRow>
            <PropRow label="Saturate">
              <Slider
                value={fe.saturate ?? 100} onChange={(v) => setFe({ saturate: v })}
                min={0} max={200} step={1} size="xs" label={(v) => `${v}%`}
              />
            </PropRow>
            <PropRow label="Blur">
              <Slider
                value={fe.blur ?? 0} onChange={(v) => setFe({ blur: v })}
                min={0} max={20} step={0.5} size="xs" label={(v) => `${v}px`}
              />
            </PropRow>
            <PropRow label="Gray">
              <Slider
                value={fe.grayscale ?? 0} onChange={(v) => setFe({ grayscale: v })}
                min={0} max={100} step={1} size="xs" label={(v) => `${v}%`}
              />
            </PropRow>
            <PropRow label="Sepia">
              <Slider
                value={fe.sepia ?? 0} onChange={(v) => setFe({ sepia: v })}
                min={0} max={100} step={1} size="xs" label={(v) => `${v}%`}
              />
            </PropRow>
            <PropRow label="Hue">
              <Slider
                value={fe.hueRotate ?? 0} onChange={(v) => setFe({ hueRotate: v })}
                min={0} max={360} step={1} size="xs" label={(v) => `${v}°`}
              />
            </PropRow>
            <PropRow label="Invert">
              <Slider
                value={fe.invert ?? 0} onChange={(v) => setFe({ invert: v })}
                min={0} max={100} step={1} size="xs" label={(v) => `${v}%`}
              />
            </PropRow>
          </Stack>
        );
      })()}

      {/* ── Shadow / Glow ── */}
      <SectionHeader label="Shadow" />
      {(() => {
        const sh: SlotShadow = slot.shadow ?? { offsetX: 0, offsetY: 4, blur: 8, color: 'rgba(0,0,0,0.5)' };
        const hasShadow = Boolean(slot.shadow);
        const setSh = (patch: Partial<SlotShadow>) =>
          onUpdate({ shadow: { ...sh, ...patch } });
        return (
          <Stack gap={4}>
            <PropRow label="Enable">
              <SegmentedControl
                size="xs"
                fullWidth
                data={[
                  { label: 'Off', value: 'off' },
                  { label: 'On', value: 'on' },
                ]}
                value={hasShadow ? 'on' : 'off'}
                onChange={(v) =>
                  v === 'on'
                    ? onUpdate({ shadow: sh })
                    : onUpdate({ shadow: undefined })
                }
              />
            </PropRow>
            {hasShadow && (
              <>
                <Group grow gap={6}>
                  <PropRow label="Off X">
                    <NumberInput
                      value={sh.offsetX} onChange={(v) => setSh({ offsetX: Number(v) || 0 })}
                      min={-50} max={50} size="xs" variant="filled" suffix=" px"
                    />
                  </PropRow>
                  <PropRow label="Off Y">
                    <NumberInput
                      value={sh.offsetY} onChange={(v) => setSh({ offsetY: Number(v) || 0 })}
                      min={-50} max={50} size="xs" variant="filled" suffix=" px"
                    />
                  </PropRow>
                </Group>
                <PropRow label="Blur">
                  <Slider
                    value={sh.blur} onChange={(v) => setSh({ blur: v })}
                    min={0} max={50} step={1} size="xs" label={(v) => `${v}px`}
                  />
                </PropRow>
                <PropRow label="Color">
                  <ColorInput
                    value={sh.color} onChange={(v) => setSh({ color: v })}
                    size="xs" format="rgba" variant="filled"
                  />
                </PropRow>
              </>
            )}
          </Stack>
        );
      })()}

      {/* ── Blend Mode ── */}
      <SectionHeader label="Blend" />
      <PropRow label="Mode">
        <Select
          size="xs"
          variant="filled"
          data={BLEND_MODE_OPTIONS}
          value={slot.blendMode ?? 'normal'}
          onChange={(v) => onUpdate({ blendMode: (v ?? 'normal') as SlotBlendMode })}
        />
      </PropRow>

      {/* ── Darken / Lighten Overlay ── */}
      <SectionHeader label="Overlay" />
      {(() => {
        const ov: SlotOverlayEffect = slot.overlayEffect ?? { mode: 'none', intensity: 30, onHoverOnly: false };
        const setOv = (patch: Partial<SlotOverlayEffect>) =>
          onUpdate({ overlayEffect: { ...ov, ...patch } });
        return (
          <Stack gap={4}>
            <PropRow label="Mode">
              <SegmentedControl
                size="xs"
                fullWidth
                data={[
                  { label: 'None', value: 'none' },
                  { label: 'Darken', value: 'darken' },
                  { label: 'Lighten', value: 'lighten' },
                ]}
                value={ov.mode}
                onChange={(v) => setOv({ mode: v as SlotOverlayEffect['mode'] })}
              />
            </PropRow>
            {ov.mode !== 'none' && (
              <>
                <PropRow label="Intensity">
                  <Slider
                    value={ov.intensity} onChange={(v) => setOv({ intensity: v })}
                    min={0} max={100} step={1} size="xs" label={(v) => `${v}%`}
                  />
                </PropRow>
                <PropRow label="Hover only">
                  <SegmentedControl
                    size="xs"
                    fullWidth
                    data={[
                      { label: 'Always', value: 'always' },
                      { label: 'Hover', value: 'hover' },
                    ]}
                    value={ov.onHoverOnly ? 'hover' : 'always'}
                    onChange={(v) => setOv({ onHoverOnly: v === 'hover' })}
                  />
                </PropRow>
              </>
            )}
          </Stack>
        );
      })()}

      {/* ── 3D Tilt ── */}
      <SectionHeader label="3D Tilt" />
      {(() => {
        const tilt: SlotTiltEffect = slot.tilt ?? { enabled: false, maxAngle: 15, perspective: 1000, resetSpeed: 300 };
        const setTilt = (patch: Partial<SlotTiltEffect>) =>
          onUpdate({ tilt: { ...tilt, ...patch } });
        return (
          <Stack gap={4}>
            <PropRow label="Enable">
              <SegmentedControl
                size="xs"
                fullWidth
                data={[
                  { label: 'Off', value: 'off' },
                  { label: 'On', value: 'on' },
                ]}
                value={tilt.enabled ? 'on' : 'off'}
                onChange={(v) => setTilt({ enabled: v === 'on' })}
              />
            </PropRow>
            {tilt.enabled && (
              <>
                <PropRow label="Max °">
                  <Slider
                    value={tilt.maxAngle} onChange={(v) => setTilt({ maxAngle: v })}
                    min={1} max={45} step={1} size="xs" label={(v) => `${v}°`}
                  />
                </PropRow>
                <PropRow label="Persp.">
                  <NumberInput
                    value={tilt.perspective} onChange={(v) => setTilt({ perspective: Number(v) || 1000 })}
                    min={200} max={5000} step={50} size="xs" variant="filled" suffix=" px"
                  />
                </PropRow>
                <PropRow label="Reset">
                  <NumberInput
                    value={tilt.resetSpeed} onChange={(v) => setTilt({ resetSpeed: Number(v) || 300 })}
                    min={50} max={2000} step={50} size="xs" variant="filled" suffix=" ms"
                  />
                </PropRow>
              </>
            )}
          </Stack>
        );
      })()}
    </Stack>
  );
}
