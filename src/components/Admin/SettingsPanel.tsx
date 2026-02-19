import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
  IconArrowsExchange,
  IconNavigation,
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
} from '@/types';
import { ThemeSelector } from './ThemeSelector';
import { getErrorMessage } from '@/utils/getErrorMessage';

export interface SettingsData extends GalleryBehaviorSettings {
  galleryLayout: 'grid' | 'masonry' | 'carousel';
  itemsPerPage: number;
  enableLightbox: boolean;
  enableAnimations: boolean;
}

const defaultSettings: SettingsData = {
  galleryLayout: 'grid',
  itemsPerPage: 12,
  enableLightbox: true,
  enableAnimations: true,
  videoViewportHeight: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoViewportHeight,
  imageViewportHeight: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageViewportHeight,
  thumbnailScrollSpeed: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.thumbnailScrollSpeed,
  scrollAnimationStyle: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationStyle,
  scrollAnimationDurationMs: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationDurationMs,
  scrollAnimationEasing: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationEasing,
  scrollTransitionType: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollTransitionType,
  imageBorderRadius: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageBorderRadius,
  videoBorderRadius: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoBorderRadius,
  transitionFadeEnabled: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.transitionFadeEnabled,
  // P12-A/B
  videoThumbnailWidth: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoThumbnailWidth,
  videoThumbnailHeight: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoThumbnailHeight,
  imageThumbnailWidth: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageThumbnailWidth,
  imageThumbnailHeight: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageThumbnailHeight,
  thumbnailGap: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.thumbnailGap,
  thumbnailWheelScrollEnabled: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.thumbnailWheelScrollEnabled,
  thumbnailDragScrollEnabled: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.thumbnailDragScrollEnabled,
  thumbnailScrollButtonsVisible: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.thumbnailScrollButtonsVisible,
  // P12-H
  navArrowPosition: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowPosition,
  navArrowSize: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowSize,
  navArrowColor: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowColor,
  navArrowBgColor: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowBgColor,
  navArrowBorderWidth: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowBorderWidth,
  navArrowHoverScale: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowHoverScale,
  navArrowAutoHideMs: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowAutoHideMs,
  // P12-I
  dotNavEnabled: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavEnabled,
  dotNavPosition: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavPosition,
  dotNavSize: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavSize,
  dotNavActiveColor: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavActiveColor,
  dotNavInactiveColor: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavInactiveColor,
  dotNavShape: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavShape,
  dotNavSpacing: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavSpacing,
  dotNavActiveScale: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavActiveScale,
  // P12-J
  imageShadowPreset: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageShadowPreset,
  videoShadowPreset: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoShadowPreset,
  imageShadowCustom: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageShadowCustom,
  videoShadowCustom: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoShadowCustom,
  // P12-C
  imageGalleryAdapterId: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageGalleryAdapterId,
  videoGalleryAdapterId: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoGalleryAdapterId,
  gridCardWidth: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.gridCardWidth,
  gridCardHeight: DEFAULT_GALLERY_BEHAVIOR_SETTINGS.gridCardHeight,
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
  galleryLayout: (response.galleryLayout as SettingsData['galleryLayout']) ?? defaultSettings.galleryLayout,
  itemsPerPage: response.itemsPerPage ?? defaultSettings.itemsPerPage,
  enableLightbox: response.enableLightbox ?? defaultSettings.enableLightbox,
  enableAnimations: response.enableAnimations ?? defaultSettings.enableAnimations,
  videoViewportHeight: response.videoViewportHeight ?? defaultSettings.videoViewportHeight,
  imageViewportHeight: response.imageViewportHeight ?? defaultSettings.imageViewportHeight,
  thumbnailScrollSpeed: response.thumbnailScrollSpeed ?? defaultSettings.thumbnailScrollSpeed,
  scrollAnimationStyle: response.scrollAnimationStyle ?? defaultSettings.scrollAnimationStyle,
  scrollAnimationDurationMs:
    response.scrollAnimationDurationMs ?? defaultSettings.scrollAnimationDurationMs,
  scrollAnimationEasing: response.scrollAnimationEasing ?? defaultSettings.scrollAnimationEasing,
  scrollTransitionType: response.scrollTransitionType ?? defaultSettings.scrollTransitionType,
  imageBorderRadius: response.imageBorderRadius ?? defaultSettings.imageBorderRadius,
  videoBorderRadius: response.videoBorderRadius ?? defaultSettings.videoBorderRadius,
  transitionFadeEnabled: response.transitionFadeEnabled ?? defaultSettings.transitionFadeEnabled,
  // P12-A/B
  videoThumbnailWidth: response.videoThumbnailWidth ?? defaultSettings.videoThumbnailWidth,
  videoThumbnailHeight: response.videoThumbnailHeight ?? defaultSettings.videoThumbnailHeight,
  imageThumbnailWidth: response.imageThumbnailWidth ?? defaultSettings.imageThumbnailWidth,
  imageThumbnailHeight: response.imageThumbnailHeight ?? defaultSettings.imageThumbnailHeight,
  thumbnailGap: response.thumbnailGap ?? defaultSettings.thumbnailGap,
  thumbnailWheelScrollEnabled: response.thumbnailWheelScrollEnabled ?? defaultSettings.thumbnailWheelScrollEnabled,
  thumbnailDragScrollEnabled: response.thumbnailDragScrollEnabled ?? defaultSettings.thumbnailDragScrollEnabled,
  thumbnailScrollButtonsVisible: response.thumbnailScrollButtonsVisible ?? defaultSettings.thumbnailScrollButtonsVisible,
  // P12-H
  navArrowPosition: (response.navArrowPosition as NavArrowPosition) ?? defaultSettings.navArrowPosition,
  navArrowSize: response.navArrowSize ?? defaultSettings.navArrowSize,
  navArrowColor: response.navArrowColor ?? defaultSettings.navArrowColor,
  navArrowBgColor: response.navArrowBgColor ?? defaultSettings.navArrowBgColor,
  navArrowBorderWidth: response.navArrowBorderWidth ?? defaultSettings.navArrowBorderWidth,
  navArrowHoverScale: response.navArrowHoverScale ?? defaultSettings.navArrowHoverScale,
  navArrowAutoHideMs: response.navArrowAutoHideMs ?? defaultSettings.navArrowAutoHideMs,
  // P12-I
  dotNavEnabled: response.dotNavEnabled ?? defaultSettings.dotNavEnabled,
  dotNavPosition: (response.dotNavPosition as DotNavPosition) ?? defaultSettings.dotNavPosition,
  dotNavSize: response.dotNavSize ?? defaultSettings.dotNavSize,
  dotNavActiveColor: response.dotNavActiveColor ?? defaultSettings.dotNavActiveColor,
  dotNavInactiveColor: response.dotNavInactiveColor ?? defaultSettings.dotNavInactiveColor,
  dotNavShape: (response.dotNavShape as DotNavShape) ?? defaultSettings.dotNavShape,
  dotNavSpacing: response.dotNavSpacing ?? defaultSettings.dotNavSpacing,
  dotNavActiveScale: response.dotNavActiveScale ?? defaultSettings.dotNavActiveScale,
  // P12-J
  imageShadowPreset: (response.imageShadowPreset as ShadowPreset) ?? defaultSettings.imageShadowPreset,
  videoShadowPreset: (response.videoShadowPreset as ShadowPreset) ?? defaultSettings.videoShadowPreset,
  imageShadowCustom: response.imageShadowCustom ?? defaultSettings.imageShadowCustom,
  videoShadowCustom: response.videoShadowCustom ?? defaultSettings.videoShadowCustom,
  // P12-C
  imageGalleryAdapterId: response.imageGalleryAdapterId ?? defaultSettings.imageGalleryAdapterId,
  videoGalleryAdapterId: response.videoGalleryAdapterId ?? defaultSettings.videoGalleryAdapterId,
  gridCardWidth: response.gridCardWidth ?? defaultSettings.gridCardWidth,
  gridCardHeight: response.gridCardHeight ?? defaultSettings.gridCardHeight,
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
      size="lg"
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
              <Tabs.Tab value="gallery" leftSection={<IconPhoto size={16} />}>
                Gallery
              </Tabs.Tab>
              <Tabs.Tab value="transitions" leftSection={<IconArrowsExchange size={16} />}>
                Transitions
              </Tabs.Tab>
              <Tabs.Tab value="navigation" leftSection={<IconNavigation size={16} />}>
                Navigation
              </Tabs.Tab>
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
              </Stack>
            </Tabs.Panel>

            {/* ── Gallery Tab ──────────────────────────────────── */}
            <Tabs.Panel value="gallery" pt="md">
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

                <Divider label="Thumbnail Strip" labelPosition="center" />

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

                <Divider label="Gallery Adapter" labelPosition="center" />

                <Select
                  label="Image Gallery Layout"
                  description="Choose how images are displayed. 'Classic' uses the carousel; 'Compact Grid' arranges images in a responsive playing-card grid with lightbox."
                  value={settings.imageGalleryAdapterId}
                  onChange={(value) => updateSetting('imageGalleryAdapterId', value ?? 'classic')}
                  data={[
                    { value: 'classic', label: 'Classic (Carousel)' },
                    { value: 'compact-grid', label: 'Compact Grid' },
                  ]}
                />

                {settings.imageGalleryAdapterId === 'compact-grid' && (
                  <>
                    <Group grow>
                      <NumberInput
                        label="Card Min Width (px)"
                        description="Minimum width of each grid card. Grid auto-fills based on available space."
                        value={settings.gridCardWidth}
                        onChange={(value) =>
                          updateSetting('gridCardWidth', typeof value === 'number' ? value : defaultSettings.gridCardWidth)
                        }
                        min={80}
                        max={400}
                        step={10}
                      />
                      <NumberInput
                        label="Card Height (px)"
                        description="Fixed height of each grid card. Default 224 px gives a classic 5:7 playing-card proportion."
                        value={settings.gridCardHeight}
                        onChange={(value) =>
                          updateSetting('gridCardHeight', typeof value === 'number' ? value : defaultSettings.gridCardHeight)
                        }
                        min={80}
                        max={600}
                        step={10}
                      />
                    </Group>
                  </>
                )}

                <Select
                  label="Video Gallery Layout"
                  description="Layout adapter for video galleries. Only Classic is available in this release."
                  value={settings.videoGalleryAdapterId}
                  onChange={(value) => updateSetting('videoGalleryAdapterId', value ?? 'classic')}
                  disabled
                  data={[
                    { value: 'classic', label: 'Classic (Carousel)' },
                  ]}
                />
              </Stack>
            </Tabs.Panel>

            {/* ── Transitions Tab ──────────────────────────────── */}
            <Tabs.Panel value="transitions" pt="md">
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
            </Tabs.Panel>

            {/* ── Navigation Tab ───────────────────────────────── */}
            <Tabs.Panel value="navigation" pt="md">
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
            </Tabs.Panel>
          </Tabs>

          {/* ── Footer ─────────────────────────────────────── */}
          <Divider />
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
        </Stack>
      )}
    </Modal>
  );
}
