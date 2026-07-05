import { Accordion, Divider, NumberInput, Stack, Switch } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { DimensionInput } from '@/components/Settings/DimensionInput';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings, type GalleryCommonSettings } from '@/types';
import { CSS_HEIGHT_UNITS, CSS_OFFSET_UNITS, CSS_SPACING_UNITS, CSS_WIDTH_UNITS } from '@wp-super-gallery/shared-utils';
import { anyAdapterUsesSettingGroup } from '@/components/Galleries/Adapters/adapterRegistry';
import {
  collectGalleryAdapterSettingValues,
  getActiveGalleryConfigAdapterIds,
  getRepresentativeGalleryCommonSetting,
  resolveGalleryConfig,
  setRepresentativeGalleryCommonSetting,
  setGalleryAdapterSetting,
} from '@/utils/galleryConfig';
import type { UpdateGallerySetting } from './GalleryAdapterSettingsSection';

interface GalleryLayoutDetailSectionsProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
  mountedPanels?: Set<string>;
}

function usesCarouselSettings(settings: GalleryBehaviorSettings): boolean {
  return anyAdapterUsesSettingGroup(getActiveGalleryConfigAdapterIds(resolveGalleryConfig(settings)), 'carousel');
}

export function GalleryLayoutDetailSections({ settings, updateSetting, mountedPanels }: GalleryLayoutDetailSectionsProps) {
  const { t } = useTranslation('wpsg');
  const resolvedGalleryConfig = resolveGalleryConfig(settings);
  const resolvedAdapterSettings = collectGalleryAdapterSettingValues(resolvedGalleryConfig);
  const showCarouselSettings = usesCarouselSettings(settings);

  const updateRepresentativeCommonSetting = (
    key: Exclude<keyof GalleryCommonSettings, 'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl'>,
    value: string | number | boolean | undefined,
  ) => {
    updateSetting('galleryConfig', setRepresentativeGalleryCommonSetting(
      resolvedGalleryConfig,
      key,
      value as GalleryCommonSettings[typeof key],
    ));
  };

  const getAdapterSettingValue = <K extends keyof GalleryBehaviorSettings>(key: K): GalleryBehaviorSettings[K] => (
    (resolvedAdapterSettings[key] as GalleryBehaviorSettings[K] | undefined) ?? settings[key]
  );

  const updateAdapterSetting = <K extends keyof GalleryBehaviorSettings>(key: K, value: GalleryBehaviorSettings[K]) => {
    updateSetting('galleryConfig', setGalleryAdapterSetting(resolvedGalleryConfig, key, value));
  };

  const gallerySectionMaxWidth = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'sectionMaxWidth') as number | undefined;
  const gallerySectionMaxWidthUnit = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'sectionMaxWidthUnit') as GalleryBehaviorSettings['gallerySectionMaxWidthUnit'] | undefined;
  const gallerySectionMinWidth = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'sectionMinWidth') as number | undefined;
  const gallerySectionMinWidthUnit = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'sectionMinWidthUnit') as GalleryBehaviorSettings['gallerySectionMinWidthUnit'] | undefined;
  const gallerySectionHeightMode = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'sectionHeightMode') as GalleryBehaviorSettings['gallerySectionHeightMode'] | undefined;
  const gallerySectionMaxHeight = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'sectionMaxHeight') as number | undefined;
  const gallerySectionMaxHeightUnit = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'sectionMaxHeightUnit') as GalleryBehaviorSettings['gallerySectionMaxHeightUnit'] | undefined;
  const gallerySectionMinHeight = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'sectionMinHeight') as number | undefined;
  const gallerySectionMinHeightUnit = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'sectionMinHeightUnit') as GalleryBehaviorSettings['gallerySectionMinHeightUnit'] | undefined;
  const perTypeSectionEqualHeight = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'perTypeSectionEqualHeight') as boolean | undefined;
  const gallerySectionPadding = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'sectionPadding') as number | undefined;
  const gallerySectionPaddingUnit = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'sectionPaddingUnit') as GalleryBehaviorSettings['gallerySectionPaddingUnit'] | undefined;
  const adapterContentPadding = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'adapterContentPadding') as number | undefined;
  const adapterContentPaddingUnit = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'adapterContentPaddingUnit') as GalleryBehaviorSettings['adapterContentPaddingUnit'] | undefined;
  const adapterSizingMode = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'adapterSizingMode') as GalleryBehaviorSettings['adapterSizingMode'] | undefined;
  const adapterMaxWidthPct = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'adapterMaxWidthPct') as number | undefined;
  const adapterMaxHeightPct = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'adapterMaxHeightPct') as number | undefined;
  const adapterItemGap = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'adapterItemGap') as number | undefined;
  const adapterItemGapUnit = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'adapterItemGapUnit') as GalleryBehaviorSettings['adapterItemGapUnit'] | undefined;
  const adapterJustifyContent = getRepresentativeGalleryCommonSetting(resolvedGalleryConfig, 'adapterJustifyContent') as GalleryBehaviorSettings['adapterJustifyContent'] | undefined;

  return (
    <>
      {showCarouselSettings && (
        <Accordion.Item value="carousel-settings">
          <Accordion.Control>{t('set_ld_carousel_title', 'Carousel Settings')}</Accordion.Control>
          <Accordion.Panel>
            {(!mountedPanels || mountedPanels.has('carousel-settings')) && <Stack gap="md">
              <NumberInput
                label={t('set_ld_visible_cards_label', 'Visible Cards')}
                description={t('set_ld_visible_cards_desc', 'Number of slides visible at once in the carousel.')}
                value={getAdapterSettingValue('carouselVisibleCards')}
                onChange={(value) => updateAdapterSetting('carouselVisibleCards', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.carouselVisibleCards)}
                min={1}
                max={10}
                step={1}
              />
              <DimensionInput
                label={t('set_ld_slide_gap_label', 'Slide Gap')}
                description={t('set_ld_slide_gap_desc', 'Space between carousel slides.')}
                value={getAdapterSettingValue('carouselGap')}
                unit={getAdapterSettingValue('carouselGapUnit') ?? 'px'}
                onValueChange={(value) => updateAdapterSetting('carouselGap', value)}
                onUnitChange={(unit) => updateAdapterSetting('carouselGapUnit', unit as GalleryBehaviorSettings['carouselGapUnit'])}
                allowedUnits={CSS_SPACING_UNITS}
                max={64}
                step={4}
              />
              <Switch
                label={t('set_ld_loop_label', 'Loop')}
                description={t('set_ld_loop_desc', 'Continuously loop slides when reaching the end.')}
                checked={getAdapterSettingValue('carouselLoop')}
                onChange={(e) => updateAdapterSetting('carouselLoop', e.currentTarget.checked)}
              />
              <Switch
                label={t('set_ld_drag_enabled_label', 'Drag Enabled')}
                description={t('set_ld_drag_enabled_desc', 'Allow dragging/swiping to navigate slides.')}
                checked={getAdapterSettingValue('carouselDragEnabled')}
                onChange={(e) => updateAdapterSetting('carouselDragEnabled', e.currentTarget.checked)}
              />
              <Divider label={t('set_ld_autoplay_divider', 'Autoplay')} labelPosition="center" />
              <Switch
                label={t('set_ld_autoplay_label', 'Autoplay')}
                description={t('set_ld_autoplay_desc', 'Automatically advance slides.')}
                checked={getAdapterSettingValue('carouselAutoplay')}
                onChange={(e) => updateAdapterSetting('carouselAutoplay', e.currentTarget.checked)}
              />
              {getAdapterSettingValue('carouselAutoplay') && (
                <>
                  <NumberInput
                    label={t('set_ld_autoplay_speed_label', 'Autoplay Speed (ms)')}
                    description={t('set_ld_autoplay_speed_desc', 'Delay between automatic slide transitions.')}
                    value={getAdapterSettingValue('carouselAutoplaySpeed')}
                    onChange={(value) => updateAdapterSetting('carouselAutoplaySpeed', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.carouselAutoplaySpeed)}
                    min={500}
                    max={15000}
                    step={250}
                  />
                  <Switch
                    label={t('set_ld_pause_hover_label', 'Pause on Hover')}
                    description={t('set_ld_pause_hover_desc', 'Pause autoplay when the mouse hovers over the carousel.')}
                    checked={getAdapterSettingValue('carouselAutoplayPauseOnHover')}
                    onChange={(e) => updateAdapterSetting('carouselAutoplayPauseOnHover', e.currentTarget.checked)}
                  />
                  <ModalSelect
                    label={t('set_ld_autoplay_dir_label', 'Autoplay Direction')}
                    description={t('set_ld_autoplay_dir_desc', 'Direction autoplay advances slides.')}
                    value={getAdapterSettingValue('carouselAutoplayDirection')}
                    onChange={(value) => updateAdapterSetting('carouselAutoplayDirection', (value ?? 'ltr') as GalleryBehaviorSettings['carouselAutoplayDirection'])}
                    data={[
                      { value: 'ltr', label: t('set_ld_dir_ltr', 'Left to Right') },
                      { value: 'rtl', label: t('set_ld_dir_rtl', 'Right to Left') },
                    ]}
                  />
                </>
              )}
              <Divider label={t('set_ld_visual_effects_divider', 'Visual Effects')} labelPosition="center" />
              <Switch
                label={t('set_ld_darken_label', 'Darken Unfocused Slides')}
                description={t('set_ld_darken_desc', 'Apply a dark overlay on slides that are not currently selected.')}
                checked={getAdapterSettingValue('carouselDarkenUnfocused')}
                onChange={(e) => updateAdapterSetting('carouselDarkenUnfocused', e.currentTarget.checked)}
              />
              {getAdapterSettingValue('carouselDarkenUnfocused') && (
                <NumberInput
                  label={t('set_ld_darken_opacity_label', 'Darken Opacity')}
                  description={t('set_ld_darken_opacity_desc', 'Opacity of the darken overlay (0 = transparent, 1 = fully dark).')}
                  value={getAdapterSettingValue('carouselDarkenOpacity')}
                  onChange={(value) => updateAdapterSetting('carouselDarkenOpacity', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.carouselDarkenOpacity)}
                  min={0}
                  max={1}
                  step={0.05}
                  decimalScale={2}
                />
              )}
              <Switch
                label={t('set_ld_edge_fade_label', 'Edge Fade')}
                description={t('set_ld_edge_fade_desc', 'Fade slides at the edges of the carousel viewport.')}
                checked={getAdapterSettingValue('carouselEdgeFade')}
                onChange={(e) => updateAdapterSetting('carouselEdgeFade', e.currentTarget.checked)}
              />
            </Stack>}
          </Accordion.Panel>
        </Accordion.Item>
      )}

      <Accordion.Item value="section-sizing">
        <Accordion.Control>{t('set_ld_section_title', 'Section Sizing & Spacing')}</Accordion.Control>
        <Accordion.Panel>
          {(!mountedPanels || mountedPanels.has('section-sizing')) && <Stack gap="md">
            <DimensionInput
              label={t('set_ld_section_maxw_label', 'Gallery Section Max Width')}
              description={t('set_ld_section_maxw_desc', 'Maximum width for each gallery section. 0 = fill available space.')}
              value={gallerySectionMaxWidth ?? 0}
              unit={gallerySectionMaxWidthUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('sectionMaxWidth', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('sectionMaxWidthUnit', unit as GalleryBehaviorSettings['gallerySectionMaxWidthUnit'])}
              allowedUnits={CSS_WIDTH_UNITS}
              max={2000}
              step={50}
            />
            <DimensionInput
              label={t('set_ld_section_minw_label', 'Gallery Section Min Width')}
              description={t('set_ld_section_minw_desc', 'Minimum width floor for gallery sections.')}
              value={gallerySectionMinWidth ?? 300}
              unit={gallerySectionMinWidthUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('sectionMinWidth', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('sectionMinWidthUnit', unit as GalleryBehaviorSettings['gallerySectionMinWidthUnit'])}
              allowedUnits={CSS_WIDTH_UNITS}
              max={600}
              step={50}
            />
            <ModalSelect
              label={t('set_ld_height_mode_label', 'Section Height Mode')}
              description={t('set_ld_height_mode_desc', 'How section height is determined. Auto = content-driven (recommended for masonry/justified).')}
              data={[
                { value: 'auto', label: t('set_ld_height_auto', 'Auto (content-driven)') },
                { value: 'manual', label: t('set_ld_height_manual', 'Manual (fixed max height)') },
                { value: 'viewport', label: t('set_ld_height_viewport', 'Viewport (% of screen)') },
              ]}
              value={gallerySectionHeightMode ?? 'auto'}
              onChange={(value) => updateRepresentativeCommonSetting('sectionHeightMode', (value ?? 'auto') as GalleryBehaviorSettings['gallerySectionHeightMode'])}
            />
            {gallerySectionHeightMode === 'manual' && (
              <DimensionInput
                label={t('set_ld_section_maxh_label', 'Gallery Section Max Height')}
                description={t('set_ld_section_maxh_desc', 'Maximum height for gallery sections in manual mode.')}
                value={gallerySectionMaxHeight ?? 0}
                unit={gallerySectionMaxHeightUnit ?? 'px'}
                onValueChange={(value) => updateRepresentativeCommonSetting('sectionMaxHeight', value)}
                onUnitChange={(unit) => updateRepresentativeCommonSetting('sectionMaxHeightUnit', unit as GalleryBehaviorSettings['gallerySectionMaxHeightUnit'])}
                allowedUnits={CSS_HEIGHT_UNITS}
                max={2000}
                step={50}
              />
            )}
            <DimensionInput
              label={t('set_ld_section_minh_label', 'Gallery Section Min Height')}
              description={t('set_ld_section_minh_desc', 'Minimum height floor for gallery sections.')}
              value={gallerySectionMinHeight ?? 150}
              unit={gallerySectionMinHeightUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('sectionMinHeight', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('sectionMinHeightUnit', unit as GalleryBehaviorSettings['gallerySectionMinHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={400}
              step={50}
            />
            <NumberInput
              label={t('set_ld_section_scale_label', 'Section Scale')}
              description={t('set_ld_section_scale_desc', 'Primary sizing multiplier for gallery sections. Scales min/max width, min/max height, and padding proportionally. 1 = default size.')}
              value={settings.sectionScale ?? 1}
              onChange={(value) => updateSetting('sectionScale', typeof value === 'number' ? value : 1)}
              min={0.5}
              max={2}
              step={0.05}
              decimalScale={2}
            />
            <Divider label={t('set_ld_section_align_divider', 'Section Content Alignment')} labelPosition="center" />
            <ModalSelect
              label={t('set_ld_content_halign_label', 'Content Horizontal Alignment')}
              description={t('set_ld_content_halign_desc', 'Horizontal alignment of adapter content within each gallery section.')}
              data={[
                { value: 'start', label: t('set_ld_opt_left', 'Left') },
                { value: 'center', label: t('set_ld_opt_center', 'Center') },
                { value: 'end', label: t('set_ld_opt_right', 'Right') },
              ]}
              value={settings.gallerySectionContentAlignX || 'center'}
              onChange={(value) => updateSetting('gallerySectionContentAlignX', (value || 'center') as GalleryBehaviorSettings['gallerySectionContentAlignX'])}
            />
            <ModalSelect
              label={t('set_ld_content_valign_label', 'Content Vertical Alignment')}
              description={t('set_ld_content_valign_desc', 'Vertical alignment of adapter content within each gallery section.')}
              data={[
                { value: 'start', label: t('set_ld_opt_top', 'Top') },
                { value: 'center', label: t('set_ld_opt_center', 'Center') },
                { value: 'end', label: t('set_ld_opt_bottom', 'Bottom') },
              ]}
              value={settings.gallerySectionContentAlignY || 'start'}
              onChange={(value) => updateSetting('gallerySectionContentAlignY', (value || 'start') as GalleryBehaviorSettings['gallerySectionContentAlignY'])}
            />
            <DimensionInput
              label={t('set_ld_content_hoffset_label', 'Content Horizontal Offset')}
              description={t('set_ld_content_hoffset_desc', 'Fine-tune horizontal position of section content. Negative = left, positive = right.')}
              value={settings.gallerySectionContentOffsetX ?? 0}
              unit={settings.gallerySectionContentOffsetXUnit ?? 'px'}
              onValueChange={(value) => updateSetting('gallerySectionContentOffsetX', value)}
              onUnitChange={(unit) => updateSetting('gallerySectionContentOffsetXUnit', unit as GalleryBehaviorSettings['gallerySectionContentOffsetXUnit'])}
              allowedUnits={CSS_OFFSET_UNITS}
              max={200}
              step={4}
              allowNegative
            />
            <DimensionInput
              label={t('set_ld_content_voffset_label', 'Content Vertical Offset')}
              description={t('set_ld_content_voffset_desc', 'Fine-tune vertical position of section content. Negative = up, positive = down.')}
              value={settings.gallerySectionContentOffsetY ?? 0}
              unit={settings.gallerySectionContentOffsetYUnit ?? 'px'}
              onValueChange={(value) => updateSetting('gallerySectionContentOffsetY', value)}
              onUnitChange={(unit) => updateSetting('gallerySectionContentOffsetYUnit', unit as GalleryBehaviorSettings['gallerySectionContentOffsetYUnit'])}
              allowedUnits={CSS_OFFSET_UNITS}
              max={200}
              step={4}
              allowNegative
            />
            <Switch
              label={t('set_ld_equal_height_label', 'Equal Height Sections (Per-Type)')}
              description={t('set_ld_equal_height_desc', 'When using per-type galleries, display image and video sections side-by-side at equal height on tablet+ viewports.')}
              checked={perTypeSectionEqualHeight ?? false}
              onChange={(e) => updateRepresentativeCommonSetting('perTypeSectionEqualHeight', e.currentTarget.checked)}
            />
            <DimensionInput
              label={t('set_ld_section_padding_label', 'Gallery Section Padding')}
              description={t('set_ld_section_padding_desc', 'Inner padding within each gallery section wrapper.')}
              value={gallerySectionPadding ?? 16}
              unit={gallerySectionPaddingUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('sectionPadding', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('sectionPaddingUnit', unit as GalleryBehaviorSettings['gallerySectionPaddingUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={32}
              step={4}
            />
            <DimensionInput
              label={t('set_ld_adapter_padding_label', 'Adapter Content Padding')}
              description={t('set_ld_adapter_padding_desc', 'Inner padding within each adapter (gallery grid). 0 = edges meet section boundary.')}
              value={adapterContentPadding ?? 0}
              unit={adapterContentPaddingUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('adapterContentPadding', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('adapterContentPaddingUnit', unit as GalleryBehaviorSettings['adapterContentPaddingUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={24}
              step={4}
            />
            <ModalSelect
              label={t('set_ld_modal_content_valign_label', 'Content Vertical Alignment')}
              description={t('set_ld_modal_content_valign_desc', 'Vertical alignment of content within the modal.')}
              data={[
                { value: 'top', label: t('set_ld_opt_top', 'Top') },
                { value: 'center', label: t('set_ld_opt_center', 'Center') },
                { value: 'bottom', label: t('set_ld_opt_bottom', 'Bottom') },
              ]}
              value={settings.modalContentVerticalAlign || 'top'}
              onChange={(value) => updateSetting('modalContentVerticalAlign', (value || 'top') as GalleryBehaviorSettings['modalContentVerticalAlign'])}
            />
            <Divider label={t('set_ld_gallery_spacing_divider', 'Gallery Spacing')} labelPosition="center" />
            <ModalSelect
              label={t('set_ld_shell_valign_label', 'Gallery Shell Vertical Alignment')}
              description={t('set_ld_shell_valign_desc', 'Vertical alignment of the gallery sections within the viewer shell.')}
              data={[
                { value: 'start', label: t('set_ld_opt_top', 'Top') },
                { value: 'center', label: t('set_ld_opt_center', 'Center') },
                { value: 'end', label: t('set_ld_opt_bottom', 'Bottom') },
              ]}
              value={settings.modalGalleryVerticalAlign || 'start'}
              onChange={(value) => updateSetting('modalGalleryVerticalAlign', (value || 'start') as GalleryBehaviorSettings['modalGalleryVerticalAlign'])}
            />
            <DimensionInput
              label={t('set_ld_shell_voffset_label', 'Gallery Shell Vertical Offset')}
              description={t('set_ld_shell_voffset_desc', 'Fine-tune vertical position of the gallery sections. Negative = up, positive = down.')}
              value={settings.modalGalleryOffsetY ?? 0}
              unit={settings.modalGalleryOffsetYUnit ?? 'px'}
              onValueChange={(value) => updateSetting('modalGalleryOffsetY', value)}
              onUnitChange={(unit) => updateSetting('modalGalleryOffsetYUnit', unit as GalleryBehaviorSettings['modalGalleryOffsetYUnit'])}
              allowedUnits={CSS_OFFSET_UNITS}
              max={200}
              step={4}
              allowNegative
            />
            <DimensionInput
              label={t('set_ld_gallery_maxw_label', 'Gallery Max Width')}
              description={t('set_ld_gallery_maxw_desc', 'Maximum width of the gallery container. 0 = full responsive width.')}
              value={settings.modalGalleryMaxWidth}
              unit={settings.modalGalleryMaxWidthUnit ?? 'px'}
              onValueChange={(value) => updateSetting('modalGalleryMaxWidth', value)}
              onUnitChange={(unit) => updateSetting('modalGalleryMaxWidthUnit', unit as GalleryBehaviorSettings['modalGalleryMaxWidthUnit'])}
              allowedUnits={CSS_WIDTH_UNITS}
              max={3000}
              step={50}
            />
            <DimensionInput
              label={t('set_ld_gallery_gap_label', 'Gallery Section Gap')}
              description={t('set_ld_gallery_gap_desc', 'Vertical gap between gallery sections.')}
              value={settings.modalGalleryGap}
              unit={settings.modalGalleryGapUnit ?? 'px'}
              onValueChange={(value) => updateSetting('modalGalleryGap', value)}
              onUnitChange={(unit) => updateSetting('modalGalleryGapUnit', unit as GalleryBehaviorSettings['modalGalleryGapUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={64}
              step={8}
            />
            <DimensionInput
              label={t('set_ld_gallery_margin_label', 'Gallery Edge Margin')}
              description={t('set_ld_gallery_margin_desc', 'Horizontal margin on gallery edges.')}
              value={settings.modalGalleryMargin}
              unit={settings.modalGalleryMarginUnit ?? 'px'}
              onValueChange={(value) => updateSetting('modalGalleryMargin', value)}
              onUnitChange={(unit) => updateSetting('modalGalleryMarginUnit', unit as GalleryBehaviorSettings['modalGalleryMarginUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={120}
              step={4}
            />
          </Stack>}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="adapter-sizing">
        <Accordion.Control>{t('set_ld_adapter_title', 'Adapter Sizing')}</Accordion.Control>
        <Accordion.Panel>
          {(!mountedPanels || mountedPanels.has('adapter-sizing')) && <Stack gap="md">
            <ModalSelect
              label={t('set_ld_adapter_mode_label', 'Adapter Sizing Mode')}
              description={t('set_ld_adapter_mode_desc', 'How adapters fill their gallery section. Fill = 100% of section, Manual = custom percentage.')}
              data={[
                { value: 'fill', label: t('set_ld_adapter_fill', 'Fill (100%)') },
                { value: 'manual', label: t('set_ld_adapter_manual', 'Manual (custom %)') },
              ]}
              value={adapterSizingMode ?? 'fill'}
              onChange={(value) => updateRepresentativeCommonSetting('adapterSizingMode', (value ?? 'fill') as GalleryBehaviorSettings['adapterSizingMode'])}
            />
            {adapterSizingMode === 'manual' && (
              <>
                <NumberInput
                  label={t('set_ld_adapter_maxw_label', 'Adapter Max Width (%)')}
                  description={t('set_ld_adapter_maxw_desc', 'Adapter width as percentage of its gallery section.')}
                  value={adapterMaxWidthPct ?? 100}
                  onChange={(value) => updateRepresentativeCommonSetting('adapterMaxWidthPct', typeof value === 'number' ? value : 100)}
                  min={50}
                  max={100}
                  step={5}
                />
                <NumberInput
                  label={t('set_ld_adapter_maxh_label', 'Adapter Max Height (%)')}
                  description={t('set_ld_adapter_maxh_desc', 'Adapter height as percentage of its gallery section.')}
                  value={adapterMaxHeightPct ?? 100}
                  onChange={(value) => updateRepresentativeCommonSetting('adapterMaxHeightPct', typeof value === 'number' ? value : 100)}
                  min={50}
                  max={100}
                  step={5}
                />
              </>
            )}
            <DimensionInput
              label={t('set_ld_adapter_gap_label', 'Adapter Item Gap')}
              description={t('set_ld_adapter_gap_desc', 'Spacing between items in grid adapters (Compact Grid). 0 = no gap.')}
              value={adapterItemGap ?? 16}
              unit={adapterItemGapUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('adapterItemGap', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('adapterItemGapUnit', unit as GalleryBehaviorSettings['adapterItemGapUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={64}
              step={4}
            />
            <ModalSelect
              label={t('set_ld_adapter_justify_label', 'Adapter Justification')}
              description={t('set_ld_adapter_justify_desc', 'How adapter items distribute within the container (Compact Grid, Circular).')}
              data={[
                { value: 'start', label: t('set_ld_opt_start', 'Start') },
                { value: 'center', label: t('set_ld_opt_center', 'Center') },
                { value: 'end', label: t('set_ld_opt_end', 'End') },
                { value: 'space-between', label: t('set_ld_justify_between', 'Space Between') },
                { value: 'space-evenly', label: t('set_ld_justify_evenly', 'Space Evenly') },
                { value: 'stretch', label: t('set_ld_justify_stretch', 'Stretch') },
              ]}
              value={adapterJustifyContent ?? 'center'}
              onChange={(value) => updateRepresentativeCommonSetting('adapterJustifyContent', (value ?? 'center') as GalleryBehaviorSettings['adapterJustifyContent'])}
            />
            <NumberInput
              label={t('set_ld_item_scale_label', 'Item Scale')}
              description={t('set_ld_item_scale_desc', 'Primary sizing multiplier for gallery items. Scales card width/height (Compact Grid), row height (Justified), and tile size (Shape adapters) proportionally. 1 = default size. Does not apply to Carousel.')}
              value={settings.itemScale ?? 1}
              onChange={(value) => updateSetting('itemScale', typeof value === 'number' ? value : 1)}
              min={0.5}
              max={2}
              step={0.05}
              decimalScale={2}
            />
          </Stack>}
        </Accordion.Panel>
      </Accordion.Item>
    </>
  );
}
