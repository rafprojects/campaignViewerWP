import { Box, Group, NumberInput, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import type { GalleryBehaviorSettings, GalleryConfig, GalleryConfigBreakpoint, GalleryConfigScope } from '@/types';
import type { AdapterSettingFieldAppliesTo, AdapterSettingGroupDefinition } from '@/components/Galleries/Adapters/GalleryAdapter';
import { anyAdapterUsesSettingGroup, getActiveSettingGroupDefinitions, getAdapterSelectOptions, getSettingGroupFieldDefinitions } from '@/components/Galleries/Adapters/adapterRegistry';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { buildGalleryConfigFromLegacySettings, cloneGalleryConfig, GALLERY_BREAKPOINTS, mergeGalleryConfig } from '@/utils/galleryConfig';
import { DimensionInput } from './DimensionInput';

export type UpdateGallerySetting = <K extends keyof GalleryBehaviorSettings>(
  key: K,
  value: GalleryBehaviorSettings[K],
) => void;

interface GalleryAdapterSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
}

const BREAKPOINT_LABELS: Record<GalleryConfigBreakpoint, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

function buildResolvedGalleryConfig(settings: GalleryBehaviorSettings): GalleryConfig {
  const seed = buildGalleryConfigFromLegacySettings(settings);
  return settings.galleryConfig ? mergeGalleryConfig(seed, settings.galleryConfig) : seed;
}

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
  return GALLERY_BREAKPOINTS
    .map((breakpoint) => getConfiguredAdapterId(galleryConfig, breakpoint, scope))
    .filter((adapterId) => adapterId.length > 0);
}

function renderSettingFields(
  groupDefinition: AdapterSettingGroupDefinition,
  settings: GalleryBehaviorSettings,
  updateSetting: UpdateGallerySetting,
  options?: {
    includeAppliesTo?: AdapterSettingFieldAppliesTo[];
  },
) {
  const includeAppliesTo = options?.includeAppliesTo ?? ['always'];
  const group = groupDefinition.group;

  return getSettingGroupFieldDefinitions(groupDefinition.group)
    .filter((field) => includeAppliesTo.includes(field.appliesTo ?? 'always'))
    .map((field) => {
      if (field.control === 'number') {
        return (
          <NumberInput
            key={`${group}-${String(field.key)}`}
            label={field.label}
            description={field.description}
            value={settings[field.key] as number | undefined}
            onChange={(value) => updateSetting(field.key, (typeof value === 'number' ? value : field.fallback) as GalleryBehaviorSettings[typeof field.key])}
            min={field.min}
            max={field.max}
            step={field.step}
          />
        );
      }

      if (field.control === 'dimension') {
        return (
          <DimensionInput
            key={`${group}-${String(field.key)}`}
            label={field.label}
            description={field.description}
            value={(settings[field.key] as number | undefined) ?? field.fallback}
            unit={(settings[field.unitKey] as string | undefined) ?? 'px'}
            onValueChange={(value) => updateSetting(field.key, value as GalleryBehaviorSettings[typeof field.key])}
            onUnitChange={(unit) => updateSetting(field.unitKey, unit as GalleryBehaviorSettings[typeof field.unitKey])}
            allowedUnits={field.allowedUnits}
            max={field.max}
            step={field.step}
          />
        );
      }

      if (field.control === 'boolean') {
        return (
          <ModalSelect
            key={`${group}-${String(field.key)}`}
            label={field.label}
            description={field.description}
            value={String(settings[field.key] as boolean | undefined ?? field.fallback)}
            onChange={(value) => updateSetting(field.key, ((value ?? String(field.fallback)) === 'true') as GalleryBehaviorSettings[typeof field.key])}
            data={[
              { value: 'true', label: 'On' },
              { value: 'false', label: 'Off' },
            ]}
          />
        );
      }

      if (field.control === 'text') {
        return (
          <TextInput
            key={`${group}-${String(field.key)}`}
            label={field.label}
            description={field.description}
            value={(settings[field.key] as string | undefined) ?? field.fallback}
            placeholder={field.placeholder}
            onChange={(event) => updateSetting(field.key, event.currentTarget.value as GalleryBehaviorSettings[typeof field.key])}
          />
        );
      }

      if (field.control === 'color') {
        return (
          <ColorInput
            key={`${group}-${String(field.key)}`}
            label={field.label}
            description={field.description}
            value={(settings[field.key] as string | undefined) ?? field.fallback}
            onChange={(value) => updateSetting(field.key, value as GalleryBehaviorSettings[typeof field.key])}
          />
        );
      }

      return (
        <ModalSelect
          key={`${group}-${String(field.key)}`}
          label={field.label}
          description={field.description}
          size={field.size}
          value={settings[field.key] as string | undefined}
          onChange={(value) => updateSetting(field.key, (value ?? field.fallback) as GalleryBehaviorSettings[typeof field.key])}
          data={field.options}
        />
      );
    });
}

