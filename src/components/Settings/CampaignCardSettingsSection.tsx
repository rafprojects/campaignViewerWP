import { useMemo } from 'react';
import { Accordion, Divider, NumberInput, Slider, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { DimensionInput } from '@/components/Settings/DimensionInput';

import type { CardBreakpointOverrides, CardConfigBreakpoint, GalleryBehaviorSettings } from '@/types';
import { CSS_BORDER_RADIUS_UNITS, CSS_HEIGHT_UNITS, CSS_OFFSET_UNITS, CSS_SPACING_UNITS, CSS_WIDTH_UNITS } from '@wp-super-gallery/shared-utils';
import {
  resolveCardBreakpointSettings,
  setCardBreakpointOverride,
  clearCardBreakpointOverride,
  clearCardDimensionOverride,
} from '@/utils/cardConfig';
// P35-B: Listing adapter selector
import { getListingAdapterSelectOptions } from '@/components/Galleries/Adapters/adapterRegistry';
// P37-LB: Layout templates for listing-builder template selector
import { useLayoutTemplates } from '@/services/layoutTemplateQuery';
import type { ApiClient } from '@/services/apiClient';

import type { UpdateGallerySetting } from './GalleryAdapterSettingsSection';

interface CampaignCardSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
  activeBreakpoint: CardConfigBreakpoint;
  /** P37-LB: Required to fetch layout templates for the listing-builder template selector. */
  apiClient: ApiClient;
}

