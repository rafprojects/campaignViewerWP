import type { ReactNode } from 'react';

import { Accordion, Divider, Group, NumberInput, Slider, Stack, Switch, Text, TextInput } from '@mantine/core';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import { useLazyAccordion } from '@/hooks/useLazyAccordion';
import { DimensionInput } from '@/components/Settings/DimensionInput';

import {
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type DotNavPosition,
  type DotNavShape,
  type GalleryBehaviorSettings,
  type GalleryCommonSettings,
  type NavArrowPosition,
  type ScrollAnimationEasing,
  type ScrollAnimationStyle,
  type ScrollTransitionType,
  type ShadowPreset,
} from '@/types';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { CSS_BORDER_RADIUS_UNITS, CSS_SPACING_UNITS } from '@/utils/cssUnits';
import {
  collectGalleryAdapterSettingValues,
  getRepresentativeGalleryCommonSetting,
  resolveGalleryConfig,
  setRepresentativeGalleryCommonSetting,
} from '@/utils/galleryConfig';

interface MediaDisplaySettingsData extends GalleryBehaviorSettings {
  galleryLayout: 'grid' | 'masonry' | 'carousel';
  itemsPerPage: number;
  enableLightbox: boolean;
  enableAnimations: boolean;
}

interface MediaDisplaySettingsSectionProps {
  settings: MediaDisplaySettingsData;
  updateSetting: <K extends keyof MediaDisplaySettingsData>(key: K, value: MediaDisplaySettingsData[K]) => void;
  tooltipLabel: (label: string, key: string) => ReactNode;
}

