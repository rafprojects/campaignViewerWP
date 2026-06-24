import { type ReactNode } from 'react';
import { ActionIcon, Badge, Box, Button, Group, NumberInput, SimpleGrid, Stack, Switch, Text, TextInput, Tooltip, type SelectProps } from '@mantine/core';
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

const renderAdapterOption: NonNullable<SelectProps['renderOption']> = ({ option }) => {
  const reg = getAdapterRegistration(option.value);
  const caps = reg?.capabilities ?? [];
  return (
    <Stack gap={4}>
      <Text size="sm">{option.label}</Text>
      {caps.length > 0 && (
        <Group gap={4} wrap="wrap">
          {caps.map((cap) => (
            <Badge key={cap} size="xs" variant="light" color="gray" radius="sm">
              {CAPABILITY_LABELS[cap] ?? cap}
            </Badge>
          ))}
        </Group>
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
    <Group justify="space-between" gap={4} wrap="nowrap" style={{ width: '100%' }}>
      <span>{label}</span>
      <Tooltip label="Reset to default" withArrow position="top" offset={4}>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          onClick={onReset}
          aria-label={`Reset ${label} to default`}
        >
          <IconRefresh size={12} />
        </ActionIcon>
      </Tooltip>
    </Group>
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
          ? `Enter a value between ${field.min} and ${field.max}`
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
          ? `Value exceeds maximum of ${field.max}`
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
              { value: 'true', label: 'On' },
              { value: 'false', label: 'Off' },
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
        ? `Stored value "${selectValue}" is not a valid option`
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
        label="Unified Gallery Mode"
        description="When enabled, images and videos are combined in a single gallery view. When disabled, each media type uses its own layout independently."
        checked={isUnifiedMode}
        onChange={(e) => updateSetting('galleryConfig', {
          ...resolvedGalleryConfig,
          mode: e.currentTarget.checked ? 'unified' : 'per-type',
        })}
      />

      {isUnifiedMode ? (
        <Box>
          <Text size="sm" fw={500} mb={4}>Unified Breakpoint Adapters</Text>
          <Text size="xs" c="dimmed" mb={8}>
            Choose the unified gallery adapter used at each breakpoint.
          </Text>
          <SimpleGrid cols={2} spacing="xs" mb={4}>
            <Text size="xs" fw={600} ta="center" c="dimmed"> </Text>
            <Text size="xs" fw={600} ta="center">Unified</Text>
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
                    {BREAKPOINT_LABELS[breakpoint]}
                  </Text>
                  <ModalSelect
                    size="xs"
                    label={`${BREAKPOINT_LABELS[breakpoint]} Unified Gallery Adapter`}
                    aria-label={`${BREAKPOINT_LABELS[breakpoint]} Unified Gallery Adapter`}
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
                    Some adapters are unavailable on mobile — they require a larger screen (shown greyed out above).
                  </Text>
                )}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box>
          <Text size="sm" fw={500} mb={4}>Per-Type Breakpoint Adapters</Text>
          <Text size="xs" c="dimmed" mb={8}>
            Choose separate image and video adapters for each breakpoint.
          </Text>
          <SimpleGrid cols={3} spacing="xs" mb={4}>
            <Text size="xs" fw={600} ta="center" c="dimmed"> </Text>
            <Text size="xs" fw={600} ta="center">Image</Text>
            <Text size="xs" fw={600} ta="center">Video</Text>
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
                    {BREAKPOINT_LABELS[breakpoint]}
                  </Text>
                  <ModalSelect
                    size="xs"
                    label={`${BREAKPOINT_LABELS[breakpoint]} Image Gallery Adapter`}
                    aria-label={`${BREAKPOINT_LABELS[breakpoint]} Image Gallery Adapter`}
                    value={getConfiguredAdapterId(resolvedGalleryConfig, breakpoint, 'image') || null}
                    onChange={(value) => updateConfiguredAdapterId(breakpoint, 'image', value ?? 'classic')}
                    data={adapterOptions}
                    renderOption={renderAdapterOption}
                  />
                  <ModalSelect
                    size="xs"
                    label={`${BREAKPOINT_LABELS[breakpoint]} Video Gallery Adapter`}
                    aria-label={`${BREAKPOINT_LABELS[breakpoint]} Video Gallery Adapter`}
                    value={getConfiguredAdapterId(resolvedGalleryConfig, breakpoint, 'video') || null}
                    onChange={(value) => updateConfiguredAdapterId(breakpoint, 'video', value ?? 'classic')}
                    data={adapterOptions}
                    renderOption={renderAdapterOption}
                  />
                </SimpleGrid>
                {hasMobileUnsupported && (
                  <Text size="xs" c="dimmed" mt={4}>
                    Some adapters are unavailable on mobile — they require a larger screen (shown greyed out above).
                  </Text>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <Box>
        <Text size="sm" fw={500} mb={4}>Breakpoint Pixel Thresholds</Text>
        <Text size="xs" c="dimmed" mb={8}>
          Width thresholds (px) used by the classic carousel adapter to determine the active breakpoint. Defaults match Mantine (768 / 1200).
        </Text>
        <SimpleGrid cols={2} spacing="xs">
          <NumberInput
            label={fieldLabel('Mobile max (px)', () => updateSetting('mobileBreakpointPx', 768))}
            description="Max container width considered mobile. (320–1440, default: 768)"
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
                ? 'Enter a value between 320 and 1440'
                : settings.mobileBreakpointPx >= settings.tabletBreakpointPx
                  ? 'Mobile threshold must be less than tablet threshold'
                  : undefined
            }
          />
          <NumberInput
            label={fieldLabel('Tablet max (px)', () => updateSetting('tabletBreakpointPx', 1200))}
            description="Max container width considered tablet. (320–1920, default: 1200)"
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
                ? 'Enter a value between 320 and 1920'
                : settings.mobileBreakpointPx >= settings.tabletBreakpointPx
                  ? 'Tablet threshold must be greater than mobile threshold'
                  : undefined
            }
          />
        </SimpleGrid>
      </Box>

      {inlineSettingGroups.map((groupDefinition) => renderSettingGroup(groupDefinition, resolvedAdapterSettings, settings, updateConfiguredAdapterSetting, imageAdapterIds, videoAdapterIds, isUnifiedMode, batchUpdateAdapterSettings))}

      {sectionSettingGroups.map((groupDefinition) => renderSettingGroup(groupDefinition, resolvedAdapterSettings, settings, updateConfiguredAdapterSetting, imageAdapterIds, videoAdapterIds, isUnifiedMode, batchUpdateAdapterSettings))}

      <Group justify="space-between">
        <Group gap="xs">
          <Button
            size="compact-xs"
            variant="subtle"
            color="blue"
            onClick={handleExport}
          >
            Export settings
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            color="blue"
            onClick={() => importFileRef.current?.click()}
          >
            Import settings
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
            Reset all adapter settings to defaults
          </Button>
        )}
      </Group>
    </Stack>
  );
}