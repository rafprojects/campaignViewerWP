import { type ReactNode } from 'react';
import { ActionIcon, Box, Button, Group, NumberInput, SimpleGrid, Stack, Switch, Text, TextInput, Tooltip, type SelectProps } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useGalleryAdapterSettingsIO } from '@/hooks/useGalleryAdapterSettingsIO';
import { IconRefresh } from '@tabler/icons-react';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import type { GalleryBehaviorSettings, GalleryConfig, GalleryConfigBreakpoint, GalleryConfigScope } from '@/types';
import type { AdapterCapability, AdapterSettingFieldAppliesTo, AdapterSettingGroupDefinition } from '@/components/Galleries/Adapters/GalleryAdapter';
import { anyAdapterUsesSettingGroup, getActiveSettingGroupDefinitions, getAdapterRegistration, getAdapterSelectOptions, getSettingGroupFieldDefinitions } from '@/components/Galleries/Adapters/adapterRegistry';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { cloneGalleryConfig, collectGalleryAdapterSettingValues, GALLERY_BREAKPOINTS, getGalleryConfigScopeAdapterIds, resolveGalleryConfig, setGalleryAdapterSetting } from '@/utils/galleryConfig';
import { DimensionInput } from './DimensionInput';

export type UpdateGallerySetting = <K extends keyof GalleryBehaviorSettings>(
  key: K,
  value: GalleryBehaviorSettings[K],
) => void;

type BatchGalleryConfigUpdate = (pairs: Array<[keyof GalleryBehaviorSettings, GalleryBehaviorSettings[keyof GalleryBehaviorSettings]]>) => void;

interface GalleryAdapterSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
}

const BREAKPOINT_LABELS: Record<GalleryConfigBreakpoint, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

const CAPABILITY_LABELS: Record<AdapterCapability, string> = {
  lightbox: 'Lightbox',
  'drag-scroll': 'Drag scroll',
  'infinite-scroll': 'Infinite scroll',
  'grid-layout': 'Grid',
  'carousel-layout': 'Carousel',
  'keyboard-nav': 'Keyboard nav',
  'touch-swipe': 'Touch swipe',
  'layout-builder': 'Layout builder',
  'listing-compatible': 'Listing',
};

const CAPABILITY_I18N_KEYS: Record<AdapterCapability, string> = {
  lightbox: 'set_ad_cap_lightbox',
  'drag-scroll': 'set_ad_cap_drag_scroll',
  'infinite-scroll': 'set_ad_cap_infinite_scroll',
  'grid-layout': 'set_ad_cap_grid',
  'carousel-layout': 'set_ad_cap_carousel',
  'keyboard-nav': 'set_ad_cap_keyboard_nav',
  'touch-swipe': 'set_ad_cap_touch_swipe',
  'layout-builder': 'set_ad_cap_layout_builder',
  'listing-compatible': 'set_ad_cap_listing',
};

function translateCapability(cap: AdapterCapability): string {
  const fallback = CAPABILITY_LABELS[cap];
  if (!fallback) return cap;
  return i18n.t(CAPABILITY_I18N_KEYS[cap], fallback, { ns: 'wpsg' });
}

const renderAdapterOption: NonNullable<SelectProps['renderOption']> = ({ option }) => {
  const reg = getAdapterRegistration(option.value);
  const caps = reg?.capabilities ?? [];
  return (
    <Stack gap={0}>
      <Box bg="gray.0" px={6} py={3} style={{ borderRadius: 'var(--mantine-radius-sm)' }}>
        <Text size="sm" fw={500}>{option.label}</Text>
      </Box>
      {caps.length > 0 && (
        <Text size="xs" c="dimmed" px={6} pt={2} pb={1}>
          {caps.map((cap) => translateCapability(cap)).join(' · ')}
        </Text>
      )}
    </Stack>
  );
};

function getConfiguredAdapterId(
  galleryConfig: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  scope: Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>,
): string {
  return galleryConfig.breakpoints?.[breakpoint]?.[scope]?.adapterId ?? '';
}

