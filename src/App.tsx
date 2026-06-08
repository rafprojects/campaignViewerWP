import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Container, Alert, Loader, Center, Stack, Modal, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { CardGallery } from './components/CampaignGallery/CardGallery';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { WpJwtProvider } from './services/auth/WpJwtProvider';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/Auth/LoginForm';
import { AuthBar } from './components/Auth/AuthBar';
import { UnifiedCampaignModal } from './components/Campaign/UnifiedCampaignModal';
import { ArchiveCampaignModal } from './components/Campaign/ArchiveCampaignModal';
import { AddExternalMediaModal } from './components/Campaign/AddExternalMediaModal';
import { ApiClient } from './services/apiClient';
import type { AuthProvider as AuthProviderInterface } from './services/auth/AuthProvider';
import type { Campaign, Company, MediaItem } from './types';
import { getCompanyById } from './data/mockData';
import { FALLBACK_IMAGE_SRC } from './utils/fallback';
import { buildCampaignGalleryOverrideEditorValue } from './utils/campaignGalleryOverrides';
import { sortByOrder } from './utils/sortByOrder';
import { useBuilderDeepLink } from './hooks/useBuilderDeepLink';
import { useReloadSafeView } from './hooks/useReloadSafeView';
import { useRootId } from './contexts/RootIdContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useNonceHeartbeat } from './hooks/useNonceHeartbeat';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { useUnifiedCampaignModal } from './hooks/useUnifiedCampaignModal';
import { useArchiveModal } from './hooks/useArchiveModal';
import { useExternalMediaModal } from './hooks/useExternalMediaModal';
import {
  DEFAULT_RESOLVED_SETTINGS,
  setSettingsQueryData,
  useGetSettings,
} from './services/settingsQuery';
import { CampaignContextProvider } from '@/contexts/CampaignContext';
import { toCss } from '@/lib/cssUnits';

// Lazy load admin-only components for better initial bundle size
const AdminPanel = lazy(() => import('./components/Admin/AdminPanel').then(m => ({ default: m.AdminPanel })));
const SettingsPanel = lazy(() => import('./components/Admin/SettingsPanel').then(m => ({ default: m.SettingsPanel })));

const getAuthProvider = (apiBaseUrl: string) => {
  // [P20-K] JWT auth is now opt-in. Only instantiate WpJwtProvider when the
  // WordPress site defines WPSG_ENABLE_JWT_AUTH (surfaced as enableJwt in config).
  const enableJwt = window.__WPSG_CONFIG__?.enableJwt === true;
  if (enableJwt && window.__WPSG_AUTH_PROVIDER__ === 'wp-jwt') {
    return new WpJwtProvider({ apiBaseUrl });
  }
  return undefined;
};

type ApiCampaign = Omit<Campaign, 'company' | 'videos' | 'images'> & {
  companyId: string;
};

interface ApiCampaignResponse {
  items: ApiCampaign[];
  mediaByCampaign?: Record<string, MediaItem[]>;
}

const titleCase = (value: string) =>
  value.split(/[-_\s]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

const stringToColor = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
};

const buildCompany = (companyId: string): Company => {
  const key = companyId?.toLowerCase() || 'unknown';
  const company = getCompanyById(key);
  if (company) return company;
  return { id: key, name: key === 'unknown' ? 'Unknown' : titleCase(companyId), logo: '🏷️', brandColor: stringToColor(key) };
};

const ACCESS_MODE_STORAGE_KEY = 'wpsg_access_mode';

