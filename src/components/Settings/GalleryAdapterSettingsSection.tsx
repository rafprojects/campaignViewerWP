import { Box, Group, NumberInput, Select, SegmentedControl, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core';
import type { GalleryBehaviorSettings } from '@/types';
import type { AdapterSelectionUpdate, AdapterSettingFieldAppliesTo, AdapterSettingGroupDefinition } from '@/components/Galleries/Adapters/GalleryAdapter';
import { anyAdapterUsesSettingGroup, getActiveSettingGroupDefinitions, getAdapterSelectOptions, getPerTypeAdapterSelectionUpdates, getSettingGroupFieldDefinitions } from '@/components/Galleries/Adapters/adapterRegistry';
import { getLegacyActiveAdapterIds, getLegacyScopeAdapterIds } from '@/utils/galleryAdapterSelection';

export type UpdateGallerySetting = <K extends keyof GalleryBehaviorSettings>(
  key: K,
  value: GalleryBehaviorSettings[K],
) => void;

interface GalleryAdapterSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
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

      if (field.control === 'boolean') {
        return (
          <Select
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

      return (
        <Select
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
) {
  if (groupDefinition.scopeMode === 'contextual') {
    if (settings.unifiedGalleryEnabled) {
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

function applySelectionUpdates(
  updates: AdapterSelectionUpdate[],
  updateSetting: UpdateGallerySetting,
) {
  updates.forEach((update) => {
    updateSetting(update.key, update.value as GalleryBehaviorSettings[typeof update.key]);
  });
}

export function GalleryAdapterSettingsSection({ settings, updateSetting }: GalleryAdapterSettingsSectionProps) {
  const imageAdapterIds = getLegacyScopeAdapterIds(settings, 'image');
  const videoAdapterIds = getLegacyScopeAdapterIds(settings, 'video');
  const activeAdapterIds = getLegacyActiveAdapterIds(settings);
  const activeSettingGroups = getActiveSettingGroupDefinitions(activeAdapterIds);
  const inlineSettingGroups = activeSettingGroups.filter((groupDefinition) => groupDefinition.placement === 'inline');
  const sectionSettingGroups = activeSettingGroups.filter((groupDefinition) => groupDefinition.placement !== 'inline');

  return (
    <Stack gap="md">
      <Switch
        label="Unified Gallery Mode"
        description="When enabled, images and videos are combined in a single gallery view. When disabled, each media type uses its own layout independently."
        checked={settings.unifiedGalleryEnabled}
        onChange={(e) => updateSetting('unifiedGalleryEnabled', e.currentTarget.checked)}
      />

      {settings.unifiedGalleryEnabled ? (
        <Select
          label="Unified Gallery Adapter"
          description="Layout used when images and videos are displayed together."
          value={settings.unifiedGalleryAdapterId}
          onChange={(value) => updateSetting('unifiedGalleryAdapterId', (value ?? 'compact-grid') as GalleryBehaviorSettings['unifiedGalleryAdapterId'])}
          data={getAdapterSelectOptions({ context: 'unified-gallery' })}
        />
      ) : (
        <>
          <Box>
            <Text size="sm" fw={500} mb={4}>Gallery Selection Mode</Text>
            <Text size="xs" c="dimmed" mb={8}>
              Unified: one adapter for all screen sizes. Per-breakpoint: different adapters for desktop, tablet, and mobile.
            </Text>
            <SegmentedControl
              fullWidth
              value={settings.gallerySelectionMode}
              onChange={(value) => updateSetting('gallerySelectionMode', value as GalleryBehaviorSettings['gallerySelectionMode'])}
              data={[
                { value: 'unified', label: 'Unified' },
                { value: 'per-breakpoint', label: 'Per Breakpoint' },
              ]}
            />
          </Box>

          {settings.gallerySelectionMode === 'per-breakpoint' ? (
            <Box>
              <SimpleGrid cols={3} spacing="xs" mb={4}>
                <Text size="xs" fw={600} ta="center" c="dimmed"> </Text>
                <Text size="xs" fw={600} ta="center">Image</Text>
                <Text size="xs" fw={600} ta="center">Video</Text>
              </SimpleGrid>
              {(['desktop', 'tablet', 'mobile'] as const).map((breakpoint) => {
                const adapterOptions = getAdapterSelectOptions({
                  context: 'per-breakpoint-gallery',
                  breakpoint,
                });

                return (
                  <SimpleGrid cols={3} spacing="xs" mb="xs" key={breakpoint}>
                    <Text size="sm" fw={500} style={{ display: 'flex', alignItems: 'center' }}>
                      {breakpoint.charAt(0).toUpperCase() + breakpoint.slice(1)}
                    </Text>
                    <Select
                      size="xs"
                      value={settings[`${breakpoint}ImageAdapterId` as keyof GalleryBehaviorSettings] as string}
                      onChange={(value) => updateSetting(
                        `${breakpoint}ImageAdapterId` as keyof GalleryBehaviorSettings,
                        (value ?? 'classic') as GalleryBehaviorSettings[keyof GalleryBehaviorSettings],
                      )}
                      data={adapterOptions}
                    />
                    <Select
                      size="xs"
                      value={settings[`${breakpoint}VideoAdapterId` as keyof GalleryBehaviorSettings] as string}
                      onChange={(value) => updateSetting(
                        `${breakpoint}VideoAdapterId` as keyof GalleryBehaviorSettings,
                        (value ?? 'classic') as GalleryBehaviorSettings[keyof GalleryBehaviorSettings],
                      )}
                      data={adapterOptions}
                    />
                  </SimpleGrid>
                );
              })}
              {inlineSettingGroups.map((groupDefinition) => renderSettingGroup(groupDefinition, settings, updateSetting, imageAdapterIds, videoAdapterIds))}
            </Box>
          ) : (
            <>
              <Select
                label="Image Gallery Adapter"
                description="Layout for campaigns with images."
                value={settings.imageGalleryAdapterId}
                onChange={(value) => applySelectionUpdates(getPerTypeAdapterSelectionUpdates(settings, 'image', value), updateSetting)}
                data={getAdapterSelectOptions({ context: 'per-type-gallery' })}
              />
              <Select
                label="Video Gallery Adapter"
                description="Layout for campaigns with videos."
                value={settings.videoGalleryAdapterId}
                onChange={(value) => applySelectionUpdates(getPerTypeAdapterSelectionUpdates(settings, 'video', value), updateSetting)}
                data={getAdapterSelectOptions({ context: 'per-type-gallery' })}
              />
            </>
          )}
        </>
      )}

      {sectionSettingGroups.map((groupDefinition) => renderSettingGroup(groupDefinition, settings, updateSetting, imageAdapterIds, videoAdapterIds))}
    </Stack>
  );
}