import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
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
  Modal,
  NativeScrollArea,
  Tabs,
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
import { buildGalleryConfigFromLegacySettings, collectGalleryAdapterSettingValues, mergeGalleryConfig } from '@/utils/galleryConfig';
import { mergeSettingsWithDefaults } from '@/utils/mergeSettingsWithDefaults';
import { SETTING_TOOLTIPS } from '@/data/settingTooltips';

const LazyGalleryConfigEditorModal = lazy(() =>
  import('@/components/Common/GalleryConfigEditorModal').then((module) => ({
    default: module.GalleryConfigEditorModal,
  })),
);

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
    | 'adapterSizingMode'
    | 'adapterMaxWidthPct'
    | 'adapterMaxHeightPct'
    | 'adapterItemGap'
    | 'adapterJustifyContent'
    | 'gallerySizingMode'
    | 'galleryManualHeight'
    | 'galleryImageLabel'
    | 'galleryVideoLabel'
    | 'galleryLabelJustification'
    | 'showGalleryLabelIcon'
    | 'showCampaignGalleryLabels',
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

function getScopeGalleryCommonSetting(
  galleryConfig: GalleryConfig,
  scope: 'unified' | 'image' | 'video',
  key: 'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl',
): string | undefined {
  const value = galleryConfig.breakpoints?.desktop?.[scope]?.common?.[key]
    ?? galleryConfig.breakpoints?.tablet?.[scope]?.common?.[key]
    ?? galleryConfig.breakpoints?.mobile?.[scope]?.common?.[key];

  return typeof value === 'string' ? value : undefined;
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
      const adapterSizingMode = getRepresentativeGalleryCommonSetting(galleryConfig, 'adapterSizingMode') ?? prev.adapterSizingMode;
      const adapterMaxWidthPct = getRepresentativeGalleryCommonSetting(galleryConfig, 'adapterMaxWidthPct') ?? prev.adapterMaxWidthPct;
      const adapterMaxHeightPct = getRepresentativeGalleryCommonSetting(galleryConfig, 'adapterMaxHeightPct') ?? prev.adapterMaxHeightPct;
      const adapterItemGap = getRepresentativeGalleryCommonSetting(galleryConfig, 'adapterItemGap') ?? prev.adapterItemGap;
      const adapterJustifyContent = getRepresentativeGalleryCommonSetting(galleryConfig, 'adapterJustifyContent') ?? prev.adapterJustifyContent;
      const gallerySizingMode = getRepresentativeGalleryCommonSetting(galleryConfig, 'gallerySizingMode') ?? prev.gallerySizingMode;
      const galleryManualHeight = getRepresentativeGalleryCommonSetting(galleryConfig, 'galleryManualHeight') ?? prev.galleryManualHeight;
      const galleryImageLabel = getRepresentativeGalleryCommonSetting(galleryConfig, 'galleryImageLabel') ?? prev.galleryImageLabel;
      const galleryVideoLabel = getRepresentativeGalleryCommonSetting(galleryConfig, 'galleryVideoLabel') ?? prev.galleryVideoLabel;
      const galleryLabelJustification = getRepresentativeGalleryCommonSetting(galleryConfig, 'galleryLabelJustification') ?? prev.galleryLabelJustification;
      const showGalleryLabelIcon = getRepresentativeGalleryCommonSetting(galleryConfig, 'showGalleryLabelIcon') ?? prev.showGalleryLabelIcon;
      const showCampaignGalleryLabels = getRepresentativeGalleryCommonSetting(galleryConfig, 'showCampaignGalleryLabels') ?? prev.showCampaignGalleryLabels;
      const imageBgType = getScopeGalleryCommonSetting(galleryConfig, 'image', 'viewportBgType') ?? prev.imageBgType;
      const imageBgColor = getScopeGalleryCommonSetting(galleryConfig, 'image', 'viewportBgColor') ?? prev.imageBgColor;
      const imageBgGradient = getScopeGalleryCommonSetting(galleryConfig, 'image', 'viewportBgGradient') ?? prev.imageBgGradient;
      const imageBgImageUrl = getScopeGalleryCommonSetting(galleryConfig, 'image', 'viewportBgImageUrl') ?? prev.imageBgImageUrl;
      const videoBgType = getScopeGalleryCommonSetting(galleryConfig, 'video', 'viewportBgType') ?? prev.videoBgType;
      const videoBgColor = getScopeGalleryCommonSetting(galleryConfig, 'video', 'viewportBgColor') ?? prev.videoBgColor;
      const videoBgGradient = getScopeGalleryCommonSetting(galleryConfig, 'video', 'viewportBgGradient') ?? prev.videoBgGradient;
      const videoBgImageUrl = getScopeGalleryCommonSetting(galleryConfig, 'video', 'viewportBgImageUrl') ?? prev.videoBgImageUrl;
      const unifiedBgType = getScopeGalleryCommonSetting(galleryConfig, 'unified', 'viewportBgType') ?? prev.unifiedBgType;
      const unifiedBgColor = getScopeGalleryCommonSetting(galleryConfig, 'unified', 'viewportBgColor') ?? prev.unifiedBgColor;
      const unifiedBgGradient = getScopeGalleryCommonSetting(galleryConfig, 'unified', 'viewportBgGradient') ?? prev.unifiedBgGradient;
      const unifiedBgImageUrl = getScopeGalleryCommonSetting(galleryConfig, 'unified', 'viewportBgImageUrl') ?? prev.unifiedBgImageUrl;

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
        adapterSizingMode: adapterSizingMode as SettingsData['adapterSizingMode'],
        adapterMaxWidthPct: adapterMaxWidthPct as SettingsData['adapterMaxWidthPct'],
        adapterMaxHeightPct: adapterMaxHeightPct as SettingsData['adapterMaxHeightPct'],
        adapterItemGap: adapterItemGap as SettingsData['adapterItemGap'],
        adapterJustifyContent: adapterJustifyContent as SettingsData['adapterJustifyContent'],
        gallerySizingMode: gallerySizingMode as SettingsData['gallerySizingMode'],
        galleryManualHeight: galleryManualHeight as SettingsData['galleryManualHeight'],
        galleryImageLabel: galleryImageLabel as SettingsData['galleryImageLabel'],
        galleryVideoLabel: galleryVideoLabel as SettingsData['galleryVideoLabel'],
        galleryLabelJustification: galleryLabelJustification as SettingsData['galleryLabelJustification'],
        showGalleryLabelIcon: showGalleryLabelIcon as SettingsData['showGalleryLabelIcon'],
        showCampaignGalleryLabels: showCampaignGalleryLabels as SettingsData['showCampaignGalleryLabels'],
        imageBgType: imageBgType as SettingsData['imageBgType'],
        imageBgColor: imageBgColor as SettingsData['imageBgColor'],
        imageBgGradient: imageBgGradient as SettingsData['imageBgGradient'],
        imageBgImageUrl: imageBgImageUrl as SettingsData['imageBgImageUrl'],
        videoBgType: videoBgType as SettingsData['videoBgType'],
        videoBgColor: videoBgColor as SettingsData['videoBgColor'],
        videoBgGradient: videoBgGradient as SettingsData['videoBgGradient'],
        videoBgImageUrl: videoBgImageUrl as SettingsData['videoBgImageUrl'],
        unifiedBgType: unifiedBgType as SettingsData['unifiedBgType'],
        unifiedBgColor: unifiedBgColor as SettingsData['unifiedBgColor'],
        unifiedBgGradient: unifiedBgGradient as SettingsData['unifiedBgGradient'],
        unifiedBgImageUrl: unifiedBgImageUrl as SettingsData['unifiedBgImageUrl'],
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
              {activeTab === 'general' && (
                <GeneralSettingsSection
                  settings={settings}
                  updateSetting={updateSetting}
                  onThemeChange={(id) => updateSetting('theme' as keyof SettingsData, id as SettingsData[keyof SettingsData])}
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

            {/* ── Media Display Tab ─────────────────────────── */}
            <Tabs.Panel value="gallery" pt="md">
              {activeTab === 'gallery' && (
                <MediaDisplaySettingsSection
                  settings={settings}
                  updateSetting={updateSetting}
                  tooltipLabel={tt}
                />
              )}
            </Tabs.Panel>


            {/* ── Gallery Layout Tab ────────────────────────── */}
            <Tabs.Panel value="layout" pt="md">
              {activeTab === 'layout' && (
                <GalleryLayoutSettingsSection
                  settings={settings}
                  updateSetting={updateGallerySetting}
                  onOpenResponsiveConfig={() => setGalleryConfigEditorOpen(true)}
                />
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

          {galleryConfigEditorOpen && (
            <Suspense fallback={null}>
              <LazyGalleryConfigEditorModal
                opened={galleryConfigEditorOpen}
                onClose={() => setGalleryConfigEditorOpen(false)}
                title="Responsive Gallery Config"
                value={buildGalleryConfigEditorSeed(settings)}
                onSave={handleGalleryConfigEditorSave}
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
    </Modal>
  );
}
