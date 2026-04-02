import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  Accordion,
  Box,
  Button,
  Drawer,
  Group,
  Stack,
  Loader,
  Center,
  Title,
  NativeScrollArea,
  Tabs,
} from '@mantine/core';
import {
  IconSettings,
  IconPhoto,
  IconLayoutGrid,
  IconAdjustments,
  IconTypography,
  IconEye,
} from '@tabler/icons-react';
import type { ApiClient } from '@/services/apiClient';
import {
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryBehaviorSettings,
  type TypographyOverride,
  type GalleryConfig,
} from '@/types';
import { SettingTooltip } from './SettingTooltip';
import type { CustomFontEntry } from '../Common/TypographyEditor';
import type { UpdateGallerySetting } from '../Settings/GalleryAdapterSettingsSection';
import { GeneralSettingsSection } from '../Settings/GeneralSettingsSection';
import { MediaDisplaySettingsSection } from '../Settings/MediaDisplaySettingsSection';
import { GalleryLayoutSettingsSection } from '../Settings/GalleryLayoutSettingsSection';
import { CampaignViewerSettingsSection } from '../Settings/CampaignViewerSettingsSection';
import { CampaignCardSettingsSection } from '../Settings/CampaignCardSettingsSection';
import { AdvancedSettingsSection } from '../Settings/AdvancedSettingsSection';
import { TypographySettingsSection } from '../Settings/TypographySettingsSection';
import { useTheme } from '@/hooks/useTheme';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { GalleryConfigEditorLoader } from '@/components/Common/GalleryConfigEditorLoader';
import {
  buildGalleryConfigFromLegacySettings,
  collectLegacyGallerySettingValues,
  LEGACY_GALLERY_SETTING_KEYS,
  mergeGalleryConfig,
  syncLegacyGallerySettingToConfig,
} from '@/utils/galleryConfig';
import { mergeSettingsWithDefaults } from '@/utils/mergeSettingsWithDefaults';
import { SETTING_TOOLTIPS } from '@/data/settingTooltips';

const LazyGalleryConfigEditorModal = lazy(() =>
  import('@/components/Common/GalleryConfigEditorModal').then((module) => ({
    default: module.GalleryConfigEditorModal,
  })),
);

function buildGalleryConfigEditorSeed(settings: SettingsData): GalleryConfig {
  const seed = buildGalleryConfigFromLegacySettings(settings);

  return settings.galleryConfig
    ? mergeGalleryConfig(seed, settings.galleryConfig)
    : seed;
}

function isGalleryBehaviorSettingKey(key: keyof SettingsData): key is keyof GalleryBehaviorSettings {
  return Object.prototype.hasOwnProperty.call(DEFAULT_GALLERY_BEHAVIOR_SETTINGS, key);
}

export interface SettingsData extends GalleryBehaviorSettings {
  theme?: string;
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
  theme: response.theme,
  galleryLayout: (response.galleryLayout as SettingsData['galleryLayout']) ?? defaultSettings.galleryLayout,
  itemsPerPage: response.itemsPerPage ?? defaultSettings.itemsPerPage,
  enableLightbox: response.enableLightbox ?? defaultSettings.enableLightbox,
  enableAnimations: response.enableAnimations ?? defaultSettings.enableAnimations,
});

