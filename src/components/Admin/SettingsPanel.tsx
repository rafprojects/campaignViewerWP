import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  Accordion,
  Box,
  Button,
  ColorInput,
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
  Slider,
  Tabs,
  Text,
  Divider,
  TextInput,
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
  type GalleryConfig,
  type ShadowPreset,
} from '@/types';
import { ThemeSelector } from './ThemeSelector';
import { SettingTooltip } from './SettingTooltip';
import type { CustomFontEntry } from '../Common/TypographyEditor';
import { GradientEditor } from '../Common/GradientEditor';
import { GalleryAdapterSettingsSection, type UpdateGallerySetting } from '../Settings/GalleryAdapterSettingsSection';
import { GalleryLayoutDetailSections } from '../Settings/GalleryLayoutDetailSections';
import { GalleryPresentationSections } from '../Settings/GalleryPresentationSections';
import { CampaignViewerSettingsSection } from '../Settings/CampaignViewerSettingsSection';
import { AdvancedSettingsSection } from '../Settings/AdvancedSettingsSection';
import { TypographySettingsSection } from '../Settings/TypographySettingsSection';
import { useTheme } from '@/hooks/useTheme';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { GalleryConfigEditorModal } from '@/components/Common/GalleryConfigEditorModal';
import { buildGalleryConfigFromLegacySettings, collectGalleryAdapterSettingValues, mergeGalleryConfig } from '@/utils/galleryConfig';
import { mergeSettingsWithDefaults } from '@/utils/mergeSettingsWithDefaults';
import { SETTING_TOOLTIPS } from '@/data/settingTooltips';

function getRepresentativeGalleryCommonSetting(
  galleryConfig: GalleryConfig,
  key:
    | 'sectionMaxWidth'
    | 'sectionMaxHeight'
    | 'sectionMinWidth'
    | 'sectionMinHeight'
    | 'sectionHeightMode'
    | 'perTypeSectionEqualHeight'
    | 'sectionPadding'
    | 'adapterContentPadding'
    | 'adapterItemGap'
    | 'adapterJustifyContent',
): number | string | boolean | undefined {
  const scopes = galleryConfig.mode === 'unified'
    ? ['unified'] as const
    : ['image', 'video'] as const;

  for (const scope of scopes) {
    const value = galleryConfig.breakpoints?.desktop?.[scope]?.common?.[key]
      ?? galleryConfig.breakpoints?.tablet?.[scope]?.common?.[key]
      ?? galleryConfig.breakpoints?.mobile?.[scope]?.common?.[key];
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }
  }

  return undefined;
}

