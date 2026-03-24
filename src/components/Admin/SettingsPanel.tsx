import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  Accordion,
  Box,
  Button,
  Group,
  Stack,
  Loader,
  Center,
  Title,
  Select,
  Switch,
  NumberInput,
  Modal,
  NativeScrollArea,
  Tabs,
  Text,
  Divider,
  TextInput,
  ColorInput,
  Slider,
  SegmentedControl,
  SimpleGrid,
} from '@mantine/core';
import {
  IconSettings,
  IconPhoto,
  IconLayoutGrid,
  IconAdjustments,
  IconColumns,
  IconTypography,
  IconEye,
} from '@tabler/icons-react';
import type { ApiClient } from '@/services/apiClient';
import {
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryBehaviorSettings,
  type TypographyOverride,
  type ScrollAnimationEasing,
  type ScrollAnimationStyle,
  type ScrollTransitionType,
  type NavArrowPosition,
  type DotNavPosition,
  type DotNavShape,
  type ShadowPreset,
  type ViewportBgType,
} from '@/types';
import { ThemeSelector } from './ThemeSelector';
import { SettingTooltip } from './SettingTooltip';
import { TypographyEditor, type CustomFontEntry } from '../Common/TypographyEditor';
import { GradientEditor } from '../Common/GradientEditor';
import { FontLibraryManager } from './FontLibraryManager';
import { useTheme } from '@/hooks/useTheme';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { mergeSettingsWithDefaults } from '@/utils/mergeSettingsWithDefaults';
import { SETTING_TOOLTIPS } from '@/data/settingTooltips';

export interface SettingsData extends GalleryBehaviorSettings {
  galleryLayout: 'grid' | 'masonry' | 'carousel';
  itemsPerPage: number;
  enableLightbox: boolean;
  enableAnimations: boolean;
}

/** SettingsPanel defaults extending gallery behavior settings. */
const defaultSettings: SettingsData = {
  ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  galleryLayout: 'grid',
  itemsPerPage: 12,
  enableLightbox: true,
  enableAnimations: true,
};

interface SettingsPanelProps {
  opened: boolean;
  apiClient: ApiClient;
  onClose: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
  onSettingsSaved?: (settings: SettingsData) => void;
  /** Pre-cached settings from SWR — avoids loading spinner on open */
  initialSettings?: Partial<SettingsData>;
}

const mapResponseToSettings = (response: Awaited<ReturnType<ApiClient['getSettings']>>): SettingsData => ({
  ...mergeSettingsWithDefaults(response as Partial<GalleryBehaviorSettings>),
  galleryLayout: (response.galleryLayout as SettingsData['galleryLayout']) ?? defaultSettings.galleryLayout,
  itemsPerPage: response.itemsPerPage ?? defaultSettings.itemsPerPage,
  enableLightbox: response.enableLightbox ?? defaultSettings.enableLightbox,
  enableAnimations: response.enableAnimations ?? defaultSettings.enableAnimations,
});

