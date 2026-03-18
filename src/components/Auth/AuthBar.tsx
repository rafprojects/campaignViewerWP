import { useEffect, useRef, useState } from 'react';
import { Box, Container, Group, Button, Tooltip, ActionIcon, Text, Menu } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconSettings, IconLogout, IconDashboard, IconDotsVertical } from '@tabler/icons-react';
import type { GalleryBehaviorSettings } from '@/types';
import { AuthBarFloating } from './AuthBarFloating';
import { AuthBarMinimal } from './AuthBarMinimal';

interface AuthBarProps {
  email: string;
  isAdmin: boolean;
  isAuthenticated?: boolean;
  appMaxWidth?: number;
  appPadding?: number;
  displayMode?: GalleryBehaviorSettings['authBarDisplayMode'];
  dragMargin?: number;
  onOpenAdminPanel: () => void;
  onOpenSettings: () => void;
  onOpenSignIn?: () => void;
  onLogout: () => void;
}

/** Detect scroll direction for auto-hide mode. */
function useScrollDirection() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > lastY.current && y > 80);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return hidden;
}

export function AuthBar({
  email,
  isAdmin,
  isAuthenticated = true,
  appMaxWidth,
  appPadding,
  displayMode = 'floating',
  dragMargin = 16,
  onOpenAdminPanel,
  onOpenSettings,
  onOpenSignIn,
  onLogout,
}: AuthBarProps) {
  // Route to the appropriate sub-component based on mode
  if (displayMode === 'floating') {
    return (
      <AuthBarFloating
        email={email}
        isAdmin={isAdmin}
        isAuthenticated={isAuthenticated}
        onOpenAdminPanel={onOpenAdminPanel}
        onOpenSettings={onOpenSettings}
        onOpenSignIn={onOpenSignIn}
        onLogout={onLogout}
      />
    );
  }

  if (displayMode === 'draggable') {
    return (
      <AuthBarFloating
        email={email}
        isAdmin={isAdmin}
        isAuthenticated={isAuthenticated}
        draggable
        dragMargin={dragMargin}
        onOpenAdminPanel={onOpenAdminPanel}
        onOpenSettings={onOpenSettings}
        onOpenSignIn={onOpenSignIn}
        onLogout={onLogout}
      />
    );
  }

  if (displayMode === 'minimal') {
    return (
      <AuthBarMinimal
        email={email}
        isAdmin={isAdmin}
        isAuthenticated={isAuthenticated}
        appMaxWidth={appMaxWidth}
        appPadding={appPadding}
        onOpenAdminPanel={onOpenAdminPanel}
        onOpenSettings={onOpenSettings}
        onOpenSignIn={onOpenSignIn}
        onLogout={onLogout}
      />
    );
  }

  // 'bar' and 'auto-hide' both render the full bar
  return (
    <AuthBarFull
      email={email}
      isAdmin={isAdmin}
      isAuthenticated={isAuthenticated}
      appMaxWidth={appMaxWidth}
      appPadding={appPadding}
      autoHide={displayMode === 'auto-hide'}
      onOpenAdminPanel={onOpenAdminPanel}
      onOpenSettings={onOpenSettings}
      onOpenSignIn={onOpenSignIn}
      onLogout={onLogout}
    />
  );
}

/** The original full-width bar, with optional auto-hide behavior. */
function AuthBarFull({
  email,
  isAdmin,
  isAuthenticated = true,
  appMaxWidth,
  appPadding,
  autoHide = false,
  onOpenAdminPanel,
  onOpenSettings,
  onOpenSignIn,
  onLogout,
}: Omit<AuthBarProps, 'displayMode' | 'dragMargin'> & { autoHide?: boolean }) {
  const hidden = useScrollDirection();
  const shouldHide = autoHide && hidden;
  const isMobile = useMediaQuery('(max-width: 36em)'); // ≤ 576px
  const containerSize = appMaxWidth && appMaxWidth > 0 ? appMaxWidth : undefined;
  const containerFluid = !appMaxWidth || appMaxWidth === 0;
  const containerPaddingStyle = appPadding != null ? { paddingInline: appPadding } : undefined;

  return (
    <Box
      component="nav"
      aria-label="User navigation"
      style={{
        position: 'sticky',
        top: 'var(--wp-admin--admin-bar--height, 0px)',
        zIndex: 'var(--z-header, 100)',
        background: 'color-mix(in srgb, var(--wpsg-color-surface) 92%, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--wpsg-color-border)',
        transform: shouldHide ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.3s ease',
      }}
    >
    <Container size={containerSize} fluid={containerFluid} py="sm" style={containerPaddingStyle}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        {!isAuthenticated ? (
          <>
            <Text size="sm" c="dimmed">Sign in to access private campaigns</Text>
            <Button variant="light" size="sm" onClick={onOpenSignIn}>Sign in</Button>
          </>
        ) : (
        <>
        <Text size="sm" truncate style={{ minWidth: 0 }}>
          Signed in as {email}
        </Text>

        {isMobile ? (
          /* ── Mobile: single overflow menu ── */
          <Menu shadow="md" width={200} position="bottom-end" withArrow>
            <Menu.Target>
              <ActionIcon variant="default" size="lg" aria-label="User menu">
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {isAdmin && (
                <>
                  <Menu.Item leftSection={<IconDashboard size={16} />} onClick={onOpenAdminPanel}>
                    Admin Panel
                  </Menu.Item>
                  <Menu.Item leftSection={<IconSettings size={16} />} onClick={onOpenSettings}>
                    Settings
                  </Menu.Item>
                  <Menu.Divider />
                </>
              )}
              <Menu.Item leftSection={<IconLogout size={16} />} onClick={onLogout} color="red">
                Sign out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          /* ── Desktop: inline controls ── */
          <Group gap="sm" wrap="nowrap">
            {isAdmin && (
              <>
                <Button
                  variant="default"
                  onClick={onOpenAdminPanel}
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
                    onClick={onOpenSettings}
                    aria-label="Settings"
                  >
                    <IconSettings size={20} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
            <Button
              variant="subtle"
              onClick={onLogout}
              size="sm"
            >
              Sign out
            </Button>
          </Group>
        )}
        </>)}
      </Group>
    </Container>
    </Box>
  );
}