export function SettingsPanel({ opened, apiClient, onClose, onNotify, onSettingsSaved, initialSettings }: SettingsPanelProps) {
  const { setPreviewTheme, setTheme } = useTheme();
  const seedSettings: SettingsData = initialSettings
    ? mapResponseToSettings(initialSettings as Awaited<ReturnType<ApiClient['getSettings']>>)
    : defaultSettings;

  const [settings, setSettings] = useState<SettingsData>(seedSettings);
  const [isLoading, setIsLoading] = useState(!initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<SettingsData>(seedSettings);
  const [activeTab, setActiveTab] = useState<string | null>('page-theme');
  const [customFonts, setCustomFonts] = useState<CustomFontEntry[]>([]);
  const [galleryConfigEditorOpen, setGalleryConfigEditorOpen] = useState(false);
  const hasChangesRef = useRef(false);

  const revertThemePreview = useCallback(() => {
    if (settings.theme !== originalSettings.theme && typeof originalSettings.theme === 'string') {
      setPreviewTheme(originalSettings.theme);
      return;
    }

    setPreviewTheme(null);
  }, [originalSettings.theme, setPreviewTheme, settings.theme]);

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

  const loadMissingTheme = useCallback(async () => {
    try {
      const response = await apiClient.getSettings();
      if (typeof response.theme !== 'string') {
        return;
      }

      if (!hasChangesRef.current) {
        setSettings((prev) => ({ ...prev, theme: response.theme }));
      }
      setOriginalSettings((prev) => ({ ...prev, theme: response.theme }));
    } catch {
      // If settings endpoint doesn't exist or fails, keep current state
    }
  }, [apiClient]);

  useEffect(() => {
    if (!opened) {
      return;
    }

    if (!initialSettings) {
      void loadSettings();
      return;
    }

    if (typeof initialSettings.theme !== 'string') {
      void loadMissingTheme();
    }
  }, [opened, loadSettings, loadMissingTheme, initialSettings]);

  const updateSetting = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    applySettingsUpdate((prev) => {
      const next = { ...prev, [key]: value };

      if (isGalleryBehaviorSettingKey(key)) {
        const syncedGalleryConfig = syncLegacyGallerySettingToConfig(
          prev.galleryConfig,
          next,
          key,
          value as GalleryBehaviorSettings[K & keyof GalleryBehaviorSettings],
        );

        if (syncedGalleryConfig) {
          next.galleryConfig = syncedGalleryConfig;
        }
      }

      return next;
    });
  };

  const updateGallerySetting: UpdateGallerySetting = (key, value) => {
    updateSetting(key as keyof SettingsData, value as SettingsData[keyof SettingsData]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = { ...settings } as Partial<SettingsData> & Record<string, unknown>;
      for (const key of LEGACY_GALLERY_SETTING_KEYS) {
        delete payload[key];
      }

      const response = await apiClient.updateSettings(payload as Partial<SettingsData>);
      const saved = mapResponseToSettings(response);
      setSettings(saved);
      setOriginalSettings(saved);
      setHasChanges(false);
      hasChangesRef.current = false;
      onSettingsSaved?.(saved);
      const persistedTheme = typeof saved.theme === 'string' ? saved.theme : settings.theme;
      if (typeof persistedTheme === 'string') {
        setTheme(persistedTheme);
      }
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
    revertThemePreview();
  };

  const isSmallScreen = useMediaQuery('(max-width: 575px)');

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
      const legacyGallerySettings = collectLegacyGallerySettingValues(galleryConfig);

      return {
        ...prev,
        galleryConfig,
        ...(legacyGallerySettings as Partial<SettingsData>),
      };
    });

    setGalleryConfigEditorOpen(false);
  };

  return (
    <Drawer
      opened={opened}
      onClose={() => { revertThemePreview(); onClose(); }}
      title={
        <Group gap="sm">
          <IconSettings size={22} />
          <Title order={3}>Display Settings</Title>
        </Group>
      }
      position="right"
      size={isSmallScreen ? '100%' : 'lg'}
      zIndex={450}
      withinPortal={false}
      closeOnClickOutside={!hasChanges}
      closeOnEscape={!hasChanges}
      transitionProps={{ transition: 'slide-left', duration: 200 }}
      overlayProps={{ backgroundOpacity: 0.6, blur: settings.settingsDrawerBlurEnabled !== false ? 4 : 0 }}
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
              <Tabs.Tab value="page-theme" leftSection={<IconSettings size={16} />}>
                Page & Theme
              </Tabs.Tab>
              <Tabs.Tab value="cards" leftSection={<IconLayoutGrid size={16} />}>
                Campaign Cards
              </Tabs.Tab>
              <Tabs.Tab value="gallery-media" leftSection={<IconPhoto size={16} />}>
                Gallery & Media
              </Tabs.Tab>
              <Tabs.Tab value="viewer" leftSection={<IconEye size={16} />}>
                Campaign Viewer
              </Tabs.Tab>
              {settings.advancedSettingsEnabled && (
                <Tabs.Tab value="system-admin" leftSection={<IconAdjustments size={16} />}>
                  System & Admin
                </Tabs.Tab>
              )}
              <Tabs.Tab value="typography" leftSection={<IconTypography size={16} />}>
                Typography
              </Tabs.Tab>
            </Tabs.List>

            {/* ── Page & Theme Tab ───────────────────────────────────── */}
            <Tabs.Panel value="page-theme" pt="md">
              {activeTab === 'page-theme' && (
                <GeneralSettingsSection
                  settings={settings}
                  updateSetting={updateSetting}
                  onThemeChange={(id) => updateSetting('theme', id)}
                />
              )}
            </Tabs.Panel>

            {/* ── Campaign Cards Tab ────────────────────────── */}
            <Tabs.Panel value="cards" pt="md">
              {activeTab === 'cards' && (
                <Accordion variant="separated" defaultValue="appearance">
                  <CampaignCardSettingsSection
                    settings={settings}
                    updateSetting={updateGallerySetting}
                  />
                </Accordion>
              )}
            </Tabs.Panel>

            {/* ── Gallery & Media Tab ───────────────────────── */}
            <Tabs.Panel value="gallery-media" pt="md">
              {activeTab === 'gallery-media' && (
                <Stack gap="lg">
                  <MediaDisplaySettingsSection
                    settings={settings}
                    updateSetting={updateSetting}
                    tooltipLabel={tt}
                  />
                  <GalleryLayoutSettingsSection
                    settings={settings}
                    updateSetting={updateGallerySetting}
                    onOpenResponsiveConfig={() => setGalleryConfigEditorOpen(true)}
                  />
                </Stack>
              )}
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
              <Tabs.Panel value="system-admin" pt="md">
                {activeTab === 'system-admin' && (
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

          {galleryConfigEditorOpen && (
            <Suspense fallback={<GalleryConfigEditorLoader />}>
              <LazyGalleryConfigEditorModal
                opened={galleryConfigEditorOpen}
                onClose={() => setGalleryConfigEditorOpen(false)}
                title="Responsive Gallery Config"
                value={buildGalleryConfigEditorSeed(settings)}
                onSave={(galleryConfig) => {
                  if (!galleryConfig) {
                    return;
                  }

                  handleGalleryConfigEditorSave(galleryConfig);
                }}
                zIndex={500}
                blurEnabled={settings.settingsDrawerBlurEnabled}
              />
            </Suspense>
          )}

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
    </Drawer>
  );
}
