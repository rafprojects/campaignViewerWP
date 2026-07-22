import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Text,
  Stack,
  Group,
  Button,
  Select,
  Slider,
  NumberInput,
  SegmentedControl,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { BuilderColorInput as ColorInput } from './BuilderColorInput';
import { IconTrash } from '@tabler/icons-react';
import type {
  GradientStop,
  GradientDirection,
  BackgroundMode,
  GradientType,
  RadialShape,
  RadialSize,
} from '@/types';
import { buildGradientCss, templateToGradientOpts, DEFAULT_GRADIENT_STOPS } from '@wp-super-gallery/shared-utils';
import { useBuilderDock } from './BuilderDockContext';
import { AssetUploader } from './AssetUploader';
import { DesignAssetsGrid } from './DesignAssetsGrid';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ── Helpers ──────────────────────────────────────────────────

function GRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group gap={6} align="center" wrap="nowrap">
      <Text size="xs" c="dimmed" style={{ width: 40, flexShrink: 0 }}>{label}</Text>
      {children}
    </Group>
  );
}
setWpsgDebugDisplayName(GRow, 'LayoutBuilder:GRow');

function SectionHeader({ label }: { label: string }) {
  return (
    <Box mt={6} mb={2} pb={3} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed" lts={0.8}>{label}</Text>
    </Box>
  );
}
setWpsgDebugDisplayName(SectionHeader, 'LayoutBuilder:SectionHeader');

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

// ── Component ────────────────────────────────────────────────

export function BackgroundPropertiesPanel() {
  const { t } = useTranslation('wpsg');
  const {
    builder,
    assetLibrary,
    isUploadingBg,
    handleUploadBgImage,
  } = useBuilderDock();

  const mode = builder.template.backgroundMode ?? 'color';

  return (
    <Stack gap={4} p={4}>
      {/* ── Mode selector ── */}
      <SegmentedControl
        size="xs"
        fullWidth
        data={[
          { label: t('lb_bg_mode_none', 'None'), value: 'none' },
          { label: t('lb_bg_mode_color', 'Color'), value: 'color' },
          { label: t('lb_bg_mode_gradient', 'Gradient'), value: 'gradient' },
          { label: t('lb_bg_mode_image', 'Image'), value: 'image' },
        ]}
        value={mode}
        onChange={(val) => {
          builder.setTemplateField('backgroundMode', val as BackgroundMode);
          if (val === 'gradient' && (!builder.template.backgroundGradientStops || builder.template.backgroundGradientStops.length < 2)) {
            builder.setTemplateField('backgroundGradientStops', [...DEFAULT_GRADIENT_STOPS]);
          }
        }}
      />

      {/* ── Mode-specific controls ── */}
      <BackgroundModeControls
        builder={builder}
        handleUploadBgImage={handleUploadBgImage}
        isUploadingBg={isUploadingBg}
      />

      {/* ── Asset Library for background image ── */}
      {mode === 'image' && (assetLibrary ?? []).length > 0 && (
        <>
          <SectionHeader label={t('lb_bg_asset_library', 'Asset Library')} />
          <DesignAssetsGrid
            items={assetLibrary ?? []}
            onSelect={(url) => builder.setBackgroundImage(url)}
            activeUrl={builder.template.backgroundImage ?? undefined}
            maxHeight={160}
          />
        </>
      )}
    </Stack>
  );
}

setWpsgDebugDisplayName(BackgroundPropertiesPanel, 'LayoutBuilder:BackgroundPropertiesPanel');

// ── Background mode controls ─────────────────────────────────

