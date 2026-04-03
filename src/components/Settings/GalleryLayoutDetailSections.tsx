import { Accordion, Divider, NumberInput, Stack, Switch } from '@mantine/core';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings } from '@/types';
import { anyAdapterUsesSettingGroup } from '@/components/Galleries/Adapters/adapterRegistry';
import { getLegacyActiveAdapterIds } from '@/utils/galleryAdapterSelection';
import type { UpdateGallerySetting } from './GalleryAdapterSettingsSection';

interface GalleryLayoutDetailSectionsProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
  mountedPanels?: Set<string>;
}

function usesCarouselSettings(settings: GalleryBehaviorSettings): boolean {
  return anyAdapterUsesSettingGroup(getLegacyActiveAdapterIds(settings), 'carousel');
}

export function GalleryLayoutDetailSections({ settings, updateSetting, mountedPanels }: GalleryLayoutDetailSectionsProps) {
  const showCarouselSettings = usesCarouselSettings(settings);

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
              <NumberInput
                label="Slide Gap (px)"
                description="Space between carousel slides."
                value={settings.carouselGap}
                onChange={(value) => updateSetting('carouselGap', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.carouselGap)}
                min={0}
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
            <NumberInput
              label="Gallery Section Max Width (px)"
              description="Maximum width for each gallery section. 0 = fill available space."
              value={settings.gallerySectionMaxWidth ?? 0}
              onChange={(value) => updateSetting('gallerySectionMaxWidth', typeof value === 'number' ? value : 0)}
              min={0}
              max={2000}
              step={50}
            />
            <NumberInput
              label="Gallery Section Min Width (px)"
              description="Minimum width floor for gallery sections."
              value={settings.gallerySectionMinWidth ?? 300}
              onChange={(value) => updateSetting('gallerySectionMinWidth', typeof value === 'number' ? value : 300)}
              min={200}
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
              value={settings.gallerySectionHeightMode ?? 'auto'}
              onChange={(value) => updateSetting('gallerySectionHeightMode', (value ?? 'auto') as GalleryBehaviorSettings['gallerySectionHeightMode'])}
            />
            {settings.gallerySectionHeightMode === 'manual' && (
              <NumberInput
                label="Gallery Section Max Height (px)"
                description="Maximum height for gallery sections in manual mode."
                value={settings.gallerySectionMaxHeight ?? 0}
                onChange={(value) => updateSetting('gallerySectionMaxHeight', typeof value === 'number' ? value : 0)}
                min={0}
                max={2000}
                step={50}
              />
            )}
            <NumberInput
              label="Gallery Section Min Height (px)"
              description="Minimum height floor for gallery sections."
              value={settings.gallerySectionMinHeight ?? 150}
              onChange={(value) => updateSetting('gallerySectionMinHeight', typeof value === 'number' ? value : 150)}
              min={100}
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
            <NumberInput
              label="Content Horizontal Offset (px)"
              description="Fine-tune horizontal position of section content. Negative = left, positive = right."
              value={settings.gallerySectionContentOffsetX ?? 0}
              onChange={(value) => updateSetting('gallerySectionContentOffsetX', typeof value === 'number' ? value : 0)}
              min={-200}
              max={200}
              step={4}
            />
            <NumberInput
              label="Content Vertical Offset (px)"
              description="Fine-tune vertical position of section content. Negative = up, positive = down."
              value={settings.gallerySectionContentOffsetY ?? 0}
              onChange={(value) => updateSetting('gallerySectionContentOffsetY', typeof value === 'number' ? value : 0)}
              min={-200}
              max={200}
              step={4}
            />
            <Switch
              label="Equal Height Sections (Per-Type)"
              description="When using per-type galleries, display image and video sections side-by-side at equal height on tablet+ viewports."
              checked={settings.perTypeSectionEqualHeight ?? false}
              onChange={(e) => updateSetting('perTypeSectionEqualHeight', e.currentTarget.checked)}
            />
            <NumberInput
              label="Gallery Section Padding (px)"
              description="Inner padding within each gallery section wrapper."
              value={settings.gallerySectionPadding ?? 16}
              onChange={(value) => updateSetting('gallerySectionPadding', typeof value === 'number' ? value : 16)}
              min={0}
              max={32}
              step={4}
            />
            <NumberInput
              label="Adapter Content Padding (px)"
              description="Inner padding within each adapter (gallery grid). 0 = edges meet section boundary."
              value={settings.adapterContentPadding ?? 0}
              onChange={(value) => updateSetting('adapterContentPadding', typeof value === 'number' ? value : 0)}
              min={0}
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
            <NumberInput
              label="Gallery Shell Vertical Offset (px)"
              description="Fine-tune vertical position of the gallery sections. Negative = up, positive = down."
              value={settings.modalGalleryOffsetY ?? 0}
              onChange={(value) => updateSetting('modalGalleryOffsetY', typeof value === 'number' ? value : 0)}
              min={-200}
              max={200}
              step={4}
            />
            <NumberInput
              label="Gallery Max Width (px)"
              description="Maximum width of the gallery container. 0 = full responsive width."
              value={settings.modalGalleryMaxWidth}
              onChange={(value) => updateSetting('modalGalleryMaxWidth', typeof value === 'number' ? value : 0)}
              min={0}
              max={3000}
              step={50}
            />
            <NumberInput
              label="Gallery Section Gap (px)"
              description="Vertical gap between gallery sections."
              value={settings.modalGalleryGap}
              onChange={(value) => updateSetting('modalGalleryGap', typeof value === 'number' ? value : 32)}
              min={0}
              max={64}
              step={8}
            />
            <NumberInput
              label="Gallery Edge Margin (px)"
              description="Horizontal margin on gallery edges."
              value={settings.modalGalleryMargin}
              onChange={(value) => updateSetting('modalGalleryMargin', typeof value === 'number' ? value : 0)}
              min={0}
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
              value={settings.adapterSizingMode ?? 'fill'}
              onChange={(value) => updateSetting('adapterSizingMode', (value ?? 'fill') as GalleryBehaviorSettings['adapterSizingMode'])}
            />
            {settings.adapterSizingMode === 'manual' && (
              <>
                <NumberInput
                  label="Adapter Max Width (%)"
                  description="Adapter width as percentage of its gallery section."
                  value={settings.adapterMaxWidthPct ?? 100}
                  onChange={(value) => updateSetting('adapterMaxWidthPct', typeof value === 'number' ? value : 100)}
                  min={50}
                  max={100}
                  step={5}
                />
                <NumberInput
                  label="Adapter Max Height (%)"
                  description="Adapter height as percentage of its gallery section."
                  value={settings.adapterMaxHeightPct ?? 100}
                  onChange={(value) => updateSetting('adapterMaxHeightPct', typeof value === 'number' ? value : 100)}
                  min={50}
                  max={100}
                  step={5}
                />
              </>
            )}
            <NumberInput
              label="Adapter Item Gap (px)"
              description="Spacing between items in grid adapters (Compact Grid). 0 = no gap."
              value={settings.adapterItemGap ?? 16}
              onChange={(value) => updateSetting('adapterItemGap', typeof value === 'number' ? value : 16)}
              min={0}
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
              value={settings.adapterJustifyContent ?? 'center'}
              onChange={(value) => updateSetting('adapterJustifyContent', (value ?? 'center') as GalleryBehaviorSettings['adapterJustifyContent'])}
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