function setConfiguredAdapterId(
  galleryConfig: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  scope: Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>,
  adapterId: string,
): GalleryConfig {
  const next = cloneGalleryConfig(galleryConfig) ?? { mode: 'per-type', breakpoints: {} };
  next.breakpoints ??= {};
  const breakpointConfig = next.breakpoints[breakpoint] ?? {};
  const scopeConfig = breakpointConfig[scope] ?? {};

  breakpointConfig[scope] = {
    ...scopeConfig,
    adapterId,
  };
  next.breakpoints[breakpoint] = breakpointConfig;

  return next;
}

function getConfiguredScopeAdapterIds(
  galleryConfig: GalleryConfig,
  scope: Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>,
): string[] {
  return getGalleryConfigScopeAdapterIds(galleryConfig, scope);
}

function fieldLabel(label: string, onReset: () => void): ReactNode {
  return (
    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 4 }}>
      <span>{label}</span>
      <Tooltip label={i18n.t('set_ad_reset_default', 'Reset to default', { ns: 'wpsg' })} withArrow position="top" offset={4}>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          style={{ opacity: 0.7, flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          aria-label={i18n.t('set_ad_reset_label', 'Reset {{label}} to default', { ns: 'wpsg', label })}
        >
          <IconRefresh size={14} />
        </ActionIcon>
      </Tooltip>
    </span>
  );
}

function getResolvedAdapterFieldValue<K extends keyof GalleryBehaviorSettings>(
  resolvedAdapterSettings: Partial<Record<keyof GalleryBehaviorSettings, GalleryBehaviorSettings[keyof GalleryBehaviorSettings]>>,
  settings: GalleryBehaviorSettings,
  key: K,
): GalleryBehaviorSettings[K] {
  return (resolvedAdapterSettings[key] as GalleryBehaviorSettings[K] | undefined) ?? settings[key];
}

