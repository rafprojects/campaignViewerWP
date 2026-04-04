import { useState, useMemo } from 'react';
import { Accordion, Divider, NumberInput, SegmentedControl, Slider, Stack, Switch, Text, TextInput } from '@mantine/core';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { DimensionInput } from '@/components/Settings/DimensionInput';

import type { CardBreakpointOverrides, CardConfigBreakpoint, GalleryBehaviorSettings } from '@/types';
import { CSS_BORDER_RADIUS_UNITS, CSS_HEIGHT_UNITS, CSS_OFFSET_UNITS, CSS_SPACING_UNITS, CSS_WIDTH_UNITS } from '@/utils/cssUnits';
import {
  resolveCardBreakpointSettings,
  setCardBreakpointOverride,
  clearCardBreakpointOverride,
  clearCardDimensionOverride,
} from '@/utils/cardConfig';

import type { UpdateGallerySetting } from './GalleryAdapterSettingsSection';

const BREAKPOINT_OPTIONS = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Mobile' },
];

interface CampaignCardSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
}

export function CampaignCardSettingsSection({ settings, updateSetting }: CampaignCardSettingsSectionProps) {
  const [activeBreakpoint, setActiveBreakpoint] = useState<CardConfigBreakpoint>('desktop');
  const isDesktop = activeBreakpoint === 'desktop';

  // Resolved settings = flat base + cascaded overrides for the active breakpoint.
  const resolved = useMemo(
    () => resolveCardBreakpointSettings(settings, activeBreakpoint),
    [settings, activeBreakpoint],
  );

  // ── Adapter functions for breakpoint-aware read/write ────────────────

  /** Check whether a field has an explicit override at the active breakpoint. */
  function hasOverride(key: keyof CardBreakpointOverrides): boolean {
    if (isDesktop) return false;
    const layer = settings.cardConfig?.breakpoints?.[activeBreakpoint];
    return layer !== undefined && key in layer && layer[key] !== undefined;
  }

  /** Inheritance source label for non-desktop fields. */
  function inheritLabel(key: keyof CardBreakpointOverrides): string {
    if (activeBreakpoint === 'mobile') {
      const tabletLayer = settings.cardConfig?.breakpoints?.tablet;
      if (tabletLayer && key in tabletLayer && tabletLayer[key] !== undefined) {
        return 'tablet';
      }
    }
    return 'desktop';
  }

  /** Decorate a description string with inheritance/override info. */
  function desc(base: string, key: keyof CardBreakpointOverrides): string {
    if (isDesktop) return base;
    if (hasOverride(key)) return `${base} — Override for ${activeBreakpoint}`;
    return `${base} — Inherited from ${inheritLabel(key)}`;
  }

  /** Write a value: flat setting for desktop, cardConfig overlay for tablet/mobile. */
  function writeField<K extends keyof CardBreakpointOverrides & keyof GalleryBehaviorSettings>(
    key: K,
    value: GalleryBehaviorSettings[K],
  ): void {
    if (isDesktop) {
      updateSetting(key, value);
      return;
    }
    const next = setCardBreakpointOverride(
      settings.cardConfig ?? { breakpoints: {} },
      activeBreakpoint,
      key,
      value,
    );
    updateSetting('cardConfig', next);
  }

  /** Clear a single override back to inherited (no-op on desktop). */
  function clearField(key: keyof CardBreakpointOverrides): void {
    if (isDesktop) return;
    const next = clearCardBreakpointOverride(
      settings.cardConfig ?? { breakpoints: {} },
      activeBreakpoint,
      key,
    );
    updateSetting('cardConfig', next);
  }

  /** Clear a dimension value+unit pair back to inherited. */
  function clearDimField(
    valueKey: keyof CardBreakpointOverrides,
    unitKey: keyof CardBreakpointOverrides,
  ): void {
    if (isDesktop) return;
    const next = clearCardDimensionOverride(
      settings.cardConfig ?? { breakpoints: {} },
      activeBreakpoint,
      valueKey,
      unitKey,
    );
    updateSetting('cardConfig', next);
  }

  /** Render a small "Reset to inherited" link when a field has an override. */
  function ResetLink({ fieldKey, unitKey }: { fieldKey: keyof CardBreakpointOverrides; unitKey?: keyof CardBreakpointOverrides }) {
    if (isDesktop || !hasOverride(fieldKey)) return null;
    return (
      <Text
        size="xs"
        c="dimmed"
        style={{ cursor: 'pointer' }}
        onClick={() => unitKey ? clearDimField(fieldKey, unitKey) : clearField(fieldKey)}
      >
        ↻ Reset to inherited
      </Text>
    );
  }
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
            <SegmentedControl
              data={BREAKPOINT_OPTIONS}
              value={activeBreakpoint}
              onChange={(value) => setActiveBreakpoint(value as CardConfigBreakpoint)}
              size="xs"
              fullWidth
            />

            <ModalSelect
              label="Cards Per Row"
              description={desc('Number of columns in the card grid (Auto = responsive)', 'cardGridColumns')}
              data={[
                { value: '0', label: 'Auto (responsive)' },
                { value: '2', label: '2 columns' },
                { value: '3', label: '3 columns' },
                { value: '4', label: '4 columns' },
                { value: '5', label: '5 columns' },
                { value: '6', label: '6 columns' },
              ]}
              value={String(resolved.cardGridColumns)}
              onChange={(value) => writeField('cardGridColumns', parseInt(value ?? '0', 10))}
            />
            <ResetLink fieldKey="cardGridColumns" />

            {resolved.cardGridColumns === 0 && (
              <>
                <NumberInput
                  label="Max Columns (auto mode)"
                  description={desc('Cap the number of columns when using Auto layout. 0 = unlimited.', 'cardMaxColumns')}
                  value={resolved.cardMaxColumns}
                  onChange={(value) => writeField('cardMaxColumns', typeof value === 'number' ? value : 0)}
                  min={0}
                  max={8}
                />
                <ResetLink fieldKey="cardMaxColumns" />
              </>
            )}

            <DimensionInput
              label="Horizontal Gap"
              description={desc('Horizontal spacing between campaign cards', 'cardGapH')}
              value={resolved.cardGapH}
              unit={resolved.cardGapHUnit ?? 'px'}
              onValueChange={(value) => writeField('cardGapH', value)}
              onUnitChange={(unit) => writeField('cardGapHUnit', unit as GalleryBehaviorSettings['cardGapHUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={48}
              step={2}
            />
            <ResetLink fieldKey="cardGapH" unitKey="cardGapHUnit" />

            <DimensionInput
              label="Vertical Gap"
              description={desc('Vertical spacing between campaign card rows', 'cardGapV')}
              value={resolved.cardGapV}
              unit={resolved.cardGapVUnit ?? 'px'}
              onValueChange={(value) => writeField('cardGapV', value)}
              onUnitChange={(unit) => writeField('cardGapVUnit', unit as GalleryBehaviorSettings['cardGapVUnit'])}
              allowedUnits={CSS_SPACING_UNITS}
              max={48}
              step={2}
            />
            <ResetLink fieldKey="cardGapV" unitKey="cardGapVUnit" />

            <DimensionInput
              label="Card Max Width"
              description={desc('Limit individual card width. 0 = no limit (fill column).', 'cardMaxWidth')}
              value={resolved.cardMaxWidth}
              unit={resolved.cardMaxWidthUnit ?? 'px'}
              onValueChange={(value) => writeField('cardMaxWidth', value)}
              onUnitChange={(unit) => writeField('cardMaxWidthUnit', unit as GalleryBehaviorSettings['cardMaxWidthUnit'])}
              allowedUnits={CSS_WIDTH_UNITS}
              max={800}
              step={10}
              placeholder="0 = unlimited"
            />
            <ResetLink fieldKey="cardMaxWidth" unitKey="cardMaxWidthUnit" />

            <NumberInput
              label="Card Scale"
              description={desc('Primary sizing multiplier for cards. 1 = default size.', 'cardScale')}
              value={resolved.cardScale ?? 1}
              onChange={(value) => writeField('cardScale', typeof value === 'number' ? value : 1)}
              min={0.5}
              max={2}
              step={0.05}
              decimalScale={2}
            />
            <ResetLink fieldKey="cardScale" />

            <ModalSelect
              label="Card Justification"
              description={desc('How cards distribute when a row does not fill the full available width.', 'cardJustifyContent')}
              data={[
                { value: 'start', label: 'Start' },
                { value: 'center', label: 'Center' },
                { value: 'end', label: 'End' },
                { value: 'space-between', label: 'Space Between' },
                { value: 'space-evenly', label: 'Space Evenly' },
              ]}
              value={resolved.cardJustifyContent ?? 'center'}
              onChange={(value) => writeField('cardJustifyContent', (value ?? 'center') as GalleryBehaviorSettings['cardJustifyContent'])}
            />
            <ResetLink fieldKey="cardJustifyContent" />

            <ModalSelect
              label="Vertical Alignment"
              description={desc('How the card grid aligns vertically when minimum height exceeds content height.', 'cardGalleryVerticalAlign')}
              data={[
                { value: 'start', label: 'Top' },
                { value: 'center', label: 'Center' },
                { value: 'end', label: 'Bottom' },
              ]}
              value={resolved.cardGalleryVerticalAlign ?? 'start'}
              onChange={(value) => writeField('cardGalleryVerticalAlign', (value ?? 'start') as GalleryBehaviorSettings['cardGalleryVerticalAlign'])}
            />
            <ResetLink fieldKey="cardGalleryVerticalAlign" />

            <DimensionInput
              label="Grid Minimum Height"
              description={desc('Minimum height for the card grid container.', 'cardGalleryMinHeight')}
              value={resolved.cardGalleryMinHeight}
              unit={resolved.cardGalleryMinHeightUnit ?? 'px'}
              onValueChange={(value) => writeField('cardGalleryMinHeight', value)}
              onUnitChange={(unit) => writeField('cardGalleryMinHeightUnit', unit as GalleryBehaviorSettings['cardGalleryMinHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={1200}
              step={50}
              placeholder="0 = no minimum"
            />
            <ResetLink fieldKey="cardGalleryMinHeight" unitKey="cardGalleryMinHeightUnit" />

            <DimensionInput
              label="Grid Maximum Height"
              description={desc('Maximum height for the card grid area. 0 = no limit.', 'cardGalleryMaxHeight')}
              value={resolved.cardGalleryMaxHeight}
              unit={resolved.cardGalleryMaxHeightUnit ?? 'px'}
              onValueChange={(value) => writeField('cardGalleryMaxHeight', value)}
              onUnitChange={(unit) => writeField('cardGalleryMaxHeightUnit', unit as GalleryBehaviorSettings['cardGalleryMaxHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={2000}
              step={50}
              placeholder="0 = no maximum"
            />
            <ResetLink fieldKey="cardGalleryMaxHeight" unitKey="cardGalleryMaxHeightUnit" />

            <DimensionInput
              label="Grid Horizontal Offset"
              description={desc('Fine-tune horizontal position of the card grid.', 'cardGalleryOffsetX')}
              value={resolved.cardGalleryOffsetX ?? 0}
              unit={resolved.cardGalleryOffsetXUnit ?? 'px'}
              onValueChange={(value) => writeField('cardGalleryOffsetX', value)}
              onUnitChange={(unit) => writeField('cardGalleryOffsetXUnit', unit as GalleryBehaviorSettings['cardGalleryOffsetXUnit'])}
              allowedUnits={CSS_OFFSET_UNITS}
              max={200}
              step={4}
              allowNegative
            />
            <ResetLink fieldKey="cardGalleryOffsetX" unitKey="cardGalleryOffsetXUnit" />

            <DimensionInput
              label="Grid Vertical Offset"
              description={desc('Fine-tune vertical position of the card grid.', 'cardGalleryOffsetY')}
              value={resolved.cardGalleryOffsetY ?? 0}
              unit={resolved.cardGalleryOffsetYUnit ?? 'px'}
              onValueChange={(value) => writeField('cardGalleryOffsetY', value)}
              onUnitChange={(unit) => writeField('cardGalleryOffsetYUnit', unit as GalleryBehaviorSettings['cardGalleryOffsetYUnit'])}
              allowedUnits={CSS_OFFSET_UNITS}
              max={200}
              step={4}
              allowNegative
            />
            <ResetLink fieldKey="cardGalleryOffsetY" unitKey="cardGalleryOffsetYUnit" />

            <ModalSelect
              label="Card Aspect Ratio"
              description={desc('Lock cards to a fixed aspect ratio', 'cardAspectRatio')}
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
              value={resolved.cardAspectRatio ?? 'auto'}
              onChange={(value) => writeField('cardAspectRatio', (value ?? 'auto') as GalleryBehaviorSettings['cardAspectRatio'])}
            />
            <ResetLink fieldKey="cardAspectRatio" />

            <DimensionInput
              label="Card Min Height"
              description={desc('Minimum height for each card. 0 = no minimum.', 'cardMinHeight')}
              value={resolved.cardMinHeight}
              unit={resolved.cardMinHeightUnit ?? 'px'}
              onValueChange={(value) => writeField('cardMinHeight', value)}
              onUnitChange={(unit) => writeField('cardMinHeightUnit', unit as GalleryBehaviorSettings['cardMinHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={600}
              step={10}
            />
            <ResetLink fieldKey="cardMinHeight" unitKey="cardMinHeightUnit" />

            <Divider label="Pagination" labelPosition="left" />
            <ModalSelect
              label="Display Mode"
              description={desc('How cards are displayed: all at once, progressively loaded, or paginated with arrows', 'cardDisplayMode')}
              data={[
                { value: 'show-all', label: 'Show All' },
                { value: 'load-more', label: 'Load More (progressive)' },
                { value: 'paginated', label: 'Paginated (arrows)' },
              ]}
              value={resolved.cardDisplayMode}
              onChange={(value) => writeField('cardDisplayMode', (value ?? 'load-more') as GalleryBehaviorSettings['cardDisplayMode'])}
            />
            <ResetLink fieldKey="cardDisplayMode" />

            {resolved.cardDisplayMode === 'paginated' && (
              <>
                <NumberInput
                  label="Rows Per Page"
                  description={desc('Number of card rows visible per page', 'cardRowsPerPage')}
                  value={resolved.cardRowsPerPage}
                  onChange={(value) => writeField('cardRowsPerPage', typeof value === 'number' ? value : 3)}
                  min={1}
                  max={10}
                  step={1}
                />
                <ResetLink fieldKey="cardRowsPerPage" />
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