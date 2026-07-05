import { Accordion, NumberInput, Stack, Switch, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { GradientEditor } from '@/components/Common/GradientEditor';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { DimensionInput } from '@/components/Settings/DimensionInput';
import { useLazyAccordion } from '@wp-super-gallery/shared-utils';
import { type GalleryBehaviorSettings } from '@/types';
import { CSS_WIDTH_UNITS, CSS_SPACING_UNITS } from '@wp-super-gallery/shared-utils';

import { ThemeSelector } from '../Admin/ThemeSelector';

interface GeneralSettingsData extends GalleryBehaviorSettings {
  theme?: string | undefined;
  galleryLayout: 'grid' | 'masonry' | 'carousel';
  itemsPerPage: number;
  enableLightbox: boolean;
  enableAnimations: boolean;
}

interface GeneralSettingsSectionProps {
  settings: GeneralSettingsData;
  updateSetting: <K extends keyof GeneralSettingsData>(key: K, value: GeneralSettingsData[K]) => void;
  onThemeChange: (themeId: string) => void;
  isSystemAdmin?: boolean;
}

export function GeneralSettingsSection({ settings, updateSetting, onThemeChange, isSystemAdmin = false }: GeneralSettingsSectionProps) {
  const { t } = useTranslation('wpsg');
  const { mounted, onChange } = useLazyAccordion('gen-theme');

  return (
    <Accordion variant="separated" defaultValue="gen-theme" onChange={onChange}>
      <Accordion.Item value="gen-theme">
        <Accordion.Control>{t('set_gen_theme_layout', 'Theme & Layout')}</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('gen-theme') ? (
            <Stack gap="md">
              <ThemeSelector
                description={t('set_theme_desc', 'Choose a color theme. Preview applies instantly; saved when you click Save.')}
                value={settings.theme}
                onThemeChange={onThemeChange}
              />

              <ModalSelect
                label={t('set_default_layout', 'Default Layout')}
                description={t('set_default_layout_desc', 'Default layout for displaying gallery items.')}
                value={settings.galleryLayout}
                onChange={(value) => updateSetting('galleryLayout', (value as GeneralSettingsData['galleryLayout']) ?? 'grid')}
                data={[
                  { value: 'grid', label: t('set_layout_grid', 'Grid') },
                  { value: 'masonry', label: t('set_layout_masonry', 'Masonry') },
                  { value: 'carousel', label: t('set_layout_carousel', 'Carousel') },
                ]}
              />

              <NumberInput
                label={t('set_items_per_page', 'Items Per Page')}
                description={t('set_items_per_page_desc', 'Number of items to display per page (1-100).')}
                value={settings.itemsPerPage}
                onChange={(value) => updateSetting('itemsPerPage', typeof value === 'number' ? value : 12)}
                min={1}
                max={100}
                step={1}
              />
            </Stack>
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="gen-container">
        <Accordion.Control>{t('set_page_container', 'Page Container')}</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('gen-container') ? (
            <Stack gap="md">
              <DimensionInput
                label={t('set_app_max_width', 'App Max Width')}
                description={t('set_app_max_width_desc', 'Maximum width of the gallery container. Set to 0 for full-width (edge-to-edge). Default 1200px.')}
                value={settings.appMaxWidth}
                unit={settings.appMaxWidthUnit ?? 'px'}
                onValueChange={(value) => updateSetting('appMaxWidth', value)}
                onUnitChange={(unit) => updateSetting('appMaxWidthUnit', unit as GalleryBehaviorSettings['appMaxWidthUnit'])}
                allowedUnits={CSS_WIDTH_UNITS}
                max={3000}
                step={50}
                placeholder={t('set_full_width_ph', '0 = full width')}
              />

              <DimensionInput
                label={t('set_container_padding', 'Container Padding')}
                description={t('set_container_padding_desc', 'Horizontal padding inside the container. Set to 0 for true edge-to-edge content. Default 16px.')}
                value={settings.appPadding}
                unit={settings.appPaddingUnit ?? 'px'}
                onValueChange={(value) => updateSetting('appPadding', value)}
                onUnitChange={(unit) => updateSetting('appPaddingUnit', unit as GalleryBehaviorSettings['appPaddingUnit'])}
                allowedUnits={CSS_SPACING_UNITS}
                max={100}
                step={4}
                placeholder="16"
              />

              <Switch
                label={t('set_fullbleed_desktop', 'WP Full Bleed — Desktop (≥ 1024px)')}
                description={t('set_fullbleed_desktop_desc', 'Break out of the WordPress page container padding on desktop viewports. Requires page refresh.')}
                checked={settings.wpFullBleedDesktop}
                onChange={(event) => updateSetting('wpFullBleedDesktop', event.currentTarget.checked)}
              />
              <Switch
                label={t('set_fullbleed_tablet', 'WP Full Bleed — Tablet (768-1023px)')}
                description={t('set_fullbleed_tablet_desc', 'Break out of the WordPress page container padding on tablet viewports. Requires page refresh.')}
                checked={settings.wpFullBleedTablet}
                onChange={(event) => updateSetting('wpFullBleedTablet', event.currentTarget.checked)}
              />
              <Switch
                label={t('set_fullbleed_mobile', 'WP Full Bleed — Mobile (< 768px)')}
                description={t('set_fullbleed_mobile_desc', 'Break out of the WordPress page container padding on mobile viewports. Requires page refresh.')}
                checked={settings.wpFullBleedMobile}
                onChange={(event) => updateSetting('wpFullBleedMobile', event.currentTarget.checked)}
              />
            </Stack>
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="gen-header">
        <Accordion.Control>{t('set_page_header', 'Page Header')}</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('gen-header') ? (
            <Stack gap="md">
              <Switch
                label={t('set_show_gallery_title', 'Show Gallery Title')}
                description={t('set_show_gallery_title_desc', 'Show the "Campaign Gallery" heading.')}
                checked={settings.showGalleryTitle}
                onChange={(event) => updateSetting('showGalleryTitle', event.currentTarget.checked)}
              />
              <TextInput
                label={t('set_gallery_title_text', 'Gallery Title Text')}
                description={t('set_gallery_title_text_desc', 'Main heading text shown above the gallery.')}
                value={settings.galleryTitleText}
                onChange={(event) => updateSetting('galleryTitleText', event.currentTarget.value)}
              />
              <Switch
                label={t('set_show_gallery_subtitle', 'Show Gallery Subtitle')}
                description={t('set_show_gallery_subtitle_desc', 'Show the subtitle text beneath the title.')}
                checked={settings.showGallerySubtitle}
                onChange={(event) => updateSetting('showGallerySubtitle', event.currentTarget.checked)}
              />
              <TextInput
                label={t('set_gallery_subtitle_text', 'Gallery Subtitle Text')}
                description={t('set_gallery_subtitle_text_desc', 'Subtitle text shown beneath the title.')}
                value={settings.gallerySubtitleText}
                onChange={(event) => updateSetting('gallerySubtitleText', event.currentTarget.value)}
              />
              <Switch
                label={t('set_show_access_mode', 'Show Access Mode')}
                description={t('set_show_access_mode_desc', 'Show the Lock / Hide access-mode toggle (admin only).')}
                checked={settings.showAccessMode}
                onChange={(event) => updateSetting('showAccessMode', event.currentTarget.checked)}
              />
              <Switch
                label={t('set_show_filter_tabs', 'Show Filter Tabs')}
                description={t('set_show_filter_tabs_desc', 'Show the campaign filter tab strip.')}
                checked={settings.showFilterTabs}
                onChange={(event) => updateSetting('showFilterTabs', event.currentTarget.checked)}
              />
              <Switch
                label={t('set_show_search_box', 'Show Search Box')}
                description={t('set_show_search_box_desc', 'Show the campaign search input.')}
                checked={settings.showSearchBox}
                onChange={(event) => updateSetting('showSearchBox', event.currentTarget.checked)}
              />
            </Stack>
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="gen-background">
        <Accordion.Control>{t('set_page_background', 'Page Background')}</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('gen-background') ? (
            <Stack gap="md">
              <ModalSelect
                label={t('set_bg_type', 'Page Background Type')}
                description={t('set_bg_type_desc', 'Gallery container background style')}
                data={[
                  { value: 'theme', label: t('set_bg_default_theme', 'Default Theme') },
                  { value: 'transparent', label: t('set_bg_transparent', 'Transparent') },
                  { value: 'solid', label: t('set_bg_solid', 'Solid color') },
                  { value: 'gradient', label: t('set_bg_gradient', 'Custom gradient') },
                ]}
                value={settings.viewerBgType ?? 'theme'}
                onChange={(value) => updateSetting('viewerBgType', (value ?? 'theme') as GalleryBehaviorSettings['viewerBgType'])}
              />
              {settings.viewerBgType === 'solid' && (
                <ColorInput
                  label={t('set_bg_color', 'Background Color')}
                  description={t('set_bg_color_desc', 'Solid background color for the gallery')}
                  value={settings.viewerBgColor}
                  onChange={(value) => updateSetting('viewerBgColor', value)}
                />
              )}
              {settings.viewerBgType === 'gradient' && (
                <GradientEditor
                  value={settings.viewerBgGradient ?? {}}
                  onChange={(value) => updateSetting('viewerBgGradient', value)}
                />
              )}
              <Switch
                label={t('set_show_header_border', 'Show Header Border')}
                description={t('set_show_header_border_desc', 'Show border, shadow, and backdrop blur on the sticky gallery header.')}
                checked={settings.showViewerBorder ?? true}
                onChange={(event) => updateSetting('showViewerBorder', event.currentTarget.checked)}
              />
            </Stack>
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="gen-authbar">
        <Accordion.Control>{t('set_auth_bar', 'Auth Bar')}</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('gen-authbar') ? (
            <Stack gap="md">
              <NumberInput
                label={t('set_authbar_blur', 'Auth Bar Backdrop Blur (px)')}
                description={t('set_authbar_blur_desc', 'Blur intensity for the auth bar backdrop.')}
                value={settings.authBarBackdropBlur}
                onChange={(value) => updateSetting('authBarBackdropBlur', typeof value === 'number' ? value : 8)}
                min={0}
                max={24}
              />
              <NumberInput
                label={t('set_authbar_breakpoint', 'Auth Bar Mobile Breakpoint (px)')}
                description={t('set_authbar_breakpoint_desc', 'Viewport width below which the auth bar uses mobile layout.')}
                value={settings.authBarMobileBreakpoint}
                onChange={(value) => updateSetting('authBarMobileBreakpoint', typeof value === 'number' ? value : 768)}
                min={320}
                max={1280}
              />
            </Stack>
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="gen-security">
        <Accordion.Control>{t('set_security_login', 'Security & Login')}</Accordion.Control>
        <Accordion.Panel>
          {mounted.has('gen-security') ? (
            <Stack gap="md">
              <NumberInput
                label={t('set_idle_timeout', 'Session Idle Timeout (minutes)')}
                description={t('set_idle_timeout_desc', 'Automatically sign out users after this many minutes of inactivity. Set to 0 to disable.')}
                value={settings.sessionIdleTimeoutMinutes}
                onChange={(value) => updateSetting('sessionIdleTimeoutMinutes', typeof value === 'number' ? value : 0)}
                min={0}
                max={480}
                step={5}
                placeholder={t('set_idle_disabled_ph', '0 = disabled')}
              />
              <NumberInput
                label={t('set_idle_warning', 'Idle Timeout Warning (seconds before)')}
                description={t('set_idle_warning_desc', "Show a 'Stay signed in' prompt this many seconds before signing out. Set to 0 to sign out without warning.")}
                value={settings.sessionIdleWarningSeconds}
                onChange={(value) => updateSetting('sessionIdleWarningSeconds', typeof value === 'number' ? value : 120)}
                min={0}
                max={300}
                step={30}
                placeholder={t('set_idle_nowarn_ph', '0 = no warning')}
                disabled={settings.sessionIdleTimeoutMinutes === 0}
              />
              {isSystemAdmin && (
                <Switch
                  label={t('set_enable_advanced', 'Enable Advanced Settings')}
                  description={t('set_enable_advanced_desc', 'Unlock the System & Admin tab with granular control over panel behavior, cache, drawer settings, and more.')}
                  checked={settings.advancedSettingsEnabled}
                  onChange={(event) => updateSetting('advancedSettingsEnabled', event.currentTarget.checked)}
                />
              )}
              <Switch
                label={t('set_show_tooltips', 'Show Settings Tooltips')}
                description={t('set_show_tooltips_desc', 'Display info icons next to Advanced-tab labels that explain each setting on hover.')}
                checked={settings.showSettingsTooltips}
                onChange={(event) => updateSetting('showSettingsTooltips', event.currentTarget.checked)}
              />
            </Stack>
          ) : null}
        </Accordion.Panel>
      </Accordion.Item>

    </Accordion>
  );
}