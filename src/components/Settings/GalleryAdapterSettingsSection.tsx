import { Box, Group, NumberInput, Select, SegmentedControl, SimpleGrid, Stack, Switch, Text } from '@mantine/core';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings } from '@/types';
import { anyAdapterUsesSettingGroup, getAdapterSelectOptions } from '@/components/Galleries/Adapters/adapterRegistry';

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

export function GalleryAdapterSettingsSection({ settings, updateSetting }: GalleryAdapterSettingsSectionProps) {
  const imageAdapterIds = getImageAdapterIds(settings);
  const videoAdapterIds = getVideoAdapterIds(settings);
  const activeAdapterIds = settings.unifiedGalleryEnabled ? [settings.unifiedGalleryAdapterId] : getActiveAdapterIds(settings);

  const usesCompactGrid = anyAdapterUsesSettingGroup(activeAdapterIds, 'compact-grid');
  const usesJustified = anyAdapterUsesSettingGroup(activeAdapterIds, 'justified');
  const usesMasonry = anyAdapterUsesSettingGroup(activeAdapterIds, 'masonry');
  const usesShape = anyAdapterUsesSettingGroup(activeAdapterIds, 'shape');
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
              <Select
                label="Layout Builder Scope"
                description="Full: replaces entire gallery (no thumbnail strip). Viewport: replaces only the viewport area."
                size="xs"
                value={settings.layoutBuilderScope}
                onChange={(value) => updateSetting('layoutBuilderScope', (value ?? 'full') as GalleryBehaviorSettings['layoutBuilderScope'])}
                data={[
                  { value: 'full', label: 'Full Gallery' },
                  { value: 'viewport', label: 'Viewport Only' },
                ]}
                mt="sm"
              />
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
          <NumberInput
            label="Card Min Width (px)"
            description="Minimum width of each grid card. Grid auto-fills based on available space."
            value={settings.gridCardWidth}
            onChange={(value) => updateSetting('gridCardWidth', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.gridCardWidth)}
            min={80}
            max={400}
            step={10}
          />
          <NumberInput
            label="Card Height (px)"
            description="Fixed height of each grid card."
            value={settings.gridCardHeight}
            onChange={(value) => updateSetting('gridCardHeight', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.gridCardHeight)}
            min={80}
            max={600}
            step={10}
          />
        </Group>
      )}

      {usesJustified && (
        <>
          <NumberInput
            label="Target Row Height (px)"
            description="Ideal height for each justified row. Rows scale slightly to fill container width while preserving aspect ratios."
            value={settings.mosaicTargetRowHeight}
            onChange={(value) => updateSetting('mosaicTargetRowHeight', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.mosaicTargetRowHeight)}
            min={60}
            max={600}
            step={10}
          />
          <NumberInput
            label="Photo Normalize Height (px)"
            description="Normalization height used to scale image dimensions before layout. Lower values produce smaller tiles."
            value={settings.photoNormalizeHeight}
            onChange={(value) => updateSetting('photoNormalizeHeight', typeof value === 'number' ? value : 300)}
            min={100}
            max={800}
            step={10}
          />
        </>
      )}

      {usesMasonry && (
        <NumberInput
          label="Masonry Columns (0 = auto)"
          description="Number of masonry columns. Set 0 to let the layout choose responsively (1–4 based on width)."
          value={settings.masonryColumns}
          onChange={(value) => updateSetting('masonryColumns', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.masonryColumns)}
          min={0}
          max={8}
          step={1}
        />
      )}

      {usesShape && (
        settings.unifiedGalleryEnabled ? (
          <NumberInput
            label="Tile Size (px)"
            description="Width and height of each shape tile (unified gallery)."
            value={settings.tileSize}
            onChange={(value) => updateSetting('tileSize', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.tileSize)}
            min={60}
            max={400}
            step={10}
          />
        ) : (
          <Group grow>
            {imageUsesShape && (
              <NumberInput
                label="Image Tile Size (px)"
                description="Shape tile size for the image gallery."
                value={settings.imageTileSize}
                onChange={(value) => updateSetting('imageTileSize', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageTileSize)}
                min={60}
                max={400}
                step={10}
              />
            )}
            {videoUsesShape && (
              <NumberInput
                label="Video Tile Size (px)"
                description="Shape tile size for the video gallery."
                value={settings.videoTileSize}
                onChange={(value) => updateSetting('videoTileSize', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoTileSize)}
                min={60}
                max={400}
                step={10}
              />
            )}
          </Group>
        )
      )}
    </Stack>
  );
}