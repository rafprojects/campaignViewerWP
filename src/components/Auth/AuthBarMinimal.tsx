import { useState, useCallback } from 'react';
import { Box, Container, Group, Text, Menu, ActionIcon } from '@mantine/core';
import { IconUser, IconSettings, IconLogout, IconDashboard, IconChevronDown, IconLogin } from '@tabler/icons-react';
import { SpaceSwitcher } from './SpaceSwitcher';
import { spaceColor } from '@/utils/spaceColor';

interface AuthBarMinimalProps {
  email: string;
  isAdmin: boolean;
  isAuthenticated?: boolean | undefined;
  appMaxWidth?: number | undefined;
  appPadding?: number | undefined;
  onOpenAdminPanel: () => void;
  onOpenSettings: () => void;
  onOpenSignIn?: (() => void) | undefined;
  onLogout: () => void;
  instanceId?: string | undefined;
}

function callOpener(instanceId: string, panel: 'settings' | 'admin') {
  const opener = (window as unknown as Record<string, unknown>)[`__wpsgOpen_${instanceId}`];
  if (typeof opener === 'function') (opener as (p: string) => void)(panel);
}

export function AuthBarMinimal({
  email,
  isAdmin,
  isAuthenticated = true,
  appMaxWidth,
  appPadding,
  onOpenAdminPanel,
  onOpenSettings,
  onOpenSignIn,
  onLogout,
  instanceId,
}: AuthBarMinimalProps) {
  const [activeInstanceId, setActiveInstanceId] = useState(instanceId);
  const color = instanceId ? spaceColor(activeInstanceId ?? instanceId) : undefined;

  const handleOpenAdmin = useCallback(() => {
    if (activeInstanceId && activeInstanceId !== instanceId) callOpener(activeInstanceId, 'admin');
    else onOpenAdminPanel();
  }, [activeInstanceId, instanceId, onOpenAdminPanel]);

  const handleOpenSettings = useCallback(() => {
    if (activeInstanceId && activeInstanceId !== instanceId) callOpener(activeInstanceId, 'settings');
    else onOpenSettings();
  }, [activeInstanceId, instanceId, onOpenSettings]);

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
        background: 'color-mix(in srgb, var(--mantine-color-body) 92%, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--mantine-color-default-border)',
        maxHeight: 32,
      }}
    >
      <Container {...(containerSize !== undefined ? { size: containerSize } : {})} fluid={containerFluid} py={4} style={containerPaddingStyle}>
        <Group justify="space-between" wrap="nowrap" gap={4}>
          {!isAuthenticated ? (
            <>
              <Text size="xs" c="dimmed" truncate style={{ minWidth: 0, lineHeight: 1 }}>Sign in</Text>
              <ActionIcon size={22} variant="subtle" onClick={onOpenSignIn} aria-label="Sign in">
                <IconLogin size={14} />
              </ActionIcon>
            </>
          ) : (
            <>
              <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                <ActionIcon size={22} variant="transparent" aria-hidden>
                  <IconUser size={14} />
                </ActionIcon>
                <Text size="xs" truncate style={{ minWidth: 0, lineHeight: 1 }}>{email}</Text>
              </Group>
              <Menu shadow="md" width={200} position="bottom-end" withArrow
                styles={{ dropdown: color ? { borderColor: `var(--mantine-color-${color}-5)` } : {} }}
              >
                <Menu.Target>
                  <ActionIcon variant="subtle" size="sm" aria-label="User menu">
                    <IconChevronDown size={14} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {isAdmin && (
                    <>
                      <Menu.Item leftSection={<IconDashboard size={14} />} onClick={handleOpenAdmin}>
                        Admin Panel
                      </Menu.Item>
                      <Menu.Item leftSection={<IconSettings size={14} />} onClick={handleOpenSettings}>
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
                  <Menu.Item leftSection={<IconLogout size={14} />} onClick={onLogout} color="red">
                    Sign out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </>)}
        </Group>
      </Container>
    </Box>
  );
}

AuthBarMinimal.displayName = 'AuthBarMinimal';
