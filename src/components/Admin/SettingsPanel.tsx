import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Group,
  Card,
  Stack,
  Loader,
  Center,
  Title,
  Select,
  Switch,
  NumberInput,
  ActionIcon,
} from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
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
};

interface SettingsPanelProps {
  apiClient: ApiClient;
  onClose: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
  onSettingsSaved?: (settings: SettingsData) => void;
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
});

export function SettingsPanel({ apiClient, onClose, onNotify, onSettingsSaved }: SettingsPanelProps) {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<SettingsData>(defaultSettings);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getSettings();
      const loaded = mapResponseToSettings(response);
      setSettings(loaded);
      setOriginalSettings(loaded);
      setHasChanges(false);
    } catch {
      // If settings endpoint doesn't exist or fails, use defaults
      console.warn('[src/components/Admin/SettingsPanel.tsx::loadSettings] failed to load settings, using defaults');
      setSettings(defaultSettings);
      setOriginalSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSetting = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      setHasChanges(JSON.stringify(updated) !== JSON.stringify(originalSettings));
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
  };

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ActionIcon variant="subtle" onClick={onClose} aria-label="Back to gallery">
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>Display Settings</Title>
        </Group>
        <Group gap="sm">
          {hasChanges && (
            <Button variant="subtle" onClick={handleReset} disabled={isSaving}>
              Reset
            </Button>
          )}
          <Button onClick={handleSave} loading={isSaving} disabled={!hasChanges}>
            Save Changes
          </Button>
        </Group>
      </Group>

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
          description="Number of items to display per page (1-100)."
          value={settings.itemsPerPage}
          onChange={(value) => updateSetting('itemsPerPage', typeof value === 'number' ? value : 12)}
          min={1}
          max={100}
          step={1}
        />

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

        <NumberInput
          label="Scroll Animation Duration (ms)"
          description="Duration for thumbnail highlight/transition animations."
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
          label="Scroll Animation Easing"
          description="Timing function used for thumbnail strip transitions."
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
    </Card>
  );
}