export function SettingsPanel({ opened, apiClient, onClose, onNotify, onSettingsSaved, initialSettings }: SettingsPanelProps) {
  const { setPreviewTheme, setTheme } = useTheme();
  const seedSettings: SettingsData = initialSettings
    ? { ...defaultSettings, ...initialSettings }
    : defaultSettings;

  const [settings, setSettings] = useState<SettingsData>(seedSettings);
  const [isLoading, setIsLoading] = useState(!initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<SettingsData>(seedSettings);
  const [activeTab, setActiveTab] = useState<string | null>('general');
  const [customFonts, setCustomFonts] = useState<CustomFontEntry[]>([]);
  const hasChangesRef = useRef(false);

  const loadSettings = useCallback(async () => {
    try {
      const response = await apiClient.getSettings();
      const loaded = mapResponseToSettings(response);
      if (!hasChangesRef.current) {
        setSettings(loaded);
      }
      setOriginalSettings(loaded);
    } catch {
      // If settings endpoint doesn't exist or fails, keep current state
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (opened && !initialSettings) {
      void loadSettings();
    }
  }, [opened, loadSettings, initialSettings]);

  const updateSetting = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      const changed = JSON.stringify(updated) !== JSON.stringify(originalSettings);
      setHasChanges(changed);
      hasChangesRef.current = changed;
      return updated;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await apiClient.updateSettings(settings);
      const saved = mapResponseToSettings(response);
      setSettings(saved);
      setOriginalSettings(saved);
      setHasChanges(false);
      hasChangesRef.current = false;
      onSettingsSaved?.(saved);
      // Commit the previewed theme as the saved theme
      const themeVal = (settings as unknown as Record<string, unknown>).theme;
      if (typeof themeVal === 'string') setTheme(themeVal);
      setPreviewTheme(null);
      onNotify({ type: 'success', text: 'Settings saved successfully.' });
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to save settings.') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setHasChanges(false);
    hasChangesRef.current = false;
    setPreviewTheme(null);
  };

  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const isExtraSmall = useMediaQuery('(max-width: 575px)');

  /** Shorthand: wrap a label with an info tooltip when tooltips are enabled. */
  const tt = (label: string, key: string) => (
    <SettingTooltip label={label} tooltip={SETTING_TOOLTIPS[key] ?? ''} enabled={settings.showSettingsTooltips} />
  );

  /** Update a single element's typography override. */
  const updateTypoOverride = (elementId: string, override: TypographyOverride) => {
    const next = { ...settings.typographyOverrides };
    if (Object.keys(override).length === 0) {
      delete next[elementId];
    } else {
      next[elementId] = override;
    }
    updateSetting('typographyOverrides', next);
  };

  return (
    <Modal
      opened={opened}
      onClose={() => { setPreviewTheme(null); onClose(); }}
      title={
        <Group gap="sm">
          <IconSettings size={22} />
          <Title order={3}>Display Settings</Title>
        </Group>
      }
      size={isSmallScreen ? '100%' : 'lg'}
      fullScreen={!!isExtraSmall}
      centered
      closeOnClickOutside={!hasChanges}
      closeOnEscape={!hasChanges}
      transitionProps={{ transition: 'fade', duration: 200 }}
      overlayProps={{ backgroundOpacity: 0.6, blur: 4 }}
      scrollAreaComponent={NativeScrollArea}
      styles={{
        body: { display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 },
      }}
    >
      {isLoading ? (
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      ) : (
        <>
        <Box style={{ flex: 1, overflowY: 'auto', padding: 'var(--mantine-spacing-md)' }}>
        <Stack gap="md">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List grow>
              <Tabs.Tab value="general" leftSection={<IconSettings size={16} />}>
                General
              </Tabs.Tab>
              <Tabs.Tab value="cards" leftSection={<IconLayoutGrid size={16} />}>
                Campaign Cards
              </Tabs.Tab>
              <Tabs.Tab value="gallery" leftSection={<IconPhoto size={16} />}>
                Media Display
              </Tabs.Tab>
              <Tabs.Tab value="layout" leftSection={<IconColumns size={16} />}>
                Gallery Layout
              </Tabs.Tab>
              <Tabs.Tab value="viewer" leftSection={<IconEye size={16} />}>
                Campaign Viewer
              </Tabs.Tab>
              {settings.advancedSettingsEnabled && (
                <Tabs.Tab value="advanced" leftSection={<IconAdjustments size={16} />}>
                  Advanced
                </Tabs.Tab>
              )}
              <Tabs.Tab value="typography" leftSection={<IconTypography size={16} />}>
                Typography
              </Tabs.Tab>
            </Tabs.List>

            {/* ── General Tab ───────────────────────────────────── */}
            <Tabs.Panel value="general" pt="md">
              {activeTab === 'general' && <Stack gap="md">
                <ThemeSelector
                  description="Choose a color theme. Preview applies instantly; saved when you click Save."
                  onThemeChange={(id) => updateSetting('theme' as keyof SettingsData, id as SettingsData[keyof SettingsData])}
                />

                <Select
                  label="Default Layout"
                  description="Default layout for displaying gallery items."
                  value={settings.galleryLayout}
                  onChange={(value) =>
                    updateSetting('galleryLayout', (value as SettingsData['galleryLayout']) ?? 'grid')
                  }
                  data={[
                    { value: 'grid', label: 'Grid' },
                    { value: 'masonry', label: 'Masonry' },
                    { value: 'carousel', label: 'Carousel' },
                  ]}
                />

                <NumberInput
                  label="Items Per Page"
                  description="Number of items to display per page (1-100)."
                  value={settings.itemsPerPage}
                  onChange={(value) => updateSetting('itemsPerPage', typeof value === 'number' ? value : 12)}
                  min={1}
                  max={100}
                  step={1}
                />

                <Divider label="App Container" labelPosition="center" />

                <NumberInput
                  label="App Max Width (px)"
                  description="Maximum width of the gallery container. Set to 0 for full-width (edge-to-edge). Default 1200px."
                  value={settings.appMaxWidth}
                  onChange={(value) => updateSetting('appMaxWidth', typeof value === 'number' ? value : defaultSettings.appMaxWidth)}
                  min={0}
                  max={3000}
                  step={50}
                  placeholder="0 = full width"
                />

                <NumberInput
                  label="Container Padding (px)"
                  description="Horizontal padding inside the container. Set to 0 for true edge-to-edge content. Default 16px."
                  value={settings.appPadding}
                  onChange={(value) => updateSetting('appPadding', typeof value === 'number' ? value : defaultSettings.appPadding)}
                  min={0}
                  max={100}
                  step={4}
                  placeholder="16"
                />

                {/* WP Full Bleed: counteracts WordPress block-theme container padding
                    (.has-global-padding / .is-layout-constrained) by wrapping the shortcode
                    output in an alignfull div with per-breakpoint negative-margin CSS rules.
                    Server-rendered in PHP — requires page refresh to take effect. */}
                <Switch
                  label="WP Full Bleed — Desktop (≥ 1024px)"
                  description="Break out of the WordPress page container padding on desktop viewports. Requires page refresh."
                  checked={settings.wpFullBleedDesktop}
                  onChange={(e) => updateSetting('wpFullBleedDesktop', e.currentTarget.checked)}
                />
                <Switch
                  label="WP Full Bleed — Tablet (768-1023px)"
                  description="Break out of the WordPress page container padding on tablet viewports. Requires page refresh."
                  checked={settings.wpFullBleedTablet}
                  onChange={(e) => updateSetting('wpFullBleedTablet', e.currentTarget.checked)}
                />
                <Switch
                  label="WP Full Bleed — Mobile (< 768px)"
                  description="Break out of the WordPress page container padding on mobile viewports. Requires page refresh."
                  checked={settings.wpFullBleedMobile}
                  onChange={(e) => updateSetting('wpFullBleedMobile', e.currentTarget.checked)}
                />

                <Divider label="Viewer Header Visibility" labelPosition="center" />

                <Switch
                  label="Show Gallery Title"
                  description='Show the "Campaign Gallery" heading.'
                  checked={settings.showGalleryTitle}
                  onChange={(e) => updateSetting('showGalleryTitle', e.currentTarget.checked)}
                />
                <Switch
                  label="Show Gallery Subtitle"
                  description="Show the subtitle text beneath the title."
                  checked={settings.showGallerySubtitle}
                  onChange={(e) => updateSetting('showGallerySubtitle', e.currentTarget.checked)}
                />
                <Switch
                  label="Show Access Mode"
                  description="Show the Lock / Hide access-mode toggle (admin only)."
                  checked={settings.showAccessMode}
                  onChange={(e) => updateSetting('showAccessMode', e.currentTarget.checked)}
                />
                <Switch
                  label="Show Filter Tabs"
                  description="Show the campaign filter tab strip."
                  checked={settings.showFilterTabs}
                  onChange={(e) => updateSetting('showFilterTabs', e.currentTarget.checked)}
                />
                <Switch
                  label="Show Search Box"
                  description="Show the campaign search input."
                  checked={settings.showSearchBox}
                  onChange={(e) => updateSetting('showSearchBox', e.currentTarget.checked)}
                />

                <Divider label="Viewer Background" labelPosition="center" />

                <Select
                  label="Background Type"
                  description="Gallery container background style"
                  data={[
                    { value: 'theme', label: 'Default Theme' },
                    { value: 'transparent', label: 'Transparent' },
                    { value: 'solid', label: 'Solid color' },
                    { value: 'gradient', label: 'Custom gradient' },
                  ]}
                  value={settings.viewerBgType ?? 'theme'}
                  onChange={(v) => updateSetting('viewerBgType', (v ?? 'theme') as GalleryBehaviorSettings['viewerBgType'])}
                />
                {settings.viewerBgType === 'solid' && (
                  <ColorInput
                    label="Background Color"
                    description="Solid background color for the gallery"
                    value={settings.viewerBgColor}
                    onChange={(v) => updateSetting('viewerBgColor', v)}
                  />
                )}
                {settings.viewerBgType === 'gradient' && (
                  <GradientEditor
                    value={settings.viewerBgGradient ?? {}}
                    onChange={(opts) => updateSetting('viewerBgGradient', opts)}
                  />
                )}
                <Switch
                  label="Show Header Border"
                  description="Show border, shadow, and backdrop blur on the sticky gallery header."
                  checked={settings.showViewerBorder ?? true}
                  onChange={(e) => updateSetting('showViewerBorder', e.currentTarget.checked)}
                />

                <Divider label="Auth Bar" labelPosition="center" />

                <Select
                  label="Auth Bar Display Mode"
                  description="How the authentication bar appears on the page."
                  data={[
                    { value: 'bar', label: 'Bar (full-width sticky bar)' },
                    { value: 'floating', label: 'Floating (circular icon, bottom-right)' },
                    { value: 'draggable', label: 'Draggable (movable floating icon)' },
                    { value: 'minimal', label: 'Minimal (thin strip, ≤32px)' },
                    { value: 'auto-hide', label: 'Auto-hide (bar hides on scroll)' },
                  ]}
                  value={settings.authBarDisplayMode ?? 'floating'}
                  onChange={(v) => updateSetting('authBarDisplayMode', (v ?? 'floating') as GalleryBehaviorSettings['authBarDisplayMode'])}
                />
                {settings.authBarDisplayMode === 'draggable' && (
                  <NumberInput
                    label="Drag Margin (px)"
                    description="Minimum distance from viewport edges when dragging."
                    value={settings.authBarDragMargin ?? 16}
                    onChange={(v) => updateSetting('authBarDragMargin', Number(v) || 16)}
                    min={0}
                    max={64}
                  />
                )}

                <Divider label="Security" labelPosition="center" />

                <NumberInput
                  label="Session Idle Timeout (minutes)"
                  description="Automatically sign out users after this many minutes of inactivity. Set to 0 to disable."
                  value={settings.sessionIdleTimeoutMinutes}
                  onChange={(value) => updateSetting('sessionIdleTimeoutMinutes', typeof value === 'number' ? value : 0)}
                  min={0}
                  max={480}
                  step={5}
                  placeholder="0 = disabled"
                />

                <Divider label="Developer" labelPosition="center" />

                <Switch
                  label="Enable Advanced Settings"
                  description="Unlock the Advanced tab with granular control over card opacities, tile dimensions, lightbox behavior, breakpoints, and more."
                  checked={settings.advancedSettingsEnabled}
                  onChange={(e) => updateSetting('advancedSettingsEnabled', e.currentTarget.checked)}
                />
                <Switch
                  label="Show Settings Tooltips"
                  description="Display info icons next to Advanced-tab labels that explain each setting on hover."
                  checked={settings.showSettingsTooltips}
                  onChange={(e) => updateSetting('showSettingsTooltips', e.currentTarget.checked)}
                />
              </Stack>}
            </Tabs.Panel>

            {/* ── Campaign Cards Tab ────────────────────────── */}
            <Tabs.Panel value="cards" pt="md">
              {activeTab === 'cards' && <Accordion variant="separated" defaultValue="appearance">
                {/* ── Card Appearance ── */}
                <Accordion.Item value="appearance">
                  <Accordion.Control>Card Appearance</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <NumberInput
                        label="Border Radius (px)"
                        description="Corner rounding for campaign cards"
                        value={settings.cardBorderRadius}
                        onChange={(v) => updateSetting('cardBorderRadius', typeof v === 'number' ? v : 8)}
                        min={0}
                        max={24}
                        step={1}
                      />
                      <NumberInput
                        label="Border Width (px)"
                        description="Left accent border thickness"
                        value={settings.cardBorderWidth}
                        onChange={(v) => updateSetting('cardBorderWidth', typeof v === 'number' ? v : 4)}
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
                        onChange={(v) => updateSetting('cardBorderMode', (v ?? 'auto') as GalleryBehaviorSettings['cardBorderMode'])}
                      />
                      {settings.cardBorderMode === 'single' && (
                        <ColorInput
                          label="Border Color"
                          description="Accent border color applied to all campaign cards"
                          value={settings.cardBorderColor}
                          onChange={(v) => updateSetting('cardBorderColor', v)}
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
                        onChange={(v) => updateSetting('cardShadowPreset', v ?? 'subtle')}
                      />
                      <NumberInput
                        label="Thumbnail Height (px)"
                        description="Height of the card thumbnail area"
                        value={settings.cardThumbnailHeight}
                        onChange={(v) => updateSetting('cardThumbnailHeight', typeof v === 'number' ? v : 200)}
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
                        onChange={(v) => updateSetting('cardThumbnailFit', v ?? 'cover')}
                      />

                      <Divider label="Element Visibility" labelPosition="center" />

                      <Switch
                        label="Show company name badge"
                        description="Company badge overlay on card thumbnail"
                        checked={settings.showCardCompanyName ?? true}
                        onChange={(e) => updateSetting('showCardCompanyName', e.currentTarget.checked)}
                      />
                      <Switch
                        label="Show access badge"
                        description="Green 'Access' badge on accessible cards"
                        checked={settings.showCardAccessBadge ?? true}
                        onChange={(e) => updateSetting('showCardAccessBadge', e.currentTarget.checked)}
                      />
                      <Switch
                        label="Show card title"
                        checked={settings.showCardTitle ?? true}
                        onChange={(e) => updateSetting('showCardTitle', e.currentTarget.checked)}
                      />
                      <Switch
                        label="Show card description"
                        checked={settings.showCardDescription ?? true}
                        onChange={(e) => updateSetting('showCardDescription', e.currentTarget.checked)}
                      />
                      <Switch
                        label="Show media counts"
                        description="Video and image count below description"
                        checked={settings.showCardMediaCounts ?? true}
                        onChange={(e) => updateSetting('showCardMediaCounts', e.currentTarget.checked)}
                      />
                      <Switch
                        label="Show card border"
                        description="Accent border and hover border effect"
                        checked={settings.showCardBorder ?? true}
                        onChange={(e) => updateSetting('showCardBorder', e.currentTarget.checked)}
                      />
                      <Switch
                        label="Show thumbnail fade"
                        description="Gradient overlay at bottom of thumbnail"
                        checked={settings.showCardThumbnailFade ?? true}
                        onChange={(e) => updateSetting('showCardThumbnailFade', e.currentTarget.checked)}
                      />
                      <Switch
                        label="Show card info panel"
                        description="Show title, description, tags & media counts below thumbnail"
                        checked={settings.showCardInfoPanel ?? true}
                        onChange={(e) => updateSetting('showCardInfoPanel', e.currentTarget.checked)}
                      />
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* ── Card Grid & Pagination ── */}
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
                        onChange={(v) => updateSetting('cardGridColumns', parseInt(v ?? '0', 10))}
                      />
                      <NumberInput
                        label="Horizontal Gap (px)"
                        description="Horizontal spacing between campaign cards"
                        value={settings.cardGapH}
                        onChange={(v) => updateSetting('cardGapH', typeof v === 'number' ? v : 16)}
                        min={0}
                        max={48}
                        step={2}
                      />
                      <NumberInput
                        label="Vertical Gap (px)"
                        description="Vertical spacing between campaign card rows"
                        value={settings.cardGapV}
                        onChange={(v) => updateSetting('cardGapV', typeof v === 'number' ? v : 16)}
                        min={0}
                        max={48}
                        step={2}
                      />
                      <NumberInput
                        label="Card Max Width (px)"
                        description="Limit individual card width. 0 = no limit (fill column)."
                        value={settings.cardMaxWidth}
                        onChange={(v) => updateSetting('cardMaxWidth', typeof v === 'number' ? v : 0)}
                        min={0}
                        max={800}
                        step={10}
                        placeholder="0 = unlimited"
                      />
                      {settings.cardGridColumns === 0 && (
                        <NumberInput
                          label="Max Columns (auto mode)"
                          description="Cap the number of columns when using Auto layout. 0 = unlimited."
                          value={settings.cardMaxColumns}
                          onChange={(v) => updateSetting('cardMaxColumns', typeof v === 'number' ? v : 0)}
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
                        onChange={(v) => updateSetting('cardAspectRatio', (v ?? 'auto') as GalleryBehaviorSettings['cardAspectRatio'])}
                      />
                      <NumberInput
                        label="Card Min Height (px)"
                        description="Minimum height for each card. 0 = no minimum."
                        value={settings.cardMinHeight}
                        onChange={(v) => updateSetting('cardMinHeight', typeof v === 'number' ? v : 0)}
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
                        onChange={(v) => updateSetting('cardDisplayMode', (v ?? 'load-more') as GalleryBehaviorSettings['cardDisplayMode'])}
                      />
                      {settings.cardDisplayMode === 'paginated' && (
                        <>
                          <NumberInput
                            label="Rows Per Page"
                            description="Number of card rows visible per page"
                            value={settings.cardRowsPerPage}
                            onChange={(v) => updateSetting('cardRowsPerPage', typeof v === 'number' ? v : 3)}
                            min={1}
                            max={10}
                            step={1}
                          />
                          <Switch
                            label="Dot Navigator"
                            description="Show dot navigator below the card grid"
                            checked={settings.cardPageDotNav}
                            onChange={(e) => updateSetting('cardPageDotNav', e.currentTarget.checked)}
                          />
                          <NumberInput
                            label="Page Transition Duration (ms)"
                            description="Slide animation speed between pages"
                            value={settings.cardPageTransitionMs}
                            onChange={(v) => updateSetting('cardPageTransitionMs', typeof v === 'number' ? v : 300)}
                            min={100}
                            max={800}
                            step={50}
                          />
                        </>
                      )}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>}
            </Tabs.Panel>

            {/* ── Media Display Tab ─────────────────────────── */}
            <Tabs.Panel value="gallery" pt="md">
              {activeTab === 'gallery' && <Accordion variant="separated" defaultValue="viewport">
                {/* ── Viewport & Layout ── */}
                <Accordion.Item value="viewport">
                  <Accordion.Control>Viewport &amp; Layout</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <Switch
                        label="Enable Lightbox"
                        description="Enable fullscreen lightbox when clicking gallery items."
                        checked={settings.enableLightbox}
                        onChange={(e) => updateSetting('enableLightbox', e.currentTarget.checked)}
                      />

                      <Switch
                        label="Enable Animations"
                        description="Enable smooth animations and transitions. Disable for better performance on low-end devices."
                        checked={settings.enableAnimations}
                        onChange={(e) => updateSetting('enableAnimations', e.currentTarget.checked)}
                      />

                      <Divider label="Viewport Dimensions" labelPosition="center" />

                      <Select
                        label={tt('Height Constraint', 'gallerySizingMode')}
                        description="Choose whether classic galleries can overflow, are kept within the visible screen, or use a manual CSS height."
                        data={[
                          { value: 'auto', label: 'No restraint' },
                          { value: 'viewport', label: 'Restrain to view' },
                          { value: 'manual', label: 'Manually control height' },
                        ]}
                        value={settings.gallerySizingMode ?? 'auto'}
                        onChange={(v) => updateSetting('gallerySizingMode', (v ?? 'auto') as GalleryBehaviorSettings['gallerySizingMode'])}
                      />

                      {settings.gallerySizingMode === 'manual' && (<>
                      <TextInput
                        label={tt('Manual Gallery Height', 'galleryManualHeight')}
                        description="Accepted units: px, em, rem, vh, dvh, vw, %. Example: 75vh or 420px"
                        value={settings.galleryManualHeight}
                        onChange={(event) => updateSetting('galleryManualHeight', event.currentTarget.value)}
                        placeholder="420px"
                      />
                      </>)}

                      <Divider label="Border Radius" labelPosition="center" />

                      <NumberInput
                        label="Image Border Radius (px)"
                        description="Corner rounding for image gallery viewport and thumbnails."
                        value={settings.imageBorderRadius}
                        onChange={(value) =>
                          updateSetting('imageBorderRadius', typeof value === 'number' ? value : defaultSettings.imageBorderRadius)
                        }
                        min={0}
                        max={48}
                        step={1}
                      />

                      <NumberInput
                        label="Video Border Radius (px)"
                        description="Corner rounding for video gallery viewport and thumbnails."
                        value={settings.videoBorderRadius}
                        onChange={(value) =>
                          updateSetting('videoBorderRadius', typeof value === 'number' ? value : defaultSettings.videoBorderRadius)
                        }
                        min={0}
                        max={48}
                        step={1}
                      />

                      <Divider label="Shadow & Depth" labelPosition="center" />

                      <Select
                        label="Image Shadow Preset"
                        description="Box-shadow depth effect for image gallery viewport."
                        value={settings.imageShadowPreset}
                        onChange={(value) =>
                          updateSetting('imageShadowPreset', (value as ShadowPreset) ?? defaultSettings.imageShadowPreset)
                        }
                        data={[
                          { value: 'none', label: 'None' },
                          { value: 'subtle', label: 'Subtle' },
                          { value: 'medium', label: 'Medium' },
                          { value: 'strong', label: 'Strong' },
                          { value: 'custom', label: 'Custom' },
                        ]}
                      />

                      {settings.imageShadowPreset === 'custom' && (
                        <TextInput
                          label="Image Custom Shadow"
                          description="CSS box-shadow value (e.g. '0 4px 16px rgba(0,0,0,0.25)')."
                          value={settings.imageShadowCustom}
                          onChange={(e) => updateSetting('imageShadowCustom', e.currentTarget.value)}
                        />
                      )}

                      <Select
                        label="Video Shadow Preset"
                        description="Box-shadow depth effect for video gallery viewport."
                        value={settings.videoShadowPreset}
                        onChange={(value) =>
                          updateSetting('videoShadowPreset', (value as ShadowPreset) ?? defaultSettings.videoShadowPreset)
                        }
                        data={[
                          { value: 'none', label: 'None' },
                          { value: 'subtle', label: 'Subtle' },
                          { value: 'medium', label: 'Medium' },
                          { value: 'strong', label: 'Strong' },
                          { value: 'custom', label: 'Custom' },
                        ]}
                      />

                      {settings.videoShadowPreset === 'custom' && (
                        <TextInput
                          label="Video Custom Shadow"
                          description="CSS box-shadow value (e.g. '0 4px 16px rgba(0,0,0,0.25)')."
                          value={settings.videoShadowCustom}
                          onChange={(e) => updateSetting('videoShadowCustom', e.currentTarget.value)}
                        />
                      )}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* ── Tile Appearance ── */}
                <Accordion.Item value="tile-appearance">
                  <Accordion.Control>Tile Appearance</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <Group grow>
                        <NumberInput
                          label="Gap X (px)"
                          description="Horizontal gap between tiles."
                          value={settings.tileGapX}
                          onChange={(value) =>
                            updateSetting('tileGapX', typeof value === 'number' ? value : defaultSettings.tileGapX)
                          }
                          min={0} max={60} step={1}
                        />
                        <NumberInput
                          label="Gap Y (px)"
                          description="Vertical gap between tile rows."
                          value={settings.tileGapY}
                          onChange={(value) =>
                            updateSetting('tileGapY', typeof value === 'number' ? value : defaultSettings.tileGapY)
                          }
                          min={0} max={60} step={1}
                        />
                      </Group>

                      <Group grow>
                        <NumberInput
                          label="Border Width (px)"
                          description="Tile border thickness. 0 = no border."
                          value={settings.tileBorderWidth}
                          onChange={(value) =>
                            updateSetting('tileBorderWidth', typeof value === 'number' ? value : defaultSettings.tileBorderWidth)
                          }
                          min={0} max={20} step={1}
                        />
                        {settings.tileBorderWidth > 0 && (
                          <ColorInput
                            label="Border Color"
                            value={settings.tileBorderColor}
                            onChange={(value) => updateSetting('tileBorderColor', value)}
                            format="hex"
                          />
                        )}
                      </Group>

                      <Switch
                        label="Hover Bounce"
                        description="Scale-up spring animation when hovering over a tile."
                        checked={settings.tileHoverBounce}
                        onChange={(e) => updateSetting('tileHoverBounce', e.currentTarget.checked)}
                      />

                      <Switch
                        label="Hover Glow"
                        description="Drop-shadow glow on hover (works with clip-path shapes)."
                        checked={settings.tileGlowEnabled}
                        onChange={(e) => updateSetting('tileGlowEnabled', e.currentTarget.checked)}
                      />
                      {settings.tileGlowEnabled && (
                        <Group grow>
                          <ColorInput
                            label="Glow Color"
                            value={settings.tileGlowColor}
                            onChange={(value) => updateSetting('tileGlowColor', value)}
                            format="hex"
                          />
                          <NumberInput
                            label="Glow Spread (px)"
                            description="Radius of the glow effect."
                            value={settings.tileGlowSpread}
                            onChange={(value) =>
                              updateSetting('tileGlowSpread', typeof value === 'number' ? value : defaultSettings.tileGlowSpread)
                            }
                            min={2} max={60} step={2}
                          />
                        </Group>
                      )}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* ── Thumbnail Strip ── */}
                <Accordion.Item value="thumbnail-strip">
                  <Accordion.Control>Thumbnail Strip</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <Group grow>
                        <NumberInput
                          label="Video Thumb Width (px)"
                          description="Width of video thumbnail items."
                          value={settings.videoThumbnailWidth}
                          onChange={(value) =>
                            updateSetting('videoThumbnailWidth', typeof value === 'number' ? value : defaultSettings.videoThumbnailWidth)
                          }
                          min={30}
                          max={200}
                          step={5}
                        />
                        <NumberInput
                          label="Video Thumb Height (px)"
                          description="Height of video thumbnail items."
                          value={settings.videoThumbnailHeight}
                          onChange={(value) =>
                            updateSetting('videoThumbnailHeight', typeof value === 'number' ? value : defaultSettings.videoThumbnailHeight)
                          }
                          min={30}
                          max={200}
                          step={5}
                        />
                      </Group>

                      <Group grow>
                        <NumberInput
                          label="Image Thumb Width (px)"
                          description="Width of image thumbnail items."
                          value={settings.imageThumbnailWidth}
                          onChange={(value) =>
                            updateSetting('imageThumbnailWidth', typeof value === 'number' ? value : defaultSettings.imageThumbnailWidth)
                          }
                          min={30}
                          max={200}
                          step={5}
                        />
                        <NumberInput
                          label="Image Thumb Height (px)"
                          description="Height of image thumbnail items."
                          value={settings.imageThumbnailHeight}
                          onChange={(value) =>
                            updateSetting('imageThumbnailHeight', typeof value === 'number' ? value : defaultSettings.imageThumbnailHeight)
                          }
                          min={30}
                          max={200}
                          step={5}
                        />
                      </Group>

                      <NumberInput
                        label="Thumbnail Gap (px)"
                        description="Spacing between thumbnail items in the strip."
                        value={settings.thumbnailGap}
                        onChange={(value) =>
                          updateSetting('thumbnailGap', typeof value === 'number' ? value : defaultSettings.thumbnailGap)
                        }
                        min={0}
                        max={24}
                        step={1}
                      />

                      <Switch
                        label="Wheel Scroll"
                        description="Allow mouse wheel to scroll the thumbnail strip horizontally."
                        checked={settings.thumbnailWheelScrollEnabled}
                        onChange={(e) => updateSetting('thumbnailWheelScrollEnabled', e.currentTarget.checked)}
                      />

                      <Switch
                        label="Drag Scroll"
                        description="Allow click-and-drag to scroll the thumbnail strip."
                        checked={settings.thumbnailDragScrollEnabled}
                        onChange={(e) => updateSetting('thumbnailDragScrollEnabled', e.currentTarget.checked)}
                      />

                      <Switch
                        label="Strip Scroll Buttons"
                        description="Show left/right scroll buttons on the thumbnail strip edges."
                        checked={settings.thumbnailScrollButtonsVisible}
                        onChange={(e) => updateSetting('thumbnailScrollButtonsVisible', e.currentTarget.checked)}
                      />
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* ── Transitions ── */}
                <Accordion.Item value="transitions">
                  <Accordion.Control>Transitions</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <Switch
                        label="Transition Fade"
                        description="Apply an opacity fade when cards enter and exit during transitions, softening abrupt edges."
                        checked={settings.transitionFadeEnabled}
                        onChange={(e) => updateSetting('transitionFadeEnabled', e.currentTarget.checked)}
                      />

                      <Select
                        label="Transition Type"
                        description="How gallery media slides between items: fade only, slide only, or combined slide-fade."
                        value={settings.scrollTransitionType}
                        onChange={(value) =>
                          updateSetting(
                            'scrollTransitionType',
                            (value as ScrollTransitionType) ?? defaultSettings.scrollTransitionType,
                          )
                        }
                        data={[
                          { value: 'slide-fade', label: 'Slide + Fade' },
                          { value: 'slide', label: 'Slide' },
                          { value: 'fade', label: 'Fade' },
                        ]}
                      />

                      <Select
                        label="Scroll Animation Style"
                        description="Navigation scroll behavior for gallery thumbnail strips."
                        value={settings.scrollAnimationStyle}
                        onChange={(value) =>
                          updateSetting(
                            'scrollAnimationStyle',
                            (value as ScrollAnimationStyle) ?? defaultSettings.scrollAnimationStyle,
                          )
                        }
                        data={[
                          { value: 'smooth', label: 'Smooth' },
                          { value: 'instant', label: 'Instant' },
                        ]}
                      />

                      <NumberInput
                        label="Animation Duration (ms)"
                        description="Duration for gallery transition and thumbnail highlight animations."
                        value={settings.scrollAnimationDurationMs}
                        onChange={(value) =>
                          updateSetting(
                            'scrollAnimationDurationMs',
                            typeof value === 'number' ? value : defaultSettings.scrollAnimationDurationMs,
                          )
                        }
                        min={0}
                        max={2000}
                        step={10}
                      />

                      <Select
                        label="Animation Easing"
                        description="Timing function used for gallery transitions."
                        value={settings.scrollAnimationEasing}
                        onChange={(value) =>
                          updateSetting(
                            'scrollAnimationEasing',
                            (value as ScrollAnimationEasing) ?? defaultSettings.scrollAnimationEasing,
                          )
                        }
                        data={[
                          { value: 'ease', label: 'Ease' },
                          { value: 'linear', label: 'Linear' },
                          { value: 'ease-in', label: 'Ease In' },
                          { value: 'ease-out', label: 'Ease Out' },
                          { value: 'ease-in-out', label: 'Ease In Out' },
                        ]}
                      />
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* ── Navigation ── */}
                <Accordion.Item value="navigation">
                  <Accordion.Control>Navigation</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <NumberInput
                        label="Thumbnail Scroll Speed"
                        description="Multiplier for thumbnail-strip wheel scroll speed."
                        value={settings.thumbnailScrollSpeed}
                        onChange={(value) =>
                          updateSetting('thumbnailScrollSpeed', typeof value === 'number' ? value : defaultSettings.thumbnailScrollSpeed)
                        }
                        min={0.25}
                        max={3}
                        step={0.25}
                        decimalScale={2}
                      />

                      <Divider label="Overlay Arrows" labelPosition="center" />

                      <Select
                        label="Arrow Vertical Position"
                        description="Vertical alignment of the overlay prev/next arrows."
                        value={settings.navArrowPosition}
                        onChange={(value) =>
                          updateSetting('navArrowPosition', (value as NavArrowPosition) ?? defaultSettings.navArrowPosition)
                        }
                        data={[
                          { value: 'top', label: 'Top' },
                          { value: 'center', label: 'Center' },
                          { value: 'bottom', label: 'Bottom' },
                        ]}
                      />

                      <NumberInput
                        label="Arrow Size (px)"
                        description="Diameter of the overlay navigation arrows."
                        value={settings.navArrowSize}
                        onChange={(value) =>
                          updateSetting('navArrowSize', typeof value === 'number' ? value : defaultSettings.navArrowSize)
                        }
                        min={20}
                        max={64}
                        step={2}
                      />

                      <ColorInput
                        label="Arrow Color"
                        description="Icon color for the overlay arrows."
                        value={settings.navArrowColor}
                        onChange={(value) => updateSetting('navArrowColor', value)}
                        format="hex"
                      />

                      <TextInput
                        label="Arrow Background Color"
                        description="Background color (supports rgba for transparency)."
                        value={settings.navArrowBgColor}
                        onChange={(e) => updateSetting('navArrowBgColor', e.currentTarget.value)}
                      />

                      <NumberInput
                        label="Arrow Border Width (px)"
                        description="Border thickness around the arrows (0 = none)."
                        value={settings.navArrowBorderWidth}
                        onChange={(value) =>
                          updateSetting('navArrowBorderWidth', typeof value === 'number' ? value : defaultSettings.navArrowBorderWidth)
                        }
                        min={0}
                        max={6}
                        step={1}
                      />

                      <Text size="sm" fw={500}>Hover Scale Factor</Text>
                      <Slider
                        value={settings.navArrowHoverScale}
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
                        value={settings.navArrowAutoHideMs}
                        onChange={(value) =>
                          updateSetting('navArrowAutoHideMs', typeof value === 'number' ? value : defaultSettings.navArrowAutoHideMs)
                        }
                        min={0}
                        max={10000}
                        step={500}
                      />

                      <Divider label="Dot Navigator" labelPosition="center" />

                      <Switch
                        label="Enable Dot Navigator"
                        description="Show a dot-style page indicator."
                        checked={settings.dotNavEnabled}
                        onChange={(e) => updateSetting('dotNavEnabled', e.currentTarget.checked)}
                      />

                      {settings.dotNavEnabled && (
                        <>
                          <Select
                            label="Dot Position"
                            description="Where to render the dot navigator relative to the viewport."
                            value={settings.dotNavPosition}
                            onChange={(value) =>
                              updateSetting('dotNavPosition', (value as DotNavPosition) ?? defaultSettings.dotNavPosition)
                            }
                            data={[
                              { value: 'below', label: 'Below Viewport' },
                              { value: 'overlay-bottom', label: 'Overlay Bottom' },
                              { value: 'overlay-top', label: 'Overlay Top' },
                            ]}
                          />

                          <NumberInput
                            label="Dot Size (px)"
                            description="Diameter of each dot."
                            value={settings.dotNavSize}
                            onChange={(value) =>
                              updateSetting('dotNavSize', typeof value === 'number' ? value : defaultSettings.dotNavSize)
                            }
                            min={4}
                            max={24}
                            step={1}
                          />

                          <Select
                            label="Dot Shape"
                            description="Shape of the navigation dots."
                            value={settings.dotNavShape}
                            onChange={(value) =>
                              updateSetting('dotNavShape', (value as DotNavShape) ?? defaultSettings.dotNavShape)
                            }
                            data={[
                              { value: 'circle', label: 'Circle' },
                              { value: 'pill', label: 'Pill' },
                              { value: 'square', label: 'Square' },
                            ]}
                          />

                          <TextInput
                            label="Active Dot Color"
                            description="Color for the currently active dot (CSS value)."
                            value={settings.dotNavActiveColor}
                            onChange={(e) => updateSetting('dotNavActiveColor', e.currentTarget.value)}
                          />

                          <TextInput
                            label="Inactive Dot Color"
                            description="Color for inactive dots (CSS value)."
                            value={settings.dotNavInactiveColor}
                            onChange={(e) => updateSetting('dotNavInactiveColor', e.currentTarget.value)}
                          />

                          <NumberInput
                            label="Dot Spacing (px)"
                            description="Gap between dots."
                            value={settings.dotNavSpacing}
                            onChange={(value) =>
                              updateSetting('dotNavSpacing', typeof value === 'number' ? value : defaultSettings.dotNavSpacing)
                            }
                            min={2}
                            max={20}
                            step={1}
                          />

                          <Text size="sm" fw={500}>Active Dot Scale</Text>
                          <Slider
                            value={settings.dotNavActiveScale}
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
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>}
            </Tabs.Panel>


            {/* ── Gallery Layout Tab ────────────────────────── */}
            <Tabs.Panel value="layout" pt="md">
              {activeTab === 'layout' && <Accordion variant="separated" defaultValue="adapters">
                {/* ── Gallery Adapters ── */}
                <Accordion.Item value="adapters">
                  <Accordion.Control>Gallery Adapters</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <Switch
                        label="Unified Gallery Mode"
                        description="When enabled, images and videos are combined in a single gallery view. When disabled, each media type uses its own layout independently."
                        checked={settings.unifiedGalleryEnabled}
                        onChange={(e) => updateSetting('unifiedGalleryEnabled', e.currentTarget.checked)}
                      />

                      {settings.unifiedGalleryEnabled ? (
                        <Select
                          label="Unified Gallery Adapter"
                          description="Layout used when images and videos are displayed together."
                          value={settings.unifiedGalleryAdapterId}
                          onChange={(value) => updateSetting('unifiedGalleryAdapterId', value ?? 'compact-grid')}
                          data={[
                            { value: 'compact-grid', label: 'Compact Grid' },
                            { value: 'justified', label: 'Justified Rows (Flickr-style)' },
                            { value: 'masonry', label: 'Masonry' },
                            { value: 'hexagonal', label: 'Hexagonal' },
                            { value: 'circular', label: 'Circular' },
                            { value: 'diamond', label: 'Diamond' },
                            { value: 'layout-builder', label: 'Layout Builder' },
                          ]}
                        />
                      ) : (
                        <>
                          {/* P15-A: Gallery Selection Mode */}
                          <Box>
                            <Text size="sm" fw={500} mb={4}>Gallery Selection Mode</Text>
                            <Text size="xs" c="dimmed" mb={8}>
                              Unified: one adapter for all screen sizes. Per-breakpoint: different adapters for desktop, tablet, and mobile.
                            </Text>
                            <SegmentedControl
                              fullWidth
                              value={settings.gallerySelectionMode}
                              onChange={(value) => updateSetting('gallerySelectionMode', value as 'unified' | 'per-breakpoint')}
                              data={[
                                { value: 'unified', label: 'Unified' },
                                { value: 'per-breakpoint', label: 'Per Breakpoint' },
                              ]}
                            />
                          </Box>

                          {settings.gallerySelectionMode === 'per-breakpoint' ? (
                            /* 3×2 per-breakpoint adapter grid */
                            <Box>
                              <SimpleGrid cols={3} spacing="xs" mb={4}>
                                <Text size="xs" fw={600} ta="center" c="dimmed"> </Text>
                                <Text size="xs" fw={600} ta="center">Image</Text>
                                <Text size="xs" fw={600} ta="center">Video</Text>
                              </SimpleGrid>
                              {(['desktop', 'tablet', 'mobile'] as const).map((bp) => {
                                const isMobile = bp === 'mobile';
                                const adapterOptions = [
                                  { value: 'classic', label: 'Classic' },
                                  { value: 'compact-grid', label: 'Compact Grid' },
                                  { value: 'justified', label: 'Justified' },
                                  { value: 'masonry', label: 'Masonry' },
                                  { value: 'hexagonal', label: 'Hexagonal' },
                                  { value: 'circular', label: 'Circular' },
                                  { value: 'diamond', label: 'Diamond' },
                                  {
                                    value: 'layout-builder',
                                    label: isMobile ? 'Layout Builder (desktop/tablet only)' : 'Layout Builder',
                                    disabled: isMobile,
                                  },
                                ];
                                return (
                                <SimpleGrid cols={3} spacing="xs" mb="xs" key={bp}>
                                  <Text size="sm" fw={500} style={{ display: 'flex', alignItems: 'center' }}>
                                    {bp.charAt(0).toUpperCase() + bp.slice(1)}
                                  </Text>
                                  <Select
                                    size="xs"
                                    value={settings[`${bp}ImageAdapterId` as keyof typeof settings] as string}
                                    onChange={(value) => updateSetting(`${bp}ImageAdapterId` as keyof SettingsData, (value ?? 'classic') as never)}
                                    data={adapterOptions}
                                  />
                                  <Select
                                    size="xs"
                                    value={settings[`${bp}VideoAdapterId` as keyof typeof settings] as string}
                                    onChange={(value) => updateSetting(`${bp}VideoAdapterId` as keyof SettingsData, (value ?? 'classic') as never)}
                                    data={adapterOptions}
                                  />
                                </SimpleGrid>
                                );
                              })}
                              <Select
                                label="Layout Builder Scope"
                                description="Full: replaces entire gallery (no thumbnail strip). Viewport: replaces only the viewport area."
                                size="xs"
                                value={settings.layoutBuilderScope}
                                onChange={(value) => updateSetting('layoutBuilderScope', (value ?? 'full') as 'full' | 'viewport')}
                                data={[
                                  { value: 'full', label: 'Full Gallery' },
                                  { value: 'viewport', label: 'Viewport Only' },
                                ]}
                                mt="sm"
                              />
                            </Box>
                          ) : (
                            /* Unified mode: single pair of dropdowns */
                            <>
                              <Select
                                label="Image Gallery Adapter"
                                description="Layout for campaigns with images."
                                value={settings.imageGalleryAdapterId}
                                onChange={(value) => {
                                  const v = value ?? 'classic';
                                  if (v === 'layout-builder') {
                                    // Auto-switch to per-breakpoint with layout-builder on desktop+tablet
                                    updateSetting('gallerySelectionMode', 'per-breakpoint');
                                    updateSetting('desktopImageAdapterId', 'layout-builder');
                                    updateSetting('tabletImageAdapterId', 'layout-builder');
                                    updateSetting('mobileImageAdapterId', settings.imageGalleryAdapterId || 'classic');
                                    // Preserve video settings
                                    updateSetting('desktopVideoAdapterId', settings.videoGalleryAdapterId || 'classic');
                                    updateSetting('tabletVideoAdapterId', settings.videoGalleryAdapterId || 'classic');
                                    updateSetting('mobileVideoAdapterId', settings.videoGalleryAdapterId || 'classic');
                                    return;
                                  }
                                  updateSetting('imageGalleryAdapterId', v);
                                }}
                                data={[
                                  { value: 'classic', label: 'Classic (Carousel)' },
                                  { value: 'compact-grid', label: 'Compact Grid' },
                                  { value: 'justified', label: 'Justified Rows (Flickr-style)' },
                                  { value: 'masonry', label: 'Masonry' },
                                  { value: 'hexagonal', label: 'Hexagonal' },
                                  { value: 'circular', label: 'Circular' },
                                  { value: 'diamond', label: 'Diamond' },
                                  { value: 'layout-builder', label: 'Layout Builder ⟶ per-breakpoint' },
                                ]}
                              />
                              <Select
                                label="Video Gallery Adapter"
                                description="Layout for campaigns with videos."
                                value={settings.videoGalleryAdapterId}
                                onChange={(value) => {
                                  const v = value ?? 'classic';
                                  if (v === 'layout-builder') {
                                    // Auto-switch to per-breakpoint with layout-builder on desktop+tablet
                                    updateSetting('gallerySelectionMode', 'per-breakpoint');
                                    updateSetting('desktopVideoAdapterId', 'layout-builder');
                                    updateSetting('tabletVideoAdapterId', 'layout-builder');
                                    updateSetting('mobileVideoAdapterId', settings.videoGalleryAdapterId || 'classic');
                                    // Preserve image settings
                                    updateSetting('desktopImageAdapterId', settings.imageGalleryAdapterId || 'classic');
                                    updateSetting('tabletImageAdapterId', settings.imageGalleryAdapterId || 'classic');
                                    updateSetting('mobileImageAdapterId', settings.imageGalleryAdapterId || 'classic');
                                    return;
                                  }
                                  updateSetting('videoGalleryAdapterId', v);
                                }}
                                data={[
                                  { value: 'classic', label: 'Classic (Carousel)' },
                                  { value: 'compact-grid', label: 'Compact Grid' },
                                  { value: 'justified', label: 'Justified Rows (Flickr-style)' },
                                  { value: 'masonry', label: 'Masonry' },
                                  { value: 'hexagonal', label: 'Hexagonal' },
                                  { value: 'circular', label: 'Circular' },
                                  { value: 'diamond', label: 'Diamond' },
                                  { value: 'layout-builder', label: 'Layout Builder ⟶ per-breakpoint' },
                                ]}
                              />
                            </>
                          )}
                        </>
                      )}

                      {/* ── Compact-grid dimensions ── */}
                      {(settings.unifiedGalleryEnabled
                        ? settings.unifiedGalleryAdapterId === 'compact-grid'
                        : settings.imageGalleryAdapterId === 'compact-grid' ||
                          settings.videoGalleryAdapterId === 'compact-grid'
                      ) && (
                        <Group grow>
                          <NumberInput
                            label="Card Min Width (px)"
                            description="Minimum width of each grid card. Grid auto-fills based on available space."
                            value={settings.gridCardWidth}
                            onChange={(value) =>
                              updateSetting('gridCardWidth', typeof value === 'number' ? value : defaultSettings.gridCardWidth)
                            }
                            min={80} max={400} step={10}
                          />
                          <NumberInput
                            label="Card Height (px)"
                            description="Fixed height of each grid card."
                            value={settings.gridCardHeight}
                            onChange={(value) =>
                              updateSetting('gridCardHeight', typeof value === 'number' ? value : defaultSettings.gridCardHeight)
                            }
                            min={80} max={600} step={10}
                          />
                        </Group>
                      )}

                      {/* ── Justified Rows target height ── */}
                      {(settings.unifiedGalleryEnabled
                        ? ['justified', 'mosaic'].includes(settings.unifiedGalleryAdapterId)
                        : ['justified', 'mosaic'].includes(settings.imageGalleryAdapterId) ||
                          ['justified', 'mosaic'].includes(settings.videoGalleryAdapterId)
                      ) && (<>
                        <NumberInput
                          label="Target Row Height (px)"
                          description="Ideal height for each justified row. Rows scale slightly to fill container width while preserving aspect ratios."
                          value={settings.mosaicTargetRowHeight}
                          onChange={(value) =>
                            updateSetting('mosaicTargetRowHeight', typeof value === 'number' ? value : defaultSettings.mosaicTargetRowHeight)
                          }
                          min={60} max={600} step={10}
                        />
                        <NumberInput
                          label="Photo Normalize Height (px)"
                          description="Normalization height used to scale image dimensions before layout. Lower values produce smaller tiles."
                          value={settings.photoNormalizeHeight}
                          onChange={(value) =>
                            updateSetting('photoNormalizeHeight', typeof value === 'number' ? value : 300)
                          }
                          min={100} max={800} step={10}
                        />
                      </>)}

                      {/* ── Masonry columns ── */}
                      {(settings.unifiedGalleryEnabled
                        ? settings.unifiedGalleryAdapterId === 'masonry'
                        : settings.imageGalleryAdapterId === 'masonry' ||
                          settings.videoGalleryAdapterId === 'masonry'
                      ) && (
                        <NumberInput
                          label="Masonry Columns (0 = auto)"
                          description="Number of masonry columns. Set 0 to let the layout choose responsively (1–4 based on width)."
                          value={settings.masonryColumns}
                          onChange={(value) =>
                            updateSetting('masonryColumns', typeof value === 'number' ? value : defaultSettings.masonryColumns)
                          }
                          min={0} max={8} step={1}
                        />
                      )}

                      {/* ── Shape tile size (hex / circle / diamond) ── */}
                      {(settings.unifiedGalleryEnabled
                        ? ['hexagonal', 'circular', 'diamond'].includes(settings.unifiedGalleryAdapterId)
                        : ['hexagonal', 'circular', 'diamond'].includes(settings.imageGalleryAdapterId) ||
                          ['hexagonal', 'circular', 'diamond'].includes(settings.videoGalleryAdapterId)
                      ) && (
                        settings.unifiedGalleryEnabled ? (
                          <NumberInput
                            label="Tile Size (px)"
                            description="Width and height of each shape tile (unified gallery)."
                            value={settings.tileSize}
                            onChange={(value) =>
                              updateSetting('tileSize', typeof value === 'number' ? value : defaultSettings.tileSize)
                            }
                            min={60} max={400} step={10}
                          />
                        ) : (
                          <Group grow>
                            {['hexagonal', 'circular', 'diamond'].includes(settings.imageGalleryAdapterId) && (
                              <NumberInput
                                label="Image Tile Size (px)"
                                description="Shape tile size for the image gallery."
                                value={settings.imageTileSize}
                                onChange={(value) =>
                                  updateSetting('imageTileSize', typeof value === 'number' ? value : defaultSettings.imageTileSize)
                                }
                                min={60} max={400} step={10}
                              />
                            )}
                            {['hexagonal', 'circular', 'diamond'].includes(settings.videoGalleryAdapterId) && (
                              <NumberInput
                                label="Video Tile Size (px)"
                                description="Shape tile size for the video gallery."
                                value={settings.videoTileSize}
                                onChange={(value) =>
                                  updateSetting('videoTileSize', typeof value === 'number' ? value : defaultSettings.videoTileSize)
                                }
                                min={60} max={400} step={10}
                              />
                            )}
                          </Group>
                        )
                      )}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* ── Viewport Backgrounds ── */}
                <Accordion.Item value="backgrounds">
                  <Accordion.Control>Viewport Backgrounds</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      {/* ── Image viewport background ── */}
                      <Select
                        label="Image Viewport Background"
                        description="Background fill rendered behind the image gallery section."
                        value={settings.imageBgType}
                        onChange={(value) => updateSetting('imageBgType', (value as ViewportBgType) ?? 'none')}
                        data={[
                          { value: 'none', label: 'Transparent' },
                          { value: 'solid', label: 'Solid Color' },
                          { value: 'gradient', label: 'Gradient' },
                          { value: 'image', label: 'Image URL' },
                        ]}
                      />
                      {settings.imageBgType === 'solid' && (
                        <ColorInput
                          label="Image Background Color"
                          value={settings.imageBgColor}
                          onChange={(value) => updateSetting('imageBgColor', value)}
                          format="rgba"
                        />
                      )}
                      {settings.imageBgType === 'gradient' && (
                        <TextInput
                          label="Image CSS Gradient"
                          description="Full CSS gradient (e.g. 'linear-gradient(135deg, #1a1a2e, #0f3460)')."
                          value={settings.imageBgGradient}
                          onChange={(e) => updateSetting('imageBgGradient', e.currentTarget.value)}
                        />
                      )}
                      {settings.imageBgType === 'image' && (
                        <TextInput
                          label="Image Background URL"
                          description="Absolute URL of the background image."
                          value={settings.imageBgImageUrl}
                          onChange={(e) => updateSetting('imageBgImageUrl', e.currentTarget.value)}
                        />
                      )}

                      {/* ── Video viewport background ── */}
                      <Select
                        label="Video Viewport Background"
                        description="Background fill rendered behind the video gallery section."
                        value={settings.videoBgType}
                        onChange={(value) => updateSetting('videoBgType', (value as ViewportBgType) ?? 'none')}
                        data={[
                          { value: 'none', label: 'Transparent' },
                          { value: 'solid', label: 'Solid Color' },
                          { value: 'gradient', label: 'Gradient' },
                          { value: 'image', label: 'Image URL' },
                        ]}
                      />
                      {settings.videoBgType === 'solid' && (
                        <ColorInput
                          label="Video Background Color"
                          value={settings.videoBgColor}
                          onChange={(value) => updateSetting('videoBgColor', value)}
                          format="rgba"
                        />
                      )}
                      {settings.videoBgType === 'gradient' && (
                        <TextInput
                          label="Video CSS Gradient"
                          description="Full CSS gradient (e.g. 'linear-gradient(135deg, #0d0d0d, #1a1a2e)')."
                          value={settings.videoBgGradient}
                          onChange={(e) => updateSetting('videoBgGradient', e.currentTarget.value)}
                        />
                      )}
                      {settings.videoBgType === 'image' && (
                        <TextInput
                          label="Video Background URL"
                          description="Absolute URL of the background image."
                          value={settings.videoBgImageUrl}
                          onChange={(e) => updateSetting('videoBgImageUrl', e.currentTarget.value)}
                        />
                      )}

                      {/* ── Unified viewport background ── */}
                      <Select
                        label="Unified Viewport Background"
                        description="Background fill when unified gallery mode is active."
                        value={settings.unifiedBgType}
                        onChange={(value) => updateSetting('unifiedBgType', (value as ViewportBgType) ?? 'none')}
                        data={[
                          { value: 'none', label: 'Transparent' },
                          { value: 'solid', label: 'Solid Color' },
                          { value: 'gradient', label: 'Gradient' },
                          { value: 'image', label: 'Image URL' },
                        ]}
                      />
                      {settings.unifiedBgType === 'solid' && (
                        <ColorInput
                          label="Unified Background Color"
                          value={settings.unifiedBgColor}
                          onChange={(value) => updateSetting('unifiedBgColor', value)}
                          format="rgba"
                        />
                      )}
                      {settings.unifiedBgType === 'gradient' && (
                        <TextInput
                          label="Unified CSS Gradient"
                          description="Full CSS gradient (e.g. 'linear-gradient(135deg, #1a1a2e, #0f3460)')."
                          value={settings.unifiedBgGradient}
                          onChange={(e) => updateSetting('unifiedBgGradient', e.currentTarget.value)}
                        />
                      )}
                      {settings.unifiedBgType === 'image' && (
                        <TextInput
                          label="Unified Background URL"
                          description="Absolute URL of the background image."
                          value={settings.unifiedBgImageUrl}
                          onChange={(e) => updateSetting('unifiedBgImageUrl', e.currentTarget.value)}
                        />
                      )}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* ── Gallery Labels ── */}
                <Accordion.Item value="gallery-labels">
                  <Accordion.Control>Gallery Labels</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <TextInput
                        label="Image Gallery Label"
                        description="Custom label for image gallery sections. Count is appended automatically."
                        value={settings.galleryImageLabel ?? 'Images'}
                        onChange={(e) => updateSetting('galleryImageLabel', e.currentTarget.value)}
                      />
                      <TextInput
                        label="Video Gallery Label"
                        description="Custom label for video gallery sections. Count is appended automatically."
                        value={settings.galleryVideoLabel ?? 'Videos'}
                        onChange={(e) => updateSetting('galleryVideoLabel', e.currentTarget.value)}
                      />
                      <Select
                        label="Label Justification"
                        description="Horizontal alignment for gallery section labels"
                        data={[
                          { value: 'left', label: 'Left' },
                          { value: 'center', label: 'Center' },
                          { value: 'right', label: 'Right' },
                        ]}
                        value={settings.galleryLabelJustification ?? 'left'}
                        onChange={(v) => updateSetting('galleryLabelJustification', (v ?? 'left') as GalleryBehaviorSettings['galleryLabelJustification'])}
                      />
                      <Switch
                        label="Show Gallery Label Icon"
                        description="Display an icon prefix before each gallery section label"
                        checked={settings.showGalleryLabelIcon ?? false}
                        onChange={(e) => updateSetting('showGalleryLabelIcon', e.currentTarget.checked)}
                      />
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* ── Section Sizing ── */}
                <Accordion.Item value="section-sizing">
                  <Accordion.Control>Section Sizing &amp; Spacing</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <NumberInput
                        label="Gallery Section Max Width (px)"
                        description="Maximum width for each gallery section. 0 = fill available space."
                        value={settings.gallerySectionMaxWidth ?? 0}
                        onChange={(v) => updateSetting('gallerySectionMaxWidth', typeof v === 'number' ? v : 0)}
                        min={0}
                        max={2000}
                        step={50}
                      />
                      <NumberInput
                        label="Gallery Section Min Width (px)"
                        description="Minimum width floor for gallery sections."
                        value={settings.gallerySectionMinWidth ?? 300}
                        onChange={(v) => updateSetting('gallerySectionMinWidth', typeof v === 'number' ? v : 300)}
                        min={200}
                        max={600}
                        step={50}
                      />
                      <Select
                        label="Section Height Mode"
                        description="How section height is determined. Auto = content-driven (recommended for masonry/justified)."
                        data={[
                          { value: 'auto', label: 'Auto (content-driven)' },
                          { value: 'manual', label: 'Manual (fixed max height)' },
                          { value: 'viewport', label: 'Viewport (% of screen)' },
                        ]}
                        value={settings.gallerySectionHeightMode ?? 'auto'}
                        onChange={(v) => updateSetting('gallerySectionHeightMode', (v ?? 'auto') as GalleryBehaviorSettings['gallerySectionHeightMode'])}
                      />
                      {settings.gallerySectionHeightMode === 'manual' && (
                        <NumberInput
                          label="Gallery Section Max Height (px)"
                          description="Maximum height for gallery sections in manual mode."
                          value={settings.gallerySectionMaxHeight ?? 0}
                          onChange={(v) => updateSetting('gallerySectionMaxHeight', typeof v === 'number' ? v : 0)}
                          min={0}
                          max={2000}
                          step={50}
                        />
                      )}
                      <NumberInput
                        label="Gallery Section Min Height (px)"
                        description="Minimum height floor for gallery sections."
                        value={settings.gallerySectionMinHeight ?? 150}
                        onChange={(v) => updateSetting('gallerySectionMinHeight', typeof v === 'number' ? v : 150)}
                        min={100}
                        max={400}
                        step={50}
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
                        onChange={(v) => updateSetting('gallerySectionPadding', typeof v === 'number' ? v : 16)}
                        min={0}
                        max={32}
                        step={4}
                      />
                      <Divider label="Gallery Spacing" labelPosition="center" />
                      <NumberInput
                        label="Gallery Max Width (px)"
                        description="Maximum width of the gallery container. 0 = full responsive width."
                        value={settings.modalGalleryMaxWidth}
                        onChange={(v) => updateSetting('modalGalleryMaxWidth', typeof v === 'number' ? v : 0)}
                        min={0}
                        max={3000}
                        step={50}
                      />
                      <NumberInput
                        label="Gallery Section Gap (px)"
                        description="Vertical gap between gallery sections."
                        value={settings.modalGalleryGap}
                        onChange={(v) => updateSetting('modalGalleryGap', typeof v === 'number' ? v : 32)}
                        min={0}
                        max={120}
                        step={4}
                      />
                      <NumberInput
                        label="Gallery Edge Margin (px)"
                        description="Horizontal margin on gallery edges."
                        value={settings.modalGalleryMargin}
                        onChange={(v) => updateSetting('modalGalleryMargin', typeof v === 'number' ? v : 0)}
                        min={0}
                        max={120}
                        step={4}
                      />
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* ── Adapter Sizing ── */}
                <Accordion.Item value="adapter-sizing">
                  <Accordion.Control>Adapter Sizing</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      <Select
                        label="Adapter Sizing Mode"
                        description="How adapters fill their gallery section. Fill = 100% of section, Manual = custom percentage."
                        data={[
                          { value: 'fill', label: 'Fill (100%)' },
                          { value: 'manual', label: 'Manual (custom %)' },
                        ]}
                        value={settings.adapterSizingMode ?? 'fill'}
                        onChange={(v) => updateSetting('adapterSizingMode', (v ?? 'fill') as GalleryBehaviorSettings['adapterSizingMode'])}
                      />
                      {settings.adapterSizingMode === 'manual' && (
                        <>
                          <NumberInput
                            label="Adapter Max Width (%)"
                            description="Adapter width as percentage of its gallery section."
                            value={settings.adapterMaxWidthPct ?? 100}
                            onChange={(v) => updateSetting('adapterMaxWidthPct', typeof v === 'number' ? v : 100)}
                            min={50}
                            max={100}
                            step={5}
                          />
                          <NumberInput
                            label="Adapter Max Height (%)"
                            description="Adapter height as percentage of its gallery section."
                            value={settings.adapterMaxHeightPct ?? 100}
                            onChange={(v) => updateSetting('adapterMaxHeightPct', typeof v === 'number' ? v : 100)}
                            min={50}
                            max={100}
                            step={5}
                          />
                        </>
                      )}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>}
            </Tabs.Panel>

            {/* ── Campaign Viewer Tab ──────────────────────────── */}
            <Tabs.Panel value="viewer" pt="md">
              {activeTab === 'viewer' && <Stack gap="md">
                <Divider label="Open Mode" labelPosition="center" />

                <Switch
                  label="Fullscreen Campaign Modal"
                  description="Open campaign viewer in fullscreen mode instead of the default modal."
                  checked={settings.campaignModalFullscreen ?? false}
                  onChange={(e) => updateSetting('campaignModalFullscreen', e.currentTarget.checked)}
                />
                <Select
                  label="Campaign Open Mode"
                  description="What to show when a campaign is opened."
                  data={[
                    { value: 'full', label: 'Full (cover, about, galleries, stats)' },
                    { value: 'galleries-only', label: 'Galleries only (skip header/about/stats)' },
                  ]}
                  value={settings.campaignOpenMode ?? 'full'}
                  onChange={(v) => updateSetting('campaignOpenMode', (v ?? 'full') as GalleryBehaviorSettings['campaignOpenMode'])}
                />
                <NumberInput
                  label="Fullscreen Content Max Width (px)"
                  description="Limit content width in fullscreen mode. 0 = full responsive width."
                  value={settings.fullscreenContentMaxWidth ?? 0}
                  onChange={(value) => updateSetting('fullscreenContentMaxWidth', typeof value === 'number' ? value : 0)}
                  min={0}
                  max={3000}
                  step={50}
                  placeholder="0 = full width"
                  disabled={!settings.campaignModalFullscreen}
                  style={!settings.campaignModalFullscreen ? { opacity: 0.4 } : undefined}
                />
                <Box style={settings.campaignModalFullscreen ? { opacity: 0.4, pointerEvents: 'none' as const } : undefined}>
                  <Stack gap="md">
                    <NumberInput
                      label="Modal Max Width (px)"
                      description="Maximum width of the campaign modal when not fullscreen (clamped 600–1600)."
                      value={settings.modalMaxWidth ?? 1200}
                      onChange={(value) => updateSetting('modalMaxWidth', typeof value === 'number' ? value : 1200)}
                      min={600}
                      max={1600}
                      step={50}
                      placeholder="1200"
                      disabled={!!settings.campaignModalFullscreen}
                    />
                  </Stack>
                </Box>
                <NumberInput
                  label="Content Max Width (px)"
                  description="Maximum width of the content area inside the modal. 0 = full width."
                  value={settings.modalContentMaxWidth ?? 900}
                  onChange={(value) => updateSetting('modalContentMaxWidth', typeof value === 'number' ? value : 900)}
                  min={0}
                  max={2000}
                  step={50}
                  placeholder="900"
                />
                <NumberInput
                  label="Modal Inner Padding (px)"
                  description="Padding inside the modal content area (clamped 0–48)."
                  value={settings.modalInnerPadding ?? 16}
                  onChange={(value) => updateSetting('modalInnerPadding', typeof value === 'number' ? value : 16)}
                  min={0}
                  max={48}
                  step={4}
                />


                <Divider label="Modal Appearance" labelPosition="center" />

                <NumberInput
                  label="Cover Image Height (px)"
                  description="Height of the cover image in the campaign modal"
                  value={settings.modalCoverHeight}
                  onChange={(v) => updateSetting('modalCoverHeight', typeof v === 'number' ? v : 240)}
                  min={100}
                  max={400}
                  step={10}
                />
                <Select
                  label="Modal Transition"
                  description="Animation style when opening the campaign modal"
                  data={[
                    { value: 'pop', label: 'Pop (scale up)' },
                    { value: 'fade', label: 'Fade' },
                    { value: 'slide-up', label: 'Slide Up' },
                  ]}
                  value={settings.modalTransition}
                  onChange={(v) => updateSetting('modalTransition', v ?? 'pop')}
                />
                <NumberInput
                  label="Modal Transition Duration (ms)"
                  description="Length of the modal open/close animation"
                  value={settings.modalTransitionDuration}
                  onChange={(v) => updateSetting('modalTransitionDuration', typeof v === 'number' ? v : 300)}
                  min={100}
                  max={1000}
                  step={50}
                />
                <NumberInput
                  label="Modal Max Height (vh%)"
                  description="Maximum height of the campaign modal as a percentage of viewport (clamped 50–95)."
                  value={settings.modalMaxHeight}
                  onChange={(v) => updateSetting('modalMaxHeight', typeof v === 'number' ? v : 90)}
                  min={50}
                  max={95}
                  step={5}
                  disabled={!!settings.campaignModalFullscreen}
                  style={settings.campaignModalFullscreen ? { opacity: 0.4 } : undefined}
                />

                <Divider label="Visibility" labelPosition="center" />

                <Box style={settings.campaignOpenMode === 'galleries-only' ? { opacity: 0.4, pointerEvents: 'none' as const } : undefined}>
                  <Stack gap="md">
                <Switch
                  label="Show Company Name"
                  description="Show the company badge on the campaign cover image."
                  checked={settings.showCampaignCompanyName ?? true}
                  onChange={(e) => updateSetting('showCampaignCompanyName', e.currentTarget.checked)}
                  disabled={settings.campaignOpenMode === 'galleries-only'}
                />
                <Switch
                  label="Show Date"
                  description="Show the creation date under the campaign title."
                  checked={settings.showCampaignDate ?? true}
                  onChange={(e) => updateSetting('showCampaignDate', e.currentTarget.checked)}
                  disabled={settings.campaignOpenMode === 'galleries-only'}
                />
                <Switch
                  label="Show About Section"
                  description='Show the "About this Campaign" heading and description.'
                  checked={settings.showCampaignAbout ?? true}
                  onChange={(e) => updateSetting('showCampaignAbout', e.currentTarget.checked)}
                  disabled={settings.campaignOpenMode === 'galleries-only'}
                />
                <Switch
                  label="Show Description"
                  description="Show the campaign description text within the About section."
                  checked={settings.showCampaignDescription ?? true}
                  onChange={(e) => updateSetting('showCampaignDescription', e.currentTarget.checked)}
                  disabled={settings.campaignOpenMode === 'galleries-only'}
                />
                <Switch
                  label="Show Campaign Stats"
                  description="Show the statistics block (video count, image count, tags, visibility)."
                  checked={settings.showCampaignStats ?? true}
                  onChange={(e) => updateSetting('showCampaignStats', e.currentTarget.checked)}
                  disabled={settings.campaignOpenMode === 'galleries-only'}
                />
                <Switch
                  label="Stats Admin-Only"
                  description="When enabled, only admins can see the statistics block."
                  checked={settings.campaignStatsAdminOnly ?? true}
                  onChange={(e) => updateSetting('campaignStatsAdminOnly', e.currentTarget.checked)}
                  disabled={settings.campaignOpenMode === 'galleries-only'}
                />
                <Switch
                  label="Show Cover Image"
                  description="Show the campaign cover image at the top of the viewer."
                  checked={settings.showCampaignCoverImage ?? true}
                  onChange={(e) => updateSetting('showCampaignCoverImage', e.currentTarget.checked)}
                  disabled={settings.campaignOpenMode === 'galleries-only'}
                />
                <Switch
                  label="Show Tags"
                  description="Show tags section in the campaign viewer."
                  checked={settings.showCampaignTags ?? true}
                  onChange={(e) => updateSetting('showCampaignTags', e.currentTarget.checked)}
                  disabled={settings.campaignOpenMode === 'galleries-only'}
                />
                  </Stack>
                </Box>
                <Switch
                  label="Show Admin Actions"
                  description="Show admin action buttons (edit, archive, etc.) in the campaign viewer."
                  checked={settings.showCampaignAdminActions ?? true}
                  onChange={(e) => updateSetting('showCampaignAdminActions', e.currentTarget.checked)}
                />
                <Switch
                  label="Show Gallery Labels"
                  description="Show 'Images' and 'Videos' heading labels above galleries in the viewer."
                  checked={settings.showCampaignGalleryLabels ?? true}
                  onChange={(e) => updateSetting('showCampaignGalleryLabels', e.currentTarget.checked)}
                />

                <Divider label="Modal Background (Fullscreen)" labelPosition="center" />

                <Select
                  label="Background Type"
                  description="Background style for the fullscreen campaign modal"
                  data={[
                    { value: 'theme', label: 'Default Theme' },
                    { value: 'transparent', label: 'Transparent' },
                    { value: 'solid', label: 'Solid color' },
                    { value: 'gradient', label: 'Custom gradient' },
                  ]}
                  value={settings.modalBgType ?? 'theme'}
                  onChange={(v) => updateSetting('modalBgType', (v ?? 'theme') as GalleryBehaviorSettings['modalBgType'])}
                />
                {settings.modalBgType === 'solid' && (
                  <ColorInput
                    label="Modal Background Color"
                    description="Solid background color for the fullscreen modal"
                    value={settings.modalBgColor}
                    onChange={(v) => updateSetting('modalBgColor', v)}
                  />
                )}
                {settings.modalBgType === 'gradient' && (
                  <GradientEditor
                    value={settings.modalBgGradient ?? {}}
                    onChange={(opts) => updateSetting('modalBgGradient', opts)}
                  />
                )}

                <Divider label="Cover Image" labelPosition="center" />

                <Text size="sm" fw={500}>Cover Mobile Ratio</Text>
                <Slider value={settings.modalCoverMobileRatio} onChange={(v) => updateSetting('modalCoverMobileRatio', v)}
                  min={0.2} max={1} step={0.05} />
                <Text size="sm" fw={500}>Cover Tablet Ratio</Text>
                <Slider value={settings.modalCoverTabletRatio} onChange={(v) => updateSetting('modalCoverTabletRatio', v)}
                  min={0.2} max={1} step={0.05} />

                <Divider label="Modal Controls" labelPosition="center" />

                <NumberInput label="Close Button Size (px)" value={settings.modalCloseButtonSize}
                  onChange={(v) => updateSetting('modalCloseButtonSize', typeof v === 'number' ? v : 36)} min={20} max={64} />
                <Text size="sm" fw={500}>Description Line Height</Text>
                <Slider value={settings.campaignDescriptionLineHeight}
                  onChange={(v) => updateSetting('campaignDescriptionLineHeight', v)}
                  min={1} max={3} step={0.1} />
              </Stack>}
            </Tabs.Panel>

            {settings.advancedSettingsEnabled && (
              <Tabs.Panel value="advanced" pt="md">
                {activeTab === 'advanced' && <><Text size="sm" c="dimmed" mb="md">
                  Fine-grained controls for power users. These settings override internal defaults
                  across all gallery components. Change with care.
                </Text>
                <Accordion variant="separated">
                  {/* ── Card Appearance (advanced) ── */}
                  <Accordion.Item value="adv-card">
                    <Accordion.Control>Card Appearance</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <Text size="sm" fw={500}>{tt('Locked Card Opacity', 'cardLockedOpacity')}</Text>
                        <Slider
                          value={settings.cardLockedOpacity}
                          onChange={(v) => updateSetting('cardLockedOpacity', v)}
                          min={0} max={1} step={0.05}
                          marks={[{ value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }]}
                        />
                        <Text size="sm" fw={500}>{tt('Gradient Start Opacity', 'cardGradientStartOpacity')}</Text>
                        <Slider
                          value={settings.cardGradientStartOpacity}
                          onChange={(v) => updateSetting('cardGradientStartOpacity', v)}
                          min={0} max={1} step={0.05}
                        />
                        <Text size="sm" fw={500}>{tt('Gradient End Opacity', 'cardGradientEndOpacity')}</Text>
                        <Slider
                          value={settings.cardGradientEndOpacity}
                          onChange={(v) => updateSetting('cardGradientEndOpacity', v)}
                          min={0} max={1} step={0.05}
                        />
                        <NumberInput label={tt('Lock Icon Size (px)', 'cardLockIconSize')} value={settings.cardLockIconSize}
                          onChange={(v) => updateSetting('cardLockIconSize', typeof v === 'number' ? v : 32)} min={12} max={64} />
                        <NumberInput label={tt('Access Icon Size (px)', 'cardAccessIconSize')} value={settings.cardAccessIconSize}
                          onChange={(v) => updateSetting('cardAccessIconSize', typeof v === 'number' ? v : 14)} min={8} max={32} />
                        <NumberInput label={tt('Badge Offset Y (px)', 'cardBadgeOffsetY')} value={settings.cardBadgeOffsetY}
                          onChange={(v) => updateSetting('cardBadgeOffsetY', typeof v === 'number' ? v : 8)} min={0} max={32} />
                        <NumberInput label={tt('Company Badge Max Width (px)', 'cardCompanyBadgeMaxWidth')} value={settings.cardCompanyBadgeMaxWidth}
                          onChange={(v) => updateSetting('cardCompanyBadgeMaxWidth', typeof v === 'number' ? v : 160)} min={60} max={400} />
                        <NumberInput label={tt('Thumbnail Hover Transition (ms)', 'cardThumbnailHoverTransitionMs')} value={settings.cardThumbnailHoverTransitionMs}
                          onChange={(v) => updateSetting('cardThumbnailHoverTransitionMs', typeof v === 'number' ? v : 300)} min={0} max={1000} />
                        <Text size="sm" fw={500}>{tt('Page Transition Opacity', 'cardPageTransitionOpacity')}</Text>
                        <Slider
                          value={settings.cardPageTransitionOpacity}
                          onChange={(v) => updateSetting('cardPageTransitionOpacity', v)}
                          min={0} max={1} step={0.05}
                        />
                        <TextInput label={tt('Auto Columns Breakpoints', 'cardAutoColumnsBreakpoints')} description="Format: 480:1,768:2,1024:3,1280:4"
                          value={settings.cardAutoColumnsBreakpoints}
                          onChange={(e) => updateSetting('cardAutoColumnsBreakpoints', e.currentTarget.value)} />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* ── Gallery Text (advanced) ── */}
                  <Accordion.Item value="adv-text">
                    <Accordion.Control>Gallery Text</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <TextInput label={tt('Gallery Title', 'galleryTitleText')} description="Main heading text shown above the gallery."
                          value={settings.galleryTitleText}
                          onChange={(e) => updateSetting('galleryTitleText', e.currentTarget.value)} />
                        <TextInput label={tt('Gallery Subtitle', 'gallerySubtitleText')} description="Subtitle text shown beneath the title."
                          value={settings.gallerySubtitleText}
                          onChange={(e) => updateSetting('gallerySubtitleText', e.currentTarget.value)} />
                        <TextInput label={tt('Campaign About Heading', 'campaignAboutHeadingText')} description='Heading for the campaign description section (default "About").'
                          value={settings.campaignAboutHeadingText}
                          onChange={(e) => updateSetting('campaignAboutHeadingText', e.currentTarget.value)} />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* ── Modal / Viewer (advanced) ── */}
                  <Accordion.Item value="adv-modal">
                    <Accordion.Control>Modal / Viewer</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <TextInput label={tt('Close Button Background', 'modalCloseButtonBgColor')} value={settings.modalCloseButtonBgColor}
                          onChange={(e) => updateSetting('modalCloseButtonBgColor', e.currentTarget.value)} />
                        <NumberInput label={tt('Content Max Width (px)', 'modalContentMaxWidth')} value={settings.modalContentMaxWidth}
                          onChange={(v) => updateSetting('modalContentMaxWidth', typeof v === 'number' ? v : 900)} min={400} max={2000} />
                        <NumberInput label={tt('Mobile Breakpoint (px)', 'modalMobileBreakpoint')} value={settings.modalMobileBreakpoint}
                          onChange={(v) => updateSetting('modalMobileBreakpoint', typeof v === 'number' ? v : 768)} min={320} max={1280} />

                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* ── Upload / Media (advanced) ── */}
                  <Accordion.Item value="adv-upload">
                    <Accordion.Control>Upload / Media</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <NumberInput label={tt('Upload Max Size (MB)', 'uploadMaxSizeMb')} value={settings.uploadMaxSizeMb}
                          onChange={(v) => updateSetting('uploadMaxSizeMb', typeof v === 'number' ? v : 50)} min={1} max={500} />
                        <TextInput label={tt('Allowed Upload Types', 'uploadAllowedTypes')} description="Comma-separated MIME patterns (e.g. image/*,video/*)"
                          value={settings.uploadAllowedTypes}
                          onChange={(e) => updateSetting('uploadAllowedTypes', e.currentTarget.value)} />
                        <NumberInput label={tt('Library Page Size', 'libraryPageSize')} value={settings.libraryPageSize}
                          onChange={(v) => updateSetting('libraryPageSize', typeof v === 'number' ? v : 20)} min={5} max={100} />
                        <NumberInput label={tt('Media List Page Size', 'mediaListPageSize')} value={settings.mediaListPageSize}
                          onChange={(v) => updateSetting('mediaListPageSize', typeof v === 'number' ? v : 50)} min={10} max={200} />
                        <NumberInput label={tt('Compact Card Height (px)', 'mediaCompactCardHeight')} value={settings.mediaCompactCardHeight}
                          onChange={(v) => updateSetting('mediaCompactCardHeight', typeof v === 'number' ? v : 100)} min={40} max={300} />
                        <NumberInput label={tt('Small Card Height (px)', 'mediaSmallCardHeight')} value={settings.mediaSmallCardHeight}
                          onChange={(v) => updateSetting('mediaSmallCardHeight', typeof v === 'number' ? v : 80)} min={40} max={300} />
                        <NumberInput label={tt('Medium Card Height (px)', 'mediaMediumCardHeight')} value={settings.mediaMediumCardHeight}
                          onChange={(v) => updateSetting('mediaMediumCardHeight', typeof v === 'number' ? v : 240)} min={100} max={600} />
                        <NumberInput label={tt('Large Card Height (px)', 'mediaLargeCardHeight')} value={settings.mediaLargeCardHeight}
                          onChange={(v) => updateSetting('mediaLargeCardHeight', typeof v === 'number' ? v : 340)} min={100} max={800} />
                        <NumberInput label={tt('Media List Min Width (px)', 'mediaListMinWidth')} value={settings.mediaListMinWidth}
                          onChange={(v) => updateSetting('mediaListMinWidth', typeof v === 'number' ? v : 600)} min={300} max={1200} />
                        <NumberInput label={tt('SWR Deduping Interval (ms)', 'swrDedupingIntervalMs')} value={settings.swrDedupingIntervalMs}
                          onChange={(v) => updateSetting('swrDedupingIntervalMs', typeof v === 'number' ? v : 5000)} min={0} max={30000} />
                        <NumberInput label={tt('Notification Dismiss (ms)', 'notificationDismissMs')} value={settings.notificationDismissMs}
                          onChange={(v) => updateSetting('notificationDismissMs', typeof v === 'number' ? v : 4000)} min={1000} max={30000} />
                        <Divider label="Image Optimization" labelPosition="center" />
                        <Switch label={tt('Optimize on Upload', 'optimizeOnUpload')} description="Automatically resize and compress images on upload."
                          checked={settings.optimizeOnUpload}
                          onChange={(e) => updateSetting('optimizeOnUpload', e.currentTarget.checked)} />
                        <NumberInput label={tt('Max Width (px)', 'optimizeMaxWidth')} value={settings.optimizeMaxWidth}
                          onChange={(v) => updateSetting('optimizeMaxWidth', typeof v === 'number' ? v : 1920)} min={100} max={4096} />
                        <NumberInput label={tt('Max Height (px)', 'optimizeMaxHeight')} value={settings.optimizeMaxHeight}
                          onChange={(v) => updateSetting('optimizeMaxHeight', typeof v === 'number' ? v : 1920)} min={100} max={4096} />
                        <NumberInput label={tt('Quality (%)', 'optimizeQuality')} value={settings.optimizeQuality}
                          onChange={(v) => updateSetting('optimizeQuality', typeof v === 'number' ? v : 82)} min={10} max={100} />
                        <Switch label={tt('WebP Conversion', 'optimizeWebpEnabled')} description="Generate WebP copies alongside originals."
                          checked={settings.optimizeWebpEnabled}
                          onChange={(e) => updateSetting('optimizeWebpEnabled', e.currentTarget.checked)} />
                        <NumberInput label={tt('Thumbnail Cache TTL (s)', 'thumbnailCacheTtl')} description="How long cached external thumbnails are kept (seconds)."
                          value={settings.thumbnailCacheTtl}
                          onChange={(v) => updateSetting('thumbnailCacheTtl', typeof v === 'number' ? v : 86400)} min={0} max={604800} />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* ── Tile / Adapter (advanced) ── */}
                  <Accordion.Item value="adv-tile">
                    <Accordion.Control>Tile / Adapter</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <Text size="sm" fw={500}>{tt('Hover Overlay Opacity', 'tileHoverOverlayOpacity')}</Text>
                        <Slider value={settings.tileHoverOverlayOpacity} onChange={(v) => updateSetting('tileHoverOverlayOpacity', v)}
                          min={0} max={1} step={0.05} />
                        <Text size="sm" fw={500}>{tt('Bounce Scale (Hover)', 'tileBounceScaleHover')}</Text>
                        <Slider value={settings.tileBounceScaleHover} onChange={(v) => updateSetting('tileBounceScaleHover', v)}
                          min={1} max={1.3} step={0.01} />
                        <Text size="sm" fw={500}>{tt('Bounce Scale (Active)', 'tileBounceScaleActive')}</Text>
                        <Slider value={settings.tileBounceScaleActive} onChange={(v) => updateSetting('tileBounceScaleActive', v)}
                          min={0.9} max={1.1} step={0.01} />
                        <NumberInput label={tt('Bounce Duration (ms)', 'tileBounceDurationMs')} value={settings.tileBounceDurationMs}
                          onChange={(v) => updateSetting('tileBounceDurationMs', typeof v === 'number' ? v : 300)} min={0} max={1000} />
                        <NumberInput label={tt('Base Transition Duration (ms)', 'tileBaseTransitionDurationMs')} value={settings.tileBaseTransitionDurationMs}
                          onChange={(v) => updateSetting('tileBaseTransitionDurationMs', typeof v === 'number' ? v : 250)} min={0} max={1000} />
                        <NumberInput label={tt('Tile Transition Duration (ms)', 'tileTransitionDurationMs')} value={settings.tileTransitionDurationMs}
                          onChange={(v) => updateSetting('tileTransitionDurationMs', typeof v === 'number' ? v : 200)} min={0} max={1000} />
                        <Text size="sm" fw={500}>{tt('Hex Vertical Overlap Ratio', 'hexVerticalOverlapRatio')}</Text>
                        <Slider value={settings.hexVerticalOverlapRatio} onChange={(v) => updateSetting('hexVerticalOverlapRatio', v)}
                          min={0} max={0.5} step={0.01} />
                        <Text size="sm" fw={500}>{tt('Diamond Vertical Overlap Ratio', 'diamondVerticalOverlapRatio')}</Text>
                        <Slider value={settings.diamondVerticalOverlapRatio} onChange={(v) => updateSetting('diamondVerticalOverlapRatio', v)}
                          min={0} max={0.5} step={0.01} />
                        <TextInput label={tt('Hex Clip Path', 'hexClipPath')} value={settings.hexClipPath}
                          onChange={(e) => updateSetting('hexClipPath', e.currentTarget.value)} />
                        <TextInput label={tt('Diamond Clip Path', 'diamondClipPath')} value={settings.diamondClipPath}
                          onChange={(e) => updateSetting('diamondClipPath', e.currentTarget.value)} />
                        <NumberInput label={tt('Default Per Row', 'tileDefaultPerRow')} value={settings.tileDefaultPerRow}
                          onChange={(v) => updateSetting('tileDefaultPerRow', typeof v === 'number' ? v : 5)} min={1} max={12} />
                        <TextInput label={tt('Masonry Auto Column Breakpoints', 'masonryAutoColumnBreakpoints')} description="Format: 480:2,768:3,1024:4,1280:5"
                          value={settings.masonryAutoColumnBreakpoints}
                          onChange={(e) => updateSetting('masonryAutoColumnBreakpoints', e.currentTarget.value)} />
                        <TextInput label={tt('Grid Card Hover Shadow', 'gridCardHoverShadow')} value={settings.gridCardHoverShadow}
                          onChange={(e) => updateSetting('gridCardHoverShadow', e.currentTarget.value)} />
                        <TextInput label={tt('Grid Card Default Shadow', 'gridCardDefaultShadow')} value={settings.gridCardDefaultShadow}
                          onChange={(e) => updateSetting('gridCardDefaultShadow', e.currentTarget.value)} />
                        <Text size="sm" fw={500}>{tt('Grid Card Hover Scale', 'gridCardHoverScale')}</Text>
                        <Slider value={settings.gridCardHoverScale} onChange={(v) => updateSetting('gridCardHoverScale', v)}
                          min={1} max={1.2} step={0.01} />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* ── Lightbox (advanced) ── */}
                  <Accordion.Item value="adv-lightbox">
                    <Accordion.Control>Lightbox</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <NumberInput label={tt('Transition Duration (ms)', 'lightboxTransitionMs')} value={settings.lightboxTransitionMs}
                          onChange={(v) => updateSetting('lightboxTransitionMs', typeof v === 'number' ? v : 250)} min={0} max={1000} />
                        <TextInput label={tt('Backdrop Color', 'lightboxBackdropColor')} value={settings.lightboxBackdropColor}
                          onChange={(e) => updateSetting('lightboxBackdropColor', e.currentTarget.value)} />
                        <Text size="sm" fw={500}>{tt('Entry Scale', 'lightboxEntryScale')}</Text>
                        <Slider value={settings.lightboxEntryScale} onChange={(v) => updateSetting('lightboxEntryScale', v)}
                          min={0.5} max={1} step={0.01} />
                        <NumberInput label={tt('Video Max Width (px)', 'lightboxVideoMaxWidth')} value={settings.lightboxVideoMaxWidth}
                          onChange={(v) => updateSetting('lightboxVideoMaxWidth', typeof v === 'number' ? v : 900)} min={300} max={1920} />
                        <NumberInput label={tt('Video Height (px)', 'lightboxVideoHeight')} value={settings.lightboxVideoHeight}
                          onChange={(v) => updateSetting('lightboxVideoHeight', typeof v === 'number' ? v : 506)} min={200} max={1080} />
                        <TextInput label={tt('Media Max Height', 'lightboxMediaMaxHeight')} description="CSS value, e.g. 85vh"
                          value={settings.lightboxMediaMaxHeight}
                          onChange={(e) => updateSetting('lightboxMediaMaxHeight', e.currentTarget.value)} />
                        <NumberInput label={tt('Z-Index', 'lightboxZIndex')} value={settings.lightboxZIndex}
                          onChange={(v) => updateSetting('lightboxZIndex', typeof v === 'number' ? v : 1000)} min={1} max={10000} />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* ── Navigation (advanced) ── */}
                  <Accordion.Item value="adv-nav">
                    <Accordion.Control>Navigation</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <NumberInput label={tt('Max Visible Dots', 'dotNavMaxVisibleDots')} value={settings.dotNavMaxVisibleDots}
                          onChange={(v) => updateSetting('dotNavMaxVisibleDots', typeof v === 'number' ? v : 7)} min={3} max={20} />
                        <NumberInput label={tt('Arrow Edge Inset (px)', 'navArrowEdgeInset')} value={settings.navArrowEdgeInset}
                          onChange={(v) => updateSetting('navArrowEdgeInset', typeof v === 'number' ? v : 8)} min={0} max={48} />
                        <NumberInput label={tt('Arrow Min Hit Target (px)', 'navArrowMinHitTarget')} value={settings.navArrowMinHitTarget}
                          onChange={(v) => updateSetting('navArrowMinHitTarget', typeof v === 'number' ? v : 44)} min={24} max={80} />
                        <NumberInput label={tt('Arrow Fade Duration (ms)', 'navArrowFadeDurationMs')} value={settings.navArrowFadeDurationMs}
                          onChange={(v) => updateSetting('navArrowFadeDurationMs', typeof v === 'number' ? v : 200)} min={0} max={1000} />
                        <NumberInput label={tt('Arrow Scale Transition (ms)', 'navArrowScaleTransitionMs')} value={settings.navArrowScaleTransitionMs}
                          onChange={(v) => updateSetting('navArrowScaleTransitionMs', typeof v === 'number' ? v : 150)} min={0} max={1000} />
                        <Text size="sm" fw={500}>{tt('Viewport Height Mobile Ratio', 'viewportHeightMobileRatio')}</Text>
                        <Slider value={settings.viewportHeightMobileRatio}
                          onChange={(v) => updateSetting('viewportHeightMobileRatio', v)}
                          min={0.3} max={1} step={0.05} />
                        <Text size="sm" fw={500}>{tt('Viewport Height Tablet Ratio', 'viewportHeightTabletRatio')}</Text>
                        <Slider value={settings.viewportHeightTabletRatio}
                          onChange={(v) => updateSetting('viewportHeightTabletRatio', v)}
                          min={0.3} max={1} step={0.05} />
                        <NumberInput label={tt('Search Input Min Width (px)', 'searchInputMinWidth')} value={settings.searchInputMinWidth}
                          onChange={(v) => updateSetting('searchInputMinWidth', typeof v === 'number' ? v : 200)} min={100} max={400} />
                        <NumberInput label={tt('Search Input Max Width (px)', 'searchInputMaxWidth')} value={settings.searchInputMaxWidth}
                          onChange={(v) => updateSetting('searchInputMaxWidth', typeof v === 'number' ? v : 280)} min={150} max={600} />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* ── System (advanced) ── */}
                  <Accordion.Item value="adv-system">
                    <Accordion.Control>System</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <NumberInput label={tt('Expiry Warning Threshold (ms)', 'expiryWarningThresholdMs')} description="How early to show token-expiry warnings."
                          value={settings.expiryWarningThresholdMs}
                          onChange={(v) => updateSetting('expiryWarningThresholdMs', typeof v === 'number' ? v : 300000)} min={0} max={600000} />
                        <NumberInput label={tt('Admin Search Debounce (ms)', 'adminSearchDebounceMs')} value={settings.adminSearchDebounceMs}
                          onChange={(v) => updateSetting('adminSearchDebounceMs', typeof v === 'number' ? v : 300)} min={0} max={2000} />
                        <NumberInput label={tt('Min Password Length', 'loginMinPasswordLength')} value={settings.loginMinPasswordLength}
                          onChange={(v) => updateSetting('loginMinPasswordLength', typeof v === 'number' ? v : 1)} min={1} max={32} />
                        <NumberInput label={tt('Login Form Max Width (px)', 'loginFormMaxWidth')} value={settings.loginFormMaxWidth}
                          onChange={(v) => updateSetting('loginFormMaxWidth', typeof v === 'number' ? v : 400)} min={200} max={800} />
                        <NumberInput label={tt('Auth Bar Backdrop Blur (px)', 'authBarBackdropBlur')} value={settings.authBarBackdropBlur}
                          onChange={(v) => updateSetting('authBarBackdropBlur', typeof v === 'number' ? v : 8)} min={0} max={24} />
                        <NumberInput label={tt('Auth Bar Mobile Breakpoint (px)', 'authBarMobileBreakpoint')} value={settings.authBarMobileBreakpoint}
                          onChange={(v) => updateSetting('authBarMobileBreakpoint', typeof v === 'number' ? v : 768)} min={320} max={1280} />
                        <Switch
                          label={tt('Preserve data on plugin removal', 'preserveDataOnUninstall')}
                          description="When enabled, all campaigns, templates, analytics, and uploaded files are kept if you uninstall the plugin."
                          checked={settings.preserveDataOnUninstall ?? false}
                          onChange={(e) => updateSetting('preserveDataOnUninstall', e.currentTarget.checked)}
                        />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  <Accordion.Item value="maintenance">
                    <Accordion.Control>Data Maintenance</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <NumberInput
                          label={tt('Archive Purge After (days)', 'archivePurgeDays')}
                          description="Archived campaigns older than this are moved to trash. Set to 0 to disable automatic purging."
                          value={settings.archivePurgeDays ?? 0}
                          onChange={(v) => updateSetting('archivePurgeDays', typeof v === 'number' ? v : 0)}
                          min={0} max={365}
                        />
                        <NumberInput
                          label={tt('Trash Grace Period (days)', 'archivePurgeGraceDays')}
                          description="Trashed campaigns are permanently deleted after this many days. Minimum 7 days."
                          value={settings.archivePurgeGraceDays ?? 30}
                          onChange={(v) => updateSetting('archivePurgeGraceDays', typeof v === 'number' ? v : 30)}
                          min={7} max={90}
                        />
                        <NumberInput
                          label={tt('Analytics Retention (days)', 'analyticsRetentionDays')}
                          description="Analytics events older than this are purged weekly. Set to 0 to keep indefinitely."
                          value={settings.analyticsRetentionDays ?? 0}
                          onChange={(v) => updateSetting('analyticsRetentionDays', typeof v === 'number' ? v : 0)}
                          min={0} max={730}
                        />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion></>}
              </Tabs.Panel>
            )}

            {/* ── Typography Tab ───────────────────────────────── */}
            <Tabs.Panel value="typography" pt="md">
              {activeTab === 'typography' && <Stack gap="md">
                <Text size="sm" c="dimmed">
                  Customize fonts, sizes, colors, and effects for individual text elements. Empty fields use theme defaults.
                </Text>
                <FontLibraryManager
                  apiClient={apiClient}
                  onFontsChange={(fonts) => setCustomFonts(fonts.map((f) => ({ name: f.name, family: `'${f.name}', sans-serif` })))}
                />

                <Divider label="Element Overrides" labelPosition="left" />

                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  disabled={Object.keys(settings.typographyOverrides).length === 0}
                  onClick={() => updateSetting('typographyOverrides', {})}
                >
                  Reset all typography
                </Button>
                <Accordion variant="separated" chevronPosition="left">
                  {/* Gallery Header */}
                  <Accordion.Item value="viewerTitle">
                    <Accordion.Control>Viewer Title</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['viewerTitle'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('viewerTitle', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="viewerSubtitle">
                    <Accordion.Control>Viewer Subtitle</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['viewerSubtitle'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('viewerSubtitle', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* Campaign Cards */}
                  <Accordion.Item value="cardTitle">
                    <Accordion.Control>Card Title</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['cardTitle'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('cardTitle', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="cardDescription">
                    <Accordion.Control>Card Description</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['cardDescription'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('cardDescription', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="cardCompanyName">
                    <Accordion.Control>Card Company Name</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['cardCompanyName'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('cardCompanyName', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="cardMediaCounts">
                    <Accordion.Control>Card Media Counts</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['cardMediaCounts'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('cardMediaCounts', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* Campaign Viewer */}
                  <Accordion.Item value="campaignTitle">
                    <Accordion.Control>Campaign Title</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['campaignTitle'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('campaignTitle', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="campaignDescription">
                    <Accordion.Control>Campaign Description</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['campaignDescription'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('campaignDescription', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="campaignDate">
                    <Accordion.Control>Campaign Date</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['campaignDate'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('campaignDate', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="campaignAboutHeading">
                    <Accordion.Control>Campaign About Heading</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['campaignAboutHeading'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('campaignAboutHeading', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="campaignStatsValue">
                    <Accordion.Control>Campaign Stats Value</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['campaignStatsValue'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('campaignStatsValue', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="campaignStatsLabel">
                    <Accordion.Control>Campaign Stats Label</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['campaignStatsLabel'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('campaignStatsLabel', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* Gallery & Media */}
                  <Accordion.Item value="galleryLabel">
                    <Accordion.Control>Gallery Label</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['galleryLabel'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('galleryLabel', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="mediaCaption">
                    <Accordion.Control>Media Caption</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['mediaCaption'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('mediaCaption', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* Auth & Access */}
                  <Accordion.Item value="authBarText">
                    <Accordion.Control>Auth Bar Text</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['authBarText'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('authBarText', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                  <Accordion.Item value="accessBadgeText">
                    <Accordion.Control>Access Badge Text</Accordion.Control>
                    <Accordion.Panel>
                      <TypographyEditor
                        value={settings.typographyOverrides['accessBadgeText'] ?? {}}
                        customFonts={customFonts}
                        onChange={(v) => updateTypoOverride('accessBadgeText', v)}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </Stack>}
            </Tabs.Panel>

          </Tabs>
        </Stack>
        </Box>

          {/* ── Footer (fixed outside scroll area) ───────── */}
          <Box
            style={{
              flexShrink: 0,
              borderTop: '1px solid var(--mantine-color-default-border)',
              boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
              padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)',
            }}
          >
            <Group justify="flex-end" gap="sm">
              {hasChanges && (
                <Button variant="subtle" onClick={handleReset} disabled={isSaving}>
                  Reset
                </Button>
              )}
              <Button onClick={handleSave} loading={isSaving} disabled={!hasChanges}>
                Save Changes
              </Button>
            </Group>
          </Box>
        </>
      )}
    </Modal>
  );
}
