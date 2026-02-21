import { Box, Container, Group, Button, Tooltip, ActionIcon, Text, Menu } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconSettings, IconLogout, IconDashboard, IconDotsVertical } from '@tabler/icons-react';

interface AuthBarProps {
  email: string;
  isAdmin: boolean;
  appMaxWidth?: number;
  onOpenAdminPanel: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function AuthBar({
  email,
  isAdmin,
  appMaxWidth,
  onOpenAdminPanel,
  onOpenSettings,
  onLogout,
}: AuthBarProps) {
  const isMobile = useMediaQuery('(max-width: 36em)'); // ≤ 576px
  const containerSize = appMaxWidth && appMaxWidth > 0 ? appMaxWidth : undefined;
  const containerFluid = !appMaxWidth || appMaxWidth === 0;

  return (
    <Box
      component="nav"
      aria-label="User navigation"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-header, 100)',
        background: 'color-mix(in srgb, var(--wpsg-color-surface) 92%, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--wpsg-color-border)',
      }}
    >
    <Container size={containerSize} fluid={containerFluid} py="sm">
      <Group justify="space-between" wrap="nowrap" gap="sm">
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
      </Group>
    </Container>
    </Box>
  );
}