function BackgroundModeControls({
  builder,
  handleUploadBgImage,
  isUploadingBg,
}: {
  builder: ReturnType<typeof useBuilderDock>['builder'];
  handleUploadBgImage: (file: File) => void;
  isUploadingBg: boolean;
}) {
  const { t } = useTranslation('wpsg');
  const mode = builder.template.backgroundMode ?? 'color';
  const [stopCount, setStopCount] = useState<2 | 3>(
    (builder.template.backgroundGradientStops?.length ?? 2) > 2 ? 3 : 2,
  );

  if (mode === 'none') {
    return <Text size="xs" c="dimmed" mt={4}>{t('lb_bg_transparent', 'Transparent background — no fill applied.')}</Text>;
  }

  if (mode === 'color') {
    return (
      <Stack gap={6}>
        <GRow label={t('lb_slot_color', 'Color')}>
          <ColorInput
            size="xs"
            value={builder.template.backgroundColor}
            onChange={(color) => builder.setTemplateField('backgroundColor', color)}
            format="hexa"
            swatches={['#1a1a2e', '#0d1117', '#000000', '#ffffff', '#16213e', 'transparent']}
            style={{ flex: 1 }}
          />
        </GRow>
      </Stack>
    );
  }

  if (mode === 'gradient') {
    const stops: GradientStop[] = builder.template.backgroundGradientStops?.length
      ? builder.template.backgroundGradientStops
      : DEFAULT_GRADIENT_STOPS;
    const dir = builder.template.backgroundGradientDirection ?? 'horizontal';
    const gradType: GradientType = builder.template.backgroundGradientType ?? 'linear';

    const updateStop = (index: number, patch: Partial<GradientStop>) => {
      const next = [...stops];
      next[index] = { ...next[index]!, ...patch } as GradientStop;
      builder.setTemplateField('backgroundGradientStops', next);
    };

    const handleStopCountChange = (count: 2 | 3) => {
      setStopCount(count);
      if (count === 3 && stops.length < 3) {
        builder.setTemplateField('backgroundGradientStops', [
          ...stops,
          { color: 'rgba(128,128,128,1)', position: 50 },
        ]);
      } else if (count === 2 && stops.length > 2) {
        builder.setTemplateField('backgroundGradientStops', stops.slice(0, 2));
      }
    };

    const previewCss = buildGradientCss(templateToGradientOpts(builder.template)) ?? 'transparent';

    return (
      <Stack gap={6}>
        <Box style={{ height: 28, borderRadius: 4, background: previewCss, border: '1px solid var(--mantine-color-default-border)' }} />

        <GRow label={t('lb_slot_type', 'Type')}>
          <SegmentedControl
            size="xs"
            data={[
              { label: t('lb_bg_linear', 'Linear'), value: 'linear' },
              { label: t('lb_bg_radial', 'Radial'), value: 'radial' },
              { label: t('lb_bg_conic', 'Conic'), value: 'conic' },
            ]}
            value={gradType}
            onChange={(v) => {
              builder.setTemplateField('backgroundGradientType', v as GradientType);
              if (v === 'radial') {
                builder.setTemplateField('backgroundGradientDirection', undefined as unknown as GradientDirection);
              }
            }}
            style={{ flex: 1 }}
          />
        </GRow>

        {gradType === 'linear' && (
          <>
            <GRow label={t('lb_bg_dir', 'Dir')}>
              <Group gap={3}>
                {GRADIENT_DIRECTIONS.map((d) => (
                  <Tooltip key={d.value} label={t(`lb_bg_dir_${d.value}`, d.label)} position="top">
                    <ActionIcon
                      size="sm"
                      variant={dir === d.value && builder.template.backgroundGradientAngle == null ? 'filled' : 'subtle'}
                      color={dir === d.value && builder.template.backgroundGradientAngle == null ? 'blue' : 'gray'}
                      onClick={() => { builder.setTemplateField('backgroundGradientDirection', d.value); builder.setTemplateField('backgroundGradientAngle', undefined); }}
                      aria-label={t(`lb_bg_dir_${d.value}`, d.label)}
                    >
                      <Text size="xs" fw={600}>{d.icon}</Text>
                    </ActionIcon>
                  </Tooltip>
                ))}
              </Group>
            </GRow>
            <GRow label={t('lb_bg_angle', 'Angle')}>
              <NumberInput
                size="xs"
                value={builder.template.backgroundGradientAngle ?? ''}
                onChange={(val) => { builder.setTemplateField('backgroundGradientAngle', val === '' || val === undefined ? undefined : Number(val)); }}
                placeholder={t('lb_bg_auto', 'auto')} min={0} max={360} step={5} suffix="°" style={{ flex: 1 }}
              />
            </GRow>
          </>
        )}

        {gradType === 'radial' && (
          <>
            <GRow label={t('lb_bg_shape', 'Shape')}>
              <SegmentedControl
                size="xs"
                data={[{ label: t('lb_bg_ellipse', 'Ellipse'), value: 'ellipse' }, { label: t('lb_bg_circle', 'Circle'), value: 'circle' }]}
                value={builder.template.backgroundRadialShape ?? 'ellipse'}
                onChange={(v) => builder.setTemplateField('backgroundRadialShape', v as RadialShape)}
                style={{ flex: 1 }}
              />
            </GRow>
            <GRow label={t('lb_gl_size', 'Size')}>
              <Select
                size="xs"
                data={RADIAL_SIZES.map((s) => ({ value: s.value, label: t(`lb_bg_radial_${s.value}`, s.label) }))}
                value={builder.template.backgroundRadialSize ?? 'farthest-corner'}
                onChange={(v) => builder.setTemplateField('backgroundRadialSize', (v ?? 'farthest-corner') as RadialSize)}
                style={{ flex: 1 }}
              />
            </GRow>
            <GRow label={t('lb_bg_ctr_x', 'Ctr X')}>
              <Slider size="xs" value={builder.template.backgroundGradientCenterX ?? 50} onChange={(v) => builder.setTemplateField('backgroundGradientCenterX', v)} min={0} max={100} step={1} label={(v) => `${v}%`} style={{ flex: 1 }} />
            </GRow>
            <GRow label={t('lb_bg_ctr_y', 'Ctr Y')}>
              <Slider size="xs" value={builder.template.backgroundGradientCenterY ?? 50} onChange={(v) => builder.setTemplateField('backgroundGradientCenterY', v)} min={0} max={100} step={1} label={(v) => `${v}%`} style={{ flex: 1 }} />
            </GRow>
          </>
        )}

        {gradType === 'conic' && (
          <>
            <GRow label={t('lb_bg_angle', 'Angle')}>
              <NumberInput size="xs" value={builder.template.backgroundGradientAngle ?? 0} onChange={(val) => builder.setTemplateField('backgroundGradientAngle', val === '' ? 0 : Number(val))} min={0} max={360} step={5} suffix="°" style={{ flex: 1 }} />
            </GRow>
            <GRow label={t('lb_bg_ctr_x', 'Ctr X')}>
              <Slider size="xs" value={builder.template.backgroundGradientCenterX ?? 50} onChange={(v) => builder.setTemplateField('backgroundGradientCenterX', v)} min={0} max={100} step={1} label={(v) => `${v}%`} style={{ flex: 1 }} />
            </GRow>
            <GRow label={t('lb_bg_ctr_y', 'Ctr Y')}>
              <Slider size="xs" value={builder.template.backgroundGradientCenterY ?? 50} onChange={(v) => builder.setTemplateField('backgroundGradientCenterY', v)} min={0} max={100} step={1} label={(v) => `${v}%`} style={{ flex: 1 }} />
            </GRow>
          </>
        )}

        <GRow label={t('lb_bg_stops', 'Stops')}>
          <SegmentedControl size="xs" data={[{ label: '2', value: '2' }, { label: '3', value: '3' }]} value={String(stopCount)} onChange={(v) => handleStopCountChange(Number(v) as 2 | 3)} />
        </GRow>

        {stops.map((stop, i) => {
          const stopLabel = i === 0 ? t('lb_bg_start', 'Start') : i === stops.length - 1 ? t('lb_bg_end', 'End') : t('lb_bg_mid', 'Mid');
          return (
            <Stack key={i} gap={4}>
              <GRow label={stopLabel}>
                <ColorInput size="xs" value={stop.color} onChange={(val) => updateStop(i, { color: val })} format="rgba" style={{ flex: 1 }} />
              </GRow>
              <GRow label={t('lb_bg_pos', 'Pos')}>
                <Slider size="xs" value={stop.position ?? (i === 0 ? 0 : i === stops.length - 1 ? 100 : 50)} onChange={(val) => updateStop(i, { position: val })} min={0} max={100} step={1} label={(v) => `${v}%`} style={{ flex: 1 }} />
              </GRow>
            </Stack>
          );
        })}
      </Stack>
    );
  }

  // mode === 'image'
  return (
    <Stack gap={6}>
      {builder.template.backgroundImage ? (
        <Box>
          <div style={{ background: 'var(--mantine-color-default)', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
            <img src={builder.template.backgroundImage} alt={t('lb_bg_preview_alt', 'Background preview')} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          <Button size="xs" color="red" variant="light" fullWidth leftSection={<IconTrash size={12} />} onClick={() => builder.setBackgroundImage('')} mb={2}>
            {t('lb_bg_remove_image', 'Remove image')}
          </Button>
        </Box>
      ) : (
        <Text size="xs" c="dimmed">{t('lb_bg_no_image', 'No background image set.')}</Text>
      )}

      <AssetUploader
        onFileSelect={handleUploadBgImage}
        isUploading={isUploadingBg}
        accept="image/*"
        uploadLabel={t('lb_bg_upload_image', 'Upload image')}
        uploadAriaLabel={t('lb_bg_upload_aria', 'Upload background image')}
      />

      {builder.template.backgroundImage && (
        <>
          <Group gap={6} align="center" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ width: 40, flexShrink: 0 }}>{t('lb_slot_fit', 'Fit')}</Text>
            <Select
              size="xs"
              value={builder.template.backgroundImageFit ?? 'cover'}
              onChange={(val) => builder.setTemplateField('backgroundImageFit', (val ?? 'cover') as 'cover' | 'contain' | 'fill')}
              data={[{ value: 'cover', label: t('lb_slot_fit_cover', 'Cover') }, { value: 'contain', label: t('lb_slot_fit_contain', 'Contain') }, { value: 'fill', label: t('lb_slot_fit_fill', 'Fill') }]}
              style={{ flex: 1 }}
            />
          </Group>
          <Group gap={6} align="center" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ width: 40, flexShrink: 0 }}>{t('lb_bg_alpha', 'Alpha')}</Text>
            <Box style={{ flex: 1 }}>
              <Slider value={builder.template.backgroundImageOpacity ?? 1} onChange={(val) => builder.setTemplateField('backgroundImageOpacity', val)} min={0} max={1} step={0.05} size="xs" label={(v) => `${Math.round(v * 100)}%`} />
            </Box>
          </Group>
        </>
      )}
    </Stack>
  );
}

setWpsgDebugDisplayName(BackgroundModeControls, 'LayoutBuilder:BackgroundModeControls');