export function CampaignCardSettingsSection({ settings, updateSetting, activeBreakpoint, apiClient }: CampaignCardSettingsSectionProps) {
  const { t } = useTranslation('wpsg');
  const isDesktop = activeBreakpoint === 'desktop';

  // P37-LB: Fetch layout templates for listing-builder template selector
  const { data: layoutTemplates } = useLayoutTemplates(apiClient);

  // Resolved settings = flat base + cascaded overrides for the active breakpoint.
  const resolved = useMemo(
    () => resolveCardBreakpointSettings(settings, activeBreakpoint),
    [settings, activeBreakpoint],
  );
  const resolvedBorderMode = resolved.cardBorderMode ?? 'auto';

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
    if (hasOverride(key)) return t('set_card_override', '{{base}} — Override for {{bp}}', { base, bp: activeBreakpoint });
    return t('set_card_inherited', '{{base}} — Inherited from {{bp}}', { base, bp: inheritLabel(key) });
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
        {t('set_card_reset_inherited', '↻ Reset to inherited')}
      </Text>
    );
  }
  return (
    <>
      <Accordion.Item value="appearance">
        <Accordion.Control>{t('set_card_appearance', 'Card Appearance')}</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <DimensionInput
              label={t('set_card_border_radius', 'Border Radius')}
              description={desc(t('set_card_border_radius_desc', 'Corner rounding for campaign cards'), 'cardBorderRadius')}
              value={resolved.cardBorderRadius}
              unit={resolved.cardBorderRadiusUnit ?? 'px'}
              onValueChange={(value) => writeField('cardBorderRadius', value)}
              onUnitChange={(unit) => writeField('cardBorderRadiusUnit', unit as GalleryBehaviorSettings['cardBorderRadiusUnit'])}
              allowedUnits={CSS_BORDER_RADIUS_UNITS}
              max={24}
              step={1}
            />
            <ResetLink fieldKey="cardBorderRadius" unitKey="cardBorderRadiusUnit" />
            <NumberInput
              label={t('set_card_border_width', 'Border Width (px)')}
              description={desc(t('set_card_border_width_desc', 'Left accent border thickness'), 'cardBorderWidth')}
              value={resolved.cardBorderWidth}
              onChange={(value) => writeField('cardBorderWidth', typeof value === 'number' ? value : 4)}
              min={0}
              max={8}
              step={1}
            />
            <ResetLink fieldKey="cardBorderWidth" />
            <ModalSelect
              label={t('set_card_border_mode', 'Border Color Mode')}
              description={desc(t('set_card_border_mode_desc', 'How card accent border colors are determined'), 'cardBorderMode')}
              data={[
                { value: 'auto', label: t('set_card_border_auto', 'Auto (company brand color)') },
                { value: 'single', label: t('set_card_border_single', 'Single color for all cards') },
                { value: 'individual', label: t('set_card_border_individual', 'Per-card color (set in Edit Campaign)') },
              ]}
              value={resolvedBorderMode}
              onChange={(value) => writeField('cardBorderMode', (value ?? 'auto') as GalleryBehaviorSettings['cardBorderMode'])}
            />
            <ResetLink fieldKey="cardBorderMode" />
            {resolvedBorderMode === 'single' && (
              <ColorInput
                label={t('set_card_border_color', 'Border Color')}
                description={desc(t('set_card_border_color_desc', 'Accent border color applied to all campaign cards'), 'cardBorderColor')}
                value={resolved.cardBorderColor}
                onChange={(value) => writeField('cardBorderColor', value)}
              />
            )}
            {resolvedBorderMode === 'single' && <ResetLink fieldKey="cardBorderColor" />}
            <ModalSelect
              label={t('set_card_shadow', 'Card Shadow')}
              description={desc(t('set_card_shadow_desc', 'Depth effect for campaign cards'), 'cardShadowPreset')}
              data={[
                { value: 'none', label: t('set_card_shadow_none', 'None') },
                { value: 'subtle', label: t('set_card_shadow_subtle', 'Subtle') },
                { value: 'medium', label: t('set_card_shadow_medium', 'Medium') },
                { value: 'dramatic', label: t('set_card_shadow_dramatic', 'Dramatic') },
              ]}
              value={resolved.cardShadowPreset}
              onChange={(value) => writeField('cardShadowPreset', value ?? 'subtle')}
            />
            <ResetLink fieldKey="cardShadowPreset" />
            <DimensionInput
              label={t('set_card_thumb_h', 'Thumbnail Height')}
              description={desc(t('set_card_thumb_h_desc', 'Height of the card thumbnail area'), 'cardThumbnailHeight')}
              value={resolved.cardThumbnailHeight}
              unit={resolved.cardThumbnailHeightUnit ?? 'px'}
              onValueChange={(value) => writeField('cardThumbnailHeight', value)}
              onUnitChange={(unit) => writeField('cardThumbnailHeightUnit', unit as GalleryBehaviorSettings['cardThumbnailHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={400}
              step={10}
            />
            <ResetLink fieldKey="cardThumbnailHeight" unitKey="cardThumbnailHeightUnit" />
            <ModalSelect
              label={t('set_card_thumb_fit', 'Thumbnail Fit')}
              description={desc(t('set_card_thumb_fit_desc', 'How the thumbnail image fills the card'), 'cardThumbnailFit')}
              data={[
                { value: 'cover', label: t('set_card_fit_cover', 'Cover (fill)') },
                { value: 'contain', label: t('set_card_fit_contain', 'Contain (fit)') },
              ]}
              value={resolved.cardThumbnailFit}
              onChange={(value) => writeField('cardThumbnailFit', value ?? 'cover')}
            />
            <ResetLink fieldKey="cardThumbnailFit" />

            <Divider label={t('set_card_element_vis', 'Element Visibility')} labelPosition="center" />

            <Switch
              label={t('set_card_show_company', 'Show company name badge')}
              description={desc(t('set_card_show_company_desc', 'Company badge overlay on card thumbnail'), 'showCardCompanyName')}
              checked={resolved.showCardCompanyName ?? true}
              onChange={(event) => writeField('showCardCompanyName', event.currentTarget.checked)}
            />
            <ResetLink fieldKey="showCardCompanyName" />
            <Switch
              label={t('set_card_show_access', 'Show access badge')}
              description={desc(t('set_card_show_access_desc', "Green 'Access' badge on accessible cards"), 'showCardAccessBadge')}
              checked={resolved.showCardAccessBadge ?? true}
              onChange={(event) => writeField('showCardAccessBadge', event.currentTarget.checked)}
            />
            <ResetLink fieldKey="showCardAccessBadge" />
            <Switch
              label={t('set_card_show_title', 'Show card title')}
              description={desc(t('set_card_show_title_desc', 'Show the campaign title in the card info panel'), 'showCardTitle')}
              checked={resolved.showCardTitle ?? true}
              onChange={(event) => writeField('showCardTitle', event.currentTarget.checked)}
            />
            <ResetLink fieldKey="showCardTitle" />
            <Switch
              label={t('set_card_show_desc', 'Show card description')}
              description={desc(t('set_card_show_desc_desc', 'Show the campaign description in the card info panel'), 'showCardDescription')}
              checked={resolved.showCardDescription ?? true}
              onChange={(event) => writeField('showCardDescription', event.currentTarget.checked)}
            />
            <ResetLink fieldKey="showCardDescription" />
            <Switch
              label={t('set_card_show_counts', 'Show media counts')}
              description={desc(t('set_card_show_counts_desc', 'Video and image count below description'), 'showCardMediaCounts')}
              checked={resolved.showCardMediaCounts ?? true}
              onChange={(event) => writeField('showCardMediaCounts', event.currentTarget.checked)}
            />
            <ResetLink fieldKey="showCardMediaCounts" />
            <Switch
              label={t('set_card_show_border', 'Show card border')}
              description={desc(t('set_card_show_border_desc', 'Accent border and hover border effect'), 'showCardBorder')}
              checked={resolved.showCardBorder ?? true}
              onChange={(event) => writeField('showCardBorder', event.currentTarget.checked)}
            />
            <ResetLink fieldKey="showCardBorder" />
            <Switch
              label={t('set_card_show_fade', 'Show thumbnail fade')}
              description={desc(t('set_card_show_fade_desc', 'Gradient overlay at bottom of thumbnail'), 'showCardThumbnailFade')}
              checked={resolved.showCardThumbnailFade ?? true}
              onChange={(event) => writeField('showCardThumbnailFade', event.currentTarget.checked)}
            />
            <ResetLink fieldKey="showCardThumbnailFade" />
            <Switch
              label={t('set_card_show_info', 'Show card info panel')}
              description={desc(t('set_card_show_info_desc', 'Show title, description, tags & media counts below thumbnail'), 'showCardInfoPanel')}
              checked={resolved.showCardInfoPanel ?? true}
              onChange={(event) => writeField('showCardInfoPanel', event.currentTarget.checked)}
            />
            <ResetLink fieldKey="showCardInfoPanel" />
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="grid-pagination">
        <Accordion.Control>{t('set_card_grid_pag', 'Card Grid & Pagination')}</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <ModalSelect
              label={t('set_card_per_row', 'Cards Per Row')}
              description={desc(t('set_card_per_row_desc', 'Number of columns in the card grid (Auto = responsive)'), 'cardGridColumns')}
              data={[
                { value: '0', label: t('set_card_cols_auto', 'Auto (responsive)') },
                { value: '2', label: t('set_card_cols_2', '2 columns') },
                { value: '3', label: t('set_card_cols_3', '3 columns') },
                { value: '4', label: t('set_card_cols_4', '4 columns') },
                { value: '5', label: t('set_card_cols_5', '5 columns') },
                { value: '6', label: t('set_card_cols_6', '6 columns') },
              ]}
              value={String(resolved.cardGridColumns)}
              onChange={(value) => writeField('cardGridColumns', parseInt(value ?? '0', 10))}
            />
            <ResetLink fieldKey="cardGridColumns" />

            {resolved.cardGridColumns === 0 && (
              <>
                <NumberInput
                  label={t('set_card_max_cols', 'Max Columns (auto mode)')}
                  description={desc(t('set_card_max_cols_desc', 'Cap the number of columns when using Auto layout. 0 = unlimited.'), 'cardMaxColumns')}
                  value={resolved.cardMaxColumns}
                  onChange={(value) => writeField('cardMaxColumns', typeof value === 'number' ? value : 0)}
                  min={0}
                  max={8}
                />
                <ResetLink fieldKey="cardMaxColumns" />
              </>
            )}

            <DimensionInput
              label={t('set_card_hgap', 'Horizontal Gap')}
              description={desc(t('set_card_hgap_desc', 'Horizontal spacing between campaign cards'), 'cardGapH')}
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
              label={t('set_card_vgap', 'Vertical Gap')}
              description={desc(t('set_card_vgap_desc', 'Vertical spacing between campaign card rows'), 'cardGapV')}
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
              label={t('set_card_maxw', 'Card Max Width')}
              description={desc(t('set_card_maxw_desc', 'Limit individual card width. 0 = no limit (fill column).'), 'cardMaxWidth')}
              value={resolved.cardMaxWidth}
              unit={resolved.cardMaxWidthUnit ?? 'px'}
              onValueChange={(value) => writeField('cardMaxWidth', value)}
              onUnitChange={(unit) => writeField('cardMaxWidthUnit', unit as GalleryBehaviorSettings['cardMaxWidthUnit'])}
              allowedUnits={CSS_WIDTH_UNITS}
              max={800}
              step={10}
              placeholder={t('set_card_ph_unlimited', '0 = unlimited')}
            />
            <ResetLink fieldKey="cardMaxWidth" unitKey="cardMaxWidthUnit" />

            <NumberInput
              label={t('set_card_scale', 'Card Scale')}
              description={desc(t('set_card_scale_desc', 'Primary sizing multiplier for cards. 1 = default size.'), 'cardScale')}
              value={resolved.cardScale ?? 1}
              onChange={(value) => writeField('cardScale', typeof value === 'number' ? value : 1)}
              min={0.5}
              max={2}
              step={0.05}
              decimalScale={2}
            />
            <ResetLink fieldKey="cardScale" />

            <ModalSelect
              label={t('set_card_justify', 'Card Justification')}
              description={desc(t('set_card_justify_desc', 'How cards distribute when a row does not fill the full available width.'), 'cardJustifyContent')}
              data={[
                { value: 'start', label: t('set_card_justify_start', 'Start') },
                { value: 'center', label: t('set_card_justify_center', 'Center') },
                { value: 'end', label: t('set_card_justify_end', 'End') },
                { value: 'space-between', label: t('set_card_justify_between', 'Space Between') },
                { value: 'space-evenly', label: t('set_card_justify_evenly', 'Space Evenly') },
              ]}
              value={resolved.cardJustifyContent ?? 'center'}
              onChange={(value) => writeField('cardJustifyContent', (value ?? 'center') as GalleryBehaviorSettings['cardJustifyContent'])}
            />
            <ResetLink fieldKey="cardJustifyContent" />

            <ModalSelect
              label={t('set_card_valign', 'Vertical Alignment')}
              description={desc(t('set_card_valign_desc', 'How the card grid aligns vertically when minimum height exceeds content height.'), 'cardGalleryVerticalAlign')}
              data={[
                { value: 'start', label: t('set_card_valign_top', 'Top') },
                { value: 'center', label: t('set_card_justify_center', 'Center') },
                { value: 'end', label: t('set_card_valign_bottom', 'Bottom') },
              ]}
              value={resolved.cardGalleryVerticalAlign ?? 'start'}
              onChange={(value) => writeField('cardGalleryVerticalAlign', (value ?? 'start') as GalleryBehaviorSettings['cardGalleryVerticalAlign'])}
            />
            <ResetLink fieldKey="cardGalleryVerticalAlign" />

            <DimensionInput
              label={t('set_card_grid_minh', 'Grid Minimum Height')}
              description={desc(t('set_card_grid_minh_desc', 'Minimum height for the card grid container.'), 'cardGalleryMinHeight')}
              value={resolved.cardGalleryMinHeight}
              unit={resolved.cardGalleryMinHeightUnit ?? 'px'}
              onValueChange={(value) => writeField('cardGalleryMinHeight', value)}
              onUnitChange={(unit) => writeField('cardGalleryMinHeightUnit', unit as GalleryBehaviorSettings['cardGalleryMinHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={1200}
              step={50}
              placeholder={t('set_card_ph_no_min', '0 = no minimum')}
            />
            <ResetLink fieldKey="cardGalleryMinHeight" unitKey="cardGalleryMinHeightUnit" />

            <DimensionInput
              label={t('set_card_grid_maxh', 'Grid Maximum Height')}
              description={desc(t('set_card_grid_maxh_desc', 'Maximum height for the card grid area. 0 = no limit.'), 'cardGalleryMaxHeight')}
              value={resolved.cardGalleryMaxHeight}
              unit={resolved.cardGalleryMaxHeightUnit ?? 'px'}
              onValueChange={(value) => writeField('cardGalleryMaxHeight', value)}
              onUnitChange={(unit) => writeField('cardGalleryMaxHeightUnit', unit as GalleryBehaviorSettings['cardGalleryMaxHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={2000}
              step={50}
              placeholder={t('set_card_ph_no_max', '0 = no maximum')}
            />
            <ResetLink fieldKey="cardGalleryMaxHeight" unitKey="cardGalleryMaxHeightUnit" />

            <DimensionInput
              label={t('set_card_grid_offx', 'Grid Horizontal Offset')}
              description={desc(t('set_card_grid_offx_desc', 'Fine-tune horizontal position of the card grid.'), 'cardGalleryOffsetX')}
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
              label={t('set_card_grid_offy', 'Grid Vertical Offset')}
              description={desc(t('set_card_grid_offy_desc', 'Fine-tune vertical position of the card grid.'), 'cardGalleryOffsetY')}
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
              label={t('set_card_aspect', 'Card Aspect Ratio')}
              description={desc(t('set_card_aspect_desc', 'Lock cards to a fixed aspect ratio'), 'cardAspectRatio')}
              data={[
                { value: 'auto', label: t('set_card_ar_auto', 'Auto (natural)') },
                { value: '16:9', label: t('set_card_ar_16_9', '16:9 (widescreen)') },
                { value: '4:3', label: t('set_card_ar_4_3', '4:3 (standard)') },
                { value: '1:1', label: t('set_card_ar_1_1', '1:1 (square)') },
                { value: '3:4', label: t('set_card_ar_3_4', '3:4 (portrait)') },
                { value: '9:16', label: t('set_card_ar_9_16', '9:16 (tall portrait)') },
                { value: '2:3', label: t('set_card_ar_2_3', '2:3 (photo portrait)') },
                { value: '3:2', label: t('set_card_ar_3_2', '3:2 (photo landscape)') },
                { value: '21:9', label: t('set_card_ar_21_9', '21:9 (ultrawide)') },
              ]}
              value={resolved.cardAspectRatio ?? 'auto'}
              onChange={(value) => writeField('cardAspectRatio', (value ?? 'auto') as GalleryBehaviorSettings['cardAspectRatio'])}
            />
            <ResetLink fieldKey="cardAspectRatio" />

            <DimensionInput
              label={t('set_card_minh', 'Card Min Height')}
              description={desc(t('set_card_minh_desc', 'Minimum height for each card. 0 = no minimum.'), 'cardMinHeight')}
              value={resolved.cardMinHeight}
              unit={resolved.cardMinHeightUnit ?? 'px'}
              onValueChange={(value) => writeField('cardMinHeight', value)}
              onUnitChange={(unit) => writeField('cardMinHeightUnit', unit as GalleryBehaviorSettings['cardMinHeightUnit'])}
              allowedUnits={CSS_HEIGHT_UNITS}
              max={600}
              step={10}
            />
            <ResetLink fieldKey="cardMinHeight" unitKey="cardMinHeightUnit" />

            <Divider label={t('set_card_pagination', 'Pagination')} labelPosition="left" />
            <ModalSelect
              label={t('set_card_display_mode', 'Display Mode')}
              description={desc(t('set_card_display_mode_desc', 'How cards are displayed: all at once, progressively loaded, or paginated with arrows'), 'cardDisplayMode')}
              data={[
                { value: 'show-all', label: t('set_card_dm_all', 'Show All') },
                { value: 'load-more', label: t('set_card_dm_more', 'Load More (progressive)') },
                { value: 'paginated', label: t('set_card_dm_paged', 'Paginated (arrows)') },
              ]}
              value={resolved.cardDisplayMode}
              onChange={(value) => writeField('cardDisplayMode', (value ?? 'load-more') as GalleryBehaviorSettings['cardDisplayMode'])}
            />
            <ResetLink fieldKey="cardDisplayMode" />

            {resolved.cardDisplayMode === 'paginated' && (
              <>
                <NumberInput
                  label={t('set_card_rows_page', 'Rows Per Page')}
                  description={desc(t('set_card_rows_page_desc', 'Number of card rows visible per page'), 'cardRowsPerPage')}
                  value={resolved.cardRowsPerPage}
                  onChange={(value) => writeField('cardRowsPerPage', typeof value === 'number' ? value : 3)}
                  min={1}
                  max={10}
                  step={1}
                />
                <ResetLink fieldKey="cardRowsPerPage" />
                <Switch
                  label={t('set_card_dot_nav', 'Dot Navigator')}
                  description={desc(t('set_card_dot_nav_desc', 'Show dot navigator below the card grid'), 'cardPageDotNav')}
                  checked={resolved.cardPageDotNav}
                  onChange={(event) => writeField('cardPageDotNav', event.currentTarget.checked)}
                />
                <ResetLink fieldKey="cardPageDotNav" />
                <NumberInput
                  label={t('set_card_page_trans', 'Page Transition Duration (ms)')}
                  description={desc(t('set_card_page_trans_desc', 'Slide animation speed between pages'), 'cardPageTransitionMs')}
                  value={resolved.cardPageTransitionMs}
                  onChange={(value) => writeField('cardPageTransitionMs', typeof value === 'number' ? value : 300)}
                  min={100}
                  max={800}
                  step={50}
                />
                <ResetLink fieldKey="cardPageTransitionMs" />
              </>
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="card-internals">
        <Accordion.Control>{t('set_card_internals', 'Card Internals')}</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <Text size="sm" fw={500}>{t('set_card_locked_opacity', 'Locked Card Opacity')}</Text>
            <Slider
              value={resolved.cardLockedOpacity}
              onChange={(value) => writeField('cardLockedOpacity', value)}
              min={0}
              max={1}
              step={0.05}
              marks={[{ value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }]}
            />
            <ResetLink fieldKey="cardLockedOpacity" />
            <Text size="sm" fw={500}>{t('set_card_grad_start', 'Gradient Start Opacity')}</Text>
            <Slider
              value={resolved.cardGradientStartOpacity}
              onChange={(value) => writeField('cardGradientStartOpacity', value)}
              min={0}
              max={1}
              step={0.05}
            />
            <ResetLink fieldKey="cardGradientStartOpacity" />
            <Text size="sm" fw={500}>{t('set_card_grad_end', 'Gradient End Opacity')}</Text>
            <Slider
              value={resolved.cardGradientEndOpacity}
              onChange={(value) => writeField('cardGradientEndOpacity', value)}
              min={0}
              max={1}
              step={0.05}
            />
            <ResetLink fieldKey="cardGradientEndOpacity" />
            <NumberInput
              label={t('set_card_lock_icon', 'Lock Icon Size (px)')}
              description={desc(t('set_card_lock_icon_desc', 'Size of the lock icon shown on inaccessible cards'), 'cardLockIconSize')}
              value={resolved.cardLockIconSize}
              onChange={(value) => writeField('cardLockIconSize', typeof value === 'number' ? value : 32)}
              min={12}
              max={64}
            />
            <ResetLink fieldKey="cardLockIconSize" />
            <NumberInput
              label={t('set_card_access_icon', 'Access Icon Size (px)')}
              description={desc(t('set_card_access_icon_desc', 'Size of the icon inside the access badge'), 'cardAccessIconSize')}
              value={resolved.cardAccessIconSize}
              onChange={(value) => writeField('cardAccessIconSize', typeof value === 'number' ? value : 14)}
              min={8}
              max={32}
            />
            <ResetLink fieldKey="cardAccessIconSize" />
            <NumberInput
              label={t('set_card_badge_offy', 'Badge Offset Y (px)')}
              description={desc(t('set_card_badge_offy_desc', 'Vertical offset from the top edge for access and company badges'), 'cardBadgeOffsetY')}
              value={resolved.cardBadgeOffsetY}
              onChange={(value) => writeField('cardBadgeOffsetY', typeof value === 'number' ? value : 8)}
              min={0}
              max={32}
            />
            <ResetLink fieldKey="cardBadgeOffsetY" />
            <NumberInput
              label={t('set_card_company_maxw', 'Company Badge Max Width (px)')}
              description={desc(t('set_card_company_maxw_desc', 'Maximum width of the company badge before truncation'), 'cardCompanyBadgeMaxWidth')}
              value={resolved.cardCompanyBadgeMaxWidth}
              onChange={(value) => writeField('cardCompanyBadgeMaxWidth', typeof value === 'number' ? value : 160)}
              min={60}
              max={400}
            />
            <ResetLink fieldKey="cardCompanyBadgeMaxWidth" />
            <NumberInput
              label={t('set_card_thumb_hover', 'Thumbnail Hover Transition (ms)')}
              description={desc(t('set_card_thumb_hover_desc', 'Duration of the thumbnail hover zoom effect'), 'cardThumbnailHoverTransitionMs')}
              value={resolved.cardThumbnailHoverTransitionMs}
              onChange={(value) => writeField('cardThumbnailHoverTransitionMs', typeof value === 'number' ? value : 300)}
              min={0}
              max={1000}
            />
            <ResetLink fieldKey="cardThumbnailHoverTransitionMs" />
            <Text size="sm" fw={500}>{t('set_card_page_opacity', 'Page Transition Opacity')}</Text>
            <Slider
              value={resolved.cardPageTransitionOpacity}
              onChange={(value) => writeField('cardPageTransitionOpacity', value)}
              min={0}
              max={1}
              step={0.05}
            />
            <ResetLink fieldKey="cardPageTransitionOpacity" />
            <TextInput
              label={t('set_card_auto_cols_bp', 'Auto Columns Breakpoints')}
              description={desc(t('set_card_auto_cols_bp_desc', 'Format: 480:1,768:2,1024:3,1280:4'), 'cardAutoColumnsBreakpoints')}
              value={resolved.cardAutoColumnsBreakpoints}
              onChange={(event) => writeField('cardAutoColumnsBreakpoints', event.currentTarget.value)}
            />
            <ResetLink fieldKey="cardAutoColumnsBreakpoints" />
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      {/* P35-B: Campaign Listing layout selector */}
      <Accordion.Item value="campaign-listing">
        <Accordion.Control>{t('set_card_listing', 'Campaign Listing')}</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <Text size="xs" c="dimmed">
              {t('set_card_listing_intro', 'Choose the layout adapter used to render the public campaign listing. Adapter-specific knobs (gap, columns, target row height) are shared with per-campaign galleries in Phase 1.')}
            </Text>
            <ModalSelect
              label={t('set_card_listing_desktop', 'Listing Layout (Desktop)')}
              description={t('set_card_listing_desktop_desc', 'Layout adapter for the campaign listing on desktop.')}
              data={getListingAdapterSelectOptions('desktop')}
              value={settings.campaignListingAdapterId ?? 'compact-grid'}
              onChange={(value) => updateSetting('campaignListingAdapterId', value ?? 'compact-grid')}
            />
            <ModalSelect
              label={t('set_card_listing_tablet', 'Listing Layout (Tablet)')}
              description={t('set_card_listing_override_desc', 'Optional override for tablet. Leave unset to inherit the desktop selection.')}
              data={[
                { value: '', label: t('set_card_inherit_desktop', 'Inherit from desktop') },
                ...getListingAdapterSelectOptions('tablet'),
              ]}
              value={settings.campaignListingAdapterIdTablet ?? ''}
              onChange={(value) =>
                updateSetting('campaignListingAdapterIdTablet', value ?? '')
              }
            />
            <ModalSelect
              label={t('set_card_listing_mobile', 'Listing Layout (Mobile)')}
              description={t('set_card_listing_override_mobile_desc', 'Optional override for mobile. Leave unset to inherit the desktop selection.')}
              data={[
                { value: '', label: t('set_card_inherit_desktop', 'Inherit from desktop') },
                ...getListingAdapterSelectOptions('mobile'),
              ]}
              value={settings.campaignListingAdapterIdMobile ?? ''}
              onChange={(value) =>
                updateSetting('campaignListingAdapterIdMobile', value ?? '')
              }
            />
            {/* P37-LB: template selector for layout-builder listing adapter */}
            {(settings.campaignListingAdapterId === 'layout-builder' ||
              settings.campaignListingAdapterIdTablet === 'layout-builder' ||
              settings.campaignListingAdapterIdMobile === 'layout-builder') && (
              <ModalSelect
                label={t('set_card_listing_template', 'Listing Layout Template')}
                description={t('set_card_listing_template_desc', 'The template whose slots define the positioned containers for campaign cards.')}
                data={[
                  { value: '', label: t('set_card_no_template', 'No template selected') },
                  ...(layoutTemplates ?? []).map((lt) => ({ value: lt.id, label: lt.name })),
                ]}
                value={settings.campaignListingLayoutTemplateId ?? ''}
                onChange={(value) =>
                  updateSetting('campaignListingLayoutTemplateId', value ?? '')
                }
              />
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </>
  );
}