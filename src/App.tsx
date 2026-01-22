import { CardGallery } from './components/Gallery/CardGallery';
import { mockCampaigns, mockUserPermissions } from './data/mockData';
import { AuthProvider } from './contexts/AuthContext';
import { WpJwtProvider } from './services/auth/WpJwtProvider';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/Auth/LoginForm';

const getAuthProvider = () => {
  if (window.__WPSG_AUTH_PROVIDER__ === 'wp-jwt') {
    const apiBaseUrl = window.__WPSG_API_BASE__ ?? window.location.origin;
    return new WpJwtProvider({ apiBaseUrl });
  }
  return undefined;
};

function AppContent({ hasProvider }: { hasProvider: boolean }) {
  const { permissions, isAuthenticated, isReady, login } = useAuth();

  return (
    <div className="wp-super-gallery">
      {hasProvider && !isAuthenticated && isReady && (
        <LoginForm onSubmit={login} />
      )}
      <CardGallery
        campaigns={mockCampaigns}
        userPermissions={permissions}
      />
    </div>
  );
}

function App() {
  const provider = getAuthProvider();
  const hasProvider = Boolean(provider);
  const fallbackPermissions = hasProvider ? [] : mockUserPermissions;

  return (
    <AuthProvider provider={provider} fallbackPermissions={fallbackPermissions}>
      <AppContent hasProvider={hasProvider} />
    </AuthProvider>
  );
}

export default App;