function renderSettingGroup(
  groupDefinition: AdapterSettingGroupDefinition,
  settings: GalleryBehaviorSettings,
  updateSetting: UpdateGallerySetting,
  imageAdapterIds: string[],
  videoAdapterIds: string[],
  isUnifiedMode: boolean,
) {
  if (groupDefinition.scopeMode === 'contextual') {
    if (isUnifiedMode) {
      return renderSettingFields(groupDefinition, settings, updateSetting, { includeAppliesTo: ['unified'] });
    }

    return (
      <Group key={groupDefinition.group} grow>
        {anyAdapterUsesSettingGroup(imageAdapterIds, groupDefinition.group)
          ? renderSettingFields(groupDefinition, settings, updateSetting, { includeAppliesTo: ['image'] })
          : null}
        {anyAdapterUsesSettingGroup(videoAdapterIds, groupDefinition.group)
          ? renderSettingFields(groupDefinition, settings, updateSetting, { includeAppliesTo: ['video'] })
          : null}
      </Group>
    );
  }

  const fields = renderSettingFields(groupDefinition, settings, updateSetting);

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
  const resolvedGalleryConfig = buildResolvedGalleryConfig(settings);
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

  return (
    <Stack gap="md">
      <Switch
        label="Unified Gallery Mode"
        description="When enabled, images and videos are combined in a single gallery view. When disabled, each media type uses its own layout independently."
        checked={isUnifiedMode}
        onChange={(e) => updateSetting('unifiedGalleryEnabled', e.currentTarget.checked)}
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

            return (
              <SimpleGrid cols={2} spacing="xs" mb="xs" key={breakpoint}>
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
                    value ?? settings.unifiedGalleryAdapterId ?? 'compact-grid',
                  )}
                  data={adapterOptions}
                />
              </SimpleGrid>
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

            return (
              <SimpleGrid cols={3} spacing="xs" mb="xs" key={breakpoint}>
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
                />
                <ModalSelect
                  size="xs"
                  label={`${BREAKPOINT_LABELS[breakpoint]} Video Gallery Adapter`}
                  aria-label={`${BREAKPOINT_LABELS[breakpoint]} Video Gallery Adapter`}
                  value={getConfiguredAdapterId(resolvedGalleryConfig, breakpoint, 'video') || null}
                  onChange={(value) => updateConfiguredAdapterId(breakpoint, 'video', value ?? 'classic')}
                  data={adapterOptions}
                />
              </SimpleGrid>
            );
          })}
        </Box>
      )}

      {inlineSettingGroups.map((groupDefinition) => renderSettingGroup(groupDefinition, settings, updateSetting, imageAdapterIds, videoAdapterIds, isUnifiedMode))}

      {sectionSettingGroups.map((groupDefinition) => renderSettingGroup(groupDefinition, settings, updateSetting, imageAdapterIds, videoAdapterIds, isUnifiedMode))}
    </Stack>
  );
}