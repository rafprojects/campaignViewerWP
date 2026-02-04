import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container, Group, Button, Alert, Loader, Center, Stack, ActionIcon, Tooltip, Modal, TextInput, Textarea, Select, Card, Image, Text, SimpleGrid, Badge, FileButton, Tabs, Progress } from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { IconSettings, IconTrash, IconPlus, IconUpload, IconLink, IconPhoto } from '@tabler/icons-react';
import { CardGallery } from './components/Gallery/CardGallery';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { WpJwtProvider } from './services/auth/WpJwtProvider';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/Auth/LoginForm';
import { ApiClient, ApiError } from './services/apiClient';
import type { AuthProvider as AuthProviderInterface } from './services/auth/AuthProvider';
import type { Campaign, Company, MediaItem } from './types';
import useSWR from 'swr';

// Lazy load admin-only components for better initial bundle size
const AdminPanel = lazy(() => import('./components/Admin/AdminPanel').then(m => ({ default: m.AdminPanel })));
const SettingsPanel = lazy(() => import('./components/Admin/SettingsPanel').then(m => ({ default: m.SettingsPanel })));

const getAuthProvider = (apiBaseUrl: string) => {
  if (window.__WPSG_AUTH_PROVIDER__ === 'wp-jwt') {
    return new WpJwtProvider({ apiBaseUrl });
  }
  return undefined;
};

type ApiCampaign = Omit<Campaign, 'company' | 'videos' | 'images'> & {
  companyId: string;
};

interface ApiCampaignResponse {
  items: ApiCampaign[];
}

const FALLBACK_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="%23f0f0f0"/><stop offset="1" stop-color="%23d9d9d9"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="24" fill="%23999">WP Super Gallery</text></svg>';


const COMPANY_THEME: Record<string, Pick<Company, 'name' | 'logo' | 'brandColor'>> = {
  nike: { name: 'Nike', logo: '🏃', brandColor: '#FF6B00' },
  adidas: { name: 'Adidas', logo: '⚽', brandColor: '#000000' },
  apple: { name: 'Apple', logo: '🍎', brandColor: '#555555' },
  spotify: { name: 'Spotify', logo: '🎵', brandColor: '#1DB954' },
  netflix: { name: 'Netflix', logo: '🎬', brandColor: '#E50914' },
  tesla: { name: 'Tesla', logo: '🚗', brandColor: '#CC0000' },
};

const titleCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const stringToColor = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
};

const buildCompany = (companyId: string): Company => {
  const key = companyId?.toLowerCase() || 'unknown';
  const theme = COMPANY_THEME[key];
  if (theme) {
    return { id: key, ...theme };
  }
  return {
    id: key,
    name: key === 'unknown' ? 'Unknown' : titleCase(companyId),
    logo: '🏷️',
    brandColor: stringToColor(key),
  };
};

const ACCESS_MODE_STORAGE_KEY = 'wpsg_access_mode';

