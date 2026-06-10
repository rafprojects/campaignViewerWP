import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Container, Group, Button, Tooltip, ActionIcon, Text, Menu } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconSettings, IconLogout, IconDashboard, IconDotsVertical } from '@tabler/icons-react';
import type { GalleryBehaviorSettings } from '@/types';
import { getWpsgDebugProps } from '@/utils/wpsgDebug';
import { useCampaignContext } from '@/contexts/CampaignContext';
import { AuthBarFloating } from './AuthBarFloating';
import { AuthBarMinimal } from './AuthBarMinimal';
import { SpaceSwitcher } from './SpaceSwitcher';
import { spaceColor } from '@/utils/spaceColor';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface AuthBarProps {
  email: string;
  isAdmin: boolean;
  isAuthenticated?: boolean | undefined;
  appMaxWidth?: number | undefined;
  appPadding?: number | undefined;
  displayMode?: GalleryBehaviorSettings['authBarDisplayMode'] | undefined;
  dragMargin?: number | undefined;
  onOpenAdminPanel: () => void;
  onOpenSettings: () => void;
  onOpenSignIn?: (() => void) | undefined;
  onLogout: () => void;
  /** P48-I: stable instance ID used by SpaceSwitcher to identify this gallery. */
  instanceId?: string | undefined;
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
  instanceId,
}: AuthBarProps) {
  const { activeCampaign, onEditCampaign, onEditGalleryConfig, onArchiveCampaign, onAddExternalMedia } = useCampaignContext();

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
        activeCampaign={activeCampaign}
        onEditCampaign={onEditCampaign}
        onEditGalleryConfig={onEditGalleryConfig}
        onArchiveCampaign={onArchiveCampaign}
        onAddExternalMedia={onAddExternalMedia}
        instanceId={instanceId}
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
        activeCampaign={activeCampaign}
        onEditCampaign={onEditCampaign}
        onEditGalleryConfig={onEditGalleryConfig}
        onArchiveCampaign={onArchiveCampaign}
        onAddExternalMedia={onAddExternalMedia}
        instanceId={instanceId}
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
        instanceId={instanceId}
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
      instanceId={instanceId}
    />
  );
}

setWpsgDebugDisplayName(AuthBar, 'AuthBar');

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
  instanceId,
}: Omit<AuthBarProps, 'displayMode' | 'dragMargin'> & { autoHide?: boolean }) {
  const [activeInstanceId, setActiveInstanceId] = useState(instanceId);
  const color = instanceId ? spaceColor(activeInstanceId ?? instanceId) : undefined;

  const callOpener = useCallback((id: string, panel: 'settings' | 'admin') => {
    const opener = (window as unknown as Record<string, unknown>)[`__wpsgOpen_${id}`];
    if (typeof opener === 'function') (opener as (p: string) => void)(panel);
  }, []);

  const handleOpenAdmin = useCallback(() => {
    if (activeInstanceId && activeInstanceId !== instanceId) callOpener(activeInstanceId, 'admin');
    else onOpenAdminPanel();
  }, [activeInstanceId, instanceId, onOpenAdminPanel, callOpener]);

  const handleOpenSettings = useCallback(() => {
    if (activeInstanceId && activeInstanceId !== instanceId) callOpener(activeInstanceId, 'settings');
    else onOpenSettings();
  }, [activeInstanceId, instanceId, onOpenSettings, callOpener]);

  const hidden = useScrollDirection();
  const shouldHide = autoHide && hidden;
  const isMobile = useMediaQuery('(max-width: 36em)'); // ≤ 576px
  const containerSize = appMaxWidth && appMaxWidth > 0 ? appMaxWidth : undefined;
  const containerFluid = !appMaxWidth || appMaxWidth === 0;
  const containerPaddingStyle = appPadding != null ? { paddingInline: appPadding } : undefined;

  return (
    <Box
      {...getWpsgDebugProps('AuthBar')}
      component="nav"
      aria-label="User navigation"
      style={{
        position: 'sticky',
        top: 'var(--wp-admin--admin-bar--height, 0px)',
        zIndex: 'var(--z-header, 100)',
        background: 'color-mix(in srgb, var(--mantine-color-body) 92%, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--mantine-color-default-border)',
        transform: shouldHide ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.3s ease',
      }}
    >
      <Container {...getWpsgDebugProps('AuthBar', 'container')} {...(containerSize !== undefined ? { size: containerSize } : {})} fluid={containerFluid} py="sm" style={containerPaddingStyle}>
        <Group {...getWpsgDebugProps('AuthBar', 'content')} justify="space-between" wrap="nowrap" gap="sm">
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
                <Menu shadow="md" width={200} position="bottom-end" withArrow
                  styles={{ dropdown: color ? { borderColor: `var(--mantine-color-${color}-5)` } : {} }}
                >
                  <Menu.Target>
                    <ActionIcon {...getWpsgDebugProps('AuthBar', 'menu-trigger')} variant="default" size="lg" aria-label="User menu">
                      <IconDotsVertical size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown {...getWpsgDebugProps('AuthBar', 'menu-dropdown')}>
                    {isAdmin && (
                      <>
                        <Menu.Item leftSection={<IconDashboard size={16} />} onClick={handleOpenAdmin}>
                          Admin Panel
                        </Menu.Item>
                        <Menu.Item leftSection={<IconSettings size={16} />} onClick={handleOpenSettings}>
                          Settings
                        </Menu.Item>
                        {instanceId && (
                          <Menu.Item component="div" style={{ padding: '4px 8px' }}>
                            <SpaceSwitcher
                              activeInstanceId={activeInstanceId ?? instanceId}
                              onSelect={setActiveInstanceId}
                            />
                          </Menu.Item>
                        )}
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
                <Group {...getWpsgDebugProps('AuthBar', 'desktop-actions')} gap="sm" wrap="nowrap">
                  {isAdmin && (
                    <>
                      <Button
                        variant="default"
                        onClick={handleOpenAdmin}
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
                          onClick={handleOpenSettings}
                          aria-label="Settings"
                        >
                          <IconSettings size={20} />
                        </ActionIcon>
                      </Tooltip>
                      {instanceId && (
                        <SpaceSwitcher
                          activeInstanceId={activeInstanceId ?? instanceId}
                          onSelect={setActiveInstanceId}
                        />
                      )}
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

setWpsgDebugDisplayName(AuthBarFull, 'AuthBarFull');