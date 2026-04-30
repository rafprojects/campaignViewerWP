import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useStore } from 'zustand';
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
import {
  createSettingsDraftStore,
  DEFAULT_SETTINGS_DATA,
  mapResponseToSettings,
  type SettingsData,
  type SettingsDataInput,
} from '@/contexts/SettingsStore';
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
  LEGACY_GALLERY_SETTING_KEYS,
  resolveGalleryConfig,
  syncLegacyGallerySettingToConfig,
} from '@/utils/galleryConfig';
import { useGetSettings, useUpdateSettings } from '@/services/settingsQuery';
import { SETTING_TOOLTIPS } from '@/data/settingTooltips';

const LazyGalleryConfigEditorModal = lazy(() =>
  import('@/components/Common/GalleryConfigEditorModal').then((module) => ({
    default: module.GalleryConfigEditorModal,
  })),
);

function buildGalleryConfigEditorSeed(settings: SettingsData): GalleryConfig {
  return resolveGalleryConfig(settings);
}

function isGalleryBehaviorSettingKey(key: keyof SettingsData): key is keyof GalleryBehaviorSettings {
  return Object.prototype.hasOwnProperty.call(DEFAULT_GALLERY_BEHAVIOR_SETTINGS, key);
}

interface SettingsPanelProps {
  opened: boolean;
  apiClient: ApiClient;
  onClose: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
  onSettingsSaved?: (settings: SettingsData) => void;
  /** Pre-cached settings from the root settings query. */
  initialSettings?: SettingsDataInput;
}

function mergeCachedAndFetchedSettings(
  preferred?: SettingsDataInput,
  fallback?: SettingsDataInput,
): SettingsDataInput | undefined {
  if (!preferred) {
    return fallback;
  }

  if (!fallback) {
    return preferred;
  }

  return {
    ...preferred,
    theme: preferred.theme ?? fallback.theme,
    galleryLayout: preferred.galleryLayout ?? fallback.galleryLayout,
    itemsPerPage: preferred.itemsPerPage ?? fallback.itemsPerPage,
    enableLightbox: preferred.enableLightbox ?? fallback.enableLightbox,
    enableAnimations: preferred.enableAnimations ?? fallback.enableAnimations,
  };
}

export function SettingsPanel({ opened, apiClient, onClose, onNotify, onSettingsSaved, initialSettings }: SettingsPanelProps) {
  const { setPreviewTheme, setTheme } = useTheme();
  const { data: fetchedSettings } = useGetSettings(apiClient);
  const updateSettingsMutation = useUpdateSettings(apiClient);
  const seedSettings: SettingsData = initialSettings
    ? mapResponseToSettings(initialSettings)
    : fetchedSettings
      ? mapResponseToSettings(fetchedSettings)
      : DEFAULT_SETTINGS_DATA;
  const [settingsStore] = useState(() => createSettingsDraftStore(seedSettings));
  const [activeTab, setActiveTab] = useState<string | null>('page-theme');
  const [customFonts, setCustomFonts] = useState<CustomFontEntry[]>([]);
  const [galleryConfigEditorOpen, setGalleryConfigEditorOpen] = useState(false);
  const sourceSettings = useMemo(
    () => mergeCachedAndFetchedSettings(initialSettings, fetchedSettings),
    [fetchedSettings, initialSettings],
  );
  const settings = useStore(settingsStore, (state) => state.settings);
  const originalSettings = useStore(settingsStore, (state) => state.originalSettings);
  const hasChanges = useStore(settingsStore, (state) => state.hasChanges);
  const applySettingsUpdate = useStore(settingsStore, (state) => state.applySettingsUpdate);
  const hydrateFromSource = useStore(settingsStore, (state) => state.hydrateFromSource);
  const markSaved = useStore(settingsStore, (state) => state.markSaved);
  const resetToOriginal = useStore(settingsStore, (state) => state.resetToOriginal);
  const isLoading = opened && !sourceSettings;
  const isSaving = updateSettingsMutation.isPending;

  const revertThemePreview = useCallback(() => {
    if (settings.theme !== originalSettings.theme && typeof originalSettings.theme === 'string') {
      setPreviewTheme(originalSettings.theme);
      return;
    }

    setPreviewTheme(null);
  }, [originalSettings.theme, setPreviewTheme, settings.theme]);

  useEffect(() => {
    if (!opened || !sourceSettings) {
      return;
    }

    hydrateFromSource(mapResponseToSettings(sourceSettings));
  }, [hydrateFromSource, opened, sourceSettings]);

  const updateSetting = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    applySettingsUpdate((prev) => {
      const next = { ...prev, [key]: value };

      if (isGalleryBehaviorSettingKey(key)) {
        const syncedGalleryConfig = syncLegacyGallerySettingToConfig(
          prev.galleryConfig,
          key,
          value as GalleryBehaviorSettings[K & keyof GalleryBehaviorSettings],
        );

        if (syncedGalleryConfig) {
          next.galleryConfig = syncedGalleryConfig;

          if (LEGACY_GALLERY_SETTING_KEYS.includes(key)) {
            (next as Record<string, unknown>)[key as string] = prev[key];
          }
        }
      }

      return next;
    });
  };

  const updateGallerySetting: UpdateGallerySetting = (key, value) => {
    updateSetting(key as keyof SettingsData, value as SettingsData[keyof SettingsData]);
  };

  const handleSave = async () => {
    try {
      const payload = { ...settings } as Partial<SettingsData> & Record<string, unknown>;
      for (const key of LEGACY_GALLERY_SETTING_KEYS) {
        delete payload[key];
      }

      const response = await updateSettingsMutation.mutateAsync(payload as Partial<SettingsData>);
      const saved = mapResponseToSettings(response);
      markSaved(saved);
      onSettingsSaved?.(saved);
      const persistedTheme = typeof saved.theme === 'string' ? saved.theme : settings.theme;
      if (typeof persistedTheme === 'string') {
        setTheme(persistedTheme);
      }
      setPreviewTheme(null);
      onNotify({ type: 'success', text: 'Settings saved successfully.' });
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to save settings.') });
    }
  };

  const handleReset = () => {
    resetToOriginal();
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
      return {
        ...prev,
        galleryConfig,
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
              <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
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
