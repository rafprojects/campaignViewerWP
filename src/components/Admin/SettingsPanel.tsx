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
import { ThemeSelector } from './ThemeSelector';

export interface SettingsData {
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
};

interface SettingsPanelProps {
  apiClient: ApiClient;
  onClose: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
}

export function SettingsPanel({ apiClient, onClose, onNotify }: SettingsPanelProps) {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<SettingsData>(defaultSettings);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getSettings();
      const loaded: SettingsData = {
        galleryLayout: (response.galleryLayout as SettingsData['galleryLayout']) ?? defaultSettings.galleryLayout,
        itemsPerPage: response.itemsPerPage ?? defaultSettings.itemsPerPage,
        enableLightbox: response.enableLightbox ?? defaultSettings.enableLightbox,
        enableAnimations: response.enableAnimations ?? defaultSettings.enableAnimations,
      };
      setSettings(loaded);
      setOriginalSettings(loaded);
      setHasChanges(false);
    } catch {
      // If settings endpoint doesn't exist or fails, use defaults
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
      await apiClient.updateSettings(settings);
      setOriginalSettings(settings);
      setHasChanges(false);
      onNotify({ type: 'success', text: 'Settings saved successfully.' });
    } catch (err) {
      onNotify({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save settings.' });
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
      </Stack>
    </Card>
  );
}
