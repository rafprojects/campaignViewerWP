import { Box, ColorInput, Divider, NumberInput, Slider, Stack, Switch, Text } from '@mantine/core';

import { GradientEditor } from '@/components/Common/GradientEditor';
import { ModalSelect } from '@/components/Common/ModalSelect';
import type { GalleryBehaviorSettings } from '@/types';

import type { UpdateGallerySetting } from './GalleryAdapterSettingsSection';

interface CampaignViewerSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
}

export function CampaignViewerSettingsSection({ settings, updateSetting }: CampaignViewerSettingsSectionProps) {
  return (
    <Stack gap="md">
      <Divider label="Open Mode" labelPosition="center" />

      <Switch
        label="Fullscreen Campaign Modal"
        description="Open campaign viewer in fullscreen mode instead of the default modal."
        checked={settings.campaignModalFullscreen ?? false}
        onChange={(event) => updateSetting('campaignModalFullscreen', event.currentTarget.checked)}
      />
      <ModalSelect
        label="Campaign Open Mode"
        description="What to show when a campaign is opened."
        data={[
          { value: 'full', label: 'Full (cover, about, galleries, stats)' },
          { value: 'galleries-only', label: 'Galleries only (skip header/about/stats)' },
        ]}
        value={settings.campaignOpenMode ?? 'full'}
        onChange={(value) => updateSetting('campaignOpenMode', (value ?? 'full') as GalleryBehaviorSettings['campaignOpenMode'])}
      />
      <NumberInput
        label="Fullscreen Content Max Width (px)"
        description="Limit content width in fullscreen mode. 0 = full responsive width."
        value={settings.fullscreenContentMaxWidth ?? 0}
        onChange={(value) => updateSetting('fullscreenContentMaxWidth', typeof value === 'number' ? value : 0)}
        min={0}
        max={3000}
        step={50}
        placeholder="0 = full width"
        disabled={!settings.campaignModalFullscreen}
        style={!settings.campaignModalFullscreen ? { opacity: 0.4 } : undefined}
      />
      <Box style={settings.campaignModalFullscreen ? { opacity: 0.4, pointerEvents: 'none' as const } : undefined}>
        <Stack gap="md">
          <NumberInput
            label="Modal Max Width (px)"
            description="Maximum width of the campaign modal when not fullscreen (clamped 600-1600)."
            value={settings.modalMaxWidth ?? 1200}
            onChange={(value) => updateSetting('modalMaxWidth', typeof value === 'number' ? value : 1200)}
            min={600}
            max={1600}
            step={50}
            placeholder="1200"
            disabled={!!settings.campaignModalFullscreen}
          />
        </Stack>
      </Box>
      <NumberInput
        label="Content Max Width (px)"
        description="Maximum width of the content area inside the modal. 0 = full width."
        value={settings.modalContentMaxWidth ?? 900}
        onChange={(value) => updateSetting('modalContentMaxWidth', typeof value === 'number' ? value : 900)}
        min={0}
        max={2000}
        step={50}
        placeholder="900"
      />
      <NumberInput
        label="Modal Inner Padding (px)"
        description="Padding inside the modal content area (clamped 0-48)."
        value={settings.modalInnerPadding ?? 16}
        onChange={(value) => updateSetting('modalInnerPadding', typeof value === 'number' ? value : 16)}
        min={0}
        max={48}
        step={4}
      />

      <Divider label="Modal Appearance" labelPosition="center" />

      <NumberInput
        label="Cover Image Height (px)"
        description="Height of the cover image in the campaign modal"
        value={settings.modalCoverHeight}
        onChange={(value) => updateSetting('modalCoverHeight', typeof value === 'number' ? value : 240)}
        min={100}
        max={400}
        step={10}
      />
      <ModalSelect
        label="Modal Transition"
        description="Animation style when opening the campaign modal"
        data={[
          { value: 'pop', label: 'Pop (scale up)' },
          { value: 'fade', label: 'Fade' },
          { value: 'slide-up', label: 'Slide Up' },
        ]}
        value={settings.modalTransition}
        onChange={(value) => updateSetting('modalTransition', value ?? 'pop')}
      />
      <NumberInput
        label="Modal Transition Duration (ms)"
        description="Length of the modal open/close animation"
        value={settings.modalTransitionDuration}
        onChange={(value) => updateSetting('modalTransitionDuration', typeof value === 'number' ? value : 300)}
        min={100}
        max={1000}
        step={50}
      />
      <NumberInput
        label="Modal Max Height (vh%)"
        description="Maximum height of the campaign modal as a percentage of viewport (clamped 50-95)."
        value={settings.modalMaxHeight}
        onChange={(value) => updateSetting('modalMaxHeight', typeof value === 'number' ? value : 90)}
        min={50}
        max={95}
        step={5}
        disabled={!!settings.campaignModalFullscreen}
        style={settings.campaignModalFullscreen ? { opacity: 0.4 } : undefined}
      />

      <Divider label="Visibility" labelPosition="center" />

      <Box style={settings.campaignOpenMode === 'galleries-only' ? { opacity: 0.4, pointerEvents: 'none' as const } : undefined}>
        <Stack gap="md">
          <Switch
            label="Show Company Name"
            description="Show the company badge on the campaign cover image."
            checked={settings.showCampaignCompanyName ?? true}
            onChange={(event) => updateSetting('showCampaignCompanyName', event.currentTarget.checked)}
            disabled={settings.campaignOpenMode === 'galleries-only'}
          />
          <Switch
            label="Show Date"
            description="Show the creation date under the campaign title."
            checked={settings.showCampaignDate ?? true}
            onChange={(event) => updateSetting('showCampaignDate', event.currentTarget.checked)}
            disabled={settings.campaignOpenMode === 'galleries-only'}
          />
          <Switch
            label="Show About Section"
            description='Show the "About this Campaign" heading and description.'
            checked={settings.showCampaignAbout ?? true}
            onChange={(event) => updateSetting('showCampaignAbout', event.currentTarget.checked)}
            disabled={settings.campaignOpenMode === 'galleries-only'}
          />
          <Switch
            label="Show Description"
            description="Show the campaign description text within the About section."
            checked={settings.showCampaignDescription ?? true}
            onChange={(event) => updateSetting('showCampaignDescription', event.currentTarget.checked)}
            disabled={settings.campaignOpenMode === 'galleries-only'}
          />
          <Switch
            label="Show Campaign Stats"
            description="Show the statistics block (video count, image count, tags, visibility)."
            checked={settings.showCampaignStats ?? true}
            onChange={(event) => updateSetting('showCampaignStats', event.currentTarget.checked)}
            disabled={settings.campaignOpenMode === 'galleries-only'}
          />
          <Switch
            label="Stats Admin-Only"
            description="When enabled, only admins can see the statistics block."
            checked={settings.campaignStatsAdminOnly ?? true}
            onChange={(event) => updateSetting('campaignStatsAdminOnly', event.currentTarget.checked)}
            disabled={settings.campaignOpenMode === 'galleries-only'}
          />
          <Switch
            label="Show Cover Image"
            description="Show the campaign cover image at the top of the viewer."
            checked={settings.showCampaignCoverImage ?? true}
            onChange={(event) => updateSetting('showCampaignCoverImage', event.currentTarget.checked)}
            disabled={settings.campaignOpenMode === 'galleries-only'}
          />
          <Switch
            label="Show Tags"
            description="Show tags section in the campaign viewer."
            checked={settings.showCampaignTags ?? true}
            onChange={(event) => updateSetting('showCampaignTags', event.currentTarget.checked)}
            disabled={settings.campaignOpenMode === 'galleries-only'}
          />
        </Stack>
      </Box>
      <Switch
        label="Show Admin Actions"
        description="Show admin action buttons (edit, archive, etc.) in the campaign viewer."
        checked={settings.showCampaignAdminActions ?? true}
        onChange={(event) => updateSetting('showCampaignAdminActions', event.currentTarget.checked)}
      />
      <Switch
        label="Show Gallery Labels"
        description="Show 'Images' and 'Videos' heading labels above galleries in the viewer."
        checked={settings.showCampaignGalleryLabels ?? true}
        onChange={(event) => updateSetting('showCampaignGalleryLabels', event.currentTarget.checked)}
      />

      <Divider label="Modal Background (Fullscreen)" labelPosition="center" />

      <ModalSelect
        label="Background Type"
        description="Background style for the fullscreen campaign modal"
        data={[
          { value: 'theme', label: 'Default Theme' },
          { value: 'transparent', label: 'Transparent' },
          { value: 'solid', label: 'Solid color' },
          { value: 'gradient', label: 'Custom gradient' },
        ]}
        value={settings.modalBgType ?? 'theme'}
        onChange={(value) => updateSetting('modalBgType', (value ?? 'theme') as GalleryBehaviorSettings['modalBgType'])}
      />
      {settings.modalBgType === 'solid' && (
        <ColorInput
          label="Modal Background Color"
          description="Solid background color for the fullscreen modal"
          value={settings.modalBgColor}
          onChange={(value) => updateSetting('modalBgColor', value)}
        />
      )}
      {settings.modalBgType === 'gradient' && (
        <GradientEditor
          value={settings.modalBgGradient ?? {}}
          onChange={(value) => updateSetting('modalBgGradient', value)}
        />
      )}

      <Divider label="Cover Image" labelPosition="center" />

      <Text size="sm" fw={500}>Cover Mobile Ratio</Text>
      <Slider
        value={settings.modalCoverMobileRatio}
        onChange={(value) => updateSetting('modalCoverMobileRatio', value)}
        min={0.2}
        max={1}
        step={0.05}
      />
      <Text size="sm" fw={500}>Cover Tablet Ratio</Text>
      <Slider
        value={settings.modalCoverTabletRatio}
        onChange={(value) => updateSetting('modalCoverTabletRatio', value)}
        min={0.2}
        max={1}
        step={0.05}
      />

      <Divider label="Modal Controls" labelPosition="center" />

      <NumberInput
        label="Close Button Size (px)"
        value={settings.modalCloseButtonSize}
        onChange={(value) => updateSetting('modalCloseButtonSize', typeof value === 'number' ? value : 36)}
        min={20}
        max={64}
      />
      <Text size="sm" fw={500}>Description Line Height</Text>
      <Slider
        value={settings.campaignDescriptionLineHeight}
        onChange={(value) => updateSetting('campaignDescriptionLineHeight', value)}
        min={1}
        max={3}
        step={0.1}
      />
    </Stack>
  );
}