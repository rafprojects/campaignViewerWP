import { Box, Container, Group, Text, Menu, ActionIcon } from '@mantine/core';
import { IconUser, IconSettings, IconLogout, IconDashboard, IconChevronDown } from '@tabler/icons-react';

interface AuthBarMinimalProps {
  email: string;
  isAdmin: boolean;
  appMaxWidth?: number;
  appPadding?: number;
  onOpenAdminPanel: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function AuthBarMinimal({
  email,
  isAdmin,
  appMaxWidth,
  appPadding,
  onOpenAdminPanel,
  onOpenSettings,
  onLogout,
}: AuthBarMinimalProps) {
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
        maxHeight: 32,
      }}
    >
      <Container size={containerSize} fluid={containerFluid} py={4} style={containerPaddingStyle}>
        <Group justify="space-between" wrap="nowrap" gap={4}>
          <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
            <ActionIcon size={22} variant="transparent" aria-hidden>
              <IconUser size={14} />
            </ActionIcon>
            <Text size="xs" truncate style={{ minWidth: 0, lineHeight: 1 }}>{email}</Text>
          </Group>
          <Menu shadow="md" width={200} position="bottom-end" withArrow>
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm" aria-label="User menu">
                <IconChevronDown size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {isAdmin && (
                <>
                  <Menu.Item leftSection={<IconDashboard size={14} />} onClick={onOpenAdminPanel}>
                    Admin Panel
                  </Menu.Item>
                  <Menu.Item leftSection={<IconSettings size={14} />} onClick={onOpenSettings}>
                    Settings
                  </Menu.Item>
                  <Menu.Divider />
                </>
              )}
              <Menu.Item leftSection={<IconLogout size={14} />} onClick={onLogout} color="red">
                Sign out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Container>
    </Box>
  );
}