function renderSettingFields(
  groupDefinition: AdapterSettingGroupDefinition,
  resolvedAdapterSettings: Partial<Record<keyof GalleryBehaviorSettings, GalleryBehaviorSettings[keyof GalleryBehaviorSettings]>>,
  settings: GalleryBehaviorSettings,
  updateSetting: UpdateGallerySetting,
  options?: {
    includeAppliesTo?: AdapterSettingFieldAppliesTo[];
    batchGalleryConfigUpdate?: BatchGalleryConfigUpdate;
  },
) {
  const includeAppliesTo = options?.includeAppliesTo ?? ['always'];
  const group = groupDefinition.group;

  return getSettingGroupFieldDefinitions(groupDefinition.group)
    .filter((field) => includeAppliesTo.includes(field.appliesTo ?? 'always'))
    .map((field) => {
      if (field.control === 'number') {
        const numValue = getResolvedAdapterFieldValue(resolvedAdapterSettings, settings, field.key) as number | undefined;
        const numError = numValue !== undefined && (numValue < field.min || numValue > field.max)
          ? i18n.t('set_ad_err_range', 'Enter a value between {{min}} and {{max}}', { ns: 'wpsg', min: field.min, max: field.max })
          : undefined;
        const reset = () => updateSetting(field.key, field.fallback as GalleryBehaviorSettings[typeof field.key]);
        return (
          <NumberInput
            key={`${group}-${String(field.key)}`}
            label={fieldLabel(field.label, reset)}
            description={`${field.description} (${field.min}–${field.max}, default: ${field.fallback})`}
            {...(numValue !== undefined ? { value: numValue } : {})}
            onChange={(value) => updateSetting(field.key, (typeof value === 'number' ? value : field.fallback) as GalleryBehaviorSettings[typeof field.key])}
            min={field.min}
            max={field.max}
            step={field.step}
            error={numError}
          />
        );
      }

      if (field.control === 'dimension') {
        const dimValue = getResolvedAdapterFieldValue(resolvedAdapterSettings, settings, field.key) as number | undefined;
        const dimError = dimValue !== undefined && dimValue > field.max
          ? i18n.t('set_ad_err_max', 'Value exceeds maximum of {{max}}', { ns: 'wpsg', max: field.max })
          : undefined;
        const reset = options?.batchGalleryConfigUpdate
          ? () => options.batchGalleryConfigUpdate!([
              [field.key as keyof GalleryBehaviorSettings, field.fallback as GalleryBehaviorSettings[keyof GalleryBehaviorSettings]],
              [field.unitKey as keyof GalleryBehaviorSettings, field.allowedUnits[0] as GalleryBehaviorSettings[keyof GalleryBehaviorSettings]],
            ])
          : () => {
              updateSetting(field.key, field.fallback as GalleryBehaviorSettings[typeof field.key]);
              updateSetting(field.unitKey, field.allowedUnits[0] as GalleryBehaviorSettings[typeof field.unitKey]);
            };
        return (
          <DimensionInput
            key={`${group}-${String(field.key)}`}
            label={fieldLabel(field.label, reset)}
            description={`${field.description} (max: ${field.max}, default: ${field.fallback})`}
            value={(dimValue ?? field.fallback)}
            unit={(getResolvedAdapterFieldValue(resolvedAdapterSettings, settings, field.unitKey) as string | undefined) ?? 'px'}
            onValueChange={(value) => updateSetting(field.key, value as GalleryBehaviorSettings[typeof field.key])}
            onUnitChange={(unit) => updateSetting(field.unitKey, unit as GalleryBehaviorSettings[typeof field.unitKey])}
            allowedUnits={field.allowedUnits}
            max={field.max}
            step={field.step}
            {...(dimError ? { numberInputProps: { error: dimError } } : {})}
          />
        );
      }

      if (field.control === 'boolean') {
        const reset = () => updateSetting(field.key, field.fallback as GalleryBehaviorSettings[typeof field.key]);
        return (
          <ModalSelect
            key={`${group}-${String(field.key)}`}
            label={fieldLabel(field.label, reset)}
            description={field.description}
            value={String((getResolvedAdapterFieldValue(resolvedAdapterSettings, settings, field.key) as boolean | undefined) ?? field.fallback)}
            onChange={(value) => updateSetting(field.key, ((value ?? String(field.fallback)) === 'true') as GalleryBehaviorSettings[typeof field.key])}
            data={[
              { value: 'true', label: i18n.t('set_ad_on', 'On', { ns: 'wpsg' }) },
              { value: 'false', label: i18n.t('set_ad_off', 'Off', { ns: 'wpsg' }) },
            ]}
          />
        );
      }

      if (field.control === 'text') {
        const reset = () => updateSetting(field.key, field.fallback as GalleryBehaviorSettings[typeof field.key]);
        return (
          <TextInput
            key={`${group}-${String(field.key)}`}
            label={fieldLabel(field.label, reset)}
            description={field.description}
            value={(getResolvedAdapterFieldValue(resolvedAdapterSettings, settings, field.key) as string | undefined) ?? field.fallback}
            placeholder={field.placeholder}
            onChange={(event) => updateSetting(field.key, event.currentTarget.value as GalleryBehaviorSettings[typeof field.key])}
          />
        );
      }

      if (field.control === 'color') {
        const reset = () => updateSetting(field.key, field.fallback as GalleryBehaviorSettings[typeof field.key]);
        return (
          <ColorInput
            key={`${group}-${String(field.key)}`}
            label={fieldLabel(field.label, reset)}
            description={field.description}
            value={(getResolvedAdapterFieldValue(resolvedAdapterSettings, settings, field.key) as string | undefined) ?? field.fallback}
            onChange={(value) => updateSetting(field.key, value as GalleryBehaviorSettings[typeof field.key])}
          />
        );
      }

      // select (fallthrough)
      const selectValue = getResolvedAdapterFieldValue(resolvedAdapterSettings, settings, field.key) as string | undefined;
      const selectError = selectValue !== undefined && !field.options.some((o) => o.value === selectValue)
        ? i18n.t('set_ad_err_invalid', 'Stored value "{{value}}" is not a valid option', { ns: 'wpsg', value: selectValue })
        : undefined;
      const reset = () => updateSetting(field.key, field.fallback as GalleryBehaviorSettings[typeof field.key]);
      return (
        <ModalSelect
          key={`${group}-${String(field.key)}`}
          label={fieldLabel(field.label, reset)}
          description={field.description}
          {...(field.size !== undefined ? { size: field.size } : {})}
          {...(selectValue !== undefined ? { value: selectValue } : {})}
          onChange={(value) => updateSetting(field.key, (value ?? field.fallback) as GalleryBehaviorSettings[typeof field.key])}
          data={field.options}
          error={selectError}
        />
      );
    });
}

