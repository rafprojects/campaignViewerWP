import { useCallback, useEffect, useRef, useState } from 'react';
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
  Tabs,
  Text,
  Divider,
  TextInput,
  ColorInput,
  Slider,
} from '@mantine/core';
import {
  IconSettings,
  IconPhoto,
  IconLayoutGrid,
  IconAdjustments,
} from '@tabler/icons-react';
import type { ApiClient } from '@/services/apiClient';
import {
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryBehaviorSettings,
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
import { getErrorMessage } from '@/utils/getErrorMessage';
import { mergeSettingsWithDefaults } from '@/utils/mergeSettingsWithDefaults';

export interface SettingsData extends GalleryBehaviorSettings {
  galleryLayout: 'grid' | 'masonry' | 'carousel';
  itemsPerPage: number;
  enableLightbox: boolean;
  enableAnimations: boolean;
}

/** Extra SettingsPanel-only defaults that extend GalleryBehaviorSettings */
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
  const seedSettings: SettingsData = initialSettings
    ? { ...defaultSettings, ...initialSettings }
    : defaultSettings;

  const [settings, setSettings] = useState<SettingsData>(seedSettings);
  const [isLoading, setIsLoading] = useState(!initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<SettingsData>(seedSettings);
  const [activeTab, setActiveTab] = useState<string | null>('general');
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
    if (opened) {
      void loadSettings();
    }
  }, [opened, loadSettings]);

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
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconSettings size={22} />
          <Title order={3}>Display Settings</Title>
        </Group>
      }
      size={typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : 'lg'}
      fullScreen={typeof window !== 'undefined' && window.innerWidth < 576}
      centered
      closeOnClickOutside={!hasChanges}
      closeOnEscape={!hasChanges}
      transitionProps={{ transition: 'fade', duration: 200 }}
    >
      {isLoading ? (
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      ) : (
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
                Media Gallery
              </Tabs.Tab>
              {settings.advancedSettingsEnabled && (
                <Tabs.Tab value="advanced" leftSection={<IconAdjustments size={16} />}>
                  Advanced
                </Tabs.Tab>
              )}
            </Tabs.List>

            {/* ── General Tab ───────────────────────────────────── */}
            <Tabs.Panel value="general" pt="md">
              <Stack gap="md">
                <ThemeSelector
                  description="Choose a color theme. Changes apply instantly and are saved automatically."
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
                  description="Number of items to display per page (1–100)."
                  value={settings.itemsPerPage}
                  onChange={(value) => updateSetting('itemsPerPage', typeof value === 'number' ? value : 12)}
                  min={1}
                  max={100}
                  step={1}
                />

                <Divider label="Header Visibility" labelPosition="center" />

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
                  label="WP Full Bleed — Tablet (768–1023px)"
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

                <Divider label="Header Visibility" labelPosition="center" />

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

                <Divider label="Developer" labelPosition="center" />

                <Switch
                  label="Enable Advanced Settings"
                  description="Unlock the Advanced tab with granular control over card opacities, tile dimensions, lightbox behavior, breakpoints, and more."
                  checked={settings.advancedSettingsEnabled}
                  onChange={(e) => updateSetting('advancedSettingsEnabled', e.currentTarget.checked)}
                />
              </Stack>
            </Tabs.Panel>

            {/* ── Campaign Cards Tab ────────────────────────── */}
            <Tabs.Panel value="cards" pt="md">
              <Accordion variant="separated" defaultValue="appearance">
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
                        ]}
                        value={String(settings.cardGridColumns)}
                        onChange={(v) => updateSetting('cardGridColumns', parseInt(v ?? '0', 10))}
                      />
                      <NumberInput
                        label="Card Gap (px)"
                        description="Spacing between campaign cards"
                        value={settings.cardGap}
                        onChange={(v) => updateSetting('cardGap', typeof v === 'number' ? v : 16)}
                        min={0}
                        max={48}
                        step={2}
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

                {/* ── Campaign Modal ── */}
                <Accordion.Item value="modal">
                  <Accordion.Control>Campaign Modal</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
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
                        description="Maximum height of the campaign modal as a percentage of viewport"
                        value={settings.modalMaxHeight}
                        onChange={(v) => updateSetting('modalMaxHeight', typeof v === 'number' ? v : 90)}
                        min={50}
                        max={100}
                        step={5}
                      />
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Tabs.Panel>

            {/* ── Media Gallery Tab ────────────────────────────── */}
            <Tabs.Panel value="gallery" pt="md">
              <Accordion variant="separated" defaultValue="viewport">
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

                      <NumberInput
                        label="Video Gallery Height (px)"
                        description="Standard viewport height for video gallery player area."
                        value={settings.videoViewportHeight}
                        onChange={(value) =>
                          updateSetting('videoViewportHeight', typeof value === 'number' ? value : defaultSettings.videoViewportHeight)
                        }
                        min={180}
                        max={900}
                        step={10}
                      />

                      <NumberInput
                        label="Image Gallery Height (px)"
                        description="Standard viewport height for image gallery viewer area."
                        value={settings.imageViewportHeight}
                        onChange={(value) =>
                          updateSetting('imageViewportHeight', typeof value === 'number' ? value : defaultSettings.imageViewportHeight)
                        }
                        min={180}
                        max={900}
                        step={10}
                      />

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
                          { value: 'none', label: 'None' },
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
                          { value: 'none', label: 'None' },
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
                          { value: 'none', label: 'None' },
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
                          ]}
                        />
                      ) : (
                        <>
                          <Select
                            label="Image Gallery Adapter"
                            description="Layout for campaigns with images."
                            value={settings.imageGalleryAdapterId}
                            onChange={(value) => updateSetting('imageGalleryAdapterId', value ?? 'classic')}
                            data={[
                              { value: 'classic', label: 'Classic (Carousel)' },
                              { value: 'compact-grid', label: 'Compact Grid' },
                              { value: 'justified', label: 'Justified Rows (Flickr-style)' },
                              { value: 'masonry', label: 'Masonry' },
                              { value: 'hexagonal', label: 'Hexagonal' },
                              { value: 'circular', label: 'Circular' },
                              { value: 'diamond', label: 'Diamond' },
                            ]}
                          />
                          <Select
                            label="Video Gallery Adapter"
                            description="Layout for campaigns with videos."
                            value={settings.videoGalleryAdapterId}
                            onChange={(value) => updateSetting('videoGalleryAdapterId', value ?? 'classic')}
                            data={[
                              { value: 'classic', label: 'Classic (Carousel)' },
                              { value: 'compact-grid', label: 'Compact Grid' },
                              { value: 'justified', label: 'Justified Rows (Flickr-style)' },
                              { value: 'masonry', label: 'Masonry' },
                              { value: 'hexagonal', label: 'Hexagonal' },
                              { value: 'circular', label: 'Circular' },
                              { value: 'diamond', label: 'Diamond' },
                            ]}
                          />
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
                      ) && (
                        <NumberInput
                          label="Target Row Height (px)"
                          description="Ideal height for each justified row. Rows scale slightly to fill container width while preserving aspect ratios."
                          value={settings.mosaicTargetRowHeight}
                          onChange={(value) =>
                            updateSetting('mosaicTargetRowHeight', typeof value === 'number' ? value : defaultSettings.mosaicTargetRowHeight)
                          }
                          min={60} max={600} step={10}
                        />
                      )}

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
              </Accordion>
            </Tabs.Panel>

            {/* ── Advanced Tab (only visible when toggle is on) ─── */}
            {settings.advancedSettingsEnabled && (
              <Tabs.Panel value="advanced" pt="md">
                <Text size="sm" c="dimmed" mb="md">
                  Fine-grained controls for power users. These settings override internal defaults
                  across all gallery components. Change with care.
                </Text>
                <Accordion variant="separated">
                  {/* ── Card Appearance (advanced) ── */}
                  <Accordion.Item value="adv-card">
                    <Accordion.Control>Card Appearance</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <Text size="sm" fw={500}>Locked Card Opacity</Text>
                        <Slider
                          value={settings.cardLockedOpacity}
                          onChange={(v) => updateSetting('cardLockedOpacity', v)}
                          min={0} max={1} step={0.05}
                          marks={[{ value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }]}
                        />
                        <Text size="sm" fw={500}>Gradient Start Opacity</Text>
                        <Slider
                          value={settings.cardGradientStartOpacity}
                          onChange={(v) => updateSetting('cardGradientStartOpacity', v)}
                          min={0} max={1} step={0.05}
                        />
                        <Text size="sm" fw={500}>Gradient End Opacity</Text>
                        <Slider
                          value={settings.cardGradientEndOpacity}
                          onChange={(v) => updateSetting('cardGradientEndOpacity', v)}
                          min={0} max={1} step={0.05}
                        />
                        <NumberInput label="Lock Icon Size (px)" value={settings.cardLockIconSize}
                          onChange={(v) => updateSetting('cardLockIconSize', typeof v === 'number' ? v : 32)} min={12} max={64} />
                        <NumberInput label="Access Icon Size (px)" value={settings.cardAccessIconSize}
                          onChange={(v) => updateSetting('cardAccessIconSize', typeof v === 'number' ? v : 14)} min={8} max={32} />
                        <NumberInput label="Badge Offset Y (px)" value={settings.cardBadgeOffsetY}
                          onChange={(v) => updateSetting('cardBadgeOffsetY', typeof v === 'number' ? v : 8)} min={0} max={32} />
                        <NumberInput label="Company Badge Max Width (px)" value={settings.cardCompanyBadgeMaxWidth}
                          onChange={(v) => updateSetting('cardCompanyBadgeMaxWidth', typeof v === 'number' ? v : 160)} min={60} max={400} />
                        <NumberInput label="Thumbnail Hover Transition (ms)" value={settings.cardThumbnailHoverTransitionMs}
                          onChange={(v) => updateSetting('cardThumbnailHoverTransitionMs', typeof v === 'number' ? v : 300)} min={0} max={1000} />
                        <Text size="sm" fw={500}>Page Transition Opacity</Text>
                        <Slider
                          value={settings.cardPageTransitionOpacity}
                          onChange={(v) => updateSetting('cardPageTransitionOpacity', v)}
                          min={0} max={1} step={0.05}
                        />
                        <TextInput label="Auto Columns Breakpoints" description="Format: 480:1,768:2,1024:3,1280:4"
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
                        <TextInput label="Gallery Title" description="Main heading text shown above the gallery."
                          value={settings.galleryTitleText}
                          onChange={(e) => updateSetting('galleryTitleText', e.currentTarget.value)} />
                        <TextInput label="Gallery Subtitle" description="Subtitle text shown beneath the title."
                          value={settings.gallerySubtitleText}
                          onChange={(e) => updateSetting('gallerySubtitleText', e.currentTarget.value)} />
                        <TextInput label="Campaign About Heading" description='Heading for the campaign description section (default "About").'
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
                        <Text size="sm" fw={500}>Cover Mobile Ratio</Text>
                        <Slider value={settings.modalCoverMobileRatio} onChange={(v) => updateSetting('modalCoverMobileRatio', v)}
                          min={0.2} max={1} step={0.05} />
                        <Text size="sm" fw={500}>Cover Tablet Ratio</Text>
                        <Slider value={settings.modalCoverTabletRatio} onChange={(v) => updateSetting('modalCoverTabletRatio', v)}
                          min={0.2} max={1} step={0.05} />
                        <NumberInput label="Close Button Size (px)" value={settings.modalCloseButtonSize}
                          onChange={(v) => updateSetting('modalCloseButtonSize', typeof v === 'number' ? v : 36)} min={20} max={64} />
                        <TextInput label="Close Button Background" value={settings.modalCloseButtonBgColor}
                          onChange={(e) => updateSetting('modalCloseButtonBgColor', e.currentTarget.value)} />
                        <NumberInput label="Content Max Width (px)" value={settings.modalContentMaxWidth}
                          onChange={(v) => updateSetting('modalContentMaxWidth', typeof v === 'number' ? v : 900)} min={400} max={2000} />
                        <Text size="sm" fw={500}>Description Line Height</Text>
                        <Slider value={settings.campaignDescriptionLineHeight}
                          onChange={(v) => updateSetting('campaignDescriptionLineHeight', v)}
                          min={1} max={3} step={0.1} />
                        <NumberInput label="Mobile Breakpoint (px)" value={settings.modalMobileBreakpoint}
                          onChange={(v) => updateSetting('modalMobileBreakpoint', typeof v === 'number' ? v : 768)} min={320} max={1280} />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* ── Upload / Media (advanced) ── */}
                  <Accordion.Item value="adv-upload">
                    <Accordion.Control>Upload / Media</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <NumberInput label="Upload Max Size (MB)" value={settings.uploadMaxSizeMb}
                          onChange={(v) => updateSetting('uploadMaxSizeMb', typeof v === 'number' ? v : 50)} min={1} max={500} />
                        <TextInput label="Allowed Upload Types" description="Comma-separated MIME patterns (e.g. image/*,video/*)"
                          value={settings.uploadAllowedTypes}
                          onChange={(e) => updateSetting('uploadAllowedTypes', e.currentTarget.value)} />
                        <NumberInput label="Library Page Size" value={settings.libraryPageSize}
                          onChange={(v) => updateSetting('libraryPageSize', typeof v === 'number' ? v : 20)} min={5} max={100} />
                        <NumberInput label="Media List Page Size" value={settings.mediaListPageSize}
                          onChange={(v) => updateSetting('mediaListPageSize', typeof v === 'number' ? v : 50)} min={10} max={200} />
                        <NumberInput label="Compact Card Height (px)" value={settings.mediaCompactCardHeight}
                          onChange={(v) => updateSetting('mediaCompactCardHeight', typeof v === 'number' ? v : 100)} min={40} max={300} />
                        <NumberInput label="Small Card Height (px)" value={settings.mediaSmallCardHeight}
                          onChange={(v) => updateSetting('mediaSmallCardHeight', typeof v === 'number' ? v : 80)} min={40} max={300} />
                        <NumberInput label="Medium Card Height (px)" value={settings.mediaMediumCardHeight}
                          onChange={(v) => updateSetting('mediaMediumCardHeight', typeof v === 'number' ? v : 240)} min={100} max={600} />
                        <NumberInput label="Large Card Height (px)" value={settings.mediaLargeCardHeight}
                          onChange={(v) => updateSetting('mediaLargeCardHeight', typeof v === 'number' ? v : 340)} min={100} max={800} />
                        <NumberInput label="Media List Min Width (px)" value={settings.mediaListMinWidth}
                          onChange={(v) => updateSetting('mediaListMinWidth', typeof v === 'number' ? v : 600)} min={300} max={1200} />
                        <NumberInput label="SWR Deduping Interval (ms)" value={settings.swrDedupingIntervalMs}
                          onChange={(v) => updateSetting('swrDedupingIntervalMs', typeof v === 'number' ? v : 5000)} min={0} max={30000} />
                        <NumberInput label="Notification Dismiss (ms)" value={settings.notificationDismissMs}
                          onChange={(v) => updateSetting('notificationDismissMs', typeof v === 'number' ? v : 4000)} min={1000} max={30000} />
                        <Divider label="Image Optimization" labelPosition="center" />
                        <Switch label="Optimize on Upload" description="Automatically resize and compress images on upload."
                          checked={settings.optimizeOnUpload}
                          onChange={(e) => updateSetting('optimizeOnUpload', e.currentTarget.checked)} />
                        <NumberInput label="Max Width (px)" value={settings.optimizeMaxWidth}
                          onChange={(v) => updateSetting('optimizeMaxWidth', typeof v === 'number' ? v : 1920)} min={100} max={4096} />
                        <NumberInput label="Max Height (px)" value={settings.optimizeMaxHeight}
                          onChange={(v) => updateSetting('optimizeMaxHeight', typeof v === 'number' ? v : 1920)} min={100} max={4096} />
                        <NumberInput label="Quality (%)" value={settings.optimizeQuality}
                          onChange={(v) => updateSetting('optimizeQuality', typeof v === 'number' ? v : 82)} min={10} max={100} />
                        <Switch label="WebP Conversion" description="Generate WebP copies alongside originals."
                          checked={settings.optimizeWebpEnabled}
                          onChange={(e) => updateSetting('optimizeWebpEnabled', e.currentTarget.checked)} />
                        <NumberInput label="Thumbnail Cache TTL (s)" description="How long cached external thumbnails are kept (seconds)."
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
                        <Text size="sm" fw={500}>Hover Overlay Opacity</Text>
                        <Slider value={settings.tileHoverOverlayOpacity} onChange={(v) => updateSetting('tileHoverOverlayOpacity', v)}
                          min={0} max={1} step={0.05} />
                        <Text size="sm" fw={500}>Bounce Scale (Hover)</Text>
                        <Slider value={settings.tileBounceScaleHover} onChange={(v) => updateSetting('tileBounceScaleHover', v)}
                          min={1} max={1.3} step={0.01} />
                        <Text size="sm" fw={500}>Bounce Scale (Active)</Text>
                        <Slider value={settings.tileBounceScaleActive} onChange={(v) => updateSetting('tileBounceScaleActive', v)}
                          min={0.9} max={1.1} step={0.01} />
                        <NumberInput label="Bounce Duration (ms)" value={settings.tileBounceDurationMs}
                          onChange={(v) => updateSetting('tileBounceDurationMs', typeof v === 'number' ? v : 300)} min={0} max={1000} />
                        <NumberInput label="Base Transition Duration (ms)" value={settings.tileBaseTransitionDurationMs}
                          onChange={(v) => updateSetting('tileBaseTransitionDurationMs', typeof v === 'number' ? v : 250)} min={0} max={1000} />
                        <NumberInput label="Tile Transition Duration (ms)" value={settings.tileTransitionDurationMs}
                          onChange={(v) => updateSetting('tileTransitionDurationMs', typeof v === 'number' ? v : 200)} min={0} max={1000} />
                        <Text size="sm" fw={500}>Hex Vertical Overlap Ratio</Text>
                        <Slider value={settings.hexVerticalOverlapRatio} onChange={(v) => updateSetting('hexVerticalOverlapRatio', v)}
                          min={0} max={0.5} step={0.01} />
                        <Text size="sm" fw={500}>Diamond Vertical Overlap Ratio</Text>
                        <Slider value={settings.diamondVerticalOverlapRatio} onChange={(v) => updateSetting('diamondVerticalOverlapRatio', v)}
                          min={0} max={0.5} step={0.01} />
                        <TextInput label="Hex Clip Path" value={settings.hexClipPath}
                          onChange={(e) => updateSetting('hexClipPath', e.currentTarget.value)} />
                        <TextInput label="Diamond Clip Path" value={settings.diamondClipPath}
                          onChange={(e) => updateSetting('diamondClipPath', e.currentTarget.value)} />
                        <NumberInput label="Default Per Row" value={settings.tileDefaultPerRow}
                          onChange={(v) => updateSetting('tileDefaultPerRow', typeof v === 'number' ? v : 5)} min={1} max={12} />
                        <NumberInput label="Photo Normalize Height (px)" value={settings.photoNormalizeHeight}
                          onChange={(v) => updateSetting('photoNormalizeHeight', typeof v === 'number' ? v : 300)} min={100} max={800} />
                        <TextInput label="Masonry Auto Column Breakpoints" description="Format: 480:2,768:3,1024:4,1280:5"
                          value={settings.masonryAutoColumnBreakpoints}
                          onChange={(e) => updateSetting('masonryAutoColumnBreakpoints', e.currentTarget.value)} />
                        <TextInput label="Grid Card Hover Shadow" value={settings.gridCardHoverShadow}
                          onChange={(e) => updateSetting('gridCardHoverShadow', e.currentTarget.value)} />
                        <TextInput label="Grid Card Default Shadow" value={settings.gridCardDefaultShadow}
                          onChange={(e) => updateSetting('gridCardDefaultShadow', e.currentTarget.value)} />
                        <Text size="sm" fw={500}>Grid Card Hover Scale</Text>
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
                        <NumberInput label="Transition Duration (ms)" value={settings.lightboxTransitionMs}
                          onChange={(v) => updateSetting('lightboxTransitionMs', typeof v === 'number' ? v : 250)} min={0} max={1000} />
                        <TextInput label="Backdrop Color" value={settings.lightboxBackdropColor}
                          onChange={(e) => updateSetting('lightboxBackdropColor', e.currentTarget.value)} />
                        <Text size="sm" fw={500}>Entry Scale</Text>
                        <Slider value={settings.lightboxEntryScale} onChange={(v) => updateSetting('lightboxEntryScale', v)}
                          min={0.5} max={1} step={0.01} />
                        <NumberInput label="Video Max Width (px)" value={settings.lightboxVideoMaxWidth}
                          onChange={(v) => updateSetting('lightboxVideoMaxWidth', typeof v === 'number' ? v : 900)} min={300} max={1920} />
                        <NumberInput label="Video Height (px)" value={settings.lightboxVideoHeight}
                          onChange={(v) => updateSetting('lightboxVideoHeight', typeof v === 'number' ? v : 506)} min={200} max={1080} />
                        <TextInput label="Media Max Height" description="CSS value, e.g. 85vh"
                          value={settings.lightboxMediaMaxHeight}
                          onChange={(e) => updateSetting('lightboxMediaMaxHeight', e.currentTarget.value)} />
                        <NumberInput label="Z-Index" value={settings.lightboxZIndex}
                          onChange={(v) => updateSetting('lightboxZIndex', typeof v === 'number' ? v : 1000)} min={1} max={10000} />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* ── Navigation (advanced) ── */}
                  <Accordion.Item value="adv-nav">
                    <Accordion.Control>Navigation</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <NumberInput label="Max Visible Dots" value={settings.dotNavMaxVisibleDots}
                          onChange={(v) => updateSetting('dotNavMaxVisibleDots', typeof v === 'number' ? v : 7)} min={3} max={20} />
                        <NumberInput label="Arrow Edge Inset (px)" value={settings.navArrowEdgeInset}
                          onChange={(v) => updateSetting('navArrowEdgeInset', typeof v === 'number' ? v : 8)} min={0} max={48} />
                        <NumberInput label="Arrow Min Hit Target (px)" value={settings.navArrowMinHitTarget}
                          onChange={(v) => updateSetting('navArrowMinHitTarget', typeof v === 'number' ? v : 44)} min={24} max={80} />
                        <NumberInput label="Arrow Fade Duration (ms)" value={settings.navArrowFadeDurationMs}
                          onChange={(v) => updateSetting('navArrowFadeDurationMs', typeof v === 'number' ? v : 200)} min={0} max={1000} />
                        <NumberInput label="Arrow Scale Transition (ms)" value={settings.navArrowScaleTransitionMs}
                          onChange={(v) => updateSetting('navArrowScaleTransitionMs', typeof v === 'number' ? v : 150)} min={0} max={1000} />
                        <Text size="sm" fw={500}>Viewport Height Mobile Ratio</Text>
                        <Slider value={settings.viewportHeightMobileRatio}
                          onChange={(v) => updateSetting('viewportHeightMobileRatio', v)}
                          min={0.3} max={1} step={0.05} />
                        <Text size="sm" fw={500}>Viewport Height Tablet Ratio</Text>
                        <Slider value={settings.viewportHeightTabletRatio}
                          onChange={(v) => updateSetting('viewportHeightTabletRatio', v)}
                          min={0.3} max={1} step={0.05} />
                        <NumberInput label="Search Input Min Width (px)" value={settings.searchInputMinWidth}
                          onChange={(v) => updateSetting('searchInputMinWidth', typeof v === 'number' ? v : 200)} min={100} max={400} />
                        <NumberInput label="Search Input Max Width (px)" value={settings.searchInputMaxWidth}
                          onChange={(v) => updateSetting('searchInputMaxWidth', typeof v === 'number' ? v : 280)} min={150} max={600} />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* ── System (advanced) ── */}
                  <Accordion.Item value="adv-system">
                    <Accordion.Control>System</Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <NumberInput label="Expiry Warning Threshold (ms)" description="How early to show token-expiry warnings."
                          value={settings.expiryWarningThresholdMs}
                          onChange={(v) => updateSetting('expiryWarningThresholdMs', typeof v === 'number' ? v : 300000)} min={0} max={600000} />
                        <NumberInput label="Admin Search Debounce (ms)" value={settings.adminSearchDebounceMs}
                          onChange={(v) => updateSetting('adminSearchDebounceMs', typeof v === 'number' ? v : 300)} min={0} max={2000} />
                        <NumberInput label="Min Password Length" value={settings.loginMinPasswordLength}
                          onChange={(v) => updateSetting('loginMinPasswordLength', typeof v === 'number' ? v : 1)} min={1} max={32} />
                        <NumberInput label="Login Form Max Width (px)" value={settings.loginFormMaxWidth}
                          onChange={(v) => updateSetting('loginFormMaxWidth', typeof v === 'number' ? v : 400)} min={200} max={800} />
                        <NumberInput label="Auth Bar Backdrop Blur (px)" value={settings.authBarBackdropBlur}
                          onChange={(v) => updateSetting('authBarBackdropBlur', typeof v === 'number' ? v : 8)} min={0} max={24} />
                        <NumberInput label="Auth Bar Mobile Breakpoint (px)" value={settings.authBarMobileBreakpoint}
                          onChange={(v) => updateSetting('authBarMobileBreakpoint', typeof v === 'number' ? v : 768)} min={320} max={1280} />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </Tabs.Panel>
            )}
          </Tabs>

          {/* ── Footer (sticky) ─────────────────────────────── */}
          <Box
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 10,
              background: 'var(--mantine-color-body)',
              borderTop: '1px solid var(--mantine-color-default-border)',
              padding: 'var(--mantine-spacing-sm) 0',
              marginTop: 'var(--mantine-spacing-md)',
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
        </Stack>
      )}
    </Modal>
  );
}