function AppContent({
  hasProvider,
  apiBaseUrl,
  authProvider,
  accessMode,
}: {
  hasProvider: boolean;
  apiBaseUrl: string;
  authProvider?: AuthProviderInterface;
  accessMode: 'lock' | 'hide';
}) {
  const { permissions, isAuthenticated, isReady, login, logout, user } = useAuth();
  const [actionMessage, setActionMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isAdminPanelOpen, { open: openAdminPanel, close: closeAdminPanel }] = useDisclosure(false);
  const [isSettingsOpen, { open: openSettings, close: closeSettings }] = useDisclosure(false);
  const [localAccessMode, setLocalAccessMode] = useLocalStorage<'lock' | 'hide'>({
    key: ACCESS_MODE_STORAGE_KEY,
    defaultValue: accessMode,
    getInitialValueInEffect: false,
    deserialize: (value) => (value === 'hide' || value === 'lock' ? value : accessMode),
  });
  const isAdmin = user?.role === 'admin';

  // Modal state for edit campaign
  const [editModalCampaign, setEditModalCampaign] = useState<Campaign | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // Media management state for edit campaign modal
  const [editCampaignMedia, setEditCampaignMedia] = useState<MediaItem[]>([]);
  const [editMediaLoading, setEditMediaLoading] = useState(false);
  const [editMediaTab, setEditMediaTab] = useState<string | null>('details');
  const [addMediaUrl, setAddMediaUrl] = useState('');
  const [addMediaType, setAddMediaType] = useState<'video' | 'image'>('video');
  const [addMediaCaption, setAddMediaCaption] = useState('');
  const [addMediaLoading, setAddMediaLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  // Library media state for picking existing media
  const [libraryMedia, setLibraryMedia] = useState<MediaItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const libraryAbortControllerRef = useRef<AbortController | null>(null);

  // Modal state for archive confirmation
  const [archiveModalCampaign, setArchiveModalCampaign] = useState<Campaign | null>(null);

  // Modal state for add external media
  const [externalMediaCampaign, setExternalMediaCampaign] = useState<Campaign | null>(null);
  const [externalMediaType, setExternalMediaType] = useState<'video' | 'image'>('video');
  const [externalMediaUrl, setExternalMediaUrl] = useState('');
  const [externalMediaCaption, setExternalMediaCaption] = useState('');
  const [externalMediaThumbnail, setExternalMediaThumbnail] = useState('');

  useEffect(() => {
    if (!actionMessage) return;
    const timer = window.setTimeout(() => {
      setActionMessage(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
  };

  const handleUnauthorized = useCallback(() => {
    setActionMessage({ type: 'error', text: 'Session expired. Please sign in again.' });
    // Delay logout to allow the message to be seen
    setTimeout(() => {
      void logout();
    }, 100);
  }, [logout]);

  const apiClient = useMemo(
    () => new ApiClient({ baseUrl: apiBaseUrl, authProvider, onUnauthorized: handleUnauthorized }),
    [apiBaseUrl, authProvider, handleUnauthorized],
  );

  // SWR fetcher for campaigns
  const fetchCampaigns = useCallback(async () => {
    const response = await apiClient.get<ApiCampaignResponse>(
      '/wp-json/wp-super-gallery/v1/campaigns',
    );
    const items = response.items ?? [];

    const mapped = await Promise.all(
      items.map(async (item) => {
        let mediaItems: MediaItem[] = [];
        if (isAuthenticated) {
          try {
            const mediaResponse = await apiClient.get<
              MediaItem[] | { items: MediaItem[]; meta?: { typesUpdated?: number } }
            >(`/wp-json/wp-super-gallery/v1/campaigns/${item.id}/media`);
            mediaItems = Array.isArray(mediaResponse)
              ? mediaResponse
              : (mediaResponse.items ?? []);
          } catch {
            mediaItems = [];
          }
        }

        const thumbnail = item.thumbnail || item.coverImage || FALLBACK_IMAGE;
        const coverImage = item.coverImage || item.thumbnail || FALLBACK_IMAGE;
        const orderedMedia = [...mediaItems]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((media) => ({
            ...media,
            thumbnail: media.thumbnail || thumbnail,
            caption: media.caption || 'Campaign media',
          }));
        const videos = orderedMedia.filter((media) => media.type === 'video');
        const images = orderedMedia.filter((media) => media.type === 'image');
        const company = buildCompany(item.companyId);

        return {
          ...item,
          companyId: item.companyId,
          company,
          thumbnail,
          coverImage,
          videos,
          images,
        } as Campaign;
      }),
    );

    return mapped;
  }, [apiClient, isAuthenticated]);

  const { data: campaigns, error: campaignsError, isLoading, mutate: mutateCampaigns } = useSWR(
    isReady ? '/campaigns' : null,
    fetchCampaigns,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // 5 seconds
    }
  );

  const error = campaignsError ? (campaignsError instanceof Error ? campaignsError.message : 'Failed to load campaigns') : null;

  const handleEditCampaign = async (campaign: Campaign) => {
    if (!isAdmin) {
      setActionMessage({ type: 'error', text: 'Admin permissions required.' });
      return;
    }
    setEditTitle(campaign.title);
    setEditDescription(campaign.description ?? '');
    setEditModalCampaign(campaign);
    setEditMediaTab('details');
    setAddMediaUrl('');
    setAddMediaType('video');
    setAddMediaCaption('');
    
    // Load campaign media
    setEditMediaLoading(true);
    try {
      const response = await apiClient.get<MediaItem[] | { items: MediaItem[] }>(
        `/wp-json/wp-super-gallery/v1/campaigns/${campaign.id}/media`
      );
      const items = Array.isArray(response) ? response : (response.items ?? []);
      setEditCampaignMedia(items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    } catch {
      setEditCampaignMedia([]);
    } finally {
      setEditMediaLoading(false);
    }
  };

  const closeEditModal = () => {
    setEditModalCampaign(null);
    setEditCampaignMedia([]);
    setUploadFile(null);
    setUploadProgress(null);
  };

  const handleRemoveMedia = async (mediaItem: MediaItem) => {
    if (!editModalCampaign) return;
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}/media/${mediaItem.id}`);
      setEditCampaignMedia((prev) => prev.filter((m) => m.id !== mediaItem.id));
      setActionMessage({ type: 'success', text: 'Media removed from campaign.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to remove media.' });
    }
  };

  const loadLibraryMedia = async (search?: string) => {
    // Cancel previous request if still in flight
    if (libraryAbortControllerRef.current) {
      libraryAbortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    libraryAbortControllerRef.current = abortController;

    setLibraryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('per_page', '50');
      if (search) params.set('search', search);
      
      const response = await apiClient.get<{ items: MediaItem[]; total: number }>(
        `/wp-json/wp-super-gallery/v1/media/library?${params.toString()}`
      );
      
      // Only update state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setLibraryMedia(response.items ?? []);
      }
    } catch (err) {
      // Ignore abort errors, only handle other errors
      if (err instanceof Error && err.name !== 'AbortError') {
        setLibraryMedia([]);
      }
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setLibraryLoading(false);
        libraryAbortControllerRef.current = null;
      }
    }
  };

  const handleAddFromLibrary = async (libraryItem: MediaItem) => {
    if (!editModalCampaign) return;
    
    // Check if already added to this campaign
    if (editCampaignMedia.some((m) => m.id === libraryItem.id || m.url === libraryItem.url)) {
      setActionMessage({ type: 'error', text: 'This media is already in the campaign.' });
      return;
    }
    
    try {
      const order = editCampaignMedia.length + 1;
      const response = await apiClient.post<MediaItem>(`/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}/media`, {
        type: libraryItem.type,
        source: 'upload',
        url: libraryItem.url,
        thumbnail: libraryItem.thumbnail,
        caption: libraryItem.caption,
        attachmentId: parseInt(libraryItem.id, 10),
        order,
      });
      setEditCampaignMedia((prev) => [...prev, response]);
      setActionMessage({ type: 'success', text: 'Media added to campaign.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add media.' });
    }
  };

  const handleAddExternalMediaInEdit = async () => {
    if (!editModalCampaign || !addMediaUrl) return;
    setAddMediaLoading(true);
    try {
      const order = editCampaignMedia.length + 1;
      const response = await apiClient.post<MediaItem>(`/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}/media`, {
        type: addMediaType,
        source: 'external',
        url: addMediaUrl,
        caption: addMediaCaption || undefined,
        order,
      });
      setEditCampaignMedia((prev) => [...prev, response]);
      setAddMediaUrl('');
      setAddMediaCaption('');
      setActionMessage({ type: 'success', text: 'Media added.' });
      setEditMediaTab('list');
    } catch (err) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add media.' });
    } finally {
      setAddMediaLoading(false);
    }
  };

  const handleUploadMediaInEdit = async (file: File) => {
    if (!editModalCampaign || !file) return;
    setUploadFile(file);
    setUploadProgress(0);
    
    try {
      // Get auth token before starting XHR
      const token = authProvider ? await authProvider.getAccessToken() : null;
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('campaignId', editModalCampaign.id);

      const xhr = new XMLHttpRequest();
      
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              const mediaType = file.type.startsWith('image') ? 'image' : 'video';
              const newMedia: MediaItem = {
                id: response.attachmentId || String(Date.now()),
                type: mediaType,
                source: 'upload',
                url: response.url,
                thumbnail: response.thumbnail,
                order: editCampaignMedia.length + 1,
              };
              setEditCampaignMedia((prev) => [...prev, newMedia]);
              setActionMessage({ type: 'success', text: 'File uploaded.' });
              resolve();
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });
        
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        
        xhr.open('POST', `${apiBaseUrl}/wp-json/wp-super-gallery/v1/media/upload`);
        
        // Add auth header if available
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        
        xhr.send(formData);
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed.' });
    } finally {
      setUploadFile(null);
      setUploadProgress(null);
    }
  };

  const confirmEditCampaign = async () => {
    if (!editModalCampaign) return;

    try {
      await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}`,
        {
          title: editTitle,
          description: editDescription,
        },
      );

      setActionMessage({ type: 'success', text: 'Campaign updated.' });
      setEditModalCampaign(null);
      await mutateCampaigns();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setActionMessage({ type: 'error', text: 'Admin permissions required.' });
      } else {
        setActionMessage({ type: 'error', text: 'Failed to update campaign.' });
      }
    }
  };

  const handleArchiveCampaign = (campaign: Campaign) => {
    if (!isAdmin) {
      setActionMessage({ type: 'error', text: 'Admin permissions required.' });
      return;
    }
    setArchiveModalCampaign(campaign);
  };

  const confirmArchiveCampaign = async () => {
    if (!archiveModalCampaign) return;

    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${archiveModalCampaign.id}/archive`, {});
      setActionMessage({ type: 'success', text: 'Campaign archived.' });
      setArchiveModalCampaign(null);
      await mutateCampaigns();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setActionMessage({ type: 'error', text: 'Admin permissions required.' });
      } else {
        setActionMessage({ type: 'error', text: 'Failed to archive campaign.' });
      }
    }
  };

  const handleAddExternalMedia = (campaign: Campaign) => {
    if (!isAdmin) {
      setActionMessage({ type: 'error', text: 'Admin permissions required.' });
      return;
    }
    setExternalMediaType('video');
    setExternalMediaUrl('');
    setExternalMediaCaption('');
    setExternalMediaThumbnail('');
    setExternalMediaCampaign(campaign);
  };

  const confirmAddExternalMedia = async () => {
    if (!externalMediaCampaign || !externalMediaUrl) return;

    const order = externalMediaCampaign.videos.length + externalMediaCampaign.images.length + 1;

    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${externalMediaCampaign.id}/media`, {
        type: externalMediaType,
        source: 'external',
        url: externalMediaUrl,
        caption: externalMediaCaption || undefined,
        thumbnail: externalMediaThumbnail || undefined,
        order,
      });

      setActionMessage({ type: 'success', text: 'Media added.' });
      setExternalMediaCampaign(null);
      await mutateCampaigns();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setActionMessage({ type: 'error', text: 'Admin permissions required.' });
      } else {
        setActionMessage({ type: 'error', text: 'Failed to add media.' });
      }
    }
  };

  const handleAdminNotify = useCallback((message: { type: 'error' | 'success'; text: string }) => {
    setActionMessage(message);
  }, []);

  return (
    <div className="wp-super-gallery">
      {hasProvider && !isAuthenticated && isReady && (
        <LoginForm onSubmit={handleLogin} />
      )}
      {isAuthenticated && user && (
        <Container size="xl" py="sm">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm">Signed in as {user.email}</Text>
            <Group gap="sm" wrap="wrap">
              {isAdmin && (
                <>
                  <Button
                    variant="default"
                    onClick={openAdminPanel}
                    className="wpsg-admin-btn"
                    size="sm"
                  >
                    Admin Panel
                  </Button>
                  <Tooltip label="Settings">
                    <ActionIcon
                      variant="default"
                      size="lg"
                      className="wpsg-admin-btn"
                      onClick={openSettings}
                      aria-label="Settings"
                    >
                      <IconSettings size={20} />
                    </ActionIcon>
                  </Tooltip>
                </>
              )}
              <Button
                variant="subtle"
                onClick={() => void logout()}
                size="sm"
              >
                Sign out
              </Button>
            </Group>
          </Group>
        </Container>
      )}
      {actionMessage && (
        <Container size="xl" py="sm">
          <Alert
            color={actionMessage.type === 'error' ? 'red' : 'green'}
            role={actionMessage.type === 'error' ? 'alert' : 'status'}
            aria-live={actionMessage.type === 'error' ? 'assertive' : 'polite'}
          >
            {actionMessage.text}
          </Alert>
        </Container>
      )}
      {error && (
        <Container size="xl" py="sm">
          <Alert color="red" role="alert" aria-live="assertive">
            {error}
          </Alert>
        </Container>
      )}
      {isSettingsOpen ? (
        <Container size="xl" py="xl">
          <ErrorBoundary onReset={closeSettings}>
            <Suspense fallback={<Center py={120}><Loader /></Center>}>
              <SettingsPanel
                apiClient={apiClient}
                onClose={closeSettings}
                onNotify={handleAdminNotify}
              />
            </Suspense>
          </ErrorBoundary>
        </Container>
      ) : isAdminPanelOpen ? (
        <Container size="xl" py="xl">
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
          </Stack>
        </Center>
      ) : (
        <CardGallery
          campaigns={campaigns || []}
          userPermissions={permissions}
          accessMode={localAccessMode}
          isAdmin={isAdmin}
          onAccessModeChange={setLocalAccessMode}
          onEditCampaign={handleEditCampaign}
          onArchiveCampaign={handleArchiveCampaign}
          onAddExternalMedia={handleAddExternalMedia}
        />
      )}

      {/* Edit Campaign Modal */}
      <Modal
        opened={!!editModalCampaign}
        onClose={closeEditModal}
        title={`Edit Campaign: ${editModalCampaign?.title ?? ''}`}
        size="xl"
        zIndex={300}
      >
        <Tabs value={editMediaTab} onChange={setEditMediaTab} aria-label="Edit campaign tabs">
          <Tabs.List>
            <Tabs.Tab value="details">Details</Tabs.Tab>
            <Tabs.Tab value="list">
              Media {editCampaignMedia.length > 0 && <Badge size="sm" ml={4}>{editCampaignMedia.length}</Badge>}
            </Tabs.Tab>
            <Tabs.Tab value="add">Add Media</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="details" pt="md">
            <Stack gap="md">
              <TextInput
                label="Title"
                placeholder="Campaign title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.currentTarget.value)}
              />
              <Textarea
                label="Description"
                placeholder="Campaign description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.currentTarget.value)}
                minRows={3}
              />
              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={closeEditModal}>
                  Cancel
                </Button>
                <Button onClick={() => void confirmEditCampaign()}>
                  Save Changes
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="list" pt="md">
            {editMediaLoading ? (
              <Center py="xl"><Loader /></Center>
            ) : editCampaignMedia.length === 0 ? (
              <Stack align="center" py="xl">
                <Text c="dimmed">No media attached to this campaign.</Text>
                <Button leftSection={<IconPlus size={16} />} onClick={() => setEditMediaTab('add')}>
                  Add Media
                </Button>
              </Stack>
            ) : (
              <Stack gap="md">
                <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                  {editCampaignMedia.map((media) => (
                    <Card
                      key={media.id}
                      shadow="sm"
                      padding="xs"
                      radius="md"
                      withBorder
                      role="group"
                      aria-label={`Media item ${media.caption || media.url}`}
                    >
                      <Card.Section>
                        <Image
                          src={media.thumbnail || media.url}
                          height={100}
                          alt={media.caption || 'Media'}
                          fallbackSrc="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect fill='%23ddd' width='100%' height='100%'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' fill='%23999'>?</text></svg>"
                        />
                      </Card.Section>
                      <Group justify="space-between" mt="xs">
                        <Badge size="xs" variant="light">
                          {media.type}
                        </Badge>
                        <Tooltip label="Remove from campaign">
                          <ActionIcon
                            color="red"
                            variant="light"
                            size="sm"
                            onClick={() => void handleRemoveMedia(media)}
                            aria-label="Remove from campaign"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                      {media.caption && (
                        <Text size="xs" c="dimmed" lineClamp={1} mt={4}>
                          {media.caption}
                        </Text>
                      )}
                    </Card>
                  ))}
                </SimpleGrid>
                <Group justify="flex-end">
                  <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setEditMediaTab('add')}>
                    Add More
                  </Button>
                </Group>
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="add" pt="md">
            <Stack gap="lg">
              {/* Pick from Library Section */}
              <Card withBorder>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Group>
                      <IconPhoto size={20} />
                      <Text fw={500}>Pick from Media Library</Text>
                    </Group>
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() => void loadLibraryMedia(librarySearch)}
                      loading={libraryLoading}
                    >
                      {libraryMedia.length > 0 ? 'Refresh' : 'Load Library'}
                    </Button>
                  </Group>
                  <TextInput
                    placeholder="Search media..."
                    aria-label="Search media library"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void loadLibraryMedia(librarySearch)}
                  />
                  {libraryLoading ? (
                    <Center py="md"><Loader size="sm" /></Center>
                  ) : libraryMedia.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      Click &quot;Load Library&quot; to browse existing media
                    </Text>
                  ) : (
                    <SimpleGrid cols={{ base: 3, sm: 4, md: 5 }} spacing="xs">
                      {libraryMedia.map((item) => {
                        const isAlreadyAdded = editCampaignMedia.some(
                          (m) => m.id === item.id || m.url === item.url
                        );
                        return (
                          <Card
                            key={item.id}
                            shadow="xs"
                            padding={0}
                            radius="sm"
                            withBorder
                            style={{
                              opacity: isAlreadyAdded ? 0.5 : 1,
                              cursor: isAlreadyAdded ? 'not-allowed' : 'pointer',
                            }}
                            onClick={() => !isAlreadyAdded && void handleAddFromLibrary(item)}
                            role="button"
                            tabIndex={isAlreadyAdded ? -1 : 0}
                            aria-disabled={isAlreadyAdded}
                            aria-label={
                              isAlreadyAdded
                                ? 'Media already added to campaign'
                                : `Add ${item.type} media: ${item.caption || item.url}`
                            }
                            onKeyDown={(event) => {
                              if (isAlreadyAdded) return;
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                void handleAddFromLibrary(item);
                              }
                            }}
                          >
                            <Image
                              src={item.thumbnail || item.url}
                              height={60}
                              alt={item.caption || 'Media'}
                              fallbackSrc="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><rect fill='%23ddd' width='100%' height='100%'/></svg>"
                            />
                            <Stack gap={2} p={4}>
                              <Badge size="xs" variant="light">
                                {item.type}
                              </Badge>
                              {isAlreadyAdded && (
                                <Text size="xs" c="green">Added</Text>
                              )}
                            </Stack>
                          </Card>
                        );
                      })}
                    </SimpleGrid>
                  )}
                </Stack>
              </Card>

              {/* Upload Section */}
              <Card withBorder>
                <Stack gap="sm">
                  <Group>
                    <IconUpload size={20} />
                    <Text fw={500}>Upload New File</Text>
                  </Group>
                  <FileButton
                    onChange={(file) => file && void handleUploadMediaInEdit(file)}
                    accept="image/*,video/*"
                  >
                    {(props) => (
                      <Button {...props} variant="light" fullWidth disabled={!!uploadFile}>
                        {uploadFile ? 'Uploading...' : 'Choose file to upload'}
                      </Button>
                    )}
                  </FileButton>
                  {uploadProgress !== null && (
                    <Progress value={uploadProgress} size="sm" />
                  )}
                </Stack>
              </Card>

              {/* External URL Section */}
              <Card withBorder>
                <Stack gap="sm">
                  <Group>
                    <IconLink size={20} />
                    <Text fw={500}>Add External URL</Text>
                  </Group>
                  <Select
                    label="Type"
                    data={[
                      { value: 'video', label: 'Video' },
                      { value: 'image', label: 'Image' },
                    ]}
                    value={addMediaType}
                    onChange={(v) => setAddMediaType((v as 'video' | 'image') ?? 'video')}
                  />
                  <TextInput
                    label="URL"
                    placeholder="https://youtube.com/watch?v=... or image URL"
                    value={addMediaUrl}
                    onChange={(e) => setAddMediaUrl(e.currentTarget.value)}
                  />
                  <TextInput
                    label="Caption (optional)"
                    placeholder="Describe this media"
                    value={addMediaCaption}
                    onChange={(e) => setAddMediaCaption(e.currentTarget.value)}
                  />
                  <Button
                    onClick={() => void handleAddExternalMediaInEdit()}
                    disabled={!addMediaUrl}
                    loading={addMediaLoading}
                  >
                    Add External Media
                  </Button>
                </Stack>
              </Card>

              <Button variant="subtle" onClick={() => setEditMediaTab('list')}>
                ← Back to Media List
              </Button>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal
        opened={!!archiveModalCampaign}
        onClose={() => setArchiveModalCampaign(null)}
        title="Archive Campaign"
        zIndex={300}
        padding="md"
      >
        <Stack gap="md">
          <p>Are you sure you want to archive &quot;{archiveModalCampaign?.title}&quot;? This action will mark it as archived.</p>
          <Group justify="flex-end" wrap="wrap" gap="sm">
            <Button variant="default" onClick={() => setArchiveModalCampaign(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => void confirmArchiveCampaign()}
              aria-label={`Archive campaign ${archiveModalCampaign?.title ?? ''}`.trim()}
            >
              Archive
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add External Media Modal */}
      <Modal
        opened={!!externalMediaCampaign}
        onClose={() => setExternalMediaCampaign(null)}
        title="Add External Media"
        size="md"
        zIndex={300}
        padding="md"
      >
        <Stack gap="md">
          <Select
            label="Media Type"
            data={[
              { value: 'video', label: 'Video' },
              { value: 'image', label: 'Image' },
            ]}
            value={externalMediaType}
            onChange={(v) => setExternalMediaType((v as 'video' | 'image') ?? 'video')}
          />
          <TextInput
            label="URL"
            placeholder="https://..."
            description="YouTube, Vimeo, or direct media URL"
            value={externalMediaUrl}
            onChange={(e) => setExternalMediaUrl(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Caption"
            placeholder="Optional caption"
            value={externalMediaCaption}
            onChange={(e) => setExternalMediaCaption(e.currentTarget.value)}
          />
          <TextInput
            label="Thumbnail URL"
            placeholder="Optional thumbnail URL"
            value={externalMediaThumbnail}
            onChange={(e) => setExternalMediaThumbnail(e.currentTarget.value)}
          />
          <Group justify="flex-end" mt="md" wrap="wrap" gap="sm">
            <Button variant="default" onClick={() => setExternalMediaCampaign(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmAddExternalMedia()} disabled={!externalMediaUrl}>
              Add Media
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

interface AppProps {
  accessMode?: 'lock' | 'hide';
}

function App({ accessMode }: AppProps) {
  const apiBaseUrl = window.__WPSG_API_BASE__ ?? window.location.origin;
  const provider = useMemo(() => getAuthProvider(apiBaseUrl), [apiBaseUrl]);
  const hasProvider = Boolean(provider);
  const fallbackPermissions = hasProvider ? [] : [];
  const resolvedAccessMode = accessMode ?? window.__WPSG_ACCESS_MODE__ ?? 'lock';

  return (
    <AuthProvider provider={provider} fallbackPermissions={fallbackPermissions}>
      <AppContent
        hasProvider={hasProvider}
        apiBaseUrl={apiBaseUrl}
        authProvider={provider}
        accessMode={resolvedAccessMode}
      />
    </AuthProvider>
  );
}

export default App;
