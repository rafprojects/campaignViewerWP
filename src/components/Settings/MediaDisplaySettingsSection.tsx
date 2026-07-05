import type { ReactNode } from 'react';

import { Accordion, Divider, Group, NumberInput, Slider, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import { usePersistentAccordion } from '@/hooks/usePersistentAccordion';
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
import { CSS_BORDER_RADIUS_UNITS, CSS_SPACING_UNITS } from '@wp-super-gallery/shared-utils';
import {
  collectGalleryAdapterSettingValues,
  getRepresentativeGalleryCommonSetting,
  resolveGalleryConfig,
  setRepresentativeGalleryCommonSetting,
  setGalleryAdapterSetting,
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

// Shared helpers used by both sub-components.
function useAdapterHelpers(
  settings: MediaDisplaySettingsData,
  updateSetting: MediaDisplaySettingsSectionProps['updateSetting'],
) {
  const resolvedGalleryConfig = resolveGalleryConfig(settings);
  const resolvedAdapterSettings = collectGalleryAdapterSettingValues(resolvedGalleryConfig);
  const gallerySizingMode = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'gallerySizingMode') as GalleryBehaviorSettings['gallerySizingMode'] | undefined;
  const galleryManualHeight = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'galleryManualHeight') as string | undefined;

  const getAdapterSettingValue = <K extends keyof GalleryBehaviorSettings>(key: K): MediaDisplaySettingsData[K] => (
    (resolvedAdapterSettings[key] as MediaDisplaySettingsData[K] | undefined) ?? settings[key]
  );

  const updateAdapterSetting = <K extends keyof GalleryBehaviorSettings>(key: K, value: MediaDisplaySettingsData[K]) => {
    updateSetting('galleryConfig', setGalleryAdapterSetting(resolvedGalleryConfig, key, value));
  };

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

  return { gallerySizingMode, galleryManualHeight, getAdapterSettingValue, updateAdapterSetting, updateViewerCommonSetting };
}

