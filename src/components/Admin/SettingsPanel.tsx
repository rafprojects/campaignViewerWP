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

                <Text size="sm" c="dimmed" fs="italic">
                  More navigation controls (overlay arrows, dot navigator) coming soon.
                </Text>
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
