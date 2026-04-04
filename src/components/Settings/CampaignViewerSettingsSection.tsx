import { Accordion, Box, NumberInput, Slider, Stack, Switch, Text, TextInput } from '@mantine/core';

import { GradientEditor } from '@/components/Common/GradientEditor';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { DimensionInput } from '@/components/Settings/DimensionInput';
import { useLazyAccordion } from '@/hooks/useLazyAccordion';
import type { GalleryBehaviorSettings } from '@/types';
import { CSS_HEIGHT_UNITS, CSS_SPACING_UNITS, CSS_WIDTH_UNITS } from '@/utils/cssUnits';

import type { UpdateGallerySetting } from './GalleryAdapterSettingsSection';

interface CampaignViewerSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
}

export function CampaignViewerSettingsSection({ settings, updateSetting }: CampaignViewerSettingsSectionProps) {
  const { mounted, onChange } = useLazyAccordion('cv-open-mode');

  return (
    <Accordion variant="separated" defaultValue="cv-open-mode" onChange={onChange}>
      <Accordion.Item value="cv-open-mode">
        <Accordion.Control>Open Mode &amp; Sizing</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('cv-open-mode') ? (
            <Stack gap="md">
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
            <DimensionInput
              label="Fullscreen Content Max Width"
              description="Limit content width in fullscreen mode. 0 = full responsive width."
              value={settings.fullscreenContentMaxWidth ?? 0}
              unit={settings.fullscreenContentMaxWidthUnit ?? 'px'}
              onValueChange={(value) => updateSetting('fullscreenContentMaxWidth', value)}
              onUnitChange={(unit) => updateSetting('fullscreenContentMaxWidthUnit', unit as GalleryBehaviorSettings['fullscreenContentMaxWidthUnit'])}
              allowedUnits={CSS_WIDTH_UNITS}
              max={3000}
              step={50}
              placeholder="0 = full width"
              numberInputProps={{ disabled: !settings.campaignModalFullscreen, style: !settings.campaignModalFullscreen ? { opacity: 0.4 } : undefined }}
            />
            <Box style={settings.campaignModalFullscreen ? { opacity: 0.4, pointerEvents: 'none' as const } : undefined}>
              <Stack gap="md">
                <DimensionInput
                  label="Modal Max Width"
                  description="Maximum width of the campaign modal when not fullscreen (clamped 600-1600)."
                  value={settings.modalMaxWidth ?? 1200}
                  unit={settings.modalMaxWidthUnit ?? 'px'}
                  onValueChange={(value) => updateSetting('modalMaxWidth', value)}
                  onUnitChange={(unit) => updateSetting('modalMaxWidthUnit', unit as GalleryBehaviorSettings['modalMaxWidthUnit'])}
                  allowedUnits={CSS_WIDTH_UNITS}
                  max={1600}
                  step={50}
                  placeholder="1200"
                  numberInputProps={{ disabled: !!settings.campaignModalFullscreen }}
                />
              </Stack>
            </Box>
            <DimensionInput
              label="Content Max Width"
              description="Maximum width of the content area inside the modal. 0 = full width."
              value={settings.modalContentMaxWidth ?? 900}
              unit={settings.modalContentMaxWidthUnit ?? 'px'}
              onValueChange={(value) => updateSetting('modalContentMaxWidth', value)}
              onUnitChange={(unit) => updateSetting('modalContentMaxWidthUnit', unit as GalleryBehaviorSettings['modalContentMaxWidthUnit'])}
              allowedUnits={CSS_WIDTH_UNITS}
              max={2000}
              step={50}
              placeholder="900"
            />
            <DimensionInput
              label="Modal Inner Padding"
              description="Padding inside the modal content area (clamped 0-48)."
              value={settings.modalInnerPadding ?? 16}
              unit={settings.modalInnerPaddingUnit ?? 'px'}
              onValueChange={(value) => updateSetting('modalInnerPadding', value)}
              onUnitChange={(unit) => updateSetting('modalInnerPaddingUnit', unit as GalleryBehaviorSettings['modalInnerPaddingUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={48}
              step={4}
            />
            </Stack>
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="cv-appearance">
        <Accordion.Control>Modal Appearance</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('cv-appearance') ? (
            <Stack gap="md">
            <DimensionInput
              label="Cover Image Height"
              description="Height of the cover image in the campaign modal"
              value={settings.modalCoverHeight}
              unit={settings.modalCoverHeightUnit ?? 'px'}
              onValueChange={(value) => updateSetting('modalCoverHeight', value)}
              onUnitChange={(unit) => updateSetting('modalCoverHeightUnit', unit as GalleryBehaviorSettings['modalCoverHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
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
            </Stack>
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="cv-visibility">
        <Accordion.Control>Content Visibility</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('cv-visibility') ? (
            <Stack gap="md">
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
                <TextInput
                  label="About Section Heading"
                  description='Heading for the campaign description section (default "About").'
                  value={settings.campaignAboutHeadingText}
                  onChange={(event) => updateSetting('campaignAboutHeadingText', event.currentTarget.value)}
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
            </Stack>
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="cv-labels">
        <Accordion.Control>Gallery Labels</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('cv-labels') ? (
            <Stack gap="md">
            <TextInput
              label="Image Gallery Label"
              description="Custom label for image gallery sections. Count is appended automatically."
              value={settings.galleryImageLabel ?? 'Images'}
              onChange={(event) => updateSetting('galleryImageLabel', event.currentTarget.value)}
            />
            <TextInput
              label="Video Gallery Label"
              description="Custom label for video gallery sections. Count is appended automatically."
              value={settings.galleryVideoLabel ?? 'Videos'}
              onChange={(event) => updateSetting('galleryVideoLabel', event.currentTarget.value)}
            />
            <ModalSelect
              label="Label Justification"
              description="Horizontal alignment for gallery section labels"
              data={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
              ]}
              value={settings.galleryLabelJustification ?? 'left'}
              onChange={(value) => updateSetting('galleryLabelJustification', (value ?? 'left') as GalleryBehaviorSettings['galleryLabelJustification'])}
            />
            <Switch
              label="Show Gallery Label Icon"
              description="Display an icon prefix before each gallery section label"
              checked={settings.showGalleryLabelIcon ?? false}
              onChange={(event) => updateSetting('showGalleryLabelIcon', event.currentTarget.checked)}
            />
            </Stack>
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="cv-modal-bg">
        <Accordion.Control>Modal Background</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('cv-modal-bg') ? (
            <Stack gap="md">
            <ModalSelect
              label="Modal Background Type"
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
            </Stack>
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="cv-cover">
        <Accordion.Control>Cover Image &amp; Responsive</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('cv-cover') ? (
            <Stack gap="md">
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
            <NumberInput
              label="Close Button Size (px)"
              value={settings.modalCloseButtonSize}
              onChange={(value) => updateSetting('modalCloseButtonSize', typeof value === 'number' ? value : 36)}
              min={20}
              max={64}
            />
            <TextInput
              label="Close Button Background"
              description="CSS color for the close button background (e.g. rgba(0,0,0,0.5))."
              value={settings.modalCloseButtonBgColor}
              onChange={(event) => updateSetting('modalCloseButtonBgColor', event.currentTarget.value)}
            />
            <NumberInput
              label="Mobile Breakpoint (px)"
              description="Viewport width below which the campaign viewer switches to mobile layout."
              value={settings.modalMobileBreakpoint}
              onChange={(value) => updateSetting('modalMobileBreakpoint', typeof value === 'number' ? value : 768)}
              min={320}
              max={1280}
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
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}