function renderSettingGroup(
  groupDefinition: AdapterSettingGroupDefinition,
  resolvedAdapterSettings: Partial<Record<keyof GalleryBehaviorSettings, GalleryBehaviorSettings[keyof GalleryBehaviorSettings]>>,
  settings: GalleryBehaviorSettings,
  updateSetting: UpdateGallerySetting,
  imageAdapterIds: string[],
  videoAdapterIds: string[],
  isUnifiedMode: boolean,
  batchGalleryConfigUpdate?: BatchGalleryConfigUpdate,
) {
  const batchOpt = batchGalleryConfigUpdate ? { batchGalleryConfigUpdate } : {};

  if (groupDefinition.scopeMode === 'contextual') {
    if (isUnifiedMode) {
      return renderSettingFields(groupDefinition, resolvedAdapterSettings, settings, updateSetting, { includeAppliesTo: ['unified'], ...batchOpt });
    }

    return (
      <Group key={groupDefinition.group} grow>
        {anyAdapterUsesSettingGroup(imageAdapterIds, groupDefinition.group)
          ? renderSettingFields(groupDefinition, resolvedAdapterSettings, settings, updateSetting, { includeAppliesTo: ['image'], ...batchOpt })
          : null}
        {anyAdapterUsesSettingGroup(videoAdapterIds, groupDefinition.group)
          ? renderSettingFields(groupDefinition, resolvedAdapterSettings, settings, updateSetting, { includeAppliesTo: ['video'], ...batchOpt })
          : null}
      </Group>
    );
  }

  const fields = renderSettingFields(groupDefinition, resolvedAdapterSettings, settings, updateSetting, { ...batchOpt });

  if (fields.length === 0) {
    return null;
  }

  if (groupDefinition.layout === 'group') {
    return (
      <Group key={groupDefinition.group} grow>
        {fields}
      </Group>
    );
  }

  return <Box key={groupDefinition.group}>{fields}</Box>;
}

