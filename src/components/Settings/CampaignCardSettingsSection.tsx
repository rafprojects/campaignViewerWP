import { Accordion, ColorInput, Divider, NumberInput, Select, Stack, Switch } from '@mantine/core';

import type { GalleryBehaviorSettings } from '@/types';

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
            <NumberInput
              label="Border Radius (px)"
              description="Corner rounding for campaign cards"
              value={settings.cardBorderRadius}
              onChange={(value) => updateSetting('cardBorderRadius', typeof value === 'number' ? value : 8)}
              min={0}
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
            <Select
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
            <Select
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
            <NumberInput
              label="Thumbnail Height (px)"
              description="Height of the card thumbnail area"
              value={settings.cardThumbnailHeight}
              onChange={(value) => updateSetting('cardThumbnailHeight', typeof value === 'number' ? value : 200)}
              min={100}
              max={400}
              step={10}
            />
            <Select
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
            <Select
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
            <NumberInput
              label="Horizontal Gap (px)"
              description="Horizontal spacing between campaign cards"
              value={settings.cardGapH}
              onChange={(value) => updateSetting('cardGapH', typeof value === 'number' ? value : 16)}
              min={0}
              max={48}
              step={2}
            />
            <NumberInput
              label="Vertical Gap (px)"
              description="Vertical spacing between campaign card rows"
              value={settings.cardGapV}
              onChange={(value) => updateSetting('cardGapV', typeof value === 'number' ? value : 16)}
              min={0}
              max={48}
              step={2}
            />
            <NumberInput
              label="Card Max Width (px)"
              description="Limit individual card width. 0 = no limit (fill column)."
              value={settings.cardMaxWidth}
              onChange={(value) => updateSetting('cardMaxWidth', typeof value === 'number' ? value : 0)}
              min={0}
              max={800}
              step={10}
              placeholder="0 = unlimited"
            />
            {settings.cardMaxWidth > 0 && (
              <Select
                label="Card Max Width Unit"
                description="Unit for the card max width value"
                data={[
                  { value: 'px', label: 'Pixels (px)' },
                  { value: '%', label: 'Percent (%)' },
                ]}
                value={settings.cardMaxWidthUnit ?? 'px'}
                onChange={(value) => updateSetting('cardMaxWidthUnit', (value ?? 'px') as GalleryBehaviorSettings['cardMaxWidthUnit'])}
              />
            )}
            {settings.cardMaxWidth > 0 && (
              <Select
                label="Card Justification"
                description="How cards are distributed in the last (partial) row"
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
            )}
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
            <Select
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
            <NumberInput
              label="Card Min Height (px)"
              description="Minimum height for each card. 0 = no minimum."
              value={settings.cardMinHeight}
              onChange={(value) => updateSetting('cardMinHeight', typeof value === 'number' ? value : 0)}
              min={0}
              max={600}
              step={10}
            />

            <Divider label="Pagination" labelPosition="left" />
            <Select
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
    </>
  );
}