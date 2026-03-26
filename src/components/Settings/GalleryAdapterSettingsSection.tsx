import { Box, Group, NumberInput, Select, SegmentedControl, SimpleGrid, Stack, Switch, Text } from '@mantine/core';
import type { GalleryBehaviorSettings } from '@/types';
import { anyAdapterUsesSettingGroup, getAdapterSelectOptions, getSettingGroupFieldDefinitions } from '@/components/Galleries/Adapters/adapterRegistry';

export type UpdateGallerySetting = <K extends keyof GalleryBehaviorSettings>(
  key: K,
  value: GalleryBehaviorSettings[K],
) => void;

interface GalleryAdapterSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
}

function getImageAdapterIds(settings: GalleryBehaviorSettings): string[] {
  if (settings.unifiedGalleryEnabled) {
    return [settings.unifiedGalleryAdapterId];
  }

  if (settings.gallerySelectionMode === 'per-breakpoint') {
    return [
      settings.desktopImageAdapterId,
      settings.tabletImageAdapterId,
      settings.mobileImageAdapterId,
    ];
  }

  return [settings.imageGalleryAdapterId];
}

function getVideoAdapterIds(settings: GalleryBehaviorSettings): string[] {
  if (settings.unifiedGalleryEnabled) {
    return [settings.unifiedGalleryAdapterId];
  }

  if (settings.gallerySelectionMode === 'per-breakpoint') {
    return [
      settings.desktopVideoAdapterId,
      settings.tabletVideoAdapterId,
      settings.mobileVideoAdapterId,
    ];
  }

  return [settings.videoGalleryAdapterId];
}

function getActiveAdapterIds(settings: GalleryBehaviorSettings): string[] {
  return [...getImageAdapterIds(settings), ...getVideoAdapterIds(settings)];
}

function renderSettingFields(
  group: 'compact-grid' | 'justified' | 'masonry' | 'shape' | 'layout-builder',
  settings: GalleryBehaviorSettings,
  updateSetting: UpdateGallerySetting,
  options?: {
    includeAppliesTo?: Array<'always' | 'unified' | 'image' | 'video'>;
  },
) {
  const includeAppliesTo = options?.includeAppliesTo ?? ['always'];

  return getSettingGroupFieldDefinitions(group)
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

export function GalleryAdapterSettingsSection({ settings, updateSetting }: GalleryAdapterSettingsSectionProps) {
  const imageAdapterIds = getImageAdapterIds(settings);
  const videoAdapterIds = getVideoAdapterIds(settings);
  const activeAdapterIds = settings.unifiedGalleryEnabled ? [settings.unifiedGalleryAdapterId] : getActiveAdapterIds(settings);

  const usesCompactGrid = anyAdapterUsesSettingGroup(activeAdapterIds, 'compact-grid');
  const usesJustified = anyAdapterUsesSettingGroup(activeAdapterIds, 'justified');
  const usesMasonry = anyAdapterUsesSettingGroup(activeAdapterIds, 'masonry');
  const usesShape = anyAdapterUsesSettingGroup(activeAdapterIds, 'shape');
  const usesLayoutBuilder = anyAdapterUsesSettingGroup(activeAdapterIds, 'layout-builder');
  const imageUsesShape = anyAdapterUsesSettingGroup(imageAdapterIds, 'shape');
  const videoUsesShape = anyAdapterUsesSettingGroup(videoAdapterIds, 'shape');

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
              {usesLayoutBuilder && renderSettingFields('layout-builder', settings, updateSetting)}
            </Box>
          ) : (
            <>
              <Select
                label="Image Gallery Adapter"
                description="Layout for campaigns with images."
                value={settings.imageGalleryAdapterId}
                onChange={(value) => {
                  const nextValue = value ?? 'classic';
                  if (nextValue === 'layout-builder') {
                    updateSetting('gallerySelectionMode', 'per-breakpoint');
                    updateSetting('desktopImageAdapterId', 'layout-builder');
                    updateSetting('tabletImageAdapterId', 'layout-builder');
                    updateSetting('mobileImageAdapterId', settings.imageGalleryAdapterId || 'classic');
                    updateSetting('desktopVideoAdapterId', settings.videoGalleryAdapterId || 'classic');
                    updateSetting('tabletVideoAdapterId', settings.videoGalleryAdapterId || 'classic');
                    updateSetting('mobileVideoAdapterId', settings.videoGalleryAdapterId || 'classic');
                    return;
                  }

                  updateSetting('imageGalleryAdapterId', nextValue);
                }}
                data={getAdapterSelectOptions({ context: 'per-type-gallery' })}
              />
              <Select
                label="Video Gallery Adapter"
                description="Layout for campaigns with videos."
                value={settings.videoGalleryAdapterId}
                onChange={(value) => {
                  const nextValue = value ?? 'classic';
                  if (nextValue === 'layout-builder') {
                    updateSetting('gallerySelectionMode', 'per-breakpoint');
                    updateSetting('desktopVideoAdapterId', 'layout-builder');
                    updateSetting('tabletVideoAdapterId', 'layout-builder');
                    updateSetting('mobileVideoAdapterId', settings.videoGalleryAdapterId || 'classic');
                    updateSetting('desktopImageAdapterId', settings.imageGalleryAdapterId || 'classic');
                    updateSetting('tabletImageAdapterId', settings.imageGalleryAdapterId || 'classic');
                    updateSetting('mobileImageAdapterId', settings.imageGalleryAdapterId || 'classic');
                    return;
                  }

                  updateSetting('videoGalleryAdapterId', nextValue);
                }}
                data={getAdapterSelectOptions({ context: 'per-type-gallery' })}
              />
            </>
          )}
        </>
      )}

      {usesCompactGrid && (
        <Group grow>
          {renderSettingFields('compact-grid', settings, updateSetting)}
        </Group>
      )}

      {usesJustified && (
        <>
          {renderSettingFields('justified', settings, updateSetting)}
        </>
      )}

      {usesMasonry && (
        renderSettingFields('masonry', settings, updateSetting)
      )}

      {usesShape && (
        settings.unifiedGalleryEnabled ? (
          renderSettingFields('shape', settings, updateSetting, { includeAppliesTo: ['unified'] })
        ) : (
          <Group grow>
            {imageUsesShape && renderSettingFields('shape', settings, updateSetting, { includeAppliesTo: ['image'] })}
            {videoUsesShape && renderSettingFields('shape', settings, updateSetting, { includeAppliesTo: ['video'] })}
          </Group>
        )
      )}
    </Stack>
  );
}