export function GalleryAdapterSettingsSection({ settings, updateSetting }: GalleryAdapterSettingsSectionProps) {
  const { t } = useTranslation('wpsg');
  const bpLabel = (breakpoint: GalleryConfigBreakpoint) => t(`admin_bp_${breakpoint}`, BREAKPOINT_LABELS[breakpoint]);
  const resolvedGalleryConfig = resolveGalleryConfig(settings);
  const resolvedAdapterSettings = collectGalleryAdapterSettingValues(resolvedGalleryConfig);
  const isUnifiedMode = resolvedGalleryConfig.mode === 'unified';
  const unifiedAdapterIds = getConfiguredScopeAdapterIds(resolvedGalleryConfig, 'unified');
  const imageAdapterIds = getConfiguredScopeAdapterIds(resolvedGalleryConfig, 'image');
  const videoAdapterIds = getConfiguredScopeAdapterIds(resolvedGalleryConfig, 'video');
  const activeAdapterIds = isUnifiedMode ? unifiedAdapterIds : [...imageAdapterIds, ...videoAdapterIds];
  const activeSettingGroups = getActiveSettingGroupDefinitions(activeAdapterIds);
  const inlineSettingGroups = activeSettingGroups.filter((groupDefinition) => groupDefinition.placement === 'inline');
  const sectionSettingGroups = activeSettingGroups.filter((groupDefinition) => groupDefinition.placement !== 'inline');

  const updateConfiguredAdapterId = (
    breakpoint: GalleryConfigBreakpoint,
    scope: Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>,
    adapterId: string,
  ) => {
    updateSetting('galleryConfig', setConfiguredAdapterId(resolvedGalleryConfig, breakpoint, scope, adapterId));
  };

  const updateConfiguredAdapterSetting: UpdateGallerySetting = (key, value) => {
    updateSetting('galleryConfig', setGalleryAdapterSetting(resolvedGalleryConfig, key, value));
  };

  const batchUpdateAdapterSettings: BatchGalleryConfigUpdate = (pairs) => {
    let config = resolvedGalleryConfig;
    for (const [key, value] of pairs) {
      config = setGalleryAdapterSetting(config, key, value as GalleryBehaviorSettings[typeof key]);
    }
    updateSetting('galleryConfig', config);
  };

  const resetAllAdapterSettings = () => {
    let config = resolvedGalleryConfig;
    for (const groupDefinition of activeSettingGroups) {
      const appliesToFilter: AdapterSettingFieldAppliesTo[] = groupDefinition.scopeMode === 'contextual'
        ? (isUnifiedMode ? ['unified'] : ['image', 'video'])
        : ['always'];
      for (const field of getSettingGroupFieldDefinitions(groupDefinition.group).filter(
        (f) => appliesToFilter.includes((f.appliesTo ?? 'always') as AdapterSettingFieldAppliesTo),
      )) {
        config = setGalleryAdapterSetting(config, field.key, field.fallback as GalleryBehaviorSettings[typeof field.key]);
        if (field.control === 'dimension') {
          config = setGalleryAdapterSetting(config, field.unitKey, field.allowedUnits[0] as GalleryBehaviorSettings[typeof field.unitKey]);
        }
      }
    }
    updateSetting('galleryConfig', config);
    updateSetting('mobileBreakpointPx', 768);
    updateSetting('tabletBreakpointPx', 1200);
  };

  const { importFileRef, handleExport, handleImport } = useGalleryAdapterSettingsIO({
    galleryConfig: settings.galleryConfig,
    updateSetting,
  });

  return (
    <Stack gap="md">
      <Switch
        label={t('set_ad_unified_mode_label', 'Unified Gallery Mode')}
        description={t('set_ad_unified_mode_desc', 'When enabled, images and videos are combined in a single gallery view. When disabled, each media type uses its own layout independently.')}
        checked={isUnifiedMode}
        onChange={(e) => updateSetting('galleryConfig', {
          ...resolvedGalleryConfig,
          mode: e.currentTarget.checked ? 'unified' : 'per-type',
        })}
      />

      {isUnifiedMode ? (
        <Box>
          <Text size="sm" fw={500} mb={4}>{t('set_ad_unified_bp_title', 'Unified Breakpoint Adapters')}</Text>
          <Text size="xs" c="dimmed" mb={8}>
            {t('set_ad_unified_bp_desc', 'Choose the unified gallery adapter used at each breakpoint.')}
          </Text>
          <SimpleGrid cols={2} spacing="xs" mb={4}>
            <Text size="xs" fw={600} ta="center" c="dimmed"> </Text>
            <Text size="xs" fw={600} ta="center">{t('set_ad_col_unified', 'Unified')}</Text>
          </SimpleGrid>
          {GALLERY_BREAKPOINTS.map((breakpoint) => {
            const adapterOptions = getAdapterSelectOptions({
              context: 'unified-gallery',
              breakpoint,
            });
            const hasMobileUnsupported = breakpoint === 'mobile' && adapterOptions.some((o) => o.disabled);

            return (
              <Box key={breakpoint} mb="xs">
                <SimpleGrid cols={2} spacing="xs">
                  <Text size="sm" fw={500} style={{ display: 'flex', alignItems: 'center' }}>
                    {bpLabel(breakpoint)}
                  </Text>
                  <ModalSelect
                    size="xs"
                    label={t('set_ad_unified_adapter_label', '{{bp}} Unified Gallery Adapter', { bp: bpLabel(breakpoint) })}
                    aria-label={t('set_ad_unified_adapter_label', '{{bp}} Unified Gallery Adapter', { bp: bpLabel(breakpoint) })}
                    value={getConfiguredAdapterId(resolvedGalleryConfig, breakpoint, 'unified') || null}
                    onChange={(value) => updateConfiguredAdapterId(
                      breakpoint,
                      'unified',
                      value ?? (getConfiguredAdapterId(resolvedGalleryConfig, breakpoint, 'unified') || 'compact-grid'),
                    )}
                    data={adapterOptions}
                    renderOption={renderAdapterOption}
                  />
                </SimpleGrid>
                {hasMobileUnsupported && (
                  <Text size="xs" c="dimmed" mt={4}>
                    {t('set_ad_mobile_unsupported', 'Some adapters are unavailable on mobile — they require a larger screen (shown greyed out above).')}
                  </Text>
                )}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box>
          <Text size="sm" fw={500} mb={4}>{t('set_ad_pertype_bp_title', 'Per-Type Breakpoint Adapters')}</Text>
          <Text size="xs" c="dimmed" mb={8}>
            {t('set_ad_pertype_bp_desc', 'Choose separate image and video adapters for each breakpoint.')}
          </Text>
          <SimpleGrid cols={3} spacing="xs" mb={4}>
            <Text size="xs" fw={600} ta="center" c="dimmed"> </Text>
            <Text size="xs" fw={600} ta="center">{t('set_ad_col_image', 'Image')}</Text>
            <Text size="xs" fw={600} ta="center">{t('set_ad_col_video', 'Video')}</Text>
          </SimpleGrid>
          {GALLERY_BREAKPOINTS.map((breakpoint) => {
            const adapterOptions = getAdapterSelectOptions({
              context: 'per-breakpoint-gallery',
              breakpoint,
            });
            const hasMobileUnsupported = breakpoint === 'mobile' && adapterOptions.some((o) => o.disabled);

            return (
              <Box key={breakpoint} mb="xs">
                <SimpleGrid cols={3} spacing="xs">
                  <Text size="sm" fw={500} style={{ display: 'flex', alignItems: 'center' }}>
                    {bpLabel(breakpoint)}
                  </Text>
                  <ModalSelect
                    size="xs"
                    label={t('set_ad_image_adapter_label', '{{bp}} Image Gallery Adapter', { bp: bpLabel(breakpoint) })}
                    aria-label={t('set_ad_image_adapter_label', '{{bp}} Image Gallery Adapter', { bp: bpLabel(breakpoint) })}
                    value={getConfiguredAdapterId(resolvedGalleryConfig, breakpoint, 'image') || null}
                    onChange={(value) => updateConfiguredAdapterId(breakpoint, 'image', value ?? 'classic')}
                    data={adapterOptions}
                    renderOption={renderAdapterOption}
                  />
                  <ModalSelect
                    size="xs"
                    label={t('set_ad_video_adapter_label', '{{bp}} Video Gallery Adapter', { bp: bpLabel(breakpoint) })}
                    aria-label={t('set_ad_video_adapter_label', '{{bp}} Video Gallery Adapter', { bp: bpLabel(breakpoint) })}
                    value={getConfiguredAdapterId(resolvedGalleryConfig, breakpoint, 'video') || null}
                    onChange={(value) => updateConfiguredAdapterId(breakpoint, 'video', value ?? 'classic')}
                    data={adapterOptions}
                    renderOption={renderAdapterOption}
                  />
                </SimpleGrid>
                {hasMobileUnsupported && (
                  <Text size="xs" c="dimmed" mt={4}>
                    {t('set_ad_mobile_unsupported', 'Some adapters are unavailable on mobile — they require a larger screen (shown greyed out above).')}
                  </Text>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <Box>
        <Text size="sm" fw={500} mb={4}>{t('set_ad_thresholds_title', 'Breakpoint Pixel Thresholds')}</Text>
        <Text size="xs" c="dimmed" mb={8}>
          {t('set_ad_thresholds_desc', 'Width thresholds (px) used by the classic carousel adapter to determine the active breakpoint. Defaults match Mantine (768 / 1200).')}
        </Text>
        <SimpleGrid cols={2} spacing="xs">
          <NumberInput
            label={fieldLabel(t('set_ad_mobile_max', 'Mobile max (px)'), () => updateSetting('mobileBreakpointPx', 768))}
            description={t('set_ad_mobile_max_desc', 'Max container width considered mobile. (320–1440, default: 768)')}
            value={settings.mobileBreakpointPx}
            onChange={(v) => {
              const raw = typeof v === 'number' ? v : 768;
              updateSetting('mobileBreakpointPx', Math.min(raw, settings.tabletBreakpointPx - 1));
            }}
            min={320}
            max={1440}
            step={10}
            error={
              settings.mobileBreakpointPx < 320 || settings.mobileBreakpointPx > 1440
                ? t('set_ad_mobile_range_err', 'Enter a value between 320 and 1440')
                : settings.mobileBreakpointPx >= settings.tabletBreakpointPx
                  ? t('set_ad_mobile_lt_err', 'Mobile threshold must be less than tablet threshold')
                  : undefined
            }
          />
          <NumberInput
            label={fieldLabel(t('set_ad_tablet_max', 'Tablet max (px)'), () => updateSetting('tabletBreakpointPx', 1200))}
            description={t('set_ad_tablet_max_desc', 'Max container width considered tablet. (320–1920, default: 1200)')}
            value={settings.tabletBreakpointPx}
            onChange={(v) => {
              const raw = typeof v === 'number' ? v : 1200;
              updateSetting('tabletBreakpointPx', Math.max(raw, settings.mobileBreakpointPx + 1));
            }}
            min={320}
            max={1920}
            step={10}
            error={
              settings.tabletBreakpointPx < 320 || settings.tabletBreakpointPx > 1920
                ? t('set_ad_tablet_range_err', 'Enter a value between 320 and 1920')
                : settings.mobileBreakpointPx >= settings.tabletBreakpointPx
                  ? t('set_ad_tablet_gt_err', 'Tablet threshold must be greater than mobile threshold')
                  : undefined
            }
          />
        </SimpleGrid>
      </Box>

      {inlineSettingGroups.map((groupDefinition) => renderSettingGroup(groupDefinition, resolvedAdapterSettings, settings, updateConfiguredAdapterSetting, imageAdapterIds, videoAdapterIds, isUnifiedMode, batchUpdateAdapterSettings))}

      {sectionSettingGroups.map((groupDefinition) => renderSettingGroup(groupDefinition, resolvedAdapterSettings, settings, updateConfiguredAdapterSetting, imageAdapterIds, videoAdapterIds, isUnifiedMode, batchUpdateAdapterSettings))}

      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          {t('set_ad_export_note', 'Exports adapter configuration and carousel/media settings. Global navigation, breakpoint, and presentation settings are not included.')}
        </Text>
        <Group justify="space-between">
          <Group gap="xs">
            <Button
              size="compact-xs"
              variant="subtle"
              color="blue"
              onClick={handleExport}
            >
              {t('set_ad_export_btn', 'Export adapter settings')}
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="blue"
              onClick={() => importFileRef.current?.click()}
            >
              {t('set_ad_import_btn', 'Import adapter settings')}
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept=".json,.wpsg.json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </Group>
          {activeSettingGroups.length > 0 && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<IconRefresh size={12} />}
              onClick={resetAllAdapterSettings}
            >
              {t('set_ad_reset_all_btn', 'Reset all adapter settings to defaults')}
            </Button>
          )}
        </Group>
      </Stack>
    </Stack>
  );
}