function buildGalleryConfigEditorSeed(settings: SettingsData): GalleryConfig {
  const seed = buildGalleryConfigFromLegacySettings(settings);

  return settings.galleryConfig
    ? mergeGalleryConfig(settings.galleryConfig, seed)
    : seed;
}

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
  const [galleryConfigEditorOpen, setGalleryConfigEditorOpen] = useState(false);
  const hasChangesRef = useRef(false);

  const applySettingsUpdate = useCallback((recipe: (prev: SettingsData) => SettingsData) => {
    setSettings((prev) => {
      const updated = recipe(prev);
      const changed = JSON.stringify(updated) !== JSON.stringify(originalSettings);
      setHasChanges(changed);
      hasChangesRef.current = changed;
      return updated;
    });
  }, [originalSettings]);

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
    applySettingsUpdate((prev) => ({ ...prev, [key]: value }));
  };

  const updateGallerySetting: UpdateGallerySetting = (key, value) => {
    updateSetting(key as keyof SettingsData, value as SettingsData[keyof SettingsData]);
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

  const handleGalleryConfigEditorSave = (galleryConfig: GalleryConfig) => {
    applySettingsUpdate((prev) => {
      const adapterSettingValues = collectGalleryAdapterSettingValues(galleryConfig);
      const nextUnifiedAdapterId = galleryConfig.breakpoints?.desktop?.unified?.adapterId
        ?? galleryConfig.breakpoints?.tablet?.unified?.adapterId
        ?? galleryConfig.breakpoints?.mobile?.unified?.adapterId
        ?? prev.unifiedGalleryAdapterId;
      const desktopImageAdapterId = galleryConfig.breakpoints?.desktop?.image?.adapterId ?? prev.desktopImageAdapterId;
      const desktopVideoAdapterId = galleryConfig.breakpoints?.desktop?.video?.adapterId ?? prev.desktopVideoAdapterId;
      const tabletImageAdapterId = galleryConfig.breakpoints?.tablet?.image?.adapterId ?? prev.tabletImageAdapterId;
      const tabletVideoAdapterId = galleryConfig.breakpoints?.tablet?.video?.adapterId ?? prev.tabletVideoAdapterId;
      const mobileImageAdapterId = galleryConfig.breakpoints?.mobile?.image?.adapterId ?? prev.mobileImageAdapterId;
      const mobileVideoAdapterId = galleryConfig.breakpoints?.mobile?.video?.adapterId ?? prev.mobileVideoAdapterId;
      const gallerySectionMaxWidth = getRepresentativeGalleryCommonSetting(galleryConfig, 'sectionMaxWidth') ?? prev.gallerySectionMaxWidth;
      const gallerySectionMaxHeight = getRepresentativeGalleryCommonSetting(galleryConfig, 'sectionMaxHeight') ?? prev.gallerySectionMaxHeight;
      const gallerySectionMinWidth = getRepresentativeGalleryCommonSetting(galleryConfig, 'sectionMinWidth') ?? prev.gallerySectionMinWidth;
      const gallerySectionMinHeight = getRepresentativeGalleryCommonSetting(galleryConfig, 'sectionMinHeight') ?? prev.gallerySectionMinHeight;
      const gallerySectionHeightMode = getRepresentativeGalleryCommonSetting(galleryConfig, 'sectionHeightMode') ?? prev.gallerySectionHeightMode;
      const perTypeSectionEqualHeight = getRepresentativeGalleryCommonSetting(galleryConfig, 'perTypeSectionEqualHeight') ?? prev.perTypeSectionEqualHeight;
      const gallerySectionPadding = getRepresentativeGalleryCommonSetting(galleryConfig, 'sectionPadding') ?? prev.gallerySectionPadding;
      const adapterContentPadding = getRepresentativeGalleryCommonSetting(galleryConfig, 'adapterContentPadding') ?? prev.adapterContentPadding;
      const adapterItemGap = getRepresentativeGalleryCommonSetting(galleryConfig, 'adapterItemGap') ?? prev.adapterItemGap;
      const adapterJustifyContent = getRepresentativeGalleryCommonSetting(galleryConfig, 'adapterJustifyContent') ?? prev.adapterJustifyContent;

      return {
        ...prev,
        ...(adapterSettingValues as Partial<SettingsData>),
        galleryConfig,
        unifiedGalleryEnabled: galleryConfig.mode === 'unified',
        gallerySelectionMode: galleryConfig.mode === 'unified' ? 'unified' : 'per-breakpoint',
        unifiedGalleryAdapterId: nextUnifiedAdapterId,
        imageGalleryAdapterId: desktopImageAdapterId || prev.imageGalleryAdapterId,
        videoGalleryAdapterId: desktopVideoAdapterId || prev.videoGalleryAdapterId,
        desktopImageAdapterId,
        desktopVideoAdapterId,
        tabletImageAdapterId,
        tabletVideoAdapterId,
        mobileImageAdapterId,
        mobileVideoAdapterId,
        gallerySectionMaxWidth: gallerySectionMaxWidth as SettingsData['gallerySectionMaxWidth'],
        gallerySectionMaxHeight: gallerySectionMaxHeight as SettingsData['gallerySectionMaxHeight'],
        gallerySectionMinWidth: gallerySectionMinWidth as SettingsData['gallerySectionMinWidth'],
        gallerySectionMinHeight: gallerySectionMinHeight as SettingsData['gallerySectionMinHeight'],
        gallerySectionHeightMode: gallerySectionHeightMode as SettingsData['gallerySectionHeightMode'],
        perTypeSectionEqualHeight: perTypeSectionEqualHeight as SettingsData['perTypeSectionEqualHeight'],
        gallerySectionPadding: gallerySectionPadding as SettingsData['gallerySectionPadding'],
        adapterContentPadding: adapterContentPadding as SettingsData['adapterContentPadding'],
        adapterItemGap: adapterItemGap as SettingsData['adapterItemGap'],
        adapterJustifyContent: adapterJustifyContent as SettingsData['adapterJustifyContent'],
      };
    });

    setGalleryConfigEditorOpen(false);
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
                      {settings.cardMaxWidth > 0 && (
                        <Select
                          label="Card Max Width Unit"
                          description="Unit for the card max width value"
                          data={[
                            { value: 'px', label: 'Pixels (px)' },
                            { value: '%', label: 'Percent (%)' },
                          ]}
                          value={settings.cardMaxWidthUnit ?? 'px'}
                          onChange={(v) => updateSetting('cardMaxWidthUnit', (v ?? 'px') as GalleryBehaviorSettings['cardMaxWidthUnit'])}
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
                          onChange={(v) => updateSetting('cardJustifyContent', (v ?? 'center') as GalleryBehaviorSettings['cardJustifyContent'])}
                        />
                      )}
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
                    <Group justify="space-between" align="flex-start" mb="md">
                      <Text size="sm" c="dimmed" maw={560}>
                        Quick selectors stay inline here. Use the responsive editor when you need breakpoint-aware nested gallery selection without flattening the layout tab again.
                      </Text>
                      <Button variant="light" onClick={() => setGalleryConfigEditorOpen(true)}>
                        Edit Responsive Config
                      </Button>
                    </Group>
                    <GalleryAdapterSettingsSection
                      settings={settings}
                      updateSetting={updateGallerySetting}
                    />
                  </Accordion.Panel>
                </Accordion.Item>

                <GalleryPresentationSections
                  settings={settings}
                  updateSetting={updateGallerySetting}
                />

                <GalleryLayoutDetailSections
                  settings={settings}
                  updateSetting={updateGallerySetting}
                />
              </Accordion>}
            </Tabs.Panel>

            {/* ── Campaign Viewer Tab ──────────────────────────── */}
            <Tabs.Panel value="viewer" pt="md">
              {activeTab === 'viewer' && (
                <CampaignViewerSettingsSection
                  settings={settings}
                  updateSetting={updateGallerySetting}
                />
              )}
            </Tabs.Panel>

            {settings.advancedSettingsEnabled && (
              <Tabs.Panel value="advanced" pt="md">
                {activeTab === 'advanced' && (
                  <AdvancedSettingsSection
                    settings={settings}
                    updateSetting={updateGallerySetting}
                    tooltipLabel={tt}
                  />
                )}
              </Tabs.Panel>
            )}

            {/* ── Typography Tab ───────────────────────────────── */}
            <Tabs.Panel value="typography" pt="md">
              {activeTab === 'typography' && (
                <TypographySettingsSection
                  apiClient={apiClient}
                  customFonts={customFonts}
                  typographyOverrides={settings.typographyOverrides}
                  onFontsChange={(fonts) => setCustomFonts(fonts)}
                  onResetAll={() => updateSetting('typographyOverrides', {})}
                  onOverrideChange={updateTypoOverride}
                />
              )}
            </Tabs.Panel>

          </Tabs>
        </Stack>
        </Box>

          <GalleryConfigEditorModal
            opened={galleryConfigEditorOpen}
            onClose={() => setGalleryConfigEditorOpen(false)}
            title="Responsive Gallery Config"
            value={buildGalleryConfigEditorSeed(settings)}
            onSave={handleGalleryConfigEditorSave}
          />

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
