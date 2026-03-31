import type { ReactNode } from 'react';

import { Accordion, Divider, NumberInput, Slider, Stack, Switch, Text, TextInput } from '@mantine/core';

import type { GalleryBehaviorSettings } from '@/types';

import type { UpdateGallerySetting } from './GalleryAdapterSettingsSection';

interface AdvancedSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
  tooltipLabel: (label: string, key: string) => ReactNode;
}

export function AdvancedSettingsSection({ settings, updateSetting, tooltipLabel }: AdvancedSettingsSectionProps) {
  return (
    <>
      <Text size="sm" c="dimmed" mb="md">
        Fine-grained controls for power users. These settings override internal defaults
        across all gallery components. Change with care.
      </Text>
      <Accordion variant="separated">
        <Accordion.Item value="adv-card">
          <Accordion.Control>Card Appearance</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Text size="sm" fw={500}>{tooltipLabel('Locked Card Opacity', 'cardLockedOpacity')}</Text>
              <Slider
                value={settings.cardLockedOpacity}
                onChange={(value) => updateSetting('cardLockedOpacity', value)}
                min={0}
                max={1}
                step={0.05}
                marks={[{ value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }]}
              />
              <Text size="sm" fw={500}>{tooltipLabel('Gradient Start Opacity', 'cardGradientStartOpacity')}</Text>
              <Slider
                value={settings.cardGradientStartOpacity}
                onChange={(value) => updateSetting('cardGradientStartOpacity', value)}
                min={0}
                max={1}
                step={0.05}
              />
              <Text size="sm" fw={500}>{tooltipLabel('Gradient End Opacity', 'cardGradientEndOpacity')}</Text>
              <Slider
                value={settings.cardGradientEndOpacity}
                onChange={(value) => updateSetting('cardGradientEndOpacity', value)}
                min={0}
                max={1}
                step={0.05}
              />
              <NumberInput
                label={tooltipLabel('Lock Icon Size (px)', 'cardLockIconSize')}
                value={settings.cardLockIconSize}
                onChange={(value) => updateSetting('cardLockIconSize', typeof value === 'number' ? value : 32)}
                min={12}
                max={64}
              />
              <NumberInput
                label={tooltipLabel('Access Icon Size (px)', 'cardAccessIconSize')}
                value={settings.cardAccessIconSize}
                onChange={(value) => updateSetting('cardAccessIconSize', typeof value === 'number' ? value : 14)}
                min={8}
                max={32}
              />
              <NumberInput
                label={tooltipLabel('Badge Offset Y (px)', 'cardBadgeOffsetY')}
                value={settings.cardBadgeOffsetY}
                onChange={(value) => updateSetting('cardBadgeOffsetY', typeof value === 'number' ? value : 8)}
                min={0}
                max={32}
              />
              <NumberInput
                label={tooltipLabel('Company Badge Max Width (px)', 'cardCompanyBadgeMaxWidth')}
                value={settings.cardCompanyBadgeMaxWidth}
                onChange={(value) => updateSetting('cardCompanyBadgeMaxWidth', typeof value === 'number' ? value : 160)}
                min={60}
                max={400}
              />
              <NumberInput
                label={tooltipLabel('Thumbnail Hover Transition (ms)', 'cardThumbnailHoverTransitionMs')}
                value={settings.cardThumbnailHoverTransitionMs}
                onChange={(value) => updateSetting('cardThumbnailHoverTransitionMs', typeof value === 'number' ? value : 300)}
                min={0}
                max={1000}
              />
              <Text size="sm" fw={500}>{tooltipLabel('Page Transition Opacity', 'cardPageTransitionOpacity')}</Text>
              <Slider
                value={settings.cardPageTransitionOpacity}
                onChange={(value) => updateSetting('cardPageTransitionOpacity', value)}
                min={0}
                max={1}
                step={0.05}
              />
              <TextInput
                label={tooltipLabel('Auto Columns Breakpoints', 'cardAutoColumnsBreakpoints')}
                description="Format: 480:1,768:2,1024:3,1280:4"
                value={settings.cardAutoColumnsBreakpoints}
                onChange={(event) => updateSetting('cardAutoColumnsBreakpoints', event.currentTarget.value)}
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-text">
          <Accordion.Control>Gallery Text</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <TextInput
                label={tooltipLabel('Gallery Title', 'galleryTitleText')}
                description="Main heading text shown above the gallery."
                value={settings.galleryTitleText}
                onChange={(event) => updateSetting('galleryTitleText', event.currentTarget.value)}
              />
              <TextInput
                label={tooltipLabel('Gallery Subtitle', 'gallerySubtitleText')}
                description="Subtitle text shown beneath the title."
                value={settings.gallerySubtitleText}
                onChange={(event) => updateSetting('gallerySubtitleText', event.currentTarget.value)}
              />
              <TextInput
                label={tooltipLabel('Campaign About Heading', 'campaignAboutHeadingText')}
                description='Heading for the campaign description section (default "About").'
                value={settings.campaignAboutHeadingText}
                onChange={(event) => updateSetting('campaignAboutHeadingText', event.currentTarget.value)}
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-modal">
          <Accordion.Control>Modal / Viewer</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <TextInput
                label={tooltipLabel('Close Button Background', 'modalCloseButtonBgColor')}
                value={settings.modalCloseButtonBgColor}
                onChange={(event) => updateSetting('modalCloseButtonBgColor', event.currentTarget.value)}
              />
              <NumberInput
                label={tooltipLabel('Content Max Width (px)', 'modalContentMaxWidth')}
                value={settings.modalContentMaxWidth}
                onChange={(value) => updateSetting('modalContentMaxWidth', typeof value === 'number' ? value : 900)}
                min={400}
                max={2000}
              />
              <NumberInput
                label={tooltipLabel('Mobile Breakpoint (px)', 'modalMobileBreakpoint')}
                value={settings.modalMobileBreakpoint}
                onChange={(value) => updateSetting('modalMobileBreakpoint', typeof value === 'number' ? value : 768)}
                min={320}
                max={1280}
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-upload">
          <Accordion.Control>Upload / Media</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <NumberInput
                label={tooltipLabel('Upload Max Size (MB)', 'uploadMaxSizeMb')}
                value={settings.uploadMaxSizeMb}
                onChange={(value) => updateSetting('uploadMaxSizeMb', typeof value === 'number' ? value : 50)}
                min={1}
                max={500}
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
                label={tooltipLabel('SWR Deduping Interval (ms)', 'swrDedupingIntervalMs')}
                value={settings.swrDedupingIntervalMs}
                onChange={(value) => updateSetting('swrDedupingIntervalMs', typeof value === 'number' ? value : 5000)}
                min={0}
                max={30000}
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
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-tile">
          <Accordion.Control>Tile / Adapter</Accordion.Control>
          <Accordion.Panel>
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
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-lightbox">
          <Accordion.Control>Lightbox</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <NumberInput label={tooltipLabel('Transition Duration (ms)', 'lightboxTransitionMs')} value={settings.lightboxTransitionMs} onChange={(value) => updateSetting('lightboxTransitionMs', typeof value === 'number' ? value : 250)} min={0} max={1000} />
              <TextInput label={tooltipLabel('Backdrop Color', 'lightboxBackdropColor')} value={settings.lightboxBackdropColor} onChange={(event) => updateSetting('lightboxBackdropColor', event.currentTarget.value)} />
              <Text size="sm" fw={500}>{tooltipLabel('Entry Scale', 'lightboxEntryScale')}</Text>
              <Slider value={settings.lightboxEntryScale} onChange={(value) => updateSetting('lightboxEntryScale', value)} min={0.5} max={1} step={0.01} />
              <NumberInput label={tooltipLabel('Video Max Width (px)', 'lightboxVideoMaxWidth')} value={settings.lightboxVideoMaxWidth} onChange={(value) => updateSetting('lightboxVideoMaxWidth', typeof value === 'number' ? value : 900)} min={300} max={1920} />
              <NumberInput label={tooltipLabel('Video Height (px)', 'lightboxVideoHeight')} value={settings.lightboxVideoHeight} onChange={(value) => updateSetting('lightboxVideoHeight', typeof value === 'number' ? value : 506)} min={200} max={1080} />
              <TextInput label={tooltipLabel('Media Max Height', 'lightboxMediaMaxHeight')} description="CSS value, e.g. 85vh" value={settings.lightboxMediaMaxHeight} onChange={(event) => updateSetting('lightboxMediaMaxHeight', event.currentTarget.value)} />
              <NumberInput label={tooltipLabel('Z-Index', 'lightboxZIndex')} value={settings.lightboxZIndex} onChange={(value) => updateSetting('lightboxZIndex', typeof value === 'number' ? value : 1000)} min={1} max={10000} />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-nav">
          <Accordion.Control>Navigation</Accordion.Control>
          <Accordion.Panel>
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
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="adv-system">
          <Accordion.Control>System</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <NumberInput label={tooltipLabel('Expiry Warning Threshold (ms)', 'expiryWarningThresholdMs')} description="How early to show token-expiry warnings." value={settings.expiryWarningThresholdMs} onChange={(value) => updateSetting('expiryWarningThresholdMs', typeof value === 'number' ? value : 300000)} min={0} max={600000} />
              <NumberInput label={tooltipLabel('Admin Search Debounce (ms)', 'adminSearchDebounceMs')} value={settings.adminSearchDebounceMs} onChange={(value) => updateSetting('adminSearchDebounceMs', typeof value === 'number' ? value : 300)} min={0} max={2000} />
              <NumberInput label={tooltipLabel('Min Password Length', 'loginMinPasswordLength')} value={settings.loginMinPasswordLength} onChange={(value) => updateSetting('loginMinPasswordLength', typeof value === 'number' ? value : 1)} min={1} max={32} />
              <NumberInput label={tooltipLabel('Login Form Max Width (px)', 'loginFormMaxWidth')} value={settings.loginFormMaxWidth} onChange={(value) => updateSetting('loginFormMaxWidth', typeof value === 'number' ? value : 400)} min={200} max={800} />
              <NumberInput label={tooltipLabel('Auth Bar Backdrop Blur (px)', 'authBarBackdropBlur')} value={settings.authBarBackdropBlur} onChange={(value) => updateSetting('authBarBackdropBlur', typeof value === 'number' ? value : 8)} min={0} max={24} />
              <NumberInput label={tooltipLabel('Auth Bar Mobile Breakpoint (px)', 'authBarMobileBreakpoint')} value={settings.authBarMobileBreakpoint} onChange={(value) => updateSetting('authBarMobileBreakpoint', typeof value === 'number' ? value : 768)} min={320} max={1280} />
              <Switch
                label={tooltipLabel('Preserve data on plugin removal', 'preserveDataOnUninstall')}
                description="When enabled, all campaigns, templates, analytics, and uploaded files are kept if you uninstall the plugin."
                checked={settings.preserveDataOnUninstall ?? false}
                onChange={(event) => updateSetting('preserveDataOnUninstall', event.currentTarget.checked)}
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="maintenance">
          <Accordion.Control>Data Maintenance</Accordion.Control>
          <Accordion.Panel>
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
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  );
}