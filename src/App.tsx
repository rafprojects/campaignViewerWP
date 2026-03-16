import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Container, Alert, Loader, Center, Stack, Group, Text, Button, Modal } from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { CardGallery } from './components/Gallery/CardGallery';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { WpJwtProvider } from './services/auth/WpJwtProvider';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/Auth/LoginForm';
import { AuthBar } from './components/Auth/AuthBar';
import { UnifiedCampaignModal } from './components/shared/UnifiedCampaignModal';
import { ArchiveCampaignModal } from './components/Campaign/ArchiveCampaignModal';
import { AddExternalMediaModal } from './components/Campaign/AddExternalMediaModal';
import { ApiClient } from './services/apiClient';
import type { AuthProvider as AuthProviderInterface } from './services/auth/AuthProvider';
import type { Campaign, Company, MediaItem, GalleryBehaviorSettings } from './types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from './types';
import { getCompanyById } from './data/mockData';
import { FALLBACK_IMAGE_SRC } from './utils/fallback';
import { mergeSettingsWithDefaults } from './utils/mergeSettingsWithDefaults';
import { sortByOrder } from './utils/sortByOrder';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useNonceHeartbeat } from './hooks/useNonceHeartbeat';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { useUnifiedCampaignModal } from './hooks/useUnifiedCampaignModal';
import { useArchiveModal } from './hooks/useArchiveModal';
import { useExternalMediaModal } from './hooks/useExternalMediaModal';
import useSWR from 'swr';

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
  authProvider?: AuthProviderInterface;
  accessMode: 'lock' | 'hide';
}) {
  const { permissions, isAuthenticated, isReady, login, logout, user } = useAuth();
  const isOnline = useOnlineStatus();
  const [actionMessage, setActionMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
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
      const orderedMedia = sortedMedia.map((m) => ({
        ...m, thumbnail: m.thumbnail || (m.type === 'image' ? m.url : thumbnail), caption: m.caption || 'Campaign media',
      }));
      return { ...item, companyId: item.companyId, company: buildCompany(item.companyId), thumbnail, coverImage,
        videos: orderedMedia.filter((m) => m.type === 'video'), images: orderedMedia.filter((m) => m.type === 'image') } as Campaign;
    });
    setCampaignLoadProgress({ total: items.length, completed: items.length });
    return mapped;
  }, [apiClient, isAdmin, permissions]);

  const campaignsKey = isReady ? ['campaigns', user?.id ?? 'anon', isAuthenticated, isAdmin ? 'admin' : 'user'] : null;
  const { data: campaigns, error: campaignsError, isLoading, mutate: mutateCampaigns } = useSWR(campaignsKey, fetchCampaigns, {
    revalidateOnFocus: false, revalidateOnReconnect: true, dedupingInterval: 5000,
  });
  const error = campaignsError ? (campaignsError instanceof Error ? campaignsError.message : 'Failed to load campaigns') : null;

  const { data: galleryBehaviorSettings, mutate: mutateGalleryBehaviorSettings } = useSWR<GalleryBehaviorSettings>(
    'gallery-behavior-settings',
    async () => mergeSettingsWithDefaults((await apiClient.getSettings()) as Partial<GalleryBehaviorSettings>),
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false, fallbackData: DEFAULT_GALLERY_BEHAVIOR_SETTINGS },
  );

  useEffect(() => { if (isOnline && isReady) void mutateCampaigns(); }, [isOnline, isReady, mutateCampaigns]);

  const campaignsMutator = useCallback(() => mutateCampaigns() as Promise<unknown>, [mutateCampaigns]);

  const editModal = useUnifiedCampaignModal({ apiClient, isAdmin, onMutate: campaignsMutator, onNotify: handleAdminNotify });
  const archiveModal = useArchiveModal({ apiClient, isAdmin, onMutate: campaignsMutator, onNotify: handleAdminNotify });
  const externalMediaModal = useExternalMediaModal({ apiClient, isAdmin, onMutate: campaignsMutator, onNotify: handleAdminNotify });

  const resolvedSettings = galleryBehaviorSettings ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS;
  const appContainerSize = resolvedSettings.appMaxWidth > 0 ? resolvedSettings.appMaxWidth : undefined;
  const appContainerFluid = resolvedSettings.appMaxWidth === 0;
  const appContainerPaddingStyle = { paddingInline: resolvedSettings.appPadding };

  // [P20-K] Auto-logout after configurable period of inactivity.
  useIdleTimeout({
    timeoutMinutes: resolvedSettings.sessionIdleTimeoutMinutes,
    isAuthenticated,
    onTimeout: () => void logout(),
  });

  return (
    <div className="wp-super-gallery">
      {!isAuthenticated && isReady && (
        <>
          <Container size={appContainerSize} fluid={appContainerFluid} py="sm" style={appContainerPaddingStyle}>
            <Alert color="blue" variant="light" role="status" aria-live="polite">
              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <Text size="sm">Sign in to access private campaigns.</Text>
                <Button size="xs" onClick={openSignIn}>Sign in</Button>
              </Group>
            </Alert>
          </Container>
          <Modal opened={isSignInOpen} onClose={closeSignIn} title="Sign in" centered>
            <LoginForm onSubmit={handleLogin} compact />
          </Modal>
        </>
      )}
      {isAuthenticated && user && (
        <AuthBar
          email={user.email}
          isAdmin={isAdmin}
          appMaxWidth={resolvedSettings.appMaxWidth}
          appPadding={resolvedSettings.appPadding}
          onOpenAdminPanel={openAdminPanel}
          onOpenSettings={openSettings}
          onLogout={() => void logout()}
        />
      )}
      {actionMessage && (
        <Container size={appContainerSize} fluid={appContainerFluid} py="sm" style={appContainerPaddingStyle}>
          <Alert color={actionMessage.type === 'error' ? 'red' : 'green'}
            role={actionMessage.type === 'error' ? 'alert' : 'status'}
            aria-live={actionMessage.type === 'error' ? 'assertive' : 'polite'}>
            {actionMessage.text}
          </Alert>
        </Container>
      )}
      {!isOnline && (
        <Container size={appContainerSize} fluid={appContainerFluid} py="sm" style={appContainerPaddingStyle}>
          <Alert color="orange" role="alert" aria-live="assertive">You appear to be offline. Some features are unavailable.</Alert>
        </Container>
      )}
      {error && (
        <Container size={appContainerSize} fluid={appContainerFluid} py="sm" style={appContainerPaddingStyle}>
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
              initialSettings={galleryBehaviorSettings}
              onSettingsSaved={(saved) => void mutateGalleryBehaviorSettings(mergeSettingsWithDefaults(saved), false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
      {isAdminPanelOpen ? (
        <Container size={appContainerSize} py="xl" style={appContainerPaddingStyle}>
          <ErrorBoundary onReset={closeAdminPanel}>
            <Suspense fallback={<Center py={120}><Loader /></Center>}>
              <AdminPanel
                apiClient={apiClient}
                onClose={closeAdminPanel}
                onCampaignsUpdated={() => void mutateCampaigns()}
                onNotify={handleAdminNotify}
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
          galleryBehaviorSettings={galleryBehaviorSettings ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
          isAdmin={isAdmin}
          isAuthenticated={isAuthenticated}
          onAccessModeChange={setLocalAccessMode}
          onEditCampaign={editModal.openForEdit}
          onArchiveCampaign={archiveModal.handleArchiveCampaign}
          onAddExternalMedia={externalMediaModal.handleAddExternalMedia}
          apiClient={apiClient}
        />
      )}

      <UnifiedCampaignModal modal={editModal} />

      <ArchiveCampaignModal
        opened={!!archiveModal.archiveModalCampaign}
        campaign={archiveModal.archiveModalCampaign}
        onClose={() => archiveModal.setArchiveModalCampaign(null)}
        onConfirm={archiveModal.confirmArchiveCampaign}
      />

      <AddExternalMediaModal
        opened={!!externalMediaModal.externalMediaCampaign}
        mediaType={externalMediaModal.externalMediaType}
        onMediaTypeChange={externalMediaModal.setExternalMediaType}
        url={externalMediaModal.externalMediaUrl}
        onUrlChange={externalMediaModal.setExternalMediaUrl}
        caption={externalMediaModal.externalMediaCaption}
        onCaptionChange={externalMediaModal.setExternalMediaCaption}
        thumbnail={externalMediaModal.externalMediaThumbnail}
        onThumbnailChange={externalMediaModal.setExternalMediaThumbnail}
        onClose={() => externalMediaModal.setExternalMediaCampaign(null)}
        onConfirm={externalMediaModal.confirmAddExternalMedia}
      />
    </div>
  );
}

interface AppProps {
  accessMode?: 'lock' | 'hide';
}

function App({ accessMode }: AppProps) {
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

