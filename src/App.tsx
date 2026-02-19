import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container, Alert, Loader, Center, Stack, Group, Text, Button, Modal } from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { CardGallery } from './components/Gallery/CardGallery';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { WpJwtProvider } from './services/auth/WpJwtProvider';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/Auth/LoginForm';
import { AuthBar } from './components/Auth/AuthBar';
import { EditCampaignModal } from './components/Campaign/EditCampaignModal';
import { ArchiveCampaignModal } from './components/Campaign/ArchiveCampaignModal';
import { AddExternalMediaModal } from './components/Campaign/AddExternalMediaModal';
import { ApiClient, ApiError } from './services/apiClient';
import type { AuthProvider as AuthProviderInterface } from './services/auth/AuthProvider';
import type { Campaign, Company, MediaItem, UploadResponse, GalleryBehaviorSettings } from './types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from './types';
import { getCompanyById } from './data/mockData';
import { FALLBACK_IMAGE_SRC } from './utils/fallback';
import { getErrorMessage } from './utils/getErrorMessage';
import { sortByOrder } from './utils/sortByOrder';
import { useXhrUpload } from './hooks/useXhrUpload';
import { useOnlineStatus } from './hooks/useOnlineStatus';
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
  mediaByCampaign?: Record<string, MediaItem[]>;
}

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
  const company = getCompanyById(key);
  if (company) {
    return company;
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

  // Modal state for edit campaign
  const [editModalCampaign, setEditModalCampaign] = useState<Campaign | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCoverImage, setEditCoverImage] = useState('');
  const [coverImageChanged, setCoverImageChanged] = useState(false);
  const [coverImageUploading, setCoverImageUploading] = useState(false);
  
  // Media management state for edit campaign modal
  const [editCampaignMedia, setEditCampaignMedia] = useState<MediaItem[]>([]);
  const [editMediaLoading, setEditMediaLoading] = useState(false);
  const [editMediaTab, setEditMediaTab] = useState<string | null>('details');
  const [addMediaUrl, setAddMediaUrl] = useState('');
  const [addMediaType, setAddMediaType] = useState<'video' | 'image'>('video');
  const [addMediaCaption, setAddMediaCaption] = useState('');
  const [addMediaLoading, setAddMediaLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { upload, progress: uploadProgress, resetProgress } = useXhrUpload();
  
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
  const [campaignLoadProgress, setCampaignLoadProgress] = useState<{ total: number; completed: number }>({
    total: 0,
    completed: 0,
  });

  useEffect(() => {
    if (!actionMessage) return;
    const timer = window.setTimeout(() => {
      setActionMessage(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    closeSignIn();
  };

  const handleUnauthorized = useCallback(() => {
    setActionMessage({ type: 'error', text: 'Session expired. Please sign in again.' });
    // Delay logout to allow the message to be seen
    setTimeout(() => {
      void (async () => {
        try {
          await logout();
        } catch {
          // no-op
        }
      })();
    }, 100);
  }, [logout]);

  const apiClient = useMemo(
    () => new ApiClient({ baseUrl: apiBaseUrl, authProvider, onUnauthorized: handleUnauthorized }),
    [apiBaseUrl, authProvider, handleUnauthorized],
  );

  // SWR fetcher for campaigns
  const fetchCampaigns = useCallback(async () => {
    setCampaignLoadProgress({ total: 0, completed: 0 });
    const response = await apiClient.get<ApiCampaignResponse>(
      '/wp-json/wp-super-gallery/v1/campaigns?include_media=1',
    );
    const items = response.items ?? [];
    const mediaByCampaign = response.mediaByCampaign ?? {};
    setCampaignLoadProgress({ total: items.length, completed: 0 });

    const mapped = items.map((item) => {
        let mediaItems: MediaItem[] = [];

        const canAccessCampaign =
          isAdmin ||
          item.visibility === 'public' ||
          permissions.some((permissionId) => String(permissionId) === String(item.id));

        if (canAccessCampaign) {
          mediaItems = mediaByCampaign[String(item.id)] ?? [];
        }

        const sortedMedia = sortByOrder(mediaItems);
        const representativeMedia = sortedMedia.find((media) => media.thumbnail || media.url);
        const representativeThumbnail = representativeMedia?.thumbnail || representativeMedia?.url;

        const thumbnail = item.coverImage || representativeThumbnail || item.thumbnail || FALLBACK_IMAGE_SRC;
        const coverImage = item.coverImage || representativeThumbnail || item.thumbnail || FALLBACK_IMAGE_SRC;
        const orderedMedia = sortedMedia
          .map((media) => ({
            ...media,
            thumbnail: media.thumbnail || (media.type === 'image' ? media.url : thumbnail),
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
      });

    setCampaignLoadProgress({ total: items.length, completed: items.length });

    return mapped;
  }, [apiClient, isAdmin, permissions]);

  const campaignsKey = isReady
    ? ['campaigns', user?.id ?? 'anon', isAuthenticated, isAdmin ? 'admin' : 'user']
    : null;
  const { data: campaigns, error: campaignsError, isLoading, mutate: mutateCampaigns } = useSWR(
    campaignsKey,
    fetchCampaigns,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // 5 seconds
    }
  );

  const error = campaignsError ? (campaignsError instanceof Error ? campaignsError.message : 'Failed to load campaigns') : null;

  const fetchGalleryBehaviorSettings = useCallback(async () => {
    const response = await apiClient.getSettings();
    const resolved = {
      videoViewportHeight:
        response.videoViewportHeight ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoViewportHeight,
      imageViewportHeight:
        response.imageViewportHeight ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageViewportHeight,
      thumbnailScrollSpeed:
        response.thumbnailScrollSpeed ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.thumbnailScrollSpeed,
      scrollAnimationStyle:
        response.scrollAnimationStyle ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationStyle,
      scrollAnimationDurationMs:
        response.scrollAnimationDurationMs ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationDurationMs,
      scrollAnimationEasing:
        response.scrollAnimationEasing ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollAnimationEasing,
      scrollTransitionType:
        response.scrollTransitionType ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.scrollTransitionType,
      imageBorderRadius:
        response.imageBorderRadius ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageBorderRadius,
      videoBorderRadius:
        response.videoBorderRadius ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoBorderRadius,
      transitionFadeEnabled:
        response.transitionFadeEnabled ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.transitionFadeEnabled,
      // P12-H
      navArrowPosition:
        response.navArrowPosition ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowPosition,
      navArrowSize:
        response.navArrowSize ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowSize,
      navArrowColor:
        response.navArrowColor ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowColor,
      navArrowBgColor:
        response.navArrowBgColor ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowBgColor,
      navArrowBorderWidth:
        response.navArrowBorderWidth ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowBorderWidth,
      navArrowHoverScale:
        response.navArrowHoverScale ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowHoverScale,
      navArrowAutoHideMs:
        response.navArrowAutoHideMs ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.navArrowAutoHideMs,
      // P12-I
      dotNavEnabled:
        response.dotNavEnabled ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavEnabled,
      dotNavPosition:
        response.dotNavPosition ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavPosition,
      dotNavSize:
        response.dotNavSize ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavSize,
      dotNavActiveColor:
        response.dotNavActiveColor ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavActiveColor,
      dotNavInactiveColor:
        response.dotNavInactiveColor ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavInactiveColor,
      dotNavShape:
        response.dotNavShape ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavShape,
      dotNavSpacing:
        response.dotNavSpacing ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavSpacing,
      dotNavActiveScale:
        response.dotNavActiveScale ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.dotNavActiveScale,
      // P12-J
      imageShadowPreset:
        response.imageShadowPreset ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageShadowPreset,
      videoShadowPreset:
        response.videoShadowPreset ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoShadowPreset,
      imageShadowCustom:
        response.imageShadowCustom ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.imageShadowCustom,
      videoShadowCustom:
        response.videoShadowCustom ?? DEFAULT_GALLERY_BEHAVIOR_SETTINGS.videoShadowCustom,
    } as GalleryBehaviorSettings;

    return resolved;
  }, [apiClient]);

  const { data: galleryBehaviorSettings, mutate: mutateGalleryBehaviorSettings } = useSWR<GalleryBehaviorSettings>(
    'gallery-behavior-settings',
    fetchGalleryBehaviorSettings,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      fallbackData: DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
    },
  );

  useEffect(() => {
    if (isOnline && isReady) {
      void mutateCampaigns();
    }
  }, [isOnline, isReady, mutateCampaigns]);

  const handleEditCampaign = async (campaign: Campaign) => {
    if (!isAdmin) {
      setActionMessage({ type: 'error', text: 'Admin permissions required.' });
      return;
    }
    setEditTitle(campaign.title);
    setEditDescription(campaign.description ?? '');
    setEditCoverImage(campaign.coverImage && campaign.coverImage !== FALLBACK_IMAGE_SRC ? campaign.coverImage : '');
    setCoverImageChanged(false);
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
      setEditCampaignMedia(sortByOrder(items));
    } catch {
      setEditCampaignMedia([]);
    } finally {
      setEditMediaLoading(false);
    }
  };

  const closeEditModal = () => {
    setEditModalCampaign(null);
    setEditCampaignMedia([]);
    setEditCoverImage('');
    setCoverImageChanged(false);
    setUploadFile(null);
    resetProgress();
  };

  const handleSelectCoverImage = (value: string) => {
    setEditCoverImage(value);
    setCoverImageChanged(true);
  };

  const handleUploadCoverImage = async (file: File) => {
    if (!editModalCampaign) return;

    if (!file.type.startsWith('image/')) {
      setActionMessage({ type: 'error', text: 'Please select an image file for campaign thumbnail.' });
      return;
    }

    setCoverImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.postForm<UploadResponse>(
        '/wp-json/wp-super-gallery/v1/media/upload',
        formData,
      );

      const coverUrl = response.thumbnail ?? response.url;
      setEditCoverImage(coverUrl);
      setCoverImageChanged(true);
      setActionMessage({ type: 'success', text: 'Campaign thumbnail uploaded.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: getErrorMessage(err, 'Failed to upload campaign thumbnail.') });
    } finally {
      setCoverImageUploading(false);
    }
  };

  const handleRemoveMedia = async (mediaItem: MediaItem) => {
    if (!editModalCampaign) return;
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}/media/${mediaItem.id}`);
      setEditCampaignMedia((prev) => prev.filter((m) => m.id !== mediaItem.id));
      setActionMessage({ type: 'success', text: 'Media removed from campaign.' });
      await mutateCampaigns();
    } catch (err) {
      setActionMessage({ type: 'error', text: getErrorMessage(err, 'Failed to remove media.') });
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
      await mutateCampaigns();
    } catch (err) {
      setActionMessage({ type: 'error', text: getErrorMessage(err, 'Failed to add media.') });
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
      await mutateCampaigns();
    } catch (err) {
      setActionMessage({ type: 'error', text: getErrorMessage(err, 'Failed to add media.') });
    } finally {
      setAddMediaLoading(false);
    }
  };

  const handleUploadMediaInEdit = async (file: File) => {
    if (!editModalCampaign || !file) return;

    // Client-side validation
    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg',
    ];
    const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      setActionMessage({ type: 'error', text: 'File type not allowed. Accepted: JPEG, PNG, GIF, WebP, MP4, WebM, OGG.' });
      return;
    }
    if (file.size > MAX_SIZE) {
      setActionMessage({ type: 'error', text: `File too large (${Math.round(file.size / 1024 / 1024)} MB). Maximum size is 50 MB.` });
      return;
    }

    setUploadFile(file);
    
    try {
      // Step 1: Upload file to WordPress media library
      const authHeaders = await apiClient.getAuthHeaders();
      const response = await upload<UploadResponse>({
        url: `${apiClient.getBaseUrl()}/wp-json/wp-super-gallery/v1/media/upload`,
        file,
        headers: authHeaders,
      });

      // Step 2: Link the uploaded file to the campaign
      const mediaType = file.type.startsWith('image') ? 'image' : 'video';
      const order = editCampaignMedia.length + 1;
      const newMedia = await apiClient.post<MediaItem>(
        `/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}/media`,
        {
          type: mediaType,
          source: 'upload',
          url: response.url,
          thumbnail: response.thumbnail ?? response.url,
          attachmentId: response.attachmentId,
          order,
        },
      );

      setEditCampaignMedia((prev) => [...prev, newMedia]);
      setActionMessage({ type: 'success', text: 'File uploaded and added to campaign.' });
      await mutateCampaigns();
    } catch (err) {
      setActionMessage({ type: 'error', text: getErrorMessage(err, 'Upload failed.') });
    } finally {
      setUploadFile(null);
      resetProgress();
    }
  };

  const confirmEditCampaign = async () => {
    if (!editModalCampaign) return;

    try {
      const payload: { title: string; description: string; coverImage?: string } = {
        title: editTitle,
        description: editDescription,
      };

      if (coverImageChanged) {
        payload.coverImage = editCoverImage || '';
      }

      await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}`, payload);

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
        <>
          <Container size="xl" py="sm">
            <Alert color="blue" variant="light" role="status" aria-live="polite">
              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <Text size="sm">Sign in to access private campaigns.</Text>
                <Button size="xs" onClick={openSignIn}>
                  Sign in
                </Button>
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
          onOpenAdminPanel={openAdminPanel}
          onOpenSettings={openSettings}
          onLogout={() => void logout()}
        />
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
      {!isOnline && (
        <Container size="xl" py="sm">
          <Alert color="orange" role="alert" aria-live="assertive">
            You appear to be offline. Some features are unavailable.
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
      {isSettingsOpen && (
        <ErrorBoundary onReset={closeSettings}>
          <Suspense fallback={null}>
            <SettingsPanel
              opened={isSettingsOpen}
              apiClient={apiClient}
              onClose={closeSettings}
              onNotify={handleAdminNotify}
              initialSettings={galleryBehaviorSettings}
              onSettingsSaved={(saved) => {
                void mutateGalleryBehaviorSettings(
                  {
                    videoViewportHeight: saved.videoViewportHeight,
                    imageViewportHeight: saved.imageViewportHeight,
                    thumbnailScrollSpeed: saved.thumbnailScrollSpeed,
                    scrollAnimationStyle: saved.scrollAnimationStyle,
                    scrollAnimationDurationMs: saved.scrollAnimationDurationMs,
                    scrollAnimationEasing: saved.scrollAnimationEasing,
                    scrollTransitionType: saved.scrollTransitionType,
                    imageBorderRadius: saved.imageBorderRadius,
                    videoBorderRadius: saved.videoBorderRadius,
                    transitionFadeEnabled: saved.transitionFadeEnabled,
                    // P12-H
                    navArrowPosition: saved.navArrowPosition,
                    navArrowSize: saved.navArrowSize,
                    navArrowColor: saved.navArrowColor,
                    navArrowBgColor: saved.navArrowBgColor,
                    navArrowBorderWidth: saved.navArrowBorderWidth,
                    navArrowHoverScale: saved.navArrowHoverScale,
                    navArrowAutoHideMs: saved.navArrowAutoHideMs,
                    // P12-I
                    dotNavEnabled: saved.dotNavEnabled,
                    dotNavPosition: saved.dotNavPosition,
                    dotNavSize: saved.dotNavSize,
                    dotNavActiveColor: saved.dotNavActiveColor,
                    dotNavInactiveColor: saved.dotNavInactiveColor,
                    dotNavShape: saved.dotNavShape,
                    dotNavSpacing: saved.dotNavSpacing,
                    dotNavActiveScale: saved.dotNavActiveScale,
                    // P12-J
                    imageShadowPreset: saved.imageShadowPreset,
                    videoShadowPreset: saved.videoShadowPreset,
                    imageShadowCustom: saved.imageShadowCustom,
                    videoShadowCustom: saved.videoShadowCustom,
                  },
                  false,
                );
              }}
            />
          </Suspense>
        </ErrorBoundary>
      )}
      {isAdminPanelOpen ? (
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
            <Stack gap={2} align="center">
              <Container size="sm" px={0}>
                <Alert color="blue" variant="light" role="status" aria-live="polite">
                  Loading campaigns...
                  {campaignLoadProgress.total > 0
                    ? ` (${campaignLoadProgress.completed}/${campaignLoadProgress.total} processed)`
                    : ''}
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
          onEditCampaign={handleEditCampaign}
          onArchiveCampaign={handleArchiveCampaign}
          onAddExternalMedia={handleAddExternalMedia}
        />
      )}

      {/* Edit Campaign Modal */}
      <EditCampaignModal
        opened={!!editModalCampaign}
        campaign={editModalCampaign}
        editMediaTab={editMediaTab}
        onEditMediaTabChange={setEditMediaTab}
        editTitle={editTitle}
        onEditTitleChange={setEditTitle}
        editDescription={editDescription}
        onEditDescriptionChange={setEditDescription}
        editCoverImage={editCoverImage}
        onEditCoverImageChange={handleSelectCoverImage}
        onUploadCoverImage={handleUploadCoverImage}
        coverImageUploading={coverImageUploading}
        onClose={closeEditModal}
        onConfirmEdit={confirmEditCampaign}
        editMediaLoading={editMediaLoading}
        editCampaignMedia={editCampaignMedia}
        onRemoveMedia={handleRemoveMedia}
        libraryMedia={libraryMedia}
        libraryLoading={libraryLoading}
        librarySearch={librarySearch}
        onLibrarySearchChange={setLibrarySearch}
        onLoadLibrary={loadLibraryMedia}
        onAddFromLibrary={handleAddFromLibrary}
        uploadFile={uploadFile}
        uploadProgress={uploadProgress}
        onUploadFile={handleUploadMediaInEdit}
        addMediaType={addMediaType}
        onAddMediaTypeChange={setAddMediaType}
        addMediaUrl={addMediaUrl}
        onAddMediaUrlChange={setAddMediaUrl}
        addMediaCaption={addMediaCaption}
        onAddMediaCaptionChange={setAddMediaCaption}
        addMediaLoading={addMediaLoading}
        onAddExternalMedia={handleAddExternalMediaInEdit}
      />

      {/* Archive Confirmation Modal */}
      <ArchiveCampaignModal
        opened={!!archiveModalCampaign}
        campaign={archiveModalCampaign}
        onClose={() => setArchiveModalCampaign(null)}
        onConfirm={confirmArchiveCampaign}
      />

      {/* Add External Media Modal */}
      <AddExternalMediaModal
        opened={!!externalMediaCampaign}
        mediaType={externalMediaType}
        onMediaTypeChange={setExternalMediaType}
        url={externalMediaUrl}
        onUrlChange={setExternalMediaUrl}
        caption={externalMediaCaption}
        onCaptionChange={setExternalMediaCaption}
        thumbnail={externalMediaThumbnail}
        onThumbnailChange={setExternalMediaThumbnail}
        onClose={() => setExternalMediaCampaign(null)}
        onConfirm={confirmAddExternalMedia}
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
