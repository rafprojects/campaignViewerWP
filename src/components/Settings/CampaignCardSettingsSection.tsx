import { Accordion, ColorInput, Divider, NumberInput, Slider, Stack, Switch, Text, TextInput } from '@mantine/core';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { DimensionInput } from '@/components/Settings/DimensionInput';

import type { GalleryBehaviorSettings } from '@/types';
import { CSS_BORDER_RADIUS_UNITS, CSS_HEIGHT_UNITS, CSS_OFFSET_UNITS, CSS_SPACING_UNITS, CSS_WIDTH_UNITS } from '@/utils/cssUnits';

import type { UpdateGallerySetting } from './GalleryAdapterSettingsSection';

interface CampaignCardSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
}

export function CampaignCardSettingsSection({ settings, updateSetting }: CampaignCardSettingsSectionProps) {
  return (
    <>
      <Accordion.Item value="appearance">
        <Accordion.Control>Card Appearance</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <DimensionInput
              label="Border Radius"
              description="Corner rounding for campaign cards"
              value={settings.cardBorderRadius}
              unit={settings.cardBorderRadiusUnit ?? 'px'}
              onValueChange={(value) => updateSetting('cardBorderRadius', value)}
              onUnitChange={(unit) => updateSetting('cardBorderRadiusUnit', unit as GalleryBehaviorSettings['cardBorderRadiusUnit'])}
              allowedUnits={CSS_BORDER_RADIUS_UNITS}
              max={24}
              step={1}
            />
            <NumberInput
              label="Border Width (px)"
              description="Left accent border thickness"
              value={settings.cardBorderWidth}
              onChange={(value) => updateSetting('cardBorderWidth', typeof value === 'number' ? value : 4)}
              min={0}
              max={8}
              step={1}
            />
            <ModalSelect
              label="Border Color Mode"
              description="How card accent border colors are determined"
              data={[
                { value: 'auto', label: 'Auto (company brand color)' },
                { value: 'single', label: 'Single color for all cards' },
                { value: 'individual', label: 'Per-card color (set in Edit Campaign)' },
              ]}
              value={settings.cardBorderMode}
              onChange={(value) => updateSetting('cardBorderMode', (value ?? 'auto') as GalleryBehaviorSettings['cardBorderMode'])}
            />
            {settings.cardBorderMode === 'single' && (
              <ColorInput
                label="Border Color"
                description="Accent border color applied to all campaign cards"
                value={settings.cardBorderColor}
                onChange={(value) => updateSetting('cardBorderColor', value)}
              />
            )}
            <ModalSelect
              label="Card Shadow"
              description="Depth effect for campaign cards"
              data={[
                { value: 'none', label: 'None' },
                { value: 'subtle', label: 'Subtle' },
                { value: 'medium', label: 'Medium' },
                { value: 'dramatic', label: 'Dramatic' },
              ]}
              value={settings.cardShadowPreset}
              onChange={(value) => updateSetting('cardShadowPreset', value ?? 'subtle')}
            />
            <DimensionInput
              label="Thumbnail Height"
              description="Height of the card thumbnail area"
              value={settings.cardThumbnailHeight}
              unit={settings.cardThumbnailHeightUnit ?? 'px'}
              onValueChange={(value) => updateSetting('cardThumbnailHeight', value)}
              onUnitChange={(unit) => updateSetting('cardThumbnailHeightUnit', unit as GalleryBehaviorSettings['cardThumbnailHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={400}
              step={10}
            />
            <ModalSelect
              label="Thumbnail Fit"
              description="How the thumbnail image fills the card"
              data={[
                { value: 'cover', label: 'Cover (fill)' },
                { value: 'contain', label: 'Contain (fit)' },
              ]}
              value={settings.cardThumbnailFit}
              onChange={(value) => updateSetting('cardThumbnailFit', value ?? 'cover')}
            />

            <Divider label="Element Visibility" labelPosition="center" />

            <Switch
              label="Show company name badge"
              description="Company badge overlay on card thumbnail"
              checked={settings.showCardCompanyName ?? true}
              onChange={(event) => updateSetting('showCardCompanyName', event.currentTarget.checked)}
            />
            <Switch
              label="Show access badge"
              description="Green 'Access' badge on accessible cards"
              checked={settings.showCardAccessBadge ?? true}
              onChange={(event) => updateSetting('showCardAccessBadge', event.currentTarget.checked)}
            />
            <Switch
              label="Show card title"
              checked={settings.showCardTitle ?? true}
              onChange={(event) => updateSetting('showCardTitle', event.currentTarget.checked)}
            />
            <Switch
              label="Show card description"
              checked={settings.showCardDescription ?? true}
              onChange={(event) => updateSetting('showCardDescription', event.currentTarget.checked)}
            />
            <Switch
              label="Show media counts"
              description="Video and image count below description"
              checked={settings.showCardMediaCounts ?? true}
              onChange={(event) => updateSetting('showCardMediaCounts', event.currentTarget.checked)}
            />
            <Switch
              label="Show card border"
              description="Accent border and hover border effect"
              checked={settings.showCardBorder ?? true}
              onChange={(event) => updateSetting('showCardBorder', event.currentTarget.checked)}
            />
            <Switch
              label="Show thumbnail fade"
              description="Gradient overlay at bottom of thumbnail"
              checked={settings.showCardThumbnailFade ?? true}
              onChange={(event) => updateSetting('showCardThumbnailFade', event.currentTarget.checked)}
            />
            <Switch
              label="Show card info panel"
              description="Show title, description, tags & media counts below thumbnail"
              checked={settings.showCardInfoPanel ?? true}
              onChange={(event) => updateSetting('showCardInfoPanel', event.currentTarget.checked)}
            />
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="grid-pagination">
        <Accordion.Control>Card Grid &amp; Pagination</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <ModalSelect
              label="Cards Per Row"
              description="Number of columns in the card grid (Auto = responsive)"
              data={[
                { value: '0', label: 'Auto (responsive)' },
                { value: '2', label: '2 columns' },
                { value: '3', label: '3 columns' },
                { value: '4', label: '4 columns' },
                { value: '5', label: '5 columns' },
                { value: '6', label: '6 columns' },
              ]}
              value={String(settings.cardGridColumns)}
              onChange={(value) => updateSetting('cardGridColumns', parseInt(value ?? '0', 10))}
            />
            <DimensionInput
              label="Horizontal Gap"
              description="Horizontal spacing between campaign cards"
              value={settings.cardGapH}
              unit={settings.cardGapHUnit ?? 'px'}
              onValueChange={(value) => updateSetting('cardGapH', value)}
              onUnitChange={(unit) => updateSetting('cardGapHUnit', unit as GalleryBehaviorSettings['cardGapHUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={48}
              step={2}
            />
            <DimensionInput
              label="Vertical Gap"
              description="Vertical spacing between campaign card rows"
              value={settings.cardGapV}
              unit={settings.cardGapVUnit ?? 'px'}
              onValueChange={(value) => updateSetting('cardGapV', value)}
              onUnitChange={(unit) => updateSetting('cardGapVUnit', unit as GalleryBehaviorSettings['cardGapVUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={48}
              step={2}
            />
            <DimensionInput
              label="Card Max Width"
              description="Limit individual card width. 0 = no limit (fill column)."
              value={settings.cardMaxWidth}
              unit={settings.cardMaxWidthUnit ?? 'px'}
              onValueChange={(value) => updateSetting('cardMaxWidth', value)}
              onUnitChange={(unit) => updateSetting('cardMaxWidthUnit', unit as GalleryBehaviorSettings['cardMaxWidthUnit'])}
              allowedUnits={CSS_WIDTH_UNITS}
              max={800}
              step={10}
              placeholder="0 = unlimited"
            />
            <NumberInput
              label="Card Scale"
              description="Primary sizing multiplier for cards. Scales thumbnail height, max width, and min height proportionally. 1 = default size."
              value={settings.cardScale ?? 1}
              onChange={(value) => updateSetting('cardScale', typeof value === 'number' ? value : 1)}
              min={0.5}
              max={2}
              step={0.05}
              decimalScale={2}
            />
            <ModalSelect
              label="Card Justification"
              description="How cards distribute when a row does not fill the full available width."
              data={[
                { value: 'start', label: 'Start' },
                { value: 'center', label: 'Center' },
                { value: 'end', label: 'End' },
                { value: 'space-between', label: 'Space Between' },
                { value: 'space-evenly', label: 'Space Evenly' },
              ]}
              value={settings.cardJustifyContent ?? 'center'}
              onChange={(value) => updateSetting('cardJustifyContent', (value ?? 'center') as GalleryBehaviorSettings['cardJustifyContent'])}
            />
            <ModalSelect
              label="Vertical Alignment"
              description="How the card grid aligns vertically when minimum height exceeds content height."
              data={[
                { value: 'start', label: 'Top' },
                { value: 'center', label: 'Center' },
                { value: 'end', label: 'Bottom' },
              ]}
              value={settings.cardGalleryVerticalAlign ?? 'start'}
              onChange={(value) => updateSetting('cardGalleryVerticalAlign', (value ?? 'start') as GalleryBehaviorSettings['cardGalleryVerticalAlign'])}
            />
            <DimensionInput
              label="Grid Minimum Height"
              description="Minimum height for the card grid container. Vertical alignment only takes effect when the grid is taller than its content."
              value={settings.cardGalleryMinHeight}
              unit={settings.cardGalleryMinHeightUnit ?? 'px'}
              onValueChange={(value) => updateSetting('cardGalleryMinHeight', value)}
              onUnitChange={(unit) => updateSetting('cardGalleryMinHeightUnit', unit as GalleryBehaviorSettings['cardGalleryMinHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={1200}
              step={50}
              placeholder="0 = no minimum"
            />
            <DimensionInput
              label="Grid Maximum Height"
              description="Maximum height for the card grid area. Content will scroll when exceeded. 0 = no limit."
              value={settings.cardGalleryMaxHeight}
              unit={settings.cardGalleryMaxHeightUnit ?? 'px'}
              onValueChange={(value) => updateSetting('cardGalleryMaxHeight', value)}
              onUnitChange={(unit) => updateSetting('cardGalleryMaxHeightUnit', unit as GalleryBehaviorSettings['cardGalleryMaxHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={2000}
              step={50}
              placeholder="0 = no maximum"
            />
            <DimensionInput
              label="Grid Horizontal Offset"
              description="Fine-tune horizontal position of the card grid. Negative = left, positive = right."
              value={settings.cardGalleryOffsetX ?? 0}
              unit={settings.cardGalleryOffsetXUnit ?? 'px'}
              onValueChange={(value) => updateSetting('cardGalleryOffsetX', value)}
              onUnitChange={(unit) => updateSetting('cardGalleryOffsetXUnit', unit as GalleryBehaviorSettings['cardGalleryOffsetXUnit'])}
              allowedUnits={CSS_OFFSET_UNITS}
              max={200}
              step={4}
              allowNegative
            />
            <DimensionInput
              label="Grid Vertical Offset"
              description="Fine-tune vertical position of the card grid. Negative = up, positive = down."
              value={settings.cardGalleryOffsetY ?? 0}
              unit={settings.cardGalleryOffsetYUnit ?? 'px'}
              onValueChange={(value) => updateSetting('cardGalleryOffsetY', value)}
              onUnitChange={(unit) => updateSetting('cardGalleryOffsetYUnit', unit as GalleryBehaviorSettings['cardGalleryOffsetYUnit'])}
              allowedUnits={CSS_OFFSET_UNITS}
              max={200}
              step={4}
              allowNegative
            />
            {settings.cardGridColumns === 0 && (
              <NumberInput
                label="Max Columns (auto mode)"
                description="Cap the number of columns when using Auto layout. 0 = unlimited."
                value={settings.cardMaxColumns}
                onChange={(value) => updateSetting('cardMaxColumns', typeof value === 'number' ? value : 0)}
                min={0}
                max={8}
              />
            )}
            <ModalSelect
              label="Card Aspect Ratio"
              description="Lock cards to a fixed aspect ratio"
              data={[
                { value: 'auto', label: 'Auto (natural)' },
                { value: '16:9', label: '16:9 (widescreen)' },
                { value: '4:3', label: '4:3 (standard)' },
                { value: '1:1', label: '1:1 (square)' },
                { value: '3:4', label: '3:4 (portrait)' },
                { value: '9:16', label: '9:16 (tall portrait)' },
                { value: '2:3', label: '2:3 (photo portrait)' },
                { value: '3:2', label: '3:2 (photo landscape)' },
                { value: '21:9', label: '21:9 (ultrawide)' },
              ]}
              value={settings.cardAspectRatio ?? 'auto'}
              onChange={(value) => updateSetting('cardAspectRatio', (value ?? 'auto') as GalleryBehaviorSettings['cardAspectRatio'])}
            />
            <DimensionInput
              label="Card Min Height"
              description="Minimum height for each card. 0 = no minimum."
              value={settings.cardMinHeight}
              unit={settings.cardMinHeightUnit ?? 'px'}
              onValueChange={(value) => updateSetting('cardMinHeight', value)}
              onUnitChange={(unit) => updateSetting('cardMinHeightUnit', unit as GalleryBehaviorSettings['cardMinHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={600}
              step={10}
            />

            <Divider label="Pagination" labelPosition="left" />
            <ModalSelect
              label="Display Mode"
              description="How cards are displayed: all at once, progressively loaded, or paginated with arrows"
              data={[
                { value: 'show-all', label: 'Show All' },
                { value: 'load-more', label: 'Load More (progressive)' },
                { value: 'paginated', label: 'Paginated (arrows)' },
              ]}
              value={settings.cardDisplayMode}
              onChange={(value) => updateSetting('cardDisplayMode', (value ?? 'load-more') as GalleryBehaviorSettings['cardDisplayMode'])}
            />
            {settings.cardDisplayMode === 'paginated' && (
              <>
                <NumberInput
                  label="Rows Per Page"
                  description="Number of card rows visible per page"
                  value={settings.cardRowsPerPage}
                  onChange={(value) => updateSetting('cardRowsPerPage', typeof value === 'number' ? value : 3)}
                  min={1}
                  max={10}
                  step={1}
                />
                <Switch
                  label="Dot Navigator"
                  description="Show dot navigator below the card grid"
                  checked={settings.cardPageDotNav}
                  onChange={(event) => updateSetting('cardPageDotNav', event.currentTarget.checked)}
                />
                <NumberInput
                  label="Page Transition Duration (ms)"
                  description="Slide animation speed between pages"
                  value={settings.cardPageTransitionMs}
                  onChange={(value) => updateSetting('cardPageTransitionMs', typeof value === 'number' ? value : 300)}
                  min={100}
                  max={800}
                  step={50}
                />
              </>
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="card-internals">
        <Accordion.Control>Card Internals</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <Text size="sm" fw={500}>Locked Card Opacity</Text>
            <Slider
              value={settings.cardLockedOpacity}
              onChange={(value) => updateSetting('cardLockedOpacity', value)}
              min={0}
              max={1}
              step={0.05}
              marks={[{ value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }]}
            />
            <Text size="sm" fw={500}>Gradient Start Opacity</Text>
            <Slider
              value={settings.cardGradientStartOpacity}
              onChange={(value) => updateSetting('cardGradientStartOpacity', value)}
              min={0}
              max={1}
              step={0.05}
            />
            <Text size="sm" fw={500}>Gradient End Opacity</Text>
            <Slider
              value={settings.cardGradientEndOpacity}
              onChange={(value) => updateSetting('cardGradientEndOpacity', value)}
              min={0}
              max={1}
              step={0.05}
            />
            <NumberInput
              label="Lock Icon Size (px)"
              value={settings.cardLockIconSize}
              onChange={(value) => updateSetting('cardLockIconSize', typeof value === 'number' ? value : 32)}
              min={12}
              max={64}
            />
            <NumberInput
              label="Access Icon Size (px)"
              value={settings.cardAccessIconSize}
              onChange={(value) => updateSetting('cardAccessIconSize', typeof value === 'number' ? value : 14)}
              min={8}
              max={32}
            />
            <NumberInput
              label="Badge Offset Y (px)"
              value={settings.cardBadgeOffsetY}
              onChange={(value) => updateSetting('cardBadgeOffsetY', typeof value === 'number' ? value : 8)}
              min={0}
              max={32}
            />
            <NumberInput
              label="Company Badge Max Width (px)"
              value={settings.cardCompanyBadgeMaxWidth}
              onChange={(value) => updateSetting('cardCompanyBadgeMaxWidth', typeof value === 'number' ? value : 160)}
              min={60}
              max={400}
            />
            <NumberInput
              label="Thumbnail Hover Transition (ms)"
              value={settings.cardThumbnailHoverTransitionMs}
              onChange={(value) => updateSetting('cardThumbnailHoverTransitionMs', typeof value === 'number' ? value : 300)}
              min={0}
              max={1000}
            />
            <Text size="sm" fw={500}>Page Transition Opacity</Text>
            <Slider
              value={settings.cardPageTransitionOpacity}
              onChange={(value) => updateSetting('cardPageTransitionOpacity', value)}
              min={0}
              max={1}
              step={0.05}
            />
            <TextInput
              label="Auto Columns Breakpoints"
              description="Format: 480:1,768:2,1024:3,1280:4"
              value={settings.cardAutoColumnsBreakpoints}
              onChange={(event) => updateSetting('cardAutoColumnsBreakpoints', event.currentTarget.value)}
            />
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </>
  );
}