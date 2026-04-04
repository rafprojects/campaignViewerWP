import { useState } from 'react';
import {
  Box,
  Text,
  Stack,
  Group,
  Select,
  Slider,
  NumberInput,
  SegmentedControl,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import type { GradientStop, GradientDirection, GradientType, RadialShape, RadialSize } from '@/types';
import { buildGradientCss, DEFAULT_GRADIENT_STOPS, type GradientOptions } from '@/utils/gradientCss';

interface GradientEditorProps {
  value: GradientOptions;
  onChange: (opts: GradientOptions) => void;
}

function GRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group gap={6} align="center" wrap="nowrap">
      <Text size="xs" c="dimmed" style={{ width: 40, flexShrink: 0 }}>{label}</Text>
      {children}
    </Group>
  );
}

const GRADIENT_DIRECTIONS: Array<{ value: GradientDirection; icon: string; label: string }> = [
  { value: 'horizontal', icon: '→', label: 'Horizontal (90°)' },
  { value: 'vertical', icon: '↓', label: 'Vertical (180°)' },
  { value: 'diagonal-right', icon: '↗', label: '45° right' },
  { value: 'diagonal-left', icon: '↘', label: '135° left' },
];

const RADIAL_SIZES: Array<{ value: RadialSize; label: string }> = [
  { value: 'farthest-corner', label: 'Farthest corner' },
  { value: 'farthest-side', label: 'Farthest side' },
  { value: 'closest-corner', label: 'Closest corner' },
  { value: 'closest-side', label: 'Closest side' },
];

export function GradientEditor({ value, onChange }: GradientEditorProps) {
  const stops: GradientStop[] = value.stops?.length ? value.stops : [...DEFAULT_GRADIENT_STOPS];
  const gradType: GradientType = value.type ?? 'linear';
  const dir = value.direction ?? 'horizontal';

  const [stopCount, setStopCount] = useState<2 | 3>(stops.length > 2 ? 3 : 2);

  const update = (patch: Partial<GradientOptions>) => onChange({ ...value, ...patch });

  const updateStop = (index: number, patch: Partial<GradientStop>) => {
    const next = [...stops];
    next[index] = { ...next[index], ...patch };
    update({ stops: next });
  };

  const handleStopCountChange = (count: 2 | 3) => {
    setStopCount(count);
    if (count === 3 && stops.length < 3) {
      update({ stops: [...stops, { color: 'rgba(128,128,128,1)', position: 50 }] });
    } else if (count === 2 && stops.length > 2) {
      update({ stops: stops.slice(0, 2) });
    }
  };

  const previewCss = buildGradientCss(value) ?? 'transparent';

  return (
    <Stack gap={6}>
      <Box style={{ height: 28, borderRadius: 4, background: previewCss, border: '1px solid var(--mantine-color-dark-4)' }} />

      <GRow label="Type">
        <SegmentedControl
          size="xs"
          data={[
            { label: 'Linear', value: 'linear' },
            { label: 'Radial', value: 'radial' },
            { label: 'Conic', value: 'conic' },
          ]}
          value={gradType}
          onChange={(v) => update({ type: v as GradientType })}
          style={{ flex: 1 }}
        />
      </GRow>

      {gradType === 'linear' && (
        <>
          <GRow label="Dir">
            <Group gap={3}>
              {GRADIENT_DIRECTIONS.map((d) => (
                <Tooltip key={d.value} label={d.label} position="top">
                  <ActionIcon
                    size="sm"
                    variant={dir === d.value && value.angle == null ? 'filled' : 'subtle'}
                    color={dir === d.value && value.angle == null ? 'blue' : 'gray'}
                    onClick={() => update({ direction: d.value, angle: undefined })}
                    aria-label={d.label}
                  >
                    <Text size="xs" fw={600}>{d.icon}</Text>
                  </ActionIcon>
                </Tooltip>
              ))}
            </Group>
          </GRow>
          <GRow label="Angle">
            <NumberInput
              size="xs"
              value={value.angle ?? ''}
              onChange={(val) => update({ angle: val === '' || val === undefined ? undefined : Number(val) })}
              placeholder="auto" min={0} max={360} step={5} suffix="°" style={{ flex: 1 }}
            />
          </GRow>
        </>
      )}

      {gradType === 'radial' && (
        <>
          <GRow label="Shape">
            <SegmentedControl
              size="xs"
              data={[{ label: 'Ellipse', value: 'ellipse' }, { label: 'Circle', value: 'circle' }]}
              value={value.radialShape ?? 'ellipse'}
              onChange={(v) => update({ radialShape: v as RadialShape })}
              style={{ flex: 1 }}
            />
          </GRow>
          <GRow label="Size">
            <Select
              size="xs"
              data={RADIAL_SIZES.map((s) => ({ value: s.value, label: s.label }))}
              value={value.radialSize ?? 'farthest-corner'}
              onChange={(v) => update({ radialSize: (v ?? 'farthest-corner') as RadialSize })}
              style={{ flex: 1 }}
            />
          </GRow>
          <GRow label="Ctr X">
            <Slider size="xs" value={value.centerX ?? 50} onChange={(v) => update({ centerX: v })} min={0} max={100} step={1} label={(v) => `${v}%`} style={{ flex: 1 }} />
          </GRow>
          <GRow label="Ctr Y">
            <Slider size="xs" value={value.centerY ?? 50} onChange={(v) => update({ centerY: v })} min={0} max={100} step={1} label={(v) => `${v}%`} style={{ flex: 1 }} />
          </GRow>
        </>
      )}

      {gradType === 'conic' && (
        <>
          <GRow label="Angle">
            <NumberInput size="xs" value={value.angle ?? 0} onChange={(val) => update({ angle: val === '' ? 0 : Number(val) })} min={0} max={360} step={5} suffix="°" style={{ flex: 1 }} />
          </GRow>
          <GRow label="Ctr X">
            <Slider size="xs" value={value.centerX ?? 50} onChange={(v) => update({ centerX: v })} min={0} max={100} step={1} label={(v) => `${v}%`} style={{ flex: 1 }} />
          </GRow>
          <GRow label="Ctr Y">
            <Slider size="xs" value={value.centerY ?? 50} onChange={(v) => update({ centerY: v })} min={0} max={100} step={1} label={(v) => `${v}%`} style={{ flex: 1 }} />
          </GRow>
        </>
      )}

      <GRow label="Stops">
        <SegmentedControl size="xs" data={[{ label: '2', value: '2' }, { label: '3', value: '3' }]} value={String(stopCount)} onChange={(v) => handleStopCountChange(Number(v) as 2 | 3)} />
      </GRow>

      {stops.map((stop, i) => {
        const stopLabel = i === 0 ? 'Start' : i === stops.length - 1 ? 'End' : 'Mid';
        return (
          <Stack key={i} gap={4}>
            <GRow label={stopLabel}>
              <ColorInput size="xs" value={stop.color} onChange={(val) => updateStop(i, { color: val })} format="rgba" style={{ flex: 1 }} />
            </GRow>
            <GRow label="Pos">
              <Slider size="xs" value={stop.position ?? (i === 0 ? 0 : i === stops.length - 1 ? 100 : 50)} onChange={(val) => updateStop(i, { position: val })} min={0} max={100} step={1} label={(v) => `${v}%`} style={{ flex: 1 }} />
            </GRow>
          </Stack>
        );
      })}
    </Stack>
  );
}
