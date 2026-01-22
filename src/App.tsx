import { useEffect, useMemo, useState } from 'react';
import { CardGallery } from './components/Gallery/CardGallery';
import { AuthProvider } from './contexts/AuthContext';
import { WpJwtProvider } from './services/auth/WpJwtProvider';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/Auth/LoginForm';
import { ApiClient, ApiError } from './services/apiClient';
import type { AuthProvider as AuthProviderInterface } from './services/auth/AuthProvider';
import type { Campaign, Company, MediaItem } from './types';

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

function AppContent({
  hasProvider,
  apiBaseUrl,
  authProvider,
}: {
  hasProvider: boolean;
  apiBaseUrl: string;
  authProvider?: AuthProviderInterface;
}) {
  const { permissions, isAuthenticated, isReady, login, logout } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
  };

  const apiClient = useMemo(
    () => new ApiClient({ baseUrl: apiBaseUrl, authProvider }),
    [apiBaseUrl, authProvider],
  );

  useEffect(() => {
    if (!isReady) return;

    let isMounted = true;

    const loadCampaigns = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<ApiCampaignResponse>(
          '/wp-json/wp-super-gallery/v1/campaigns',
        );
        const items = response.items ?? [];

        const mapped = await Promise.all(
          items.map(async (item) => {
            let mediaItems: MediaItem[] = [];
            if (isAuthenticated) {
              try {
                mediaItems = await apiClient.get<MediaItem[]>(
                  `/wp-json/wp-super-gallery/v1/campaigns/${item.id}/media`,
                );
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

        if (isMounted) {
          setCampaigns(mapped);
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiError && err.status === 401) {
            void logout();
            setError('Session expired. Please sign in again.');
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load campaigns');
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCampaigns();

    return () => {
      isMounted = false;
    };
  }, [apiClient, isAuthenticated, isReady]);

  return (
    <div className="wp-super-gallery">
      {hasProvider && !isAuthenticated && isReady && (
        <LoginForm onSubmit={handleLogin} />
      )}
      {error && (
        <div className="wp-super-gallery__error">{error}</div>
      )}
      {isLoading ? (
        <div className="wp-super-gallery__loading">Loading campaigns...</div>
      ) : (
        <CardGallery
          campaigns={campaigns}
          userPermissions={permissions}
        />
      )}
    </div>
  );
}

function App() {
  const apiBaseUrl = window.__WPSG_API_BASE__ ?? window.location.origin;
  const provider = useMemo(() => getAuthProvider(apiBaseUrl), [apiBaseUrl]);
  const hasProvider = Boolean(provider);
  const fallbackPermissions = hasProvider ? [] : [];

  return (
    <AuthProvider provider={provider} fallbackPermissions={fallbackPermissions}>
      <AppContent hasProvider={hasProvider} apiBaseUrl={apiBaseUrl} authProvider={provider} />
    </AuthProvider>
  );
}

export default App;