function AppContent({
  apiBaseUrl,
  authProvider,
  accessMode,
}: {
  apiBaseUrl: string;
  authProvider?: AuthProviderInterface | undefined;
  accessMode: 'lock' | 'hide';
}) {
  const { permissions, isAuthenticated, isReady, login, logout, user } = useAuth();
  const isOnline = useOnlineStatus();
  const [actionMessage, setActionMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // P36-A: Persist the active top-level panel across reloads.
  // Single string key avoids two separate localStorage reads; null = campaign listing.
  const [savedActiveView, setSavedActiveView] = useReloadSafeView<'admin' | 'settings' | null>('active_view', null);
  const [isAdminPanelOpen, { open: openAdminPanel, close: closeAdminPanel }] = useDisclosure(false);
  const [isSettingsOpen, { open: openSettings, close: closeSettings }] = useDisclosure(false);
  const [isSignInOpen, { open: openSignIn, close: closeSignIn }] = useDisclosure(false);
  const [localAccessMode, setLocalAccessMode] = useLocalStorage<'lock' | 'hide'>({
    key: ACCESS_MODE_STORAGE_KEY,
    defaultValue: accessMode,
    getInitialValueInEffect: false,
    deserialize: (value) => (value === 'hide' || value === 'lock' ? value : accessMode),
  });
  const isAdmin = user?.role === 'admin';
  const [campaignLoadProgress, setCampaignLoadProgress] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 });

  // ── P30-D: Builder deep-link bootstrap ─────────────────────────────────────
  // When the page loads with `?builder=<templateId>`, auto-open the admin panel
  // so the builder launches directly without manual navigation.
  const { initialBuilderTemplateId } = useBuilderDeepLink();
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (!initialBuilderTemplateId) return;
    if (!isReady || !isAdmin) return;
    deepLinkHandledRef.current = true;
    openAdminPanel();
  }, [initialBuilderTemplateId, isReady, isAdmin, openAdminPanel]);

  // P36-A: Persist the active top-level view whenever it changes (only after
  // auth has resolved to avoid writing null during the loading phase).
  useEffect(() => {
    if (!isReady) return;
    if (isAdminPanelOpen) setSavedActiveView('admin');
    else if (isSettingsOpen) setSavedActiveView('settings');
    else setSavedActiveView(null);
  }, [isAdminPanelOpen, isSettingsOpen, isReady, setSavedActiveView]);

  // P36-A/A2: Restore the active top-level view + scroll position once, after
  // auth resolves. Combined in one effect so scroll restores to the right view.
  const viewRestoredRef = useRef(false);
  const rootId = useRootId();
  useEffect(() => {
    if (!isReady || viewRestoredRef.current) return;
    viewRestoredRef.current = true;

    if (isAdmin) {
      if (savedActiveView === 'admin') openAdminPanel();
      else if (savedActiveView === 'settings') openSettings();
    }

    // Restore window scroll for the target view.
    const targetView = savedActiveView === 'admin' && isAdmin ? 'admin' : 'listing';
    try {
      const scrollKey = `wpsg_view_${rootId}_scroll_${targetView}`;
      const stored = localStorage.getItem(scrollKey);
      const scrollY = stored !== null ? (JSON.parse(stored) as number) : 0;
      if (scrollY > 0) {
        requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' }));
      }
    } catch { /* ignore */ }
  }, [isReady, isAdmin, savedActiveView, openAdminPanel, openSettings, rootId]);

  // P36-A2: Capture window scroll position per-view (debounced 200 ms).
  useEffect(() => {
    const activeView = isAdminPanelOpen ? 'admin' : 'listing';
    const scrollKey = `wpsg_view_${rootId}_scroll_${activeView}`;
    let timer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try { localStorage.setItem(scrollKey, JSON.stringify(window.scrollY)); } catch { /* ignore */ }
      }, 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => { window.removeEventListener('scroll', handleScroll); clearTimeout(timer); };
  }, [rootId, isAdminPanelOpen]);

  // Close admin-only panels when the user signs out or loses admin privileges.
  useEffect(() => {
    if (!isAdmin) {
      closeAdminPanel();
      closeSettings();
    }
  }, [isAdmin, closeAdminPanel, closeSettings]);

  useEffect(() => {
    if (!actionMessage) return;
    const timer = window.setTimeout(() => setActionMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  const handleLogin = async (email: string, password: string) => { await login(email, password); closeSignIn(); };

  const handleUnauthorized = useCallback(() => {
    setActionMessage({ type: 'error', text: 'Session expired. Please sign in again.' });
    setTimeout(() => { void (async () => { try { await logout(); } catch { /* no-op */ } })(); }, 100);
  }, [logout]);

  const apiClient = useMemo(
    () => new ApiClient({ baseUrl: apiBaseUrl, authProvider, onUnauthorized: handleUnauthorized }),
    [apiBaseUrl, authProvider, handleUnauthorized],
  );

  const handleAdminNotify = useCallback(
    (message: { type: 'error' | 'success'; text: string }) => setActionMessage(message),
    [],
  );
  const queryClient = useQueryClient();

  const fetchCampaigns = useCallback(async () => {
    setCampaignLoadProgress({ total: 0, completed: 0 });
    const response = await apiClient.get<ApiCampaignResponse>('/wp-json/wp-super-gallery/v1/campaigns?include_media=1');
    const items = response.items ?? [];
    const mediaByCampaign = response.mediaByCampaign ?? {};
    setCampaignLoadProgress({ total: items.length, completed: 0 });
    const mapped = items.map((item) => {
      const canAccess = isAdmin || item.visibility === 'public' || permissions.some((id) => String(id) === String(item.id));
      const mediaItems: MediaItem[] = canAccess ? (mediaByCampaign[String(item.id)] ?? []) : [];
      const sortedMedia = sortByOrder(mediaItems);
      const rep = sortedMedia.find((m) => m.thumbnail || m.url);
      const repThumb = rep?.thumbnail || rep?.url;
      const thumbnail = item.coverImage || repThumb || item.thumbnail || FALLBACK_IMAGE_SRC;
      const coverImage = item.coverImage || repThumb || item.thumbnail || FALLBACK_IMAGE_SRC;
      const galleryOverrides = buildCampaignGalleryOverrideEditorValue(item);
      const orderedMedia = sortedMedia.map((m) => ({
        ...m, thumbnail: m.thumbnail || (m.type === 'image' ? m.url : thumbnail), caption: m.caption || 'Campaign media',
      }));
      return {
        ...item, companyId: item.companyId, company: buildCompany(item.companyId), thumbnail, coverImage, galleryOverrides,
        videos: orderedMedia.filter((m) => m.type === 'video'), images: orderedMedia.filter((m) => m.type === 'image')
      } as Campaign;
    });
    setCampaignLoadProgress({ total: items.length, completed: items.length });
    return mapped;
  }, [apiClient, isAdmin, permissions]);

  const campaignsKey = [
    'campaigns',
    apiClient.getBaseUrl(),
    user?.id ?? 'anon',
    isAuthenticated,
    isAdmin ? 'admin' : 'user',
  ] as const;
  const {
    data: campaigns,
    error: campaignsError,
    isLoading,
    refetch: mutateCampaigns,
  } = useQuery({
    queryKey: campaignsKey,
    queryFn: fetchCampaigns,
    enabled: isReady,
    staleTime: 5000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
  const error = campaignsError ? (campaignsError instanceof Error ? campaignsError.message : 'Failed to load campaigns') : null;

  const { data: settingsResponse } = useGetSettings(apiClient);

  useEffect(() => { if (isOnline && isReady) void mutateCampaigns(); }, [isOnline, isReady, mutateCampaigns]);

  const campaignsMutator = useCallback(() => mutateCampaigns() as Promise<unknown>, [mutateCampaigns]);

  const editModal = useUnifiedCampaignModal({ apiClient, isAdmin, onMutate: campaignsMutator, onNotify: handleAdminNotify });
  const archiveModal = useArchiveModal({ apiClient, isAdmin, onMutate: campaignsMutator, onNotify: handleAdminNotify });
  const externalMediaModal = useExternalMediaModal({ apiClient, isAdmin, onMutate: campaignsMutator, onNotify: handleAdminNotify });

  const resolvedSettings = settingsResponse ?? DEFAULT_RESOLVED_SETTINGS;
  const appContainerSize = resolvedSettings.appMaxWidth > 0 ? resolvedSettings.appMaxWidth : undefined;
  const appContainerFluid = resolvedSettings.appMaxWidth === 0;
  const appContainerPaddingStyle = { paddingInline: resolvedSettings.appPadding };
  const adminPanelContainerSize =
    (resolvedSettings.adminPanelMaxWidth ?? 0) > 0
      ? toCss(resolvedSettings.adminPanelMaxWidth, resolvedSettings.adminPanelMaxWidthUnit ?? 'px')
      : undefined;

  // [P20-K] Auto-logout after configurable period of inactivity.
  // The ref breaks the circular dependency between the returned reset fn and the onWarning callback.
  const idleResetRef = useRef<() => void>(() => {});
  const { reset: resetIdleTimer } = useIdleTimeout({
    timeoutMinutes: resolvedSettings.sessionIdleTimeoutMinutes,
    isAuthenticated,
    onTimeout: () => void logout(),
    warningThresholdMs: resolvedSettings.sessionIdleWarningSeconds * 1000,
    onWarning: (secondsRemaining) => {
      notifications.show({
        id: 'idle-timeout-warning',
        title: 'Session expiring soon',
        message: (
          <Stack gap="xs">
            <span>You will be signed out in {secondsRemaining} seconds due to inactivity.</span>
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                idleResetRef.current();
                notifications.hide('idle-timeout-warning');
              }}
            >
              Stay signed in
            </Button>
          </Stack>
        ),
        color: 'orange',
        autoClose: false,
        withCloseButton: true,
      });
    },
  });
  idleResetRef.current = resetIdleTimer;

  return (
    <CampaignContextProvider
      onEditCampaign={editModal.openForEdit}
      onArchiveCampaign={archiveModal.handleArchiveCampaign}
      onAddExternalMedia={externalMediaModal.handleAddExternalMedia}
    >
      <div
        className="wp-super-gallery"
        style={resolvedSettings.viewerBgType === 'transparent' ? { background: 'transparent' } : undefined}
      >
        {!isAuthenticated && isReady && (
          <Modal opened={isSignInOpen} onClose={closeSignIn} title="Sign in" centered withinPortal={false}>
            <LoginForm onSubmit={handleLogin} compact minPasswordLength={resolvedSettings.loginMinPasswordLength} />
          </Modal>
        )}
        {isReady && (
          <AuthBar
            email={user?.email ?? ''}
            isAdmin={isAdmin}
            isAuthenticated={isAuthenticated}
            appMaxWidth={resolvedSettings.appMaxWidth}
            appPadding={resolvedSettings.appPadding}
            displayMode={resolvedSettings.authBarDisplayMode}
            dragMargin={resolvedSettings.authBarDragMargin}
            onOpenAdminPanel={openAdminPanel}
            onOpenSettings={openSettings}
            onOpenSignIn={openSignIn}
            onLogout={() => void logout()}
          />
        )}
        {actionMessage && (
          <Container {...(appContainerSize !== undefined ? { size: appContainerSize } : {})} fluid={appContainerFluid} py="sm" style={appContainerPaddingStyle}>
            <Alert color={actionMessage.type === 'error' ? 'red' : 'green'}
              role={actionMessage.type === 'error' ? 'alert' : 'status'}
              aria-live={actionMessage.type === 'error' ? 'assertive' : 'polite'}>
              {actionMessage.text}
            </Alert>
          </Container>
        )}
        {!isOnline && (
          <Container {...(appContainerSize !== undefined ? { size: appContainerSize } : {})} fluid={appContainerFluid} py="sm" style={appContainerPaddingStyle}>
            <Alert color="orange" role="alert" aria-live="assertive">You appear to be offline. Some features are unavailable.</Alert>
          </Container>
        )}
        {error && (
          <Container {...(appContainerSize !== undefined ? { size: appContainerSize } : {})} fluid={appContainerFluid} py="sm" style={appContainerPaddingStyle}>
            <Alert color="red" role="alert" aria-live="assertive">{error}</Alert>
          </Container>
        )}
        {isSettingsOpen && (
          <ErrorBoundary onReset={closeSettings}>
            <Suspense fallback={null}>
              <SettingsPanel
                opened={isSettingsOpen}
                apiClient={apiClient}
                onClose={closeSettings}
                onNotify={handleAdminNotify}
                initialSettings={settingsResponse}
                onSettingsSaved={(saved) => setSettingsQueryData(queryClient, apiClient, saved as unknown as Parameters<typeof setSettingsQueryData>[2])}
              />
            </Suspense>
          </ErrorBoundary>
        )}
        {isAdminPanelOpen ? (
          <Container {...(adminPanelContainerSize !== undefined ? { size: adminPanelContainerSize } : appContainerSize !== undefined ? { size: appContainerSize } : {})} py="xl" style={appContainerPaddingStyle}>
            <ErrorBoundary onReset={closeAdminPanel}>
              <Suspense fallback={<Center py={120}><Loader /></Center>}>
                <AdminPanel
                  apiClient={apiClient}
                  onClose={closeAdminPanel}
                  onCampaignsUpdated={() => void mutateCampaigns()}
                  onNotify={handleAdminNotify}
                  initialBuilderTemplateId={initialBuilderTemplateId ?? undefined}
                />
              </Suspense>
            </ErrorBoundary>
          </Container>
        ) : isLoading ? (
          <Center py={120}>
            <Stack align="center">
              <Loader />
              <Stack gap={2} align="center">
                <Container size="sm" px={0}>
                  <Alert color="blue" variant="light" role="status" aria-live="polite">
                    Loading campaigns...{campaignLoadProgress.total > 0 ? ` (${campaignLoadProgress.completed}/${campaignLoadProgress.total} processed)` : ''}
                  </Alert>
                </Container>
              </Stack>
            </Stack>
          </Center>
        ) : (
          <CardGallery
            campaigns={campaigns || []}
            userPermissions={permissions}
            accessMode={localAccessMode}
            galleryBehaviorSettings={resolvedSettings}
            isAdmin={isAdmin}
            isAuthenticated={isAuthenticated}
            onAccessModeChange={setLocalAccessMode}
            onCampaignsUpdated={campaignsMutator}
            onNotify={handleAdminNotify}
            apiClient={apiClient}
          />
        )}

        <UnifiedCampaignModal modal={editModal} galleryBehaviorSettings={resolvedSettings} />

        <ArchiveCampaignModal
          opened={!!archiveModal.archiveModalCampaign}
          campaign={archiveModal.archiveModalCampaign}
          onClose={() => archiveModal.setArchiveModalCampaign(null)}
          onConfirm={archiveModal.confirmArchiveCampaign}
        />

        <AddExternalMediaModal
          opened={!!externalMediaModal.externalMediaCampaign}
          dropRef={externalMediaModal.dropRef}
          selectedFiles={externalMediaModal.selectedFiles}
          onSelectFiles={externalMediaModal.setSelectedFiles}
          previewUrl={externalMediaModal.previewUrl}
          uploadTitle={externalMediaModal.uploadTitle}
          onUploadTitleChange={externalMediaModal.setUploadTitle}
          uploadCaption={externalMediaModal.uploadCaption}
          onUploadCaptionChange={externalMediaModal.setUploadCaption}
          uploadProgresses={externalMediaModal.uploadProgresses}
          uploadErrors={externalMediaModal.uploadErrors}
          uploading={externalMediaModal.uploading}
          onUpload={externalMediaModal.confirmUploadMedia}
          externalUrl={externalMediaModal.externalMediaUrl}
          onExternalUrlChange={externalMediaModal.setExternalMediaUrl}
          externalError={externalMediaModal.externalMediaError}
          onFetchOEmbed={externalMediaModal.fetchExternalPreview}
          externalLoading={externalMediaModal.externalMediaLoading}
          onAddExternal={externalMediaModal.confirmAddExternalMedia}
          externalPreview={externalMediaModal.externalMediaPreview}
          onClose={externalMediaModal.closeExternalMediaModal}
        />
      </div>
    </CampaignContextProvider>
  );
}

interface AppProps {
  accessMode?: 'lock' | 'hide';
  spaceId?: number;
}

function App({ accessMode, spaceId: _spaceId }: AppProps) {
  const apiBaseUrl = window.__WPSG_API_BASE__ ?? window.location.origin;
  const provider = useMemo(() => getAuthProvider(apiBaseUrl), [apiBaseUrl]);
  const resolvedAccessMode = accessMode ?? window.__WPSG_ACCESS_MODE__ ?? 'lock';

  // [P20-K] Keep WP nonce fresh in long-running tabs (no-op when JWT is active).
  useNonceHeartbeat();

  return (
    <AuthProvider provider={provider} fallbackPermissions={[]}>
      <AppContent apiBaseUrl={apiBaseUrl} authProvider={provider} accessMode={resolvedAccessMode} />
    </AuthProvider>
  );
}

export default App;