/** Accordion items: Viewport & Layout, Tile Appearance, Transitions. */
export function GalleryStyleAccordion({ settings, updateSetting, tooltipLabel }: MediaDisplaySettingsSectionProps) {
  const { t } = useTranslation('wpsg');
  const { mounted, value, onChange } = usePersistentAccordion('gallery-style', 'viewport');
  const { gallerySizingMode, galleryManualHeight, getAdapterSettingValue, updateAdapterSetting, updateViewerCommonSetting } =
    useAdapterHelpers(settings, updateSetting);

  return (
    <Accordion variant="separated" value={value} onChange={onChange}>
      <Accordion.Item value="viewport">
        <Accordion.Control>{t('set_md_viewport_title', 'Viewport & Layout')}</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <Switch
              label={t('set_md_lightbox_label', 'Enable Lightbox')}
              description={t('set_md_lightbox_desc', 'Enable fullscreen lightbox when clicking gallery items.')}
              checked={settings.enableLightbox}
              onChange={(event) => updateSetting('enableLightbox', event.currentTarget.checked)}
            />

            <Switch
              label={t('set_md_animations_label', 'Enable Animations')}
              description={t('set_md_animations_desc', 'Enable smooth animations and transitions. Disable for better performance on low-end devices.')}
              checked={settings.enableAnimations}
              onChange={(event) => updateSetting('enableAnimations', event.currentTarget.checked)}
            />

            <Divider label={t('set_md_viewport_dimensions', 'Viewport Dimensions')} labelPosition="center" />

            <ModalSelect
              label={tooltipLabel(t('set_md_height_constraint_label', 'Height Constraint'), 'gallerySizingMode')}
              description={t('set_md_height_constraint_desc', 'Choose whether classic galleries can overflow, are kept within the visible screen, or use a manual CSS height.')}
              data={[
                { value: 'auto', label: t('set_md_sizing_auto', 'No restraint') },
                { value: 'viewport', label: t('set_md_sizing_viewport', 'Restrain to view') },
                { value: 'manual', label: t('set_md_sizing_manual', 'Manually control height') },
              ]}
              value={gallerySizingMode ?? 'auto'}
              onChange={(value) => updateViewerCommonSetting('gallerySizingMode', (value ?? 'auto') as GalleryBehaviorSettings['gallerySizingMode'])}
            />

            {gallerySizingMode === 'manual' && (
              <TextInput
                label={tooltipLabel(t('set_md_manual_height_label', 'Manual Gallery Height'), 'galleryManualHeight')}
                description={t('set_md_manual_height_desc', 'Accepted units: px, em, rem, vh, dvh, vw, %. Example: 75vh or 420px')}
                value={galleryManualHeight ?? ''}
                onChange={(event) => updateViewerCommonSetting('galleryManualHeight', event.currentTarget.value)}
                placeholder="420px"
              />
            )}

            <Divider label={t('set_md_border_radius_divider', 'Border Radius')} labelPosition="center" />

            <DimensionInput
              label={t('set_md_image_radius_label', 'Image Border Radius')}
              description={t('set_md_image_radius_desc', 'Corner rounding for image gallery viewport and thumbnails.')}
              value={getAdapterSettingValue('imageBorderRadius')}
              unit={getAdapterSettingValue('imageBorderRadiusUnit') ?? 'px'}
              onValueChange={(value) => updateAdapterSetting('imageBorderRadius', value)}
              onUnitChange={(unit) => updateAdapterSetting('imageBorderRadiusUnit', unit as GalleryBehaviorSettings['imageBorderRadiusUnit'])}
              allowedUnits={CSS_BORDER_RADIUS_UNITS}
              max={48}
              step={1}
            />

            <DimensionInput
              label={t('set_md_video_radius_label', 'Video Border Radius')}
              description={t('set_md_video_radius_desc', 'Corner rounding for video gallery viewport and thumbnails.')}
              value={getAdapterSettingValue('videoBorderRadius')}
              unit={getAdapterSettingValue('videoBorderRadiusUnit') ?? 'px'}
              onValueChange={(value) => updateAdapterSetting('videoBorderRadius', value)}
              onUnitChange={(unit) => updateAdapterSetting('videoBorderRadiusUnit', unit as GalleryBehaviorSettings['videoBorderRadiusUnit'])}
              allowedUnits={CSS_BORDER_RADIUS_UNITS}
              max={48}
              step={1}
            />

            <Divider label={t('set_md_shadow_divider', 'Shadow & Depth')} labelPosition="center" />

            <ModalSelect
              label={t('set_md_image_shadow_label', 'Image Shadow Preset')}
              description={t('set_md_image_shadow_desc', 'Box-shadow depth effect for image gallery viewport.')}
              value={getAdapterSettingValue('imageShadowPreset')}
              onChange={(value) => updateAdapterSetting('imageShadowPreset', (value as ShadowPreset) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageShadowPreset)}
              data={[
                { value: 'none', label: t('set_md_shadow_none', 'None') },
                { value: 'subtle', label: t('set_md_shadow_subtle', 'Subtle') },
                { value: 'medium', label: t('set_md_shadow_medium', 'Medium') },
                { value: 'strong', label: t('set_md_shadow_strong', 'Strong') },
                { value: 'custom', label: t('set_md_shadow_custom', 'Custom') },
              ]}
            />

            {getAdapterSettingValue('imageShadowPreset') === 'custom' && (
              <TextInput
                label={t('set_md_image_custom_shadow_label', 'Image Custom Shadow')}
                description={t('set_md_custom_shadow_desc', "CSS box-shadow value (e.g. '0 4px 16px rgba(0,0,0,0.25)').")}
                value={getAdapterSettingValue('imageShadowCustom')}
                onChange={(event) => updateAdapterSetting('imageShadowCustom', event.currentTarget.value)}
              />
            )}

            <ModalSelect
              label={t('set_md_video_shadow_label', 'Video Shadow Preset')}
              description={t('set_md_video_shadow_desc', 'Box-shadow depth effect for video gallery viewport.')}
              value={getAdapterSettingValue('videoShadowPreset')}
              onChange={(value) => updateAdapterSetting('videoShadowPreset', (value as ShadowPreset) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoShadowPreset)}
              data={[
                { value: 'none', label: t('set_md_shadow_none', 'None') },
                { value: 'subtle', label: t('set_md_shadow_subtle', 'Subtle') },
                { value: 'medium', label: t('set_md_shadow_medium', 'Medium') },
                { value: 'strong', label: t('set_md_shadow_strong', 'Strong') },
                { value: 'custom', label: t('set_md_shadow_custom', 'Custom') },
              ]}
            />

            {getAdapterSettingValue('videoShadowPreset') === 'custom' && (
              <TextInput
                label={t('set_md_video_custom_shadow_label', 'Video Custom Shadow')}
                description={t('set_md_custom_shadow_desc', "CSS box-shadow value (e.g. '0 4px 16px rgba(0,0,0,0.25)').")}
                value={getAdapterSettingValue('videoShadowCustom')}
                onChange={(event) => updateAdapterSetting('videoShadowCustom', event.currentTarget.value)}
              />
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="tile-appearance">
        <Accordion.Control>{t('set_md_tile_title', 'Tile Appearance')}</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('tile-appearance') && <Stack gap="md">
            <Group grow>
              <DimensionInput
                label={t('set_md_gap_x_label', 'Gap X')}
                description={t('set_md_gap_x_desc', 'Horizontal gap between tiles.')}
                value={getAdapterSettingValue('tileGapX')}
                unit={getAdapterSettingValue('tileGapXUnit') ?? 'px'}
                onValueChange={(value) => updateAdapterSetting('tileGapX', value)}
                onUnitChange={(unit) => updateAdapterSetting('tileGapXUnit', unit as GalleryBehaviorSettings['tileGapXUnit'])}
                allowedUnits={CSS_SPACING_UNITS}
                max={60}
                step={1}
              />
              <DimensionInput
                label={t('set_md_gap_y_label', 'Gap Y')}
                description={t('set_md_gap_y_desc', 'Vertical gap between tile rows.')}
                value={getAdapterSettingValue('tileGapY')}
                unit={getAdapterSettingValue('tileGapYUnit') ?? 'px'}
                onValueChange={(value) => updateAdapterSetting('tileGapY', value)}
                onUnitChange={(unit) => updateAdapterSetting('tileGapYUnit', unit as GalleryBehaviorSettings['tileGapYUnit'])}
                allowedUnits={CSS_SPACING_UNITS}
                max={60}
                step={1}
              />
            </Group>

            <Group grow>
              <NumberInput
                label={t('set_md_border_width_label', 'Border Width (px)')}
                description={t('set_md_border_width_desc', 'Tile border thickness. 0 = no border.')}
                value={getAdapterSettingValue('tileBorderWidth')}
                onChange={(value) => updateAdapterSetting('tileBorderWidth', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.tileBorderWidth)}
                min={0}
                max={20}
                step={1}
              />
              {getAdapterSettingValue('tileBorderWidth') > 0 && (
                <ColorInput
                  label={t('set_md_border_color_label', 'Border Color')}
                  value={getAdapterSettingValue('tileBorderColor')}
                  onChange={(value) => updateAdapterSetting('tileBorderColor', value)}
                  format="hex"
                />
              )}
            </Group>

            <Switch
              label={t('set_md_hover_bounce_label', 'Hover Bounce')}
              description={t('set_md_hover_bounce_desc', 'Scale-up spring animation when hovering over a tile.')}
              checked={getAdapterSettingValue('tileHoverBounce')}
              onChange={(event) => updateAdapterSetting('tileHoverBounce', event.currentTarget.checked)}
            />

            <Switch
              label={t('set_md_hover_glow_label', 'Hover Glow')}
              description={t('set_md_hover_glow_desc', 'Drop-shadow glow on hover (works with clip-path shapes).')}
              checked={getAdapterSettingValue('tileGlowEnabled')}
              onChange={(event) => updateAdapterSetting('tileGlowEnabled', event.currentTarget.checked)}
            />
            {getAdapterSettingValue('tileGlowEnabled') && (
              <Group grow>
                <ColorInput
                  label={t('set_md_glow_color_label', 'Glow Color')}
                  value={getAdapterSettingValue('tileGlowColor')}
                  onChange={(value) => updateAdapterSetting('tileGlowColor', value)}
                  format="hex"
                />
                <NumberInput
                  label={t('set_md_glow_spread_label', 'Glow Spread (px)')}
                  description={t('set_md_glow_spread_desc', 'Radius of the glow effect.')}
                  value={getAdapterSettingValue('tileGlowSpread')}
                  onChange={(value) => updateAdapterSetting('tileGlowSpread', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.tileGlowSpread)}
                  min={2}
                  max={60}
                  step={2}
                />
              </Group>
            )}
          </Stack>}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="transitions">
        <Accordion.Control>{t('set_md_transitions_title', 'Transitions')}</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('transitions') && <Stack gap="md">
            <Switch
              label={t('set_md_transition_fade_label', 'Transition Fade')}
              description={t('set_md_transition_fade_desc', 'Apply an opacity fade when cards enter and exit during transitions, softening abrupt edges.')}
              checked={getAdapterSettingValue('transitionFadeEnabled')}
              onChange={(event) => updateAdapterSetting('transitionFadeEnabled', event.currentTarget.checked)}
            />

            <ModalSelect
              label={t('set_md_transition_type_label', 'Transition Type')}
              description={t('set_md_transition_type_desc', 'How gallery media slides between items: fade only, slide only, or combined slide-fade.')}
              value={getAdapterSettingValue('scrollTransitionType')}
              onChange={(value) => updateAdapterSetting('scrollTransitionType', (value as ScrollTransitionType) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollTransitionType)}
              data={[
                { value: 'slide-fade', label: t('set_md_transition_slidefade', 'Slide + Fade') },
                { value: 'slide', label: t('set_md_transition_slide', 'Slide') },
                { value: 'fade', label: t('set_md_transition_fade_opt', 'Fade') },
              ]}
            />

            <ModalSelect
              label={t('set_md_scroll_style_label', 'Scroll Animation Style')}
              description={t('set_md_scroll_style_desc', 'Navigation scroll behavior for gallery thumbnail strips.')}
              value={getAdapterSettingValue('scrollAnimationStyle')}
              onChange={(value) => updateAdapterSetting('scrollAnimationStyle', (value as ScrollAnimationStyle) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationStyle)}
              data={[
                { value: 'smooth', label: t('set_md_scroll_smooth', 'Smooth') },
                { value: 'instant', label: t('set_md_scroll_instant', 'Instant') },
              ]}
            />

            <NumberInput
              label={t('set_md_anim_duration_label', 'Animation Duration (ms)')}
              description={t('set_md_anim_duration_desc', 'Duration for gallery transition and thumbnail highlight animations.')}
              value={getAdapterSettingValue('scrollAnimationDurationMs')}
              onChange={(value) => updateAdapterSetting('scrollAnimationDurationMs', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationDurationMs)}
              min={0}
              max={2000}
              step={10}
            />

            <ModalSelect
              label={t('set_md_anim_easing_label', 'Animation Easing')}
              description={t('set_md_anim_easing_desc', 'Timing function used for gallery transitions.')}
              value={getAdapterSettingValue('scrollAnimationEasing')}
              onChange={(value) => updateAdapterSetting('scrollAnimationEasing', (value as ScrollAnimationEasing) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationEasing)}
              data={[
                { value: 'ease', label: t('set_md_easing_ease', 'Ease') },
                { value: 'linear', label: t('set_md_easing_linear', 'Linear') },
                { value: 'ease-in', label: t('set_md_easing_ease_in', 'Ease In') },
                { value: 'ease-out', label: t('set_md_easing_ease_out', 'Ease Out') },
                { value: 'ease-in-out', label: t('set_md_easing_ease_in_out', 'Ease In Out') },
              ]}
            />
          </Stack>}
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

/** Accordion items: Navigation (arrows, dots), Thumbnail Strip. */
export function GalleryNavigationAccordion({ settings, updateSetting, tooltipLabel: _tooltipLabel }: MediaDisplaySettingsSectionProps) {
  const { t } = useTranslation('wpsg');
  const { mounted, value, onChange } = usePersistentAccordion('gallery-navigation', 'navigation');
  const { getAdapterSettingValue, updateAdapterSetting } = useAdapterHelpers(settings, updateSetting);

  return (
    <Accordion variant="separated" value={value} onChange={onChange}>
      <Accordion.Item value="thumbnail-strip">
        <Accordion.Control>{t('set_md_thumb_strip_title', 'Thumbnail Strip')}</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('thumbnail-strip') && <Stack gap="md">
            <Group grow>
              <NumberInput
                label={t('set_md_video_thumb_w_label', 'Video Thumb Width (px)')}
                description={t('set_md_video_thumb_w_desc', 'Width of video thumbnail items.')}
                value={getAdapterSettingValue('videoThumbnailWidth')}
                onChange={(value) => updateAdapterSetting('videoThumbnailWidth', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoThumbnailWidth)}
                min={30}
                max={200}
                step={5}
              />
              <NumberInput
                label={t('set_md_video_thumb_h_label', 'Video Thumb Height (px)')}
                description={t('set_md_video_thumb_h_desc', 'Height of video thumbnail items.')}
                value={getAdapterSettingValue('videoThumbnailHeight')}
                onChange={(value) => updateAdapterSetting('videoThumbnailHeight', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoThumbnailHeight)}
                min={30}
                max={200}
                step={5}
              />
            </Group>

            <Group grow>
              <NumberInput
                label={t('set_md_image_thumb_w_label', 'Image Thumb Width (px)')}
                description={t('set_md_image_thumb_w_desc', 'Width of image thumbnail items.')}
                value={getAdapterSettingValue('imageThumbnailWidth')}
                onChange={(value) => updateAdapterSetting('imageThumbnailWidth', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageThumbnailWidth)}
                min={30}
                max={200}
                step={5}
              />
              <NumberInput
                label={t('set_md_image_thumb_h_label', 'Image Thumb Height (px)')}
                description={t('set_md_image_thumb_h_desc', 'Height of image thumbnail items.')}
                value={getAdapterSettingValue('imageThumbnailHeight')}
                onChange={(value) => updateAdapterSetting('imageThumbnailHeight', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageThumbnailHeight)}
                min={30}
                max={200}
                step={5}
              />
            </Group>

            <NumberInput
              label={t('set_md_thumb_gap_label', 'Thumbnail Gap (px)')}
              description={t('set_md_thumb_gap_desc', 'Spacing between thumbnail items in the strip.')}
              value={getAdapterSettingValue('thumbnailGap')}
              onChange={(value) => updateAdapterSetting('thumbnailGap', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.thumbnailGap)}
              min={0}
              max={24}
              step={1}
            />

            <Switch
              label={t('set_md_wheel_scroll_label', 'Wheel Scroll')}
              description={t('set_md_wheel_scroll_desc', 'Allow mouse wheel to scroll the thumbnail strip horizontally.')}
              checked={getAdapterSettingValue('thumbnailWheelScrollEnabled')}
              onChange={(event) => updateAdapterSetting('thumbnailWheelScrollEnabled', event.currentTarget.checked)}
            />

            <Switch
              label={t('set_md_drag_scroll_label', 'Drag Scroll')}
              description={t('set_md_drag_scroll_desc', 'Allow click-and-drag to scroll the thumbnail strip.')}
              checked={getAdapterSettingValue('thumbnailDragScrollEnabled')}
              onChange={(event) => updateAdapterSetting('thumbnailDragScrollEnabled', event.currentTarget.checked)}
            />

            <Switch
              label={t('set_md_strip_buttons_label', 'Strip Scroll Buttons')}
              description={t('set_md_strip_buttons_desc', 'Show left/right scroll buttons on the thumbnail strip edges.')}
              checked={getAdapterSettingValue('thumbnailScrollButtonsVisible')}
              onChange={(event) => updateAdapterSetting('thumbnailScrollButtonsVisible', event.currentTarget.checked)}
            />
          </Stack>}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="navigation">
        <Accordion.Control>{t('set_md_navigation_title', 'Navigation')}</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('navigation') && <Stack gap="md">
            <NumberInput
              label={t('set_md_thumb_scroll_speed_label', 'Thumbnail Scroll Speed')}
              description={t('set_md_thumb_scroll_speed_desc', 'Multiplier for thumbnail-strip wheel scroll speed.')}
              value={getAdapterSettingValue('thumbnailScrollSpeed')}
              onChange={(value) => updateAdapterSetting('thumbnailScrollSpeed', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.thumbnailScrollSpeed)}
              min={0.25}
              max={3}
              step={0.25}
              decimalScale={2}
            />

            <Divider label={t('set_md_overlay_arrows_divider', 'Overlay Arrows')} labelPosition="center" />

            <ModalSelect
              label={t('set_md_arrow_vpos_label', 'Arrow Vertical Position')}
              description={t('set_md_arrow_vpos_desc', 'Vertical alignment of the overlay prev/next arrows.')}
              value={getAdapterSettingValue('navArrowPosition')}
              onChange={(value) => updateAdapterSetting('navArrowPosition', (value as NavArrowPosition) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowPosition)}
              data={[
                { value: 'top', label: t('set_md_arrow_top', 'Top') },
                { value: 'center', label: t('set_md_arrow_center', 'Center') },
                { value: 'bottom', label: t('set_md_arrow_bottom', 'Bottom') },
              ]}
            />

            <NumberInput
              label={t('set_md_arrow_size_label', 'Arrow Size (px)')}
              description={t('set_md_arrow_size_desc', 'Diameter of the overlay navigation arrows.')}
              value={getAdapterSettingValue('navArrowSize')}
              onChange={(value) => updateAdapterSetting('navArrowSize', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowSize)}
              min={20}
              max={64}
              step={2}
            />

            <ColorInput
              label={t('set_md_arrow_color_label', 'Arrow Color')}
              description={t('set_md_arrow_color_desc', 'Icon color for the overlay arrows.')}
              value={getAdapterSettingValue('navArrowColor')}
              onChange={(value) => updateAdapterSetting('navArrowColor', value)}
              format="hex"
            />

            <TextInput
              label={t('set_md_arrow_bg_label', 'Arrow Background Color')}
              description={t('set_md_arrow_bg_desc', 'Background color (supports rgba for transparency).')}
              value={getAdapterSettingValue('navArrowBgColor')}
              onChange={(event) => updateAdapterSetting('navArrowBgColor', event.currentTarget.value)}
            />

            <NumberInput
              label={t('set_md_arrow_border_label', 'Arrow Border Width (px)')}
              description={t('set_md_arrow_border_desc', 'Border thickness around the arrows (0 = none).')}
              value={getAdapterSettingValue('navArrowBorderWidth')}
              onChange={(value) => updateAdapterSetting('navArrowBorderWidth', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowBorderWidth)}
              min={0}
              max={6}
              step={1}
            />

            <Text size="sm" fw={500}>{t('set_md_arrow_hover_scale', 'Hover Scale Factor')}</Text>
            <Slider
              value={getAdapterSettingValue('navArrowHoverScale')}
              onChange={(value) => updateAdapterSetting('navArrowHoverScale', value)}
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
              label={t('set_md_arrow_autohide_label', 'Auto-hide Delay (ms)')}
              description={t('set_md_arrow_autohide_desc', 'Show arrows on hover/interaction. 0 = always visible.')}
              value={getAdapterSettingValue('navArrowAutoHideMs')}
              onChange={(value) => updateAdapterSetting('navArrowAutoHideMs', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowAutoHideMs)}
              min={0}
              max={10000}
              step={500}
            />

            <Divider label={t('set_md_dot_nav_divider', 'Dot Navigator')} labelPosition="center" />

            <Switch
              label={t('set_md_dot_enable_label', 'Enable Dot Navigator')}
              description={t('set_md_dot_enable_desc', 'Show a dot-style page indicator.')}
              checked={getAdapterSettingValue('dotNavEnabled')}
              onChange={(event) => updateAdapterSetting('dotNavEnabled', event.currentTarget.checked)}
            />

            {getAdapterSettingValue('dotNavEnabled') && (
              <>
                <ModalSelect
                  label={t('set_md_dot_position_label', 'Dot Position')}
                  description={t('set_md_dot_position_desc', 'Where to render the dot navigator relative to the viewport.')}
                  value={getAdapterSettingValue('dotNavPosition')}
                  onChange={(value) => updateAdapterSetting('dotNavPosition', (value as DotNavPosition) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavPosition)}
                  data={[
                    { value: 'below', label: t('set_md_dot_pos_below', 'Below Viewport') },
                    { value: 'overlay-bottom', label: t('set_md_dot_pos_overlay_bottom', 'Overlay Bottom') },
                    { value: 'overlay-top', label: t('set_md_dot_pos_overlay_top', 'Overlay Top') },
                  ]}
                />

                <NumberInput
                  label={t('set_md_dot_size_label', 'Dot Size (px)')}
                  description={t('set_md_dot_size_desc', 'Diameter of each dot.')}
                  value={getAdapterSettingValue('dotNavSize')}
                  onChange={(value) => updateAdapterSetting('dotNavSize', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavSize)}
                  min={4}
                  max={24}
                  step={1}
                />

                <ModalSelect
                  label={t('set_md_dot_shape_label', 'Dot Shape')}
                  description={t('set_md_dot_shape_desc', 'Shape of the navigation dots.')}
                  value={getAdapterSettingValue('dotNavShape')}
                  onChange={(value) => updateAdapterSetting('dotNavShape', (value as DotNavShape) ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavShape)}
                  data={[
                    { value: 'circle', label: t('set_md_dot_circle', 'Circle') },
                    { value: 'pill', label: t('set_md_dot_pill', 'Pill') },
                    { value: 'square', label: t('set_md_dot_square', 'Square') },
                  ]}
                />

                <TextInput
                  label={t('set_md_dot_active_color_label', 'Active Dot Color')}
                  description={t('set_md_dot_active_color_desc', 'Color for the currently active dot (CSS value).')}
                  value={getAdapterSettingValue('dotNavActiveColor')}
                  onChange={(event) => updateAdapterSetting('dotNavActiveColor', event.currentTarget.value)}
                />

                <TextInput
                  label={t('set_md_dot_inactive_color_label', 'Inactive Dot Color')}
                  description={t('set_md_dot_inactive_color_desc', 'Color for inactive dots (CSS value).')}
                  value={getAdapterSettingValue('dotNavInactiveColor')}
                  onChange={(event) => updateAdapterSetting('dotNavInactiveColor', event.currentTarget.value)}
                />

                <NumberInput
                  label={t('set_md_dot_spacing_label', 'Dot Spacing (px)')}
                  description={t('set_md_dot_spacing_desc', 'Gap between dots.')}
                  value={getAdapterSettingValue('dotNavSpacing')}
                  onChange={(value) => updateAdapterSetting('dotNavSpacing', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavSpacing)}
                  min={2}
                  max={20}
                  step={1}
                />

                <Text size="sm" fw={500}>{t('set_md_dot_active_scale', 'Active Dot Scale')}</Text>
                <Slider
                  value={getAdapterSettingValue('dotNavActiveScale')}
                  onChange={(value) => updateAdapterSetting('dotNavActiveScale', value)}
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

/** @deprecated Use GalleryStyleAccordion and GalleryNavigationAccordion directly. */
export function MediaDisplaySettingsSection(props: MediaDisplaySettingsSectionProps) {
  return (
    <>
      <GalleryStyleAccordion {...props} />
      <GalleryNavigationAccordion {...props} />
    </>
  );
}
