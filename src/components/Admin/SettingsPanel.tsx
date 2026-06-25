import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useStore } from 'zustand';
import { useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Stack,
  Loader,
  Center,
  Text,
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
  IconPalette,
  IconArrowsHorizontal,
  IconPlugConnected,
} from '@tabler/icons-react';
import type { ApiClient } from '@/services/apiClient';
import {
  type CardConfigBreakpoint,
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
import { SettingsAppearanceTab } from '../Settings/tabs/SettingsAppearanceTab';
import { SettingsCardsTab } from '../Settings/tabs/SettingsCardsTab';
import { SettingsGalleryLayoutTab } from '../Settings/tabs/SettingsGalleryLayoutTab';
import { SettingsGalleryStyleTab } from '../Settings/tabs/SettingsGalleryStyleTab';
import { SettingsGalleryNavigationTab } from '../Settings/tabs/SettingsGalleryNavigationTab';
import { SettingsViewerTab } from '../Settings/tabs/SettingsViewerTab';
import { SettingsTypographyTab } from '../Settings/tabs/SettingsTypographyTab';
import { SettingsIntegrationsTab } from '../Settings/tabs/SettingsIntegrationsTab';
import { SettingsSystemAdminTab } from '../Settings/tabs/SettingsSystemAdminTab';
import { useTheme } from '@/hooks/useTheme';
import { useRootId } from '@wp-super-gallery/shared-ui';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { getErrorMessage, spaceColor } from '@wp-super-gallery/shared-utils';

import { GalleryConfigEditorLoader } from '@/components/Common/GalleryConfigEditorLoader';

import {
  LEGACY_GALLERY_SETTING_KEYS,
  resolveGalleryConfig,
} from '@/utils/galleryConfig';
import { normalizeCardConfigSettings } from '@/utils/cardConfig';
import { useGetSettings, useUpdateSettings, SETTINGS_QUERY_KEY, getSettingsQueryKey, normalizeSettingsResponse } from '@/services/settingsQuery';
import { SETTING_TOOLTIPS } from '@/data/settingTooltips';
import { toCss } from '@wp-super-gallery/shared-utils';
import { resolveSettingsPanelTransition } from './settingsPanelTransition';

/**
 * P36-A: Settings draft persistence.
 * Key builder returns root-scoped localStorage keys so multi-shortcode pages
 * don't collide. Draft payload includes savedAt for the restore prompt.
 */
interface SettingsDraftStoragePayload {
  savedAt: number;
  settings: SettingsData;
}

function settingsDraftKey(rootId: string) {
  return `wpsg_settings_draft_${rootId}`;
}

function settingsTabKey(rootId: string) {
  return `wpsg_view_${rootId}_settings_tab`;
}

function readSettingsDraft(rootId: string): SettingsDraftStoragePayload | null {
  try {
    const raw = localStorage.getItem(settingsDraftKey(rootId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'savedAt' in parsed &&
      'settings' in parsed &&
      typeof (parsed as Record<string, unknown>).savedAt === 'number'
    ) {
      return parsed as SettingsDraftStoragePayload;
    }
    return null;
  } catch {
    return null;
  }
}

function writeSettingsDraft(rootId: string, settings: SettingsData) {
  try {
    const payload: SettingsDraftStoragePayload = { savedAt: Date.now(), settings };
    localStorage.setItem(settingsDraftKey(rootId), JSON.stringify(payload));
  } catch { /* localStorage full or unavailable */ }
}

function clearSettingsDraft(rootId: string) {
  try { localStorage.removeItem(settingsDraftKey(rootId)); } catch { /* ignore */ }
}

const LazyGalleryConfigEditorModal = lazy(() =>
  import('@/components/Common/GalleryConfigEditorModal').then((module) => ({
    default: module.GalleryConfigEditorModal,
  })),
);

function buildGalleryConfigEditorSeed(settings: SettingsData): GalleryConfig {
  return resolveGalleryConfig(settings);
}

interface SettingsPanelProps {
  opened: boolean;
  apiClient: ApiClient;
  onClose: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
  onSettingsSaved?: ((settings: SettingsData) => void) | undefined;
  /** Pre-cached settings from the root settings query. */
  initialSettings?: SettingsDataInput | undefined;
  /** When set, saves route to this space's overrides instead of global settings. */
  spaceId?: number;
  /** P48-I: display name for the space (shown in the drawer header badge). */
  spaceName?: string;
  /** P48-I: stable instance ID used to derive the per-space accent color. */
  instanceId?: string | undefined;
  /** Render the Drawer via a React portal (to document.body). Defaults true so the Drawer escapes any CSS transform/contain stacking context on the shortcode host. */
  withinPortal?: boolean;
  /** P53-A: gates the system-admin-only Integrations + System & Admin tabs (global mode only). */
  isSystemAdmin?: boolean;
}

type NamedComponent<Props = Record<string, never>> = ((props: Props) => ReactElement) & {
  displayName?: string;
};

type SettingsPanelUpdateSetting = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void;
type SettingsPanelTooltipRenderer = (label: string, key: string) => ReturnType<typeof SettingTooltip>;

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


interface SettingsPanelTabsContentProps {
  activeTab: string | null;
  setActiveTab: (value: string | null) => void;
  settings: SettingsData;
  updateSetting: SettingsPanelUpdateSetting;
  updateGallerySetting: UpdateGallerySetting;
  cardSettingsBreakpoint: CardConfigBreakpoint;
  setCardSettingsBreakpoint: (value: CardConfigBreakpoint) => void;
  setGalleryConfigEditorOpen: (open: boolean) => void;
  apiClient: ApiClient;
  customFonts: CustomFontEntry[];
  setCustomFonts: (fonts: CustomFontEntry[]) => void;
  updateTypoOverride: (elementId: string, override: TypographyOverride) => void;
  tooltipLabel: SettingsPanelTooltipRenderer;
  /** When set, hides the Integrations tab and the magic-link picker inside System & Admin. */
  spaceId?: number;
  /** P53-A: System & Admin tab is system-admin only. The tab itself is available in space mode; only the magic-link picker is hidden. */
  isSystemAdmin?: boolean;
}

const SettingsPanelTabsContent: NamedComponent<SettingsPanelTabsContentProps> = ({
  activeTab,
  setActiveTab,
  settings,
  updateSetting,
  updateGallerySetting,
  cardSettingsBreakpoint,
  setCardSettingsBreakpoint,
  setGalleryConfigEditorOpen,
  apiClient,
  customFonts,
  setCustomFonts,
  updateTypoOverride,
  tooltipLabel,
  spaceId,
  isSystemAdmin = false,
}) => {
  const isSpaceMode = spaceId != null;
  return <Stack gap="md">
    <Tabs
      value={activeTab}
      onChange={setActiveTab}
      keepMounted={false}
      styles={{
        list: {
          overflowX: 'auto',
          flexWrap: 'nowrap',
          scrollbarWidth: 'thin',
        },
        tab: {
          flex: '0 0 auto',
          whiteSpace: 'nowrap',
        },
      }}
    >
      <Tabs.List>
        <Tabs.Tab value="appearance" leftSection={<IconSettings size={16} />}>
          Appearance
        </Tabs.Tab>
        <Tabs.Tab value="cards" leftSection={<IconLayoutGrid size={16} />}>
          Campaign Cards
        </Tabs.Tab>
        <Tabs.Tab value="gallery-layout" leftSection={<IconPhoto size={16} />}>
          Gallery Layout
        </Tabs.Tab>
        <Tabs.Tab value="gallery-style" leftSection={<IconPalette size={16} />}>
          Gallery Style
        </Tabs.Tab>
        <Tabs.Tab value="gallery-navigation" leftSection={<IconArrowsHorizontal size={16} />}>
          Gallery Navigation
        </Tabs.Tab>
        <Tabs.Tab value="viewer" leftSection={<IconEye size={16} />}>
          Campaign Viewer
        </Tabs.Tab>
        <Tabs.Tab value="typography" leftSection={<IconTypography size={16} />}>
          Typography
        </Tabs.Tab>
        {!isSpaceMode && isSystemAdmin && (
          <Tabs.Tab value="integrations" leftSection={<IconPlugConnected size={16} />}>
            Integrations
          </Tabs.Tab>
        )}
        {isSystemAdmin && settings.advancedSettingsEnabled && (
          <Tabs.Tab value="system-admin" leftSection={<IconAdjustments size={16} />}>
            System & Admin
          </Tabs.Tab>
        )}
      </Tabs.List>

      <Tabs.Panel value="appearance" pt="md">
        <SettingsAppearanceTab settings={settings} updateSetting={updateSetting} isSystemAdmin={isSystemAdmin} />
      </Tabs.Panel>

      <Tabs.Panel value="cards" pt="md">
        <SettingsCardsTab
          settings={settings}
          updateSetting={updateGallerySetting}
          apiClient={apiClient}
          cardSettingsBreakpoint={cardSettingsBreakpoint}
          setCardSettingsBreakpoint={setCardSettingsBreakpoint}
        />
      </Tabs.Panel>

      <Tabs.Panel value="gallery-layout" pt="md">
        <SettingsGalleryLayoutTab
          settings={settings}
          updateSetting={updateGallerySetting}
          onOpenResponsiveConfig={() => setGalleryConfigEditorOpen(true)}
        />
      </Tabs.Panel>

      <Tabs.Panel value="gallery-style" pt="md">
        <SettingsGalleryStyleTab settings={settings} updateSetting={updateSetting} tooltipLabel={tooltipLabel} />
      </Tabs.Panel>

      <Tabs.Panel value="gallery-navigation" pt="md">
        <SettingsGalleryNavigationTab settings={settings} updateSetting={updateSetting} tooltipLabel={tooltipLabel} />
      </Tabs.Panel>

      <Tabs.Panel value="viewer" pt="md">
        <SettingsViewerTab settings={settings} updateSetting={updateGallerySetting} />
      </Tabs.Panel>

      <Tabs.Panel value="typography" pt="md">
        <SettingsTypographyTab
          apiClient={apiClient}
          customFonts={customFonts}
          setCustomFonts={setCustomFonts}
          typographyOverrides={settings.typographyOverrides}
          updateSetting={updateSetting}
          updateTypoOverride={updateTypoOverride}
          isSystemAdmin={isSystemAdmin}
        />
      </Tabs.Panel>

      {!isSpaceMode && isSystemAdmin && (
        <Tabs.Panel value="integrations" pt="md">
          <SettingsIntegrationsTab apiClient={apiClient} />
        </Tabs.Panel>
      )}

      {isSystemAdmin && settings.advancedSettingsEnabled && (
        <Tabs.Panel value="system-admin" pt="md">
          <SettingsSystemAdminTab
            settings={settings}
            updateSetting={updateSetting}
            updateGallerySetting={updateGallerySetting}
            apiClient={apiClient}
            tooltipLabel={tooltipLabel}
          />
        </Tabs.Panel>
      )}
    </Tabs>
  </Stack>;
};

SettingsPanelTabsContent.displayName = 'SettingsPanel:TabsContent';

export function SettingsPanel({ opened, apiClient, onClose, onNotify, onSettingsSaved, initialSettings, spaceId, spaceName, instanceId, withinPortal = true, isSystemAdmin = false }: SettingsPanelProps) {
  const color = instanceId ? spaceColor(instanceId) : undefined;
  // P57-B: Read the exact badge/accent colors from the shadow host element.
  // The Drawer portals to document.body, where `:host`-scoped Mantine CSS
  // variables don't resolve, so we read them directly via getComputedStyle on the
  // shadow host — which IS the element that `:host {}` styles apply to and whose
  // custom properties are accessible from light-DOM JS. In non-shadow mounts (dev
  // server, tests) the shadow host is never set, so shadowHost stays null and the
  // badge falls back to variant="light" (which resolves from `:root` there).
  const [shadowHost, setShadowHost] = useState<Element | null>(null);
  const shadowSentinelRef = useCallback((node: HTMLSpanElement | null) => {
    if (!node) return;
    const root = node.getRootNode();
    if (root instanceof ShadowRoot) setShadowHost(root.host);
  }, []);

  // P57-A animation: SettingsPanel is conditionally rendered by its parent, so the
  // Drawer receives opened=true on its first render and Mantine's Transition starts
  // already 'entered' (it only animates on a subsequent false→true change). Rendering
  // the Drawer closed first and flipping in a plain effect isn't enough — the two
  // commits land in the same frame (~14ms apart, sub-frame), so the browser never
  // paints the closed "from" state and the CSS transition has nothing to animate
  // from. Fix: hold opened=false, then flip true across TWO animation frames, which
  // guarantees the closed state is painted before the slide begins.
  const [internalOpened, setInternalOpened] = useState(false);
  useEffect(() => {
    if (!opened) { setInternalOpened(false); return; }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setInternalOpened(true)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [opened]);

  // Resolved inline-style values for the space badge and drawer border accent.
  // getComputedStyle reads the exact CSS variable values Mantine sets on the
  // host element, giving pixel-perfect parity with the AuthBar/AdminPanel badges.
  const colorHex = (color && shadowHost)
    ? (getComputedStyle(shadowHost).getPropertyValue(`--mantine-color-${color}-5`).trim() || undefined)
    : color ? `var(--mantine-color-${color}-5)` : undefined;
  const badgeBg = (color && shadowHost)
    ? (getComputedStyle(shadowHost).getPropertyValue(`--mantine-color-${color}-light`).trim() || undefined)
    : undefined;
  const badgeText = (color && shadowHost)
    ? (getComputedStyle(shadowHost).getPropertyValue(`--mantine-color-${color}-light-color`).trim() || undefined)
    : undefined;
  const { setPreviewTheme, setTheme } = useTheme();
  const rootId = useRootId();
  const queryClient = useQueryClient();
  const { data: fetchedSettings } = useGetSettings(apiClient, spaceId);
  const updateSettingsMutation = useUpdateSettings(apiClient);

  const persistedDraft = useMemo(() => readSettingsDraft(rootId), [rootId]);
  const seedSettings: SettingsData = initialSettings
    ? mapResponseToSettings(initialSettings)
    : fetchedSettings
      ? mapResponseToSettings(fetchedSettings)
      : DEFAULT_SETTINGS_DATA;
  const [settingsStore] = useState(() => createSettingsDraftStore(seedSettings));

  // P36-A: Restore the active tab from localStorage.
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    try {
      return localStorage.getItem(settingsTabKey(rootId)) ?? 'appearance';
    } catch {
      return 'appearance';
    }
  });
  const handleTabChange = useCallback((tab: string | null) => {
    setActiveTab(tab);
    try {
      if (tab) localStorage.setItem(settingsTabKey(rootId), tab);
    } catch { /* ignore */ }
  }, [rootId]);

  const [cardSettingsBreakpoint, setCardSettingsBreakpoint] = useState<CardConfigBreakpoint>('desktop');
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
  const [isSpaceSaving, setIsSpaceSaving] = useState(false);
  const isSaving = updateSettingsMutation.isPending || isSpaceSaving;

  // P36-A: Show the restore/discard prompt once on mount when a persisted draft exists.
  const draftPromptShownRef = useRef(false);
  useEffect(() => {
    if (!opened || !persistedDraft || draftPromptShownRef.current) return;
    draftPromptShownRef.current = true;
    const draftAge = Math.round((Date.now() - persistedDraft.savedAt) / 60_000);
    const ageLabel = draftAge < 1 ? 'just now' : draftAge === 1 ? '1 minute ago' : `${draftAge} minutes ago`;
    modals.openConfirmModal({
      title: 'Unsaved settings found',
      children: (
        <Text size="sm">
          You have unsaved settings changes from {ageLabel}. Would you like to restore them?
        </Text>
      ),
      labels: { confirm: 'Restore', cancel: 'Discard' },
      confirmProps: { color: 'blue' },
      onConfirm: () => {
        applySettingsUpdate(() => persistedDraft!.settings);
        notifications.show({
          title: 'Settings restored',
          message: 'Your previous unsaved changes have been restored.',
          color: 'blue',
          autoClose: 4000,
        });
      },
      onCancel: () => {
        resetToOriginal();
        clearSettingsDraft(rootId);
        notifications.show({
          message: 'Unsaved settings discarded.',
          color: 'gray',
          autoClose: 3000,
        });
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // P36-A: Persist the settings draft to localStorage whenever it changes.
  useEffect(() => {
    if (!opened) return;
    if (hasChanges) {
      writeSettingsDraft(rootId, settings);
    } else {
      clearSettingsDraft(rootId);
    }
  }, [opened, hasChanges, settings, rootId]);

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
    applySettingsUpdate((prev) => ({ ...prev, [key]: value }));
  };

  const updateGallerySetting: UpdateGallerySetting = (key, value) => {
    updateSetting(key as keyof SettingsData, value as SettingsData[keyof SettingsData]);
  };

  const handleSave = async () => {
    try {
      const normalizedSettings = normalizeCardConfigSettings(settings);
      const payload = { ...normalizedSettings } as Partial<SettingsData> & Record<string, unknown>;
      for (const key of LEGACY_GALLERY_SETTING_KEYS) {
        delete payload[key];
      }

      if (spaceId != null) {
        setIsSpaceSaving(true);
        try {
          const spaceResponse = await apiClient.put<{ settings?: Record<string, unknown> }>(
            `/wp-json/wp-super-gallery/v1/spaces/${spaceId}/settings`, payload
          );
          const saved = mapResponseToSettings(
            normalizeSettingsResponse(spaceResponse?.settings as Parameters<typeof normalizeSettingsResponse>[0])
          );
          void queryClient.invalidateQueries({ queryKey: getSettingsQueryKey(apiClient, spaceId) });
          void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
          markSaved(saved);
          clearSettingsDraft(rootId);
          const persistedTheme = typeof saved.theme === 'string' ? saved.theme : undefined;
          if (persistedTheme) setTheme(persistedTheme);
          setPreviewTheme(null);
          onNotify({ type: 'success', text: 'Space settings saved.' });
        } finally {
          setIsSpaceSaving(false);
        }
      } else {
        const response = await updateSettingsMutation.mutateAsync(payload as unknown as import('@/services/apiClient').SettingsUpdateRequest);
        const saved = mapResponseToSettings(response);
        markSaved(saved);
        clearSettingsDraft(rootId);
        onSettingsSaved?.(saved);
        const persistedTheme = typeof saved.theme === 'string' ? saved.theme : settings.theme;
        if (typeof persistedTheme === 'string') setTheme(persistedTheme);
        setPreviewTheme(null);
        onNotify({ type: 'success', text: 'Settings saved successfully.' });
      }
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to save settings.') });
    }
  };

  const handleReset = () => {
    resetToOriginal();
    clearSettingsDraft(rootId);
    revertThemePreview();
  };

  const isSmallScreen = useMediaQuery('(max-width: 575px)');

  // P36-A2: Restore scroll position per-tab in the settings panel body.
  const scrollBodyRef = useScrollRestore('settings', activeTab);

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

  // P57-A close animation: the parent unmounts the panel when onClose() runs, which
  // would cut off the exit transition. So a close *request* (X / Cancel / overlay /
  // escape) reverts the theme preview and flips internalOpened false — letting the
  // Drawer animate out — and the real onClose() (unmount) fires from the Transition's
  // onExited, once the exit animation has finished. `none` (duration 0) resolves
  // onExited synchronously, so it still closes instantly.
  const handleClose = () => { revertThemePreview(); setInternalOpened(false); };

  return (
    <>
      {/* P57-B: inline sentinel (lives in the shadow tree) used to resolve the
          shadow-DOM portal target for the Drawer below. */}
      <span ref={shadowSentinelRef} style={{ display: 'none' }} aria-hidden="true" />
      <Drawer
      opened={internalOpened}
      onClose={handleClose}
      title={
        <Group w="100%" justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="sm">
            <IconSettings size={22} />
            <Title order={3}>Settings</Title>
            {spaceId != null && (
              <Badge
                size="sm"
                color={color ?? 'blue'}
                variant="light"
                {...(badgeBg ? { style: { backgroundColor: badgeBg, color: badgeText } } : {})}
              >
                {spaceName ?? `Space ${spaceId}`}
              </Badge>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Button variant="default" size="sm" onClick={handleClose}>Cancel</Button>
            {hasChanges && (
              <Button variant="subtle" size="sm" onClick={handleReset} disabled={isSaving}>Reset</Button>
            )}
            <Button size="sm" onClick={() => { void handleSave(); }} loading={isSaving} disabled={!hasChanges}>
              Save Changes
            </Button>
          </Group>
        </Group>
      }
      position="right"
      size={isSmallScreen ? '100%' : toCss(settings.settingsPanelWidth ?? 600, settings.settingsPanelWidthUnit ?? 'px')}
      zIndex={450}
      withinPortal={withinPortal}
      closeOnClickOutside={!hasChanges}
      closeOnEscape={!hasChanges}
      transitionProps={resolveSettingsPanelTransition(settings.settingsPanelAnimation)}
      onExitTransitionEnd={onClose}
      overlayProps={{
        backgroundOpacity: 0.6,
        blur: settings.settingsDrawerBlurEnabled !== false ? 4 : 0,
      }}
      scrollAreaComponent={NativeScrollArea}
      styles={{
        body: { display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 },
        ...(colorHex ? { content: { borderLeft: `2px solid ${colorHex}` } } : {}),
      }}
    >
      {isLoading ? (
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      ) : (
        <>
          <Box ref={scrollBodyRef} style={{ flex: 1, overflowY: 'auto', padding: 'var(--mantine-spacing-md)' }}>
            <SettingsPanelTabsContent
              activeTab={activeTab}
              setActiveTab={handleTabChange}
              settings={settings}
              updateSetting={updateSetting}
              updateGallerySetting={updateGallerySetting}
              cardSettingsBreakpoint={cardSettingsBreakpoint}
              setCardSettingsBreakpoint={setCardSettingsBreakpoint}
              setGalleryConfigEditorOpen={setGalleryConfigEditorOpen}
              apiClient={apiClient}
              customFonts={customFonts}
              setCustomFonts={setCustomFonts}
              updateTypoOverride={updateTypoOverride}
              tooltipLabel={tt}
              isSystemAdmin={isSystemAdmin}
              {...(spaceId != null ? { spaceId } : {})}
            />
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

        </>
      )}
      </Drawer>
    </>
  );
}

SettingsPanel.displayName = 'SettingsPanel';