export function MediaDisplaySettingsSection({ settings, updateSetting, tooltipLabel }: MediaDisplaySettingsSectionProps) {
  const { mounted, onChange } = useLazyAccordion('viewport');
  const resolvedGalleryConfig = resolveGalleryConfig(settings);
  const resolvedAdapterSettings = collectGalleryAdapterSettingValues(resolvedGalleryConfig);
  const gallerySizingMode = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'gallerySizingMode') as GalleryBehaviorSettings['gallerySizingMode'] | undefined;
  const galleryManualHeight = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'galleryManualHeight') as string | undefined;

  const getAdapterSettingValue = <K extends keyof GalleryBehaviorSettings>(key: K): MediaDisplaySettingsData[K] => (
    (resolvedAdapterSettings[key] as MediaDisplaySettingsData[K] | undefined) ?? settings[key]
  );

  const updateViewerCommonSetting = (
    key: Extract<keyof GalleryCommonSettings, 'gallerySizingMode' | 'galleryManualHeight'>,
    value: string | undefined,
  ) => {
    updateSetting('galleryConfig', setRepresentativeGalleryCommonSetting(
      resolvedGalleryConfig,
      key,
      value as GalleryCommonSettings[typeof key],
    ));
  };

  return (
    <Accordion variant="separated" defaultValue="viewport" onChange={onChange}>
      <Accordion.Item value="viewport">
        <Accordion.Control>Viewport &amp; Layout</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <Switch
              label="Enable Lightbox"
              description="Enable fullscreen lightbox when clicking gallery items."
              checked={settings.enableLightbox}
              onChange={(event) => updateSetting('enableLightbox', event.currentTarget.checked)}
            />

            <Switch
              label="Enable Animations"
              description="Enable smooth animations and transitions. Disable for better performance on low-end devices."
              checked={settings.enableAnimations}
              onChange={(event) => updateSetting('enableAnimations', event.currentTarget.checked)}
            />

            <Divider label="Viewport Dimensions" labelPosition="center" />

            <ModalSelect
              label={tooltipLabel('Height Constraint', 'gallerySizingMode')}
              description="Choose whether classic galleries can overflow, are kept within the visible screen, or use a manual CSS height."
              data={[
                { value: 'auto', label: 'No restraint' },
                { value: 'viewport', label: 'Restrain to view' },
                { value: 'manual', label: 'Manually control height' },
              ]}
              value={gallerySizingMode ?? 'auto'}
              onChange={(value) => updateViewerCommonSetting('gallerySizingMode', (value ?? 'auto') as GalleryBehaviorSettings['gallerySizingMode'])}
            />

            {gallerySizingMode === 'manual' && (
              <TextInput
                label={tooltipLabel('Manual Gallery Height', 'galleryManualHeight')}
                description="Accepted units: px, em, rem, vh, dvh, vw, %. Example: 75vh or 420px"
                value={galleryManualHeight ?? ''}
                onChange={(event) => updateViewerCommonSetting('galleryManualHeight', event.currentTarget.value)}
                placeholder="420px"
              />
            )}

            <Divider label="Border Radius" labelPosition="center" />

            <DimensionInput
              label="Image Border Radius"
              description="Corner rounding for image gallery viewport and thumbnails."
              value={getAdapterSettingValue('imageBorderRadius')}
              unit={getAdapterSettingValue('imageBorderRadiusUnit') ?? 'px'}
              onValueChange={(value) => updateSetting('imageBorderRadius', value)}
              onUnitChange={(unit) => updateSetting('imageBorderRadiusUnit', unit as GalleryBehaviorSettings['imageBorderRadiusUnit'])}
              allowedUnits={CSS_BORDER_RADIUS_UNITS}
              max={48}
              step={1}
            />

            <DimensionInput
              label="Video Border Radius"
              description="Corner rounding for video gallery viewport and thumbnails."
              value={getAdapterSettingValue('videoBorderRadius')}
              unit={getAdapterSettingValue('videoBorderRadiusUnit') ?? 'px'}
              onValueChange={(value) => updateSetting('videoBorderRadius', value)}
              onUnitChange={(unit) => updateSetting('videoBorderRadiusUnit', unit as GalleryBehaviorSettings['videoBorderRadiusUnit'])}
              allowedUnits={CSS_BORDER_RADIUS_UNITS}
              max={48}
              step={1}
            />

            <Divider label="Shadow & Depth" labelPosition="center" />

            <ModalSelect
              label="Image Shadow Preset"
              description="Box-shadow depth effect for image gallery viewport."
              value={getAdapterSettingValue('imageShadowPreset')}
              onChange={(value) => updateSetting('imageShadowPreset', (value as ShadowPreset) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageShadowPreset)}
              data={[
                { value: 'none', label: 'None' },
                { value: 'subtle', label: 'Subtle' },
                { value: 'medium', label: 'Medium' },
                { value: 'strong', label: 'Strong' },
                { value: 'custom', label: 'Custom' },
              ]}
            />

            {getAdapterSettingValue('imageShadowPreset') === 'custom' && (
              <TextInput
                label="Image Custom Shadow"
                description="CSS box-shadow value (e.g. '0 4px 16px rgba(0,0,0,0.25)')."
                value={getAdapterSettingValue('imageShadowCustom')}
                onChange={(event) => updateSetting('imageShadowCustom', event.currentTarget.value)}
              />
            )}

            <ModalSelect
              label="Video Shadow Preset"
              description="Box-shadow depth effect for video gallery viewport."
              value={getAdapterSettingValue('videoShadowPreset')}
              onChange={(value) => updateSetting('videoShadowPreset', (value as ShadowPreset) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoShadowPreset)}
              data={[
                { value: 'none', label: 'None' },
                { value: 'subtle', label: 'Subtle' },
                { value: 'medium', label: 'Medium' },
                { value: 'strong', label: 'Strong' },
                { value: 'custom', label: 'Custom' },
              ]}
            />

            {getAdapterSettingValue('videoShadowPreset') === 'custom' && (
              <TextInput
                label="Video Custom Shadow"
                description="CSS box-shadow value (e.g. '0 4px 16px rgba(0,0,0,0.25)')."
                value={getAdapterSettingValue('videoShadowCustom')}
                onChange={(event) => updateSetting('videoShadowCustom', event.currentTarget.value)}
              />
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="tile-appearance">
        <Accordion.Control>Tile Appearance</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('tile-appearance') && <Stack gap="md">
            <Group grow>
              <DimensionInput
                label="Gap X"
                description="Horizontal gap between tiles."
                value={getAdapterSettingValue('tileGapX')}
                unit={getAdapterSettingValue('tileGapXUnit') ?? 'px'}
                onValueChange={(value) => updateSetting('tileGapX', value)}
                onUnitChange={(unit) => updateSetting('tileGapXUnit', unit as GalleryBehaviorSettings['tileGapXUnit'])}
                allowedUnits={CSS_SPACING_UNITS}
                max={60}
                step={1}
              />
              <DimensionInput
                label="Gap Y"
                description="Vertical gap between tile rows."
                value={getAdapterSettingValue('tileGapY')}
                unit={getAdapterSettingValue('tileGapYUnit') ?? 'px'}
                onValueChange={(value) => updateSetting('tileGapY', value)}
                onUnitChange={(unit) => updateSetting('tileGapYUnit', unit as GalleryBehaviorSettings['tileGapYUnit'])}
                allowedUnits={CSS_SPACING_UNITS}
                max={60}
                step={1}
              />
            </Group>

            <Group grow>
              <NumberInput
                label="Border Width (px)"
                description="Tile border thickness. 0 = no border."
                value={getAdapterSettingValue('tileBorderWidth')}
                onChange={(value) => updateSetting('tileBorderWidth', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.tileBorderWidth)}
                min={0}
                max={20}
                step={1}
              />
              {getAdapterSettingValue('tileBorderWidth') > 0 && (
                <ColorInput
                  label="Border Color"
                  value={getAdapterSettingValue('tileBorderColor')}
                  onChange={(value) => updateSetting('tileBorderColor', value)}
                  format="hex"
                />
              )}
            </Group>

            <Switch
              label="Hover Bounce"
              description="Scale-up spring animation when hovering over a tile."
              checked={getAdapterSettingValue('tileHoverBounce')}
              onChange={(event) => updateSetting('tileHoverBounce', event.currentTarget.checked)}
            />

            <Switch
              label="Hover Glow"
              description="Drop-shadow glow on hover (works with clip-path shapes)."
              checked={getAdapterSettingValue('tileGlowEnabled')}
              onChange={(event) => updateSetting('tileGlowEnabled', event.currentTarget.checked)}
            />
            {getAdapterSettingValue('tileGlowEnabled') && (
              <Group grow>
                <ColorInput
                  label="Glow Color"
                  value={getAdapterSettingValue('tileGlowColor')}
                  onChange={(value) => updateSetting('tileGlowColor', value)}
                  format="hex"
                />
                <NumberInput
                  label="Glow Spread (px)"
                  description="Radius of the glow effect."
                  value={getAdapterSettingValue('tileGlowSpread')}
                  onChange={(value) => updateSetting('tileGlowSpread', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.tileGlowSpread)}
                  min={2}
                  max={60}
                  step={2}
                />
              </Group>
            )}
          </Stack>}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="thumbnail-strip">
        <Accordion.Control>Thumbnail Strip</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('thumbnail-strip') && <Stack gap="md">
            <Group grow>
              <NumberInput
                label="Video Thumb Width (px)"
                description="Width of video thumbnail items."
                value={getAdapterSettingValue('videoThumbnailWidth')}
                onChange={(value) => updateSetting('videoThumbnailWidth', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoThumbnailWidth)}
                min={30}
                max={200}
                step={5}
              />
              <NumberInput
                label="Video Thumb Height (px)"
                description="Height of video thumbnail items."
                value={getAdapterSettingValue('videoThumbnailHeight')}
                onChange={(value) => updateSetting('videoThumbnailHeight', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoThumbnailHeight)}
                min={30}
                max={200}
                step={5}
              />
            </Group>

            <Group grow>
              <NumberInput
                label="Image Thumb Width (px)"
                description="Width of image thumbnail items."
                value={getAdapterSettingValue('imageThumbnailWidth')}
                onChange={(value) => updateSetting('imageThumbnailWidth', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageThumbnailWidth)}
                min={30}
                max={200}
                step={5}
              />
              <NumberInput
                label="Image Thumb Height (px)"
                description="Height of image thumbnail items."
                value={getAdapterSettingValue('imageThumbnailHeight')}
                onChange={(value) => updateSetting('imageThumbnailHeight', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageThumbnailHeight)}
                min={30}
                max={200}
                step={5}
              />
            </Group>

            <NumberInput
              label="Thumbnail Gap (px)"
              description="Spacing between thumbnail items in the strip."
              value={getAdapterSettingValue('thumbnailGap')}
              onChange={(value) => updateSetting('thumbnailGap', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.thumbnailGap)}
              min={0}
              max={24}
              step={1}
            />

            <Switch
              label="Wheel Scroll"
              description="Allow mouse wheel to scroll the thumbnail strip horizontally."
              checked={getAdapterSettingValue('thumbnailWheelScrollEnabled')}
              onChange={(event) => updateSetting('thumbnailWheelScrollEnabled', event.currentTarget.checked)}
            />

            <Switch
              label="Drag Scroll"
              description="Allow click-and-drag to scroll the thumbnail strip."
              checked={getAdapterSettingValue('thumbnailDragScrollEnabled')}
              onChange={(event) => updateSetting('thumbnailDragScrollEnabled', event.currentTarget.checked)}
            />

            <Switch
              label="Strip Scroll Buttons"
              description="Show left/right scroll buttons on the thumbnail strip edges."
              checked={getAdapterSettingValue('thumbnailScrollButtonsVisible')}
              onChange={(event) => updateSetting('thumbnailScrollButtonsVisible', event.currentTarget.checked)}
            />
          </Stack>}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="transitions">
        <Accordion.Control>Transitions</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('transitions') && <Stack gap="md">
            <Switch
              label="Transition Fade"
              description="Apply an opacity fade when cards enter and exit during transitions, softening abrupt edges."
              checked={getAdapterSettingValue('transitionFadeEnabled')}
              onChange={(event) => updateSetting('transitionFadeEnabled', event.currentTarget.checked)}
            />

            <ModalSelect
              label="Transition Type"
              description="How gallery media slides between items: fade only, slide only, or combined slide-fade."
              value={getAdapterSettingValue('scrollTransitionType')}
              onChange={(value) => updateSetting('scrollTransitionType', (value as ScrollTransitionType) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollTransitionType)}
              data={[
                { value: 'slide-fade', label: 'Slide + Fade' },
                { value: 'slide', label: 'Slide' },
                { value: 'fade', label: 'Fade' },
              ]}
            />

            <ModalSelect
              label="Scroll Animation Style"
              description="Navigation scroll behavior for gallery thumbnail strips."
              value={getAdapterSettingValue('scrollAnimationStyle')}
              onChange={(value) => updateSetting('scrollAnimationStyle', (value as ScrollAnimationStyle) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationStyle)}
              data={[
                { value: 'smooth', label: 'Smooth' },
                { value: 'instant', label: 'Instant' },
              ]}
            />

            <NumberInput
              label="Animation Duration (ms)"
              description="Duration for gallery transition and thumbnail highlight animations."
              value={getAdapterSettingValue('scrollAnimationDurationMs')}
              onChange={(value) => updateSetting('scrollAnimationDurationMs', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationDurationMs)}
              min={0}
              max={2000}
              step={10}
            />

            <ModalSelect
              label="Animation Easing"
              description="Timing function used for gallery transitions."
              value={getAdapterSettingValue('scrollAnimationEasing')}
              onChange={(value) => updateSetting('scrollAnimationEasing', (value as ScrollAnimationEasing) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationEasing)}
              data={[
                { value: 'ease', label: 'Ease' },
                { value: 'linear', label: 'Linear' },
                { value: 'ease-in', label: 'Ease In' },
                { value: 'ease-out', label: 'Ease Out' },
                { value: 'ease-in-out', label: 'Ease In Out' },
              ]}
            />
          </Stack>}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="navigation">
        <Accordion.Control>Navigation</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('navigation') && <Stack gap="md">
            <NumberInput
              label="Thumbnail Scroll Speed"
              description="Multiplier for thumbnail-strip wheel scroll speed."
              value={getAdapterSettingValue('thumbnailScrollSpeed')}
              onChange={(value) => updateSetting('thumbnailScrollSpeed', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.thumbnailScrollSpeed)}
              min={0.25}
              max={3}
              step={0.25}
              decimalScale={2}
            />

            <Divider label="Overlay Arrows" labelPosition="center" />

            <ModalSelect
              label="Arrow Vertical Position"
              description="Vertical alignment of the overlay prev/next arrows."
              value={getAdapterSettingValue('navArrowPosition')}
              onChange={(value) => updateSetting('navArrowPosition', (value as NavArrowPosition) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowPosition)}
              data={[
                { value: 'top', label: 'Top' },
                { value: 'center', label: 'Center' },
                { value: 'bottom', label: 'Bottom' },
              ]}
            />

            <NumberInput
              label="Arrow Size (px)"
              description="Diameter of the overlay navigation arrows."
              value={getAdapterSettingValue('navArrowSize')}
              onChange={(value) => updateSetting('navArrowSize', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowSize)}
              min={20}
              max={64}
              step={2}
            />

            <ColorInput
              label="Arrow Color"
              description="Icon color for the overlay arrows."
              value={getAdapterSettingValue('navArrowColor')}
              onChange={(value) => updateSetting('navArrowColor', value)}
              format="hex"
            />

            <TextInput
              label="Arrow Background Color"
              description="Background color (supports rgba for transparency)."
              value={getAdapterSettingValue('navArrowBgColor')}
              onChange={(event) => updateSetting('navArrowBgColor', event.currentTarget.value)}
            />

            <NumberInput
              label="Arrow Border Width (px)"
              description="Border thickness around the arrows (0 = none)."
              value={getAdapterSettingValue('navArrowBorderWidth')}
              onChange={(value) => updateSetting('navArrowBorderWidth', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowBorderWidth)}
              min={0}
              max={6}
              step={1}
            />

            <Text size="sm" fw={500}>Hover Scale Factor</Text>
            <Slider
              value={getAdapterSettingValue('navArrowHoverScale')}
              onChange={(value) => updateSetting('navArrowHoverScale', value)}
              min={1}
              max={1.5}
              step={0.05}
              marks={[
                { value: 1, label: '1×' },
                { value: 1.25, label: '1.25×' },
                { value: 1.5, label: '1.5×' },
              ]}
            />

            <NumberInput
              label="Auto-hide Delay (ms)"
              description="Show arrows on hover/interaction. 0 = always visible."
              value={getAdapterSettingValue('navArrowAutoHideMs')}
              onChange={(value) => updateSetting('navArrowAutoHideMs', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowAutoHideMs)}
              min={0}
              max={10000}
              step={500}
            />

            <Divider label="Dot Navigator" labelPosition="center" />

            <Switch
              label="Enable Dot Navigator"
              description="Show a dot-style page indicator."
              checked={getAdapterSettingValue('dotNavEnabled')}
              onChange={(event) => updateSetting('dotNavEnabled', event.currentTarget.checked)}
            />

            {getAdapterSettingValue('dotNavEnabled') && (
              <>
                <ModalSelect
                  label="Dot Position"
                  description="Where to render the dot navigator relative to the viewport."
                  value={getAdapterSettingValue('dotNavPosition')}
                  onChange={(value) => updateSetting('dotNavPosition', (value as DotNavPosition) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavPosition)}
                  data={[
                    { value: 'below', label: 'Below Viewport' },
                    { value: 'overlay-bottom', label: 'Overlay Bottom' },
                    { value: 'overlay-top', label: 'Overlay Top' },
                  ]}
                />

                <NumberInput
                  label="Dot Size (px)"
                  description="Diameter of each dot."
                  value={getAdapterSettingValue('dotNavSize')}
                  onChange={(value) => updateSetting('dotNavSize', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavSize)}
                  min={4}
                  max={24}
                  step={1}
                />

                <ModalSelect
                  label="Dot Shape"
                  description="Shape of the navigation dots."
                  value={getAdapterSettingValue('dotNavShape')}
                  onChange={(value) => updateSetting('dotNavShape', (value as DotNavShape) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavShape)}
                  data={[
                    { value: 'circle', label: 'Circle' },
                    { value: 'pill', label: 'Pill' },
                    { value: 'square', label: 'Square' },
                  ]}
                />

                <TextInput
                  label="Active Dot Color"
                  description="Color for the currently active dot (CSS value)."
                  value={getAdapterSettingValue('dotNavActiveColor')}
                  onChange={(event) => updateSetting('dotNavActiveColor', event.currentTarget.value)}
                />

                <TextInput
                  label="Inactive Dot Color"
                  description="Color for inactive dots (CSS value)."
                  value={getAdapterSettingValue('dotNavInactiveColor')}
                  onChange={(event) => updateSetting('dotNavInactiveColor', event.currentTarget.value)}
                />

                <NumberInput
                  label="Dot Spacing (px)"
                  description="Gap between dots."
                  value={getAdapterSettingValue('dotNavSpacing')}
                  onChange={(value) => updateSetting('dotNavSpacing', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavSpacing)}
                  min={2}
                  max={20}
                  step={1}
                />

                <Text size="sm" fw={500}>Active Dot Scale</Text>
                <Slider
                  value={getAdapterSettingValue('dotNavActiveScale')}
                  onChange={(value) => updateSetting('dotNavActiveScale', value)}
                  min={1}
                  max={2}
                  step={0.1}
                  marks={[
                    { value: 1, label: '1×' },
                    { value: 1.5, label: '1.5×' },
                    { value: 2, label: '2×' },
                  ]}
                />
              </>
            )}
          </Stack>}
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}