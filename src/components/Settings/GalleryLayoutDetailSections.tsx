import { Accordion, Divider, NumberInput, Stack, Switch } from '@mantine/core';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { DimensionInput } from '@/components/Settings/DimensionInput';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings, type GalleryCommonSettings } from '@/types';
import { CSS_HEIGHT_UNITS, CSS_OFFSET_UNITS, CSS_SPACING_UNITS, CSS_WIDTH_UNITS } from '@/utils/cssUnits';
import { anyAdapterUsesSettingGroup } from '@/components/Galleries/Adapters/adapterRegistry';
import {
  getActiveGalleryConfigAdapterIds,
  getRepresentativeGalleryCommonSetting,
  resolveGalleryConfig,
  setRepresentativeGalleryCommonSetting,
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
  const resolvedGalleryConfig = resolveGalleryConfig(settings);
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
          <Accordion.Control>Carousel Settings</Accordion.Control>
          <Accordion.Panel>
            {(!mountedPanels || mountedPanels.has('carousel-settings')) && <Stack gap="md">
              <NumberInput
                label="Visible Cards"
                description="Number of slides visible at once in the carousel."
                value={settings.carouselVisibleCards}
                onChange={(value) => updateSetting('carouselVisibleCards', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.carouselVisibleCards)}
                min={1}
                max={10}
                step={1}
              />
              <DimensionInput
                label="Slide Gap"
                description="Space between carousel slides."
                value={settings.carouselGap}
                unit={settings.carouselGapUnit ?? 'px'}
                onValueChange={(value) => updateSetting('carouselGap', value)}
                onUnitChange={(unit) => updateSetting('carouselGapUnit', unit as GalleryBehaviorSettings['carouselGapUnit'])}
                allowedUnits={CSS_SPACING_UNITS}
                max={64}
                step={4}
              />
              <Switch
                label="Loop"
                description="Continuously loop slides when reaching the end."
                checked={settings.carouselLoop}
                onChange={(e) => updateSetting('carouselLoop', e.currentTarget.checked)}
              />
              <Switch
                label="Drag Enabled"
                description="Allow dragging/swiping to navigate slides."
                checked={settings.carouselDragEnabled}
                onChange={(e) => updateSetting('carouselDragEnabled', e.currentTarget.checked)}
              />
              <Divider label="Autoplay" labelPosition="center" />
              <Switch
                label="Autoplay"
                description="Automatically advance slides."
                checked={settings.carouselAutoplay}
                onChange={(e) => updateSetting('carouselAutoplay', e.currentTarget.checked)}
              />
              {settings.carouselAutoplay && (
                <>
                  <NumberInput
                    label="Autoplay Speed (ms)"
                    description="Delay between automatic slide transitions."
                    value={settings.carouselAutoplaySpeed}
                    onChange={(value) => updateSetting('carouselAutoplaySpeed', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.carouselAutoplaySpeed)}
                    min={500}
                    max={15000}
                    step={250}
                  />
                  <Switch
                    label="Pause on Hover"
                    description="Pause autoplay when the mouse hovers over the carousel."
                    checked={settings.carouselAutoplayPauseOnHover}
                    onChange={(e) => updateSetting('carouselAutoplayPauseOnHover', e.currentTarget.checked)}
                  />
                  <ModalSelect
                    label="Autoplay Direction"
                    description="Direction autoplay advances slides."
                    value={settings.carouselAutoplayDirection}
                    onChange={(value) => updateSetting('carouselAutoplayDirection', (value ?? 'ltr') as GalleryBehaviorSettings['carouselAutoplayDirection'])}
                    data={[
                      { value: 'ltr', label: 'Left to Right' },
                      { value: 'rtl', label: 'Right to Left' },
                    ]}
                  />
                </>
              )}
              <Divider label="Visual Effects" labelPosition="center" />
              <Switch
                label="Darken Unfocused Slides"
                description="Apply a dark overlay on slides that are not currently selected."
                checked={settings.carouselDarkenUnfocused}
                onChange={(e) => updateSetting('carouselDarkenUnfocused', e.currentTarget.checked)}
              />
              {settings.carouselDarkenUnfocused && (
                <NumberInput
                  label="Darken Opacity"
                  description="Opacity of the darken overlay (0 = transparent, 1 = fully dark)."
                  value={settings.carouselDarkenOpacity}
                  onChange={(value) => updateSetting('carouselDarkenOpacity', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.carouselDarkenOpacity)}
                  min={0}
                  max={1}
                  step={0.05}
                  decimalScale={2}
                />
              )}
              <Switch
                label="Edge Fade"
                description="Fade slides at the edges of the carousel viewport."
                checked={settings.carouselEdgeFade}
                onChange={(e) => updateSetting('carouselEdgeFade', e.currentTarget.checked)}
              />
            </Stack>}
          </Accordion.Panel>
        </Accordion.Item>
      )}

      <Accordion.Item value="section-sizing">
        <Accordion.Control>Section Sizing &amp; Spacing</Accordion.Control>
        <Accordion.Panel>
          {(!mountedPanels || mountedPanels.has('section-sizing')) && <Stack gap="md">
            <DimensionInput
              label="Gallery Section Max Width"
              description="Maximum width for each gallery section. 0 = fill available space."
              value={gallerySectionMaxWidth ?? 0}
              unit={gallerySectionMaxWidthUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('sectionMaxWidth', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('sectionMaxWidthUnit', unit as GalleryBehaviorSettings['gallerySectionMaxWidthUnit'])}
              allowedUnits={CSS_WIDTH_UNITS}
              max={2000}
              step={50}
            />
            <DimensionInput
              label="Gallery Section Min Width"
              description="Minimum width floor for gallery sections."
              value={gallerySectionMinWidth ?? 300}
              unit={gallerySectionMinWidthUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('sectionMinWidth', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('sectionMinWidthUnit', unit as GalleryBehaviorSettings['gallerySectionMinWidthUnit'])}
              allowedUnits={CSS_WIDTH_UNITS}
              max={600}
              step={50}
            />
            <ModalSelect
              label="Section Height Mode"
              description="How section height is determined. Auto = content-driven (recommended for masonry/justified)."
              data={[
                { value: 'auto', label: 'Auto (content-driven)' },
                { value: 'manual', label: 'Manual (fixed max height)' },
                { value: 'viewport', label: 'Viewport (% of screen)' },
              ]}
              value={gallerySectionHeightMode ?? 'auto'}
              onChange={(value) => updateRepresentativeCommonSetting('sectionHeightMode', (value ?? 'auto') as GalleryBehaviorSettings['gallerySectionHeightMode'])}
            />
            {gallerySectionHeightMode === 'manual' && (
              <DimensionInput
                label="Gallery Section Max Height"
                description="Maximum height for gallery sections in manual mode."
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
              label="Gallery Section Min Height"
              description="Minimum height floor for gallery sections."
              value={gallerySectionMinHeight ?? 150}
              unit={gallerySectionMinHeightUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('sectionMinHeight', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('sectionMinHeightUnit', unit as GalleryBehaviorSettings['gallerySectionMinHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={400}
              step={50}
            />
            <NumberInput
              label="Section Scale"
              description="Primary sizing multiplier for gallery sections. Scales min/max width, min/max height, and padding proportionally. 1 = default size."
              value={settings.sectionScale ?? 1}
              onChange={(value) => updateSetting('sectionScale', typeof value === 'number' ? value : 1)}
              min={0.5}
              max={2}
              step={0.05}
              decimalScale={2}
            />
            <Divider label="Section Content Alignment" labelPosition="center" />
            <ModalSelect
              label="Content Horizontal Alignment"
              description="Horizontal alignment of adapter content within each gallery section."
              data={[
                { value: 'start', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'end', label: 'Right' },
              ]}
              value={settings.gallerySectionContentAlignX || 'center'}
              onChange={(value) => updateSetting('gallerySectionContentAlignX', (value || 'center') as GalleryBehaviorSettings['gallerySectionContentAlignX'])}
            />
            <ModalSelect
              label="Content Vertical Alignment"
              description="Vertical alignment of adapter content within each gallery section."
              data={[
                { value: 'start', label: 'Top' },
                { value: 'center', label: 'Center' },
                { value: 'end', label: 'Bottom' },
              ]}
              value={settings.gallerySectionContentAlignY || 'start'}
              onChange={(value) => updateSetting('gallerySectionContentAlignY', (value || 'start') as GalleryBehaviorSettings['gallerySectionContentAlignY'])}
            />
            <DimensionInput
              label="Content Horizontal Offset"
              description="Fine-tune horizontal position of section content. Negative = left, positive = right."
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
              label="Content Vertical Offset"
              description="Fine-tune vertical position of section content. Negative = up, positive = down."
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
              label="Equal Height Sections (Per-Type)"
              description="When using per-type galleries, display image and video sections side-by-side at equal height on tablet+ viewports."
              checked={perTypeSectionEqualHeight ?? false}
              onChange={(e) => updateRepresentativeCommonSetting('perTypeSectionEqualHeight', e.currentTarget.checked)}
            />
            <DimensionInput
              label="Gallery Section Padding"
              description="Inner padding within each gallery section wrapper."
              value={gallerySectionPadding ?? 16}
              unit={gallerySectionPaddingUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('sectionPadding', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('sectionPaddingUnit', unit as GalleryBehaviorSettings['gallerySectionPaddingUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={32}
              step={4}
            />
            <DimensionInput
              label="Adapter Content Padding"
              description="Inner padding within each adapter (gallery grid). 0 = edges meet section boundary."
              value={adapterContentPadding ?? 0}
              unit={adapterContentPaddingUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('adapterContentPadding', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('adapterContentPaddingUnit', unit as GalleryBehaviorSettings['adapterContentPaddingUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={24}
              step={4}
            />
            <ModalSelect
              label="Content Vertical Alignment"
              description="Vertical alignment of content within the modal."
              data={[
                { value: 'top', label: 'Top' },
                { value: 'center', label: 'Center' },
                { value: 'bottom', label: 'Bottom' },
              ]}
              value={settings.modalContentVerticalAlign || 'top'}
              onChange={(value) => updateSetting('modalContentVerticalAlign', (value || 'top') as GalleryBehaviorSettings['modalContentVerticalAlign'])}
            />
            <Divider label="Gallery Spacing" labelPosition="center" />
            <ModalSelect
              label="Gallery Shell Vertical Alignment"
              description="Vertical alignment of the gallery sections within the viewer shell."
              data={[
                { value: 'start', label: 'Top' },
                { value: 'center', label: 'Center' },
                { value: 'end', label: 'Bottom' },
              ]}
              value={settings.modalGalleryVerticalAlign || 'start'}
              onChange={(value) => updateSetting('modalGalleryVerticalAlign', (value || 'start') as GalleryBehaviorSettings['modalGalleryVerticalAlign'])}
            />
            <DimensionInput
              label="Gallery Shell Vertical Offset"
              description="Fine-tune vertical position of the gallery sections. Negative = up, positive = down."
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
              label="Gallery Max Width"
              description="Maximum width of the gallery container. 0 = full responsive width."
              value={settings.modalGalleryMaxWidth}
              unit={settings.modalGalleryMaxWidthUnit ?? 'px'}
              onValueChange={(value) => updateSetting('modalGalleryMaxWidth', value)}
              onUnitChange={(unit) => updateSetting('modalGalleryMaxWidthUnit', unit as GalleryBehaviorSettings['modalGalleryMaxWidthUnit'])}
              allowedUnits={CSS_WIDTH_UNITS}
              max={3000}
              step={50}
            />
            <DimensionInput
              label="Gallery Section Gap"
              description="Vertical gap between gallery sections."
              value={settings.modalGalleryGap}
              unit={settings.modalGalleryGapUnit ?? 'px'}
              onValueChange={(value) => updateSetting('modalGalleryGap', value)}
              onUnitChange={(unit) => updateSetting('modalGalleryGapUnit', unit as GalleryBehaviorSettings['modalGalleryGapUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={64}
              step={8}
            />
            <DimensionInput
              label="Gallery Edge Margin"
              description="Horizontal margin on gallery edges."
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
        <Accordion.Control>Adapter Sizing</Accordion.Control>
        <Accordion.Panel>
          {(!mountedPanels || mountedPanels.has('adapter-sizing')) && <Stack gap="md">
            <ModalSelect
              label="Adapter Sizing Mode"
              description="How adapters fill their gallery section. Fill = 100% of section, Manual = custom percentage."
              data={[
                { value: 'fill', label: 'Fill (100%)' },
                { value: 'manual', label: 'Manual (custom %)' },
              ]}
              value={adapterSizingMode ?? 'fill'}
              onChange={(value) => updateRepresentativeCommonSetting('adapterSizingMode', (value ?? 'fill') as GalleryBehaviorSettings['adapterSizingMode'])}
            />
            {adapterSizingMode === 'manual' && (
              <>
                <NumberInput
                  label="Adapter Max Width (%)"
                  description="Adapter width as percentage of its gallery section."
                  value={adapterMaxWidthPct ?? 100}
                  onChange={(value) => updateRepresentativeCommonSetting('adapterMaxWidthPct', typeof value === 'number' ? value : 100)}
                  min={50}
                  max={100}
                  step={5}
                />
                <NumberInput
                  label="Adapter Max Height (%)"
                  description="Adapter height as percentage of its gallery section."
                  value={adapterMaxHeightPct ?? 100}
                  onChange={(value) => updateRepresentativeCommonSetting('adapterMaxHeightPct', typeof value === 'number' ? value : 100)}
                  min={50}
                  max={100}
                  step={5}
                />
              </>
            )}
            <DimensionInput
              label="Adapter Item Gap"
              description="Spacing between items in grid adapters (Compact Grid). 0 = no gap."
              value={adapterItemGap ?? 16}
              unit={adapterItemGapUnit ?? 'px'}
              onValueChange={(value) => updateRepresentativeCommonSetting('adapterItemGap', value)}
              onUnitChange={(unit) => updateRepresentativeCommonSetting('adapterItemGapUnit', unit as GalleryBehaviorSettings['adapterItemGapUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={64}
              step={4}
            />
            <ModalSelect
              label="Adapter Justification"
              description="How adapter items distribute within the container (Compact Grid, Circular)."
              data={[
                { value: 'start', label: 'Start' },
                { value: 'center', label: 'Center' },
                { value: 'end', label: 'End' },
                { value: 'space-between', label: 'Space Between' },
                { value: 'space-evenly', label: 'Space Evenly' },
                { value: 'stretch', label: 'Stretch' },
              ]}
              value={adapterJustifyContent ?? 'center'}
              onChange={(value) => updateRepresentativeCommonSetting('adapterJustifyContent', (value ?? 'center') as GalleryBehaviorSettings['adapterJustifyContent'])}
            />
            <NumberInput
              label="Item Scale"
              description="Primary sizing multiplier for gallery items. Scales card width/height (Compact Grid), row height (Justified), and tile size (Shape adapters) proportionally. 1 = default size. Does not apply to Carousel."
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