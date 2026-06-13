import type { ReactNode } from 'react';

import { Accordion, Alert, Badge, Divider, Group, Loader, NumberInput, Slider, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';

import { useLazyAccordion } from '@/hooks/useLazyAccordion';
import type { ApiClient } from '@/services/apiClient';
import type { GalleryBehaviorSettings } from '@/types';
import { CSS_HEIGHT_UNITS, CSS_WIDTH_UNITS } from '@wp-super-gallery/shared-utils';

import { DimensionInput } from './DimensionInput';

import type { UpdateGallerySetting } from './GalleryAdapterSettingsSection';

interface AdvancedSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
  tooltipLabel: (label: string, key: string) => ReactNode;
  apiClient: ApiClient;
}

const BACKEND_LABELS: Record<string, string> = {
  redis: 'Redis',
  memcached: 'Memcached',
  apcu: 'APCu',
  unknown: 'Unknown',
};

export function AdvancedSettingsSection({ settings, updateSetting, tooltipLabel, apiClient }: AdvancedSettingsSectionProps) {
  const { mounted, onChange } = useLazyAccordion();

  const { data: healthData, isLoading: isHealthLoading, isError: isHealthError } = useQuery({
    queryKey: ['wpsgHealth'],
    queryFn: () => apiClient.getHealthData(),
    staleTime: 60 * 1000,
    enabled: mounted.has('adv-cache'),
  });

  return (
    <>
      <Text size="sm" c="dimmed" mb="md">
        Fine-grained controls for power users. These settings override internal defaults
        across all gallery components. Change with care.
      </Text>
      <Accordion variant="separated" onChange={onChange}>
        <Accordion.Item value="adv-drawer">
          <Accordion.Control>Settings Drawer</Accordion.Control>
          <Accordion.Panel>
            {mounted.has('adv-drawer') ? (
              <Stack gap="md">
                <DimensionInput
                  label={tooltipLabel('Settings Panel Width', 'settingsPanelWidth')}
                  description="Width of the settings panel drawer on medium and large screens. On small screens it is always 100%."
                  value={settings.settingsPanelWidth ?? 600}
                  unit={settings.settingsPanelWidthUnit ?? 'px'}
                  onValueChange={(value) => updateSetting('settingsPanelWidth', value)}
                  onUnitChange={(unit) => updateSetting('settingsPanelWidthUnit', unit as GalleryBehaviorSettings['settingsPanelWidthUnit'])}
                  allowedUnits={CSS_WIDTH_UNITS}
                  max={3000}
                  step={50}
                />
                <Switch
                  label={tooltipLabel('Settings Drawer Backdrop Blur', 'settingsDrawerBlurEnabled')}
                  description="When enabled, content behind open settings drawers is blurred."
                  checked={settings.settingsDrawerBlurEnabled ?? true}
                  onChange={(event) => updateSetting('settingsDrawerBlurEnabled', event.currentTarget.checked)}
                />
              </Stack>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-admin-panel">
          <Accordion.Control>Admin Panel</Accordion.Control>
          <Accordion.Panel>
            {mounted.has('adv-admin-panel') ? (
              <Stack gap="md">
                <DimensionInput
                  label={tooltipLabel('Admin Panel Max Width', 'adminPanelMaxWidth')}
                  description="Maximum width of the admin panel container. Set to 0 for full width (no constraint)."
                  value={settings.adminPanelMaxWidth ?? 0}
                  unit={settings.adminPanelMaxWidthUnit ?? 'px'}
                  onValueChange={(value) => updateSetting('adminPanelMaxWidth', value)}
                  onUnitChange={(unit) => updateSetting('adminPanelMaxWidthUnit', unit as GalleryBehaviorSettings['adminPanelMaxWidthUnit'])}
                  allowedUnits={CSS_WIDTH_UNITS}
                  max={3000}
                  step={50}
                  placeholder="0 = full width"
                />
              </Stack>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-upload">
          <Accordion.Control>Upload / Media</Accordion.Control>
          <Accordion.Panel>
            {mounted.has('adv-upload') ? (
              <Stack gap="md">
                <NumberInput
                  label={tooltipLabel('Upload Max Size (MB)', 'uploadMaxSizeMb')}
                  value={settings.uploadMaxSizeMb}
                  onChange={(value) => updateSetting('uploadMaxSizeMb', typeof value === 'number' ? value : 50)}
                  min={1}
                  max={500}
                />
                <NumberInput
                  label={tooltipLabel('Max Batch Upload Size', 'maxBatchUploadSize')}
                  value={settings.maxBatchUploadSize}
                  onChange={(value) => updateSetting('maxBatchUploadSize', typeof value === 'number' ? value : 20)}
                  min={1}
                  max={100}
                />
                <TextInput
                  label={tooltipLabel('Allowed Upload Types', 'uploadAllowedTypes')}
                  description="Comma-separated MIME patterns (e.g. image/*,video/*)"
                  value={settings.uploadAllowedTypes}
                  onChange={(event) => updateSetting('uploadAllowedTypes', event.currentTarget.value)}
                />
                <NumberInput
                  label={tooltipLabel('Library Page Size', 'libraryPageSize')}
                  value={settings.libraryPageSize}
                  onChange={(value) => updateSetting('libraryPageSize', typeof value === 'number' ? value : 20)}
                  min={5}
                  max={100}
                />
                <NumberInput
                  label={tooltipLabel('Media List Page Size', 'mediaListPageSize')}
                  value={settings.mediaListPageSize}
                  onChange={(value) => updateSetting('mediaListPageSize', typeof value === 'number' ? value : 50)}
                  min={10}
                  max={200}
                />
                <NumberInput
                  label={tooltipLabel('Compact Card Height (px)', 'mediaCompactCardHeight')}
                  value={settings.mediaCompactCardHeight}
                  onChange={(value) => updateSetting('mediaCompactCardHeight', typeof value === 'number' ? value : 100)}
                  min={40}
                  max={300}
                />
                <NumberInput
                  label={tooltipLabel('Small Card Height (px)', 'mediaSmallCardHeight')}
                  value={settings.mediaSmallCardHeight}
                  onChange={(value) => updateSetting('mediaSmallCardHeight', typeof value === 'number' ? value : 80)}
                  min={40}
                  max={300}
                />
                <NumberInput
                  label={tooltipLabel('Medium Card Height (px)', 'mediaMediumCardHeight')}
                  value={settings.mediaMediumCardHeight}
                  onChange={(value) => updateSetting('mediaMediumCardHeight', typeof value === 'number' ? value : 240)}
                  min={100}
                  max={600}
                />
                <NumberInput
                  label={tooltipLabel('Large Card Height (px)', 'mediaLargeCardHeight')}
                  value={settings.mediaLargeCardHeight}
                  onChange={(value) => updateSetting('mediaLargeCardHeight', typeof value === 'number' ? value : 340)}
                  min={100}
                  max={800}
                />
                <NumberInput
                  label={tooltipLabel('Media List Min Width (px)', 'mediaListMinWidth')}
                  value={settings.mediaListMinWidth}
                  onChange={(value) => updateSetting('mediaListMinWidth', typeof value === 'number' ? value : 600)}
                  min={300}
                  max={1200}
                />
                <NumberInput
                  label={tooltipLabel('Notification Dismiss (ms)', 'notificationDismissMs')}
                  value={settings.notificationDismissMs}
                  onChange={(value) => updateSetting('notificationDismissMs', typeof value === 'number' ? value : 4000)}
                  min={1000}
                  max={30000}
                />
                <Divider label="Image Optimization" labelPosition="center" />
                <Switch
                  label={tooltipLabel('Optimize on Upload', 'optimizeOnUpload')}
                  description="Automatically resize and compress images on upload."
                  checked={settings.optimizeOnUpload}
                  onChange={(event) => updateSetting('optimizeOnUpload', event.currentTarget.checked)}
                />
                <NumberInput
                  label={tooltipLabel('Max Width (px)', 'optimizeMaxWidth')}
                  value={settings.optimizeMaxWidth}
                  onChange={(value) => updateSetting('optimizeMaxWidth', typeof value === 'number' ? value : 1920)}
                  min={100}
                  max={4096}
                />
                <NumberInput
                  label={tooltipLabel('Max Height (px)', 'optimizeMaxHeight')}
                  value={settings.optimizeMaxHeight}
                  onChange={(value) => updateSetting('optimizeMaxHeight', typeof value === 'number' ? value : 1920)}
                  min={100}
                  max={4096}
                />
                <NumberInput
                  label={tooltipLabel('Quality (%)', 'optimizeQuality')}
                  value={settings.optimizeQuality}
                  onChange={(value) => updateSetting('optimizeQuality', typeof value === 'number' ? value : 82)}
                  min={10}
                  max={100}
                />
                <Switch
                  label={tooltipLabel('WebP Conversion', 'optimizeWebpEnabled')}
                  description="Generate WebP copies alongside originals."
                  checked={settings.optimizeWebpEnabled}
                  onChange={(event) => updateSetting('optimizeWebpEnabled', event.currentTarget.checked)}
                />
                <NumberInput
                  label={tooltipLabel('Thumbnail Cache TTL (s)', 'thumbnailCacheTtl')}
                  description="How long cached external thumbnails are kept (seconds)."
                  value={settings.thumbnailCacheTtl}
                  onChange={(value) => updateSetting('thumbnailCacheTtl', typeof value === 'number' ? value : 86400)}
                  min={0}
                  max={604800}
                />
              </Stack>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-tile">
          <Accordion.Control>Tile / Adapter</Accordion.Control>
          <Accordion.Panel>
            {mounted.has('adv-tile') ? (
              <Stack gap="md">
                <Text size="sm" fw={500}>{tooltipLabel('Hover Overlay Opacity', 'tileHoverOverlayOpacity')}</Text>
                <Slider value={settings.tileHoverOverlayOpacity} onChange={(value) => updateSetting('tileHoverOverlayOpacity', value)} min={0} max={1} step={0.05} />
                <Text size="sm" fw={500}>{tooltipLabel('Bounce Scale (Hover)', 'tileBounceScaleHover')}</Text>
                <Slider value={settings.tileBounceScaleHover} onChange={(value) => updateSetting('tileBounceScaleHover', value)} min={1} max={1.3} step={0.01} />
                <Text size="sm" fw={500}>{tooltipLabel('Bounce Scale (Active)', 'tileBounceScaleActive')}</Text>
                <Slider value={settings.tileBounceScaleActive} onChange={(value) => updateSetting('tileBounceScaleActive', value)} min={0.9} max={1.1} step={0.01} />
                <NumberInput label={tooltipLabel('Bounce Duration (ms)', 'tileBounceDurationMs')} value={settings.tileBounceDurationMs} onChange={(value) => updateSetting('tileBounceDurationMs', typeof value === 'number' ? value : 300)} min={0} max={1000} />
                <NumberInput label={tooltipLabel('Base Transition Duration (ms)', 'tileBaseTransitionDurationMs')} value={settings.tileBaseTransitionDurationMs} onChange={(value) => updateSetting('tileBaseTransitionDurationMs', typeof value === 'number' ? value : 250)} min={0} max={1000} />
                <NumberInput label={tooltipLabel('Tile Transition Duration (ms)', 'tileTransitionDurationMs')} value={settings.tileTransitionDurationMs} onChange={(value) => updateSetting('tileTransitionDurationMs', typeof value === 'number' ? value : 200)} min={0} max={1000} />
                <Text size="sm" fw={500}>{tooltipLabel('Hex Vertical Overlap Ratio', 'hexVerticalOverlapRatio')}</Text>
                <Slider value={settings.hexVerticalOverlapRatio} onChange={(value) => updateSetting('hexVerticalOverlapRatio', value)} min={0} max={0.5} step={0.01} />
                <Text size="sm" fw={500}>{tooltipLabel('Diamond Vertical Overlap Ratio', 'diamondVerticalOverlapRatio')}</Text>
                <Slider value={settings.diamondVerticalOverlapRatio} onChange={(value) => updateSetting('diamondVerticalOverlapRatio', value)} min={0} max={0.5} step={0.01} />
                <TextInput label={tooltipLabel('Hex Clip Path', 'hexClipPath')} value={settings.hexClipPath} onChange={(event) => updateSetting('hexClipPath', event.currentTarget.value)} />
                <TextInput label={tooltipLabel('Diamond Clip Path', 'diamondClipPath')} value={settings.diamondClipPath} onChange={(event) => updateSetting('diamondClipPath', event.currentTarget.value)} />
                <NumberInput label={tooltipLabel('Default Per Row', 'tileDefaultPerRow')} value={settings.tileDefaultPerRow} onChange={(value) => updateSetting('tileDefaultPerRow', typeof value === 'number' ? value : 5)} min={1} max={12} />
                <TextInput label={tooltipLabel('Masonry Auto Column Breakpoints', 'masonryAutoColumnBreakpoints')} description="Format: 480:2,768:3,1024:4,1280:5" value={settings.masonryAutoColumnBreakpoints} onChange={(event) => updateSetting('masonryAutoColumnBreakpoints', event.currentTarget.value)} />
                <TextInput label={tooltipLabel('Grid Card Hover Shadow', 'gridCardHoverShadow')} value={settings.gridCardHoverShadow} onChange={(event) => updateSetting('gridCardHoverShadow', event.currentTarget.value)} />
                <TextInput label={tooltipLabel('Grid Card Default Shadow', 'gridCardDefaultShadow')} value={settings.gridCardDefaultShadow} onChange={(event) => updateSetting('gridCardDefaultShadow', event.currentTarget.value)} />
                <Text size="sm" fw={500}>{tooltipLabel('Grid Card Hover Scale', 'gridCardHoverScale')}</Text>
                <Slider value={settings.gridCardHoverScale} onChange={(value) => updateSetting('gridCardHoverScale', value)} min={1} max={1.2} step={0.01} />
              </Stack>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-lightbox">
          <Accordion.Control>Lightbox</Accordion.Control>
          <Accordion.Panel>
            {mounted.has('adv-lightbox') ? (
              <Stack gap="md">
                <NumberInput label={tooltipLabel('Transition Duration (ms)', 'lightboxTransitionMs')} value={settings.lightboxTransitionMs} onChange={(value) => updateSetting('lightboxTransitionMs', typeof value === 'number' ? value : 250)} min={0} max={1000} />
                <TextInput label={tooltipLabel('Backdrop Color', 'lightboxBackdropColor')} value={settings.lightboxBackdropColor} onChange={(event) => updateSetting('lightboxBackdropColor', event.currentTarget.value)} />
                <Text size="sm" fw={500}>{tooltipLabel('Entry Scale', 'lightboxEntryScale')}</Text>
                <Slider value={settings.lightboxEntryScale} onChange={(value) => updateSetting('lightboxEntryScale', value)} min={0.5} max={1} step={0.01} />
                <DimensionInput label={tooltipLabel('Video Max Width', 'lightboxVideoMaxWidth')} value={settings.lightboxVideoMaxWidth} unit={settings.lightboxVideoMaxWidthUnit ?? 'px'} onValueChange={(value) => updateSetting('lightboxVideoMaxWidth', value)} onUnitChange={(unit) => updateSetting('lightboxVideoMaxWidthUnit', unit as GalleryBehaviorSettings['lightboxVideoMaxWidthUnit'])} allowedUnits={CSS_WIDTH_UNITS} max={1920} />
                <DimensionInput label={tooltipLabel('Video Height', 'lightboxVideoHeight')} value={settings.lightboxVideoHeight} unit={settings.lightboxVideoHeightUnit ?? 'px'} onValueChange={(value) => updateSetting('lightboxVideoHeight', value)} onUnitChange={(unit) => updateSetting('lightboxVideoHeightUnit', unit as GalleryBehaviorSettings['lightboxVideoHeightUnit'])} allowedUnits={CSS_HEIGHT_UNITS} max={1080} />
                <TextInput label={tooltipLabel('Media Max Height', 'lightboxMediaMaxHeight')} description="CSS value, e.g. 85vh" value={settings.lightboxMediaMaxHeight} onChange={(event) => updateSetting('lightboxMediaMaxHeight', event.currentTarget.value)} />
                <NumberInput label={tooltipLabel('Z-Index', 'lightboxZIndex')} value={settings.lightboxZIndex} onChange={(value) => updateSetting('lightboxZIndex', typeof value === 'number' ? value : 1000)} min={1} max={10000} />
              </Stack>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-nav">
          <Accordion.Control>Navigation</Accordion.Control>
          <Accordion.Panel>
            {mounted.has('adv-nav') ? (
              <Stack gap="md">
                <NumberInput label={tooltipLabel('Max Visible Dots', 'dotNavMaxVisibleDots')} value={settings.dotNavMaxVisibleDots} onChange={(value) => updateSetting('dotNavMaxVisibleDots', typeof value === 'number' ? value : 7)} min={3} max={20} />
                <NumberInput label={tooltipLabel('Arrow Edge Inset (px)', 'navArrowEdgeInset')} value={settings.navArrowEdgeInset} onChange={(value) => updateSetting('navArrowEdgeInset', typeof value === 'number' ? value : 8)} min={0} max={48} />
                <NumberInput label={tooltipLabel('Arrow Min Hit Target (px)', 'navArrowMinHitTarget')} value={settings.navArrowMinHitTarget} onChange={(value) => updateSetting('navArrowMinHitTarget', typeof value === 'number' ? value : 44)} min={24} max={80} />
                <NumberInput label={tooltipLabel('Arrow Fade Duration (ms)', 'navArrowFadeDurationMs')} value={settings.navArrowFadeDurationMs} onChange={(value) => updateSetting('navArrowFadeDurationMs', typeof value === 'number' ? value : 200)} min={0} max={1000} />
                <NumberInput label={tooltipLabel('Arrow Scale Transition (ms)', 'navArrowScaleTransitionMs')} value={settings.navArrowScaleTransitionMs} onChange={(value) => updateSetting('navArrowScaleTransitionMs', typeof value === 'number' ? value : 150)} min={0} max={1000} />
                <Text size="sm" fw={500}>{tooltipLabel('Viewport Height Mobile Ratio', 'viewportHeightMobileRatio')}</Text>
                <Slider value={settings.viewportHeightMobileRatio} onChange={(value) => updateSetting('viewportHeightMobileRatio', value)} min={0.3} max={1} step={0.05} />
                <Text size="sm" fw={500}>{tooltipLabel('Viewport Height Tablet Ratio', 'viewportHeightTabletRatio')}</Text>
                <Slider value={settings.viewportHeightTabletRatio} onChange={(value) => updateSetting('viewportHeightTabletRatio', value)} min={0.3} max={1} step={0.05} />
                <NumberInput label={tooltipLabel('Search Input Min Width (px)', 'searchInputMinWidth')} value={settings.searchInputMinWidth} onChange={(value) => updateSetting('searchInputMinWidth', typeof value === 'number' ? value : 200)} min={100} max={400} />
                <NumberInput label={tooltipLabel('Search Input Max Width (px)', 'searchInputMaxWidth')} value={settings.searchInputMaxWidth} onChange={(value) => updateSetting('searchInputMaxWidth', typeof value === 'number' ? value : 280)} min={150} max={600} />
              </Stack>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-system">
          <Accordion.Control>System</Accordion.Control>
          <Accordion.Panel>
            {mounted.has('adv-system') ? (
              <Stack gap="md">
                <NumberInput label={tooltipLabel('Admin Search Debounce (ms)', 'adminSearchDebounceMs')} value={settings.adminSearchDebounceMs} onChange={(value) => updateSetting('adminSearchDebounceMs', typeof value === 'number' ? value : 300)} min={0} max={2000} />
                <NumberInput label={tooltipLabel('Min Password Length', 'loginMinPasswordLength')} value={settings.loginMinPasswordLength} onChange={(value) => updateSetting('loginMinPasswordLength', typeof value === 'number' ? value : 1)} min={1} max={32} />
                <NumberInput label={tooltipLabel('Login Form Max Width (px)', 'loginFormMaxWidth')} value={settings.loginFormMaxWidth} onChange={(value) => updateSetting('loginFormMaxWidth', typeof value === 'number' ? value : 400)} min={200} max={800} />

              </Stack>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-debug">
          <Accordion.Control>Developer &amp; Debugging</Accordion.Control>
          <Accordion.Panel>
            {mounted.has('adv-debug') ? (
              <Stack gap="md">
                <Switch
                  label={tooltipLabel('Enable Component Debug Names & Markers', 'debugComponentMarkers')}
                  description="When enabled, deployed builds keep explicit React DevTools component names and inject data-wpsg-component/data-wpsg-slot attributes into the DOM for Elements inspection and QA selectors. Local dev may still show source component names even when this is off."
                  checked={settings.debugComponentMarkers}
                  onChange={(event) => updateSetting('debugComponentMarkers', event.currentTarget.checked)}
                />
              </Stack>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="maintenance">
          <Accordion.Control>Data Maintenance</Accordion.Control>
          <Accordion.Panel>
            {mounted.has('maintenance') ? (
              <Stack gap="md">
                <NumberInput
                  label={tooltipLabel('Archive Purge After (days)', 'archivePurgeDays')}
                  description="Archived campaigns older than this are moved to trash. Set to 0 to disable automatic purging."
                  value={settings.archivePurgeDays ?? 0}
                  onChange={(value) => updateSetting('archivePurgeDays', typeof value === 'number' ? value : 0)}
                  min={0}
                  max={365}
                />
                <NumberInput
                  label={tooltipLabel('Trash Grace Period (days)', 'archivePurgeGraceDays')}
                  description="Trashed campaigns are permanently deleted after this many days. Minimum 7 days."
                  value={settings.archivePurgeGraceDays ?? 30}
                  onChange={(value) => updateSetting('archivePurgeGraceDays', typeof value === 'number' ? value : 30)}
                  min={7}
                  max={90}
                />
                <NumberInput
                  label={tooltipLabel('Analytics Retention (days)', 'analyticsRetentionDays')}
                  description="Analytics events older than this are purged weekly. Set to 0 to keep indefinitely."
                  value={settings.analyticsRetentionDays ?? 0}
                  onChange={(value) => updateSetting('analyticsRetentionDays', typeof value === 'number' ? value : 0)}
                  min={0}
                  max={730}
                />
              </Stack>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-cache">
          <Accordion.Control>Object Cache</Accordion.Control>
          <Accordion.Panel>
            {mounted.has('adv-cache') ? (
              <Stack gap="md">
                {isHealthLoading && <Loader size="sm" />}
                {isHealthError && (
                  <Alert color="red" title="Health data unavailable">
                    Could not load object-cache status from the server.
                  </Alert>
                )}
                {!isHealthLoading && !isHealthError && healthData && (
                  <>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>Persistent cache</Text>
                      {healthData.objectCache.persistent ? (
                        <Badge color="green" size="sm">Active</Badge>
                      ) : (
                        <Badge color="gray" size="sm">Not detected</Badge>
                      )}
                      {healthData.objectCache.backend && (
                        <Badge color="blue" size="sm" variant="outline">
                          {BACKEND_LABELS[healthData.objectCache.backend] ?? healthData.objectCache.backend}
                        </Badge>
                      )}
                    </Group>

                    {!healthData.objectCache.persistent && (
                      <Alert color="yellow" title="No persistent object cache">
                        WordPress is using its default in-memory cache, which is discarded on every
                        request. For higher-traffic deployments consider adding a Redis or Memcached
                        drop-in. See <em>docs/object-cache-setup.md</em> for setup instructions.
                      </Alert>
                    )}

                    {healthData.objectCache.persistent && !healthData.objectCache.stats_available && (
                      <Text size="sm" c="dimmed">
                        Cache backend detected but no runtime stats are exposed by this drop-in.
                      </Text>
                    )}

                    {healthData.objectCache.stats_available && healthData.objectCache.stats && (
                      <Stack gap="xs">
                        <Text size="sm" fw={500}>Backend stats</Text>
                        {Object.entries(healthData.objectCache.stats).map(([key, val]) => (
                          <Group key={key} justify="space-between" gap="xs">
                            <Text size="xs" c="dimmed">{key}</Text>
                            <Text size="xs">{String(val)}</Text>
                          </Group>
                        ))}
                      </Stack>
                    )}
                  </>
                )}
              </Stack>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="danger-zone">
          <Accordion.Control>
            <Text c="red" size="sm" fw={600}>Danger Zone</Text>
          </Accordion.Control>
          <Accordion.Panel>
            {mounted.has('danger-zone') ? (
              <Stack gap="md">
                <Alert color="red" title="Irreversible data deletion">
                  When preservation is disabled, deleting this plugin permanently removes all
                  campaigns, layout templates, overlay library, analytics events, access grants,
                  and uploaded thumbnail files. This cannot be undone.
                </Alert>
                <Switch
                  label={tooltipLabel('Preserve data on plugin removal', 'preserveDataOnUninstall')}
                  description="When enabled (recommended), all plugin data is kept if you remove the plugin. Disable only if you intend to wipe all gallery data on uninstall."
                  checked={settings.preserveDataOnUninstall ?? true}
                  onChange={(event) => updateSetting('preserveDataOnUninstall', event.currentTarget.checked)}
                />
              </Stack